import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getActionPath, fileExists } from './utils';
import type { KernelVersion } from './kernel';

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

  if (options.other && options.url) {
    // Validate ksu-url uses HTTPS and comes from trusted GitHub domain
    if (!options.url.startsWith('https://')) {
      throw new Error('ksu-url must use HTTPS');
    }
    const trustedDomains = [
      'github.com',
      'raw.githubusercontent.com',
      'gist.githubusercontent.com',
    ];
    const urlDomain = new URL(options.url).hostname;
    if (!trustedDomains.includes(urlDomain)) {
      throw new Error(`ksu-url must be from trusted GitHub domain: ${trustedDomains.join(', ')}`);
    }
    ksuUrl = `${options.url}/raw/${options.version}/kernel/setup.sh`;
  } else {
    ksuUrl = `https://raw.githubusercontent.com/tiann/KernelSU/main/kernel/setup.sh`;
  }

  core.info(`Downloading KernelSU setup script from: ${ksuUrl}`);
  await exec.exec('curl', ['-sSLf', ksuUrl, '-o', setupScriptPath]);

  // Determine version
  let kver = options.version;
  if (!kernelVersion.isGki && !options.other) {
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

  core.endGroup();
}

/**
 * Setup BBG (BaseBandGuard)
 */
export async function setupBBG(kernelDir: string, configPath: string): Promise<void> {
  core.startGroup('Initializing BBG');

  // Download and run setup script
  await exec.exec('bash', [
    '-c',
    'curl -Ss https://github.com/vc-teahouse/Baseband-guard/raw/main/setup.sh | bash',
  ]);

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
