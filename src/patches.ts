import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getActionPath, fileExists } from './utils';
import type { KernelVersion } from './kernel';

/**
 * Config tweak appended to the defconfig for a specific KernelSU fork.
 */
interface KsuConfigTweak {
  option: string;
  value: string;
  /** Optional kernel-version condition. */
  when?: (kernelVersion: KernelVersion) => boolean;
}

/**
 * Integration strategy for a known third-party KernelSU fork,
 * selected automatically from the ksu-url input.
 */
export interface KsuForkStrategy {
  id: string;
  label: string;
  /**
   * Pinned commit SHA that hosts kernel/setup.sh for raw download.
   * Immutable revisions keep the executed script reproducible; bump the SHA
   * deliberately when picking up upstream changes.
   */
  setupSha: string;
  /** Ref passed to setup.sh when the user did not pin ksu-version. */
  defaultInstallRef: string | ((kernelVersion: KernelVersion) => string);
  /** defconfig tweaks applied after integration. */
  configTweaks: KsuConfigTweak[];
}

function isKernelBelow(version: number, patchlevel: number, kv: KernelVersion): boolean {
  return kv.version < version || (kv.version === version && kv.patchlevel < patchlevel);
}

/**
 * Known forks, keyed by lowercase `owner/repo`.
 * `setupSha` values are pinned commit SHAs of the revision that hosts
 * kernel/setup.sh (KernelSU-Next has no `main` branch; its default branch
 * is `dev`).
 */
const KSU_FORKS: Record<string, KsuForkStrategy> = {
  'backslashxx/kernelsu': {
    id: 'xxksu',
    label: 'KernelSU (xxksu)',
    setupSha: '76fecfc35b1551ef68ca6e46d8a9873c35064d86',
    defaultInstallRef: 'master',
    configTweaks: [{ option: 'CONFIG_KSU_KPROBES_KSUD', value: 'n' }],
  },
  'rsuntk/kernelsu': {
    id: 'rsuntk',
    label: 'KernelSU (rsuntk)',
    setupSha: '648e5988cf421172769f80ce07f86331b548c053',
    defaultInstallRef: 'main',
    configTweaks: [{ option: 'CONFIG_KSU_MANUAL_HOOK', value: 'y' }],
  },
  'sukisu-ultra/sukisu-ultra': {
    id: 'sukisu',
    label: 'SukiSU-Ultra',
    setupSha: '9fbe8fe8ca90c62c259c5894bf96d02ac31209b9',
    defaultInstallRef: 'builtin',
    configTweaks: [],
  },
  'shirkneko/sukisu-ultra': {
    id: 'sukisu',
    label: 'SukiSU-Ultra',
    setupSha: '9fbe8fe8ca90c62c259c5894bf96d02ac31209b9',
    defaultInstallRef: 'builtin',
    configTweaks: [],
  },
  'kernelsu-next/kernelsu-next': {
    id: 'next',
    label: 'KernelSU-Next',
    setupSha: '36aa55c521e509449bfe48bae0ab8c397174c1cb',
    defaultInstallRef: (kv) => (isKernelBelow(5, 10, kv) ? 'legacy' : 'main'),
    configTweaks: [
      { option: 'CONFIG_KSU_MANUAL_HOOK', value: 'y' },
      {
        option: 'CONFIG_KSU_ALLOWLIST_WORKAROUND',
        value: 'y',
        when: (kv) => isKernelBelow(5, 10, kv),
      },
    ],
  },
  'resukisu/resukisu': {
    id: 'resukisu',
    label: 'ReSukiSU',
    setupSha: '9d0ff6aea9e25fc7dd26f4643175a41f68375e5e',
    defaultInstallRef: 'main',
    configTweaks: [{ option: 'CONFIG_KSU_MANUAL_HOOK', value: 'y' }],
  },
};

/** Upstream KernelSU revision pinned for downloading kernel/setup.sh. */
const KSU_UPSTREAM_SHA = '3c1240625655978f319a98398031100b80e9da7c';

/**
 * Detect a known KernelSU fork from a GitHub URL.
 * Accepts `github.com/owner/repo(.git)` and
 * `raw.githubusercontent.com/owner/repo/...` forms.
 */
export function detectKsuFork(url: string): KsuForkStrategy | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const segments = parsed.pathname
    .replace(/\.git$/, '')
    .split('/')
    .filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return undefined;
  }

  const key = `${segments[0]}/${segments[1]}`.toLowerCase();
  return KSU_FORKS[key];
}

/** GitHub domains accepted for the ksu-url input. */
const TRUSTED_KSU_DOMAINS = [
  'github.com',
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
];

/**
 * Validate ksu-url and reduce it to a canonical
 * `https://github.com/<owner>/<repo>` repository base.
 *
 * Accepts repository URLs (with or without a `.git` suffix, optionally
 * followed by `/tree/...` or `/blob/...` paths) as well as
 * `raw.githubusercontent.com` file URLs, so the setup-script URL is always
 * built from the repository base instead of duplicating a file path.
 */
export function normalizeKsuUrl(url: string): string {
  if (!url.startsWith('https://')) {
    throw new Error('ksu-url must use HTTPS');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('ksu-url must be a valid URL');
  }
  if (!TRUSTED_KSU_DOMAINS.includes(parsed.hostname)) {
    throw new Error(
      `ksu-url must be from trusted GitHub domain: ${TRUSTED_KSU_DOMAINS.join(', ')}`
    );
  }
  const segments = parsed.pathname
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .split('/')
    .filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    throw new Error('ksu-url must point to a GitHub repository (owner/repo)');
  }
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

/** Apply fork-specific defconfig tweaks. */
function applyKsuForkTweaks(
  fork: KsuForkStrategy,
  configPath: string,
  kernelVersion: KernelVersion
): void {
  for (const tweak of fork.configTweaks) {
    if (tweak.when && !tweak.when(kernelVersion)) {
      continue;
    }
    fs.appendFileSync(configPath, `${tweak.option}=${tweak.value}\n`);
    core.info(`Applied ${fork.label} tweak: ${tweak.option}=${tweak.value}`);
  }
}

/**
 * Setup KernelSU
 */
export async function setupKernelSU(
  kernelDir: string,
  configPath: string,
  options: {
    version: string;
    lkm: boolean;
    other: boolean;
    url?: string;
  },
  kernelVersion: KernelVersion
): Promise<void> {
  core.startGroup('Initializing KernelSU');

  // Display kernel version and GKI status
  core.info(
    `Kernel version: ${kernelVersion.version}.${kernelVersion.patchlevel}.${kernelVersion.sublevel}`
  );
  core.info(`GKI: ${kernelVersion.isGki}`);

  const ksuDir = path.join(kernelDir, 'KernelSU', 'kernel');

  // Check if KernelSU is already initialized
  if (fileExists(path.join(ksuDir, 'Kconfig'))) {
    core.info('KernelSU has been initialized, skipping.');
    core.endGroup();
    return;
  }

  // Download setup script
  const setupScriptPath = path.join(kernelDir, 'ksu_setup.sh');
  let ksuUrl: string;
  let forkStrategy: KsuForkStrategy | undefined;
  let versionPinned = false;

  if (options.other && options.url) {
    // Validate ksu-url and reduce it to a canonical repository base URL.
    const repoUrl = normalizeKsuUrl(options.url);

    forkStrategy = detectKsuFork(repoUrl);
    // 'main' is the ksu-version default, treat it as "not pinned"
    versionPinned = options.version !== '' && options.version !== 'main';

    if (forkStrategy) {
      core.info(`Detected known KernelSU fork: ${forkStrategy.label}`);
      const setupRef = versionPinned ? options.version : forkStrategy.setupSha;
      ksuUrl = `${repoUrl}/raw/${setupRef}/kernel/setup.sh`;
    } else {
      core.warning(
        `ksu-url does not match a known KernelSU fork (${Object.keys(KSU_FORKS).join(', ')}); ` +
          'falling back to generic integration without fork-specific tweaks'
      );
      ksuUrl = `${repoUrl}/raw/${options.version}/kernel/setup.sh`;
    }
  } else {
    ksuUrl = `https://raw.githubusercontent.com/tiann/KernelSU/${KSU_UPSTREAM_SHA}/kernel/setup.sh`;
  }

  core.info(`Downloading KernelSU setup script from: ${ksuUrl}`);
  await exec.exec('curl', ['-sSLf', ksuUrl, '-o', setupScriptPath]);

  // Determine version
  let kver = options.version;
  if (options.other && forkStrategy && !versionPinned) {
    kver =
      typeof forkStrategy.defaultInstallRef === 'function'
        ? forkStrategy.defaultInstallRef(kernelVersion)
        : forkStrategy.defaultInstallRef;
    core.info(`${forkStrategy.label}: using default ref '${kver}' (pin ksu-version to override)`);
  } else if (!kernelVersion.isGki && !options.other) {
    core.warning(`Warning: KernelSU has dropped support for non-GKI kernels since 0.9.5.`);
    core.info('Forcing switch to v0.9.5');
    kver = 'v0.9.5';
  }

  // Run setup script (use relative path since cwd is set to kernelDir)
  await exec.exec('bash', ['ksu_setup.sh', kver], { cwd: kernelDir });

  // Handle LKM mode
  if (options.lkm) {
    const hasKprobes = isConfigEnabled(configPath, 'CONFIG_KPROBES');
    if (hasKprobes) {
      sedReplace(configPath, 'CONFIG_KSU=y', 'CONFIG_KSU=m');
    } else {
      // Modify Kconfig
      const kconfigPath = path.join(kernelDir, 'drivers', 'kernelsu', 'Kconfig');
      if (fileExists(kconfigPath)) {
        sedReplaceInRange(kconfigPath, 'config KSU', 'help', 'default y', 'default m');
      }
    }
  } else if (!kernelVersion.isGki) {
    // Apply patches for non-GKI kernels
    const hasKprobes = isConfigEnabled(configPath, 'CONFIG_KPROBES');
    if (!hasKprobes) {
      core.info('CONFIG_KPROBES not enabled, applying KernelSU patches...');

      // Setup opam and coccinelle
      await exec.exec('opam', ['init', '--disable-sandboxing', '--yes']);

      // Install coccinelle with opam environment evaluated
      await exec.exec('bash', ['-c', 'eval $(opam env) && opam install --yes coccinelle']);

      // Apply patches with opam environment evaluated
      const applyCocciPath = path.join(getActionPath(), 'kernelsu', 'apply_cocci.py');
      const cocciDir = path.join(getActionPath(), 'kernelsu');
      try {
        await exec.exec(
          'bash',
          ['-c', `eval $(opam env) && python3 ${applyCocciPath} --cocci-dir ${cocciDir}`],
          {
            cwd: kernelDir,
          }
        );
      } catch {
        core.warning('Failed to apply KernelSU patches');
      }
    }
  }

  // Apply fork-specific defconfig tweaks
  if (forkStrategy) {
    applyKsuForkTweaks(forkStrategy, configPath, kernelVersion);
  }

  core.endGroup();
}

/**
 * Setup BBG (BaseBandGuard)
 */
export async function setupBBG(
  kernelDir: string,
  configPath: string,
  options?: {
    blockBoot?: boolean;
  }
): Promise<void> {
  core.startGroup('Initializing BBG');

  // Download and run setup script
  const bbgSetupPath = path.join(kernelDir, 'bbg_setup.sh');
  await exec.exec('curl', [
    '-sSLf',
    'https://github.com/vc-teahouse/Baseband-guard/raw/main/setup.sh',
    '-o',
    bbgSetupPath,
  ]);
  await exec.exec('bash', [bbgSetupPath], { cwd: kernelDir });

  // Modify Kconfig
  const kconfigPath = path.join(kernelDir, 'security', 'Kconfig');
  if (fileExists(kconfigPath)) {
    let content = fs.readFileSync(kconfigPath, 'utf-8');

    // Add baseband_guard to LSM default
    const lsmRegex = /(config LSM[\s\S]*?default[\s\S]*?lockdown)([^,]*)/;
    if (lsmRegex.test(content) && !content.includes('baseband_guard')) {
      content = content.replace(lsmRegex, '$1,baseband_guard$2');
      fs.writeFileSync(kconfigPath, content);
    }
  }

  // Add to config
  fs.appendFileSync(configPath, 'CONFIG_BBG=y\n');

  // Optionally protect the boot partition against direct writes
  if (options?.blockBoot) {
    fs.appendFileSync(configPath, 'CONFIG_BBG_BLOCK_BOOT=y\n');
    core.info('Enabled CONFIG_BBG_BLOCK_BOOT');
  }

  core.endGroup();
}

/**
 * Setup NoMount (https://github.com/maxsteeel/nomount)
 */
export async function setupNoMount(kernelDir: string, configPath: string): Promise<void> {
  core.startGroup('Initializing NoMount');

  // Download and run upstream setup script (pinned to an immutable revision)
  const nomountSetupPath = path.join(kernelDir, 'nomount_setup.sh');
  await exec.exec('curl', [
    '-sSLf',
    'https://github.com/maxsteeel/nomount/raw/2d3863b036d69fd587585ee0cdde2560d983beb8/kernel/setup.sh',
    '-o',
    nomountSetupPath,
  ]);
  await exec.exec('bash', [nomountSetupPath], { cwd: kernelDir });

  // Add to config
  fs.appendFileSync(configPath, 'CONFIG_NOMOUNT=y\n');

  core.endGroup();
}

/**
 * Setup Re-Kernel
 */
export async function setupReKernel(
  kernelDir: string,
  configPath: string,
  arch: string
): Promise<void> {
  core.startGroup('Initializing Re-Kernel');

  const patchScript = path.join(getActionPath(), 'rekernel', 'patch.py');
  await exec.exec('python3', [patchScript, '--config', configPath, '--arch', arch], {
    cwd: kernelDir,
  });

  core.endGroup();
}

/**
 * Setup NetHunter
 */
export async function setupNetHunter(
  kernelDir: string,
  configPath: string,
  options: {
    patch: boolean;
  }
): Promise<void> {
  core.startGroup('Initializing Kali NetHunter');

  // Run config script
  const configScript = path.join(getActionPath(), 'config.py');
  await exec.exec('python3', [configScript, '--type', 'nethunter', configPath, '-w']);

  // Apply patches if requested
  if (options.patch) {
    const patchScript = path.join(getActionPath(), 'nethunter', 'patch.py');
    await exec.exec('python3', [patchScript], { cwd: kernelDir });
  }

  core.endGroup();
}

/**
 * Setup LXC
 */
export async function setupLXC(
  kernelDir: string,
  configPath: string,
  options: {
    patch: boolean;
  }
): Promise<void> {
  core.startGroup('Enabling LXC');

  // Run config script
  const configScript = path.join(getActionPath(), 'config.py');
  await exec.exec('python3', [configScript, '--type', 'lxc', configPath, '-w']);

  // Apply patches if requested
  if (options.patch) {
    const patchScript = path.join(getActionPath(), 'lxc', 'patch_cocci.py');
    const cocciDir = path.join(getActionPath(), 'lxc');
    await exec.exec('python3', [patchScript, '--cocci-dir', cocciDir], { cwd: kernelDir });
  }

  core.endGroup();
}

/**
 * Check if config option is enabled
 */
function isConfigEnabled(configPath: string, option: string): boolean {
  if (!fileExists(configPath)) {
    return false;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const regex = new RegExp(`^${option}=y$`, 'm');
  return regex.test(content);
}

/**
 * Simple sed replace
 */
function sedReplace(filePath: string, search: string, replace: string): void {
  if (!fileExists(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(new RegExp(search, 'g'), replace);
  fs.writeFileSync(filePath, content);
}

/**
 * Sed replace within range
 */
function sedReplaceInRange(
  filePath: string,
  startPattern: string,
  endPattern: string,
  search: string,
  replace: string
): void {
  if (!fileExists(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let inRange = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startPattern)) {
      inRange = true;
    }
    if (inRange && lines[i].includes(endPattern)) {
      inRange = false;
    }
    if (inRange && lines[i].includes(search)) {
      lines[i] = lines[i].replace(search, replace);
    }
  }

  fs.writeFileSync(filePath, lines.join('\n'));
}
