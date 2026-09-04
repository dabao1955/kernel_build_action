import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupKernelSU,
  setupBBG,
  setupReKernel,
  setupNetHunter,
  setupLXC,
  setupNoMount,
  detectKsuFork,
} from '../src/patches';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.statSync).mockReturnValue({
    isDirectory: () => false,
    isFile: () => true,
  } as fs.Stats);
});

describe('setupKernelSU', () => {
  const kernelVersion = { version: 5, patchlevel: 15, sublevel: 100, isGki: true };

  it('skips setup when KernelSU is already initialized', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: false,
      other: false,
    }, kernelVersion);

    expect(core.info).toHaveBeenCalledWith('KernelSU has been initialized, skipping.');
    expect(exec.exec).not.toHaveBeenCalledWith('curl', expect.any(Array));
  });

  it('downloads and runs setup script', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: false,
      other: false,
    }, kernelVersion);

    expect(exec.exec).toHaveBeenCalledWith('curl', expect.arrayContaining([
      '-sSLf',
      expect.stringContaining('setup.sh'),
      '-o',
      expect.stringContaining('ksu_setup.sh'),
    ]));
  });

  it('forces v0.9.5 for non-GKI kernels', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const nonGkiVersion = { version: 5, patchlevel: 4, sublevel: 0, isGki: false };

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'main',
      lkm: false,
      other: false,
    }, nonGkiVersion);

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('KernelSU has dropped support'));
    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining(['ksu_setup.sh', 'v0.9.5']),
      expect.any(Object)
    );
  });

  it('throws error for non-HTTPS custom URL', async () => {
    await expect(setupKernelSU('/kernel', '/kernel/.config', {
      version: 'main',
      lkm: false,
      other: true,
      url: 'http://example.com/setup.sh',
    }, kernelVersion)).rejects.toThrow('ksu-url must use HTTPS');
  });

  it('throws error for untrusted domain', async () => {
    await expect(setupKernelSU('/kernel', '/kernel/.config', {
      version: 'main',
      lkm: false,
      other: true,
      url: 'https://untrusted.com/setup.sh',
    }, kernelVersion)).rejects.toThrow('ksu-url must be from trusted GitHub domain');
  });

  it('throws error when ksu-url does not point to a repository', async () => {
    await expect(setupKernelSU('/kernel', '/kernel/.config', {
      version: 'main',
      lkm: false,
      other: true,
      url: 'https://github.com/owner',
    }, kernelVersion)).rejects.toThrow('must point to a GitHub repository');
  });

  it('accepts trusted GitHub domains', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const trustedDomains = [
      'https://github.com/user/repo',
      'https://raw.githubusercontent.com/user/repo',
      'https://gist.githubusercontent.com/user/gist',
    ];

    for (const url of trustedDomains) {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(exec.exec).mockResolvedValue(0);

      await expect(setupKernelSU('/kernel', '/kernel/.config', {
        version: 'main',
        lkm: false,
        other: true,
        url,
      }, kernelVersion)).resolves.not.toThrow();
    }
  });

  it('modifies config for LKM mode with kprobes', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('.config')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('CONFIG_KPROBES=y\nCONFIG_KSU=y');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,
      other: false,
    }, kernelVersion);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/kernel/.config',
      expect.stringContaining('CONFIG_KSU=m')
    );
  });

  it('modifies Kconfig for LKM mode without kprobes', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('.config')) return true;
      if (path.includes('drivers/kernelsu/Kconfig')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('drivers/kernelsu/Kconfig')) {
        return 'config KSU\n\ttristate "KernelSU"\n\tdefault y\n\thelp\n\t  Help text';
      }
      return '';
    });
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    } as fs.Stats);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,
      other: false,
    }, kernelVersion);

    // Kconfig should be modified with default m instead of default y
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('applies patches for non-GKI kernel without kprobes', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('.config')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('CONFIG_KPROBES=n');
    vi.mocked(exec.exec).mockResolvedValue(0);

    const nonGkiVersion = { version: 5, patchlevel: 4, sublevel: 0, isGki: false };

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: false,
      other: false,
    }, nonGkiVersion);

    expect(exec.exec).toHaveBeenCalledWith('opam', ['init', '--disable-sandboxing', '--yes']);
    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining(['-c', expect.stringContaining('coccinelle')])
    );
  });

  it('warns when KernelSU patches fail to apply', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      if (String(p).includes('.config')) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('CONFIG_KPROBES=n');
    // All exec calls succeed except apply_cocci.py which throws
    vi.mocked(exec.exec).mockImplementation(async (cmd, args) => {
      // Check if this is the apply_cocci.py call
      if (cmd === 'bash' && args?.[1]?.includes('apply_cocci.py')) {
        throw new Error('Patch application failed');
      }
      return 0; // All other commands succeed
    });

    const nonGkiVersion = { version: 5, patchlevel: 4, sublevel: 0, isGki: false };

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: false,
      other: false,
    }, nonGkiVersion);

    expect(core.warning).toHaveBeenCalledWith('Failed to apply KernelSU patches');
  });

  // Coverage: sedReplace with non-existent file (Lines 226-227)
  it('handles sedReplace when config file does not exist', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Return false for config file to trigger early return in sedReplace
      if (path.includes('.config')) return false;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('CONFIG_KPROBES=y');
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,  // LKM mode triggers sedReplace
      other: false,
    }, kernelVersion);

    // Should complete without error even when config file doesn't exist
    expect(result).toBeUndefined();
  });

  // Coverage: sedReplaceInRange with non-existent file (Lines 245-246)
  it('handles sedReplaceInRange when Kconfig file does not exist', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Return true for .config but false for Kconfig
      if (path.includes('.config')) return true;
      if (path.includes('Kconfig')) return false;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('.config')) return 'CONFIG_KPROBES=n';  // No kprobes
      return '';
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,  // LKM mode triggers sedReplaceInRange when no kprobes
      other: false,
    }, kernelVersion);

    // Should complete without error even when Kconfig file doesn't exist
    expect(result).toBeUndefined();
  });

  // Coverage: sedReplace with existing file (Lines 226-227)
  it('handles sedReplace when file exists', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Return false for KernelSU dir (so setup runs)
      if (path.includes('KernelSU/kernel/Kconfig')) return false;
      // Return true for config file
      if (path.includes('.config')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    } as fs.Stats);
    // CONFIG_KPROBES=y so hasKprobes is true, triggering sedReplace
    vi.mocked(fs.readFileSync).mockReturnValue('CONFIG_KSU=y\nCONFIG_KPROBES=y');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,  // LKM mode triggers sedReplace when hasKprobes is true
      other: false,
    }, kernelVersion);

    // Verify writeFileSync was called (sedReplace executed)
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  // Coverage: sedReplaceInRange with existing file (Lines 245-246)
  it('handles sedReplaceInRange when file exists', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Return false for KernelSU dir (so setup runs)
      if (path.includes('KernelSU/kernel/Kconfig')) return false;
      // Return true for both config and Kconfig files
      if (path.includes('.config')) return true;
      if (path.includes('Kconfig')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
    } as fs.Stats);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('.config')) return 'CONFIG_KPROBES=n';  // No kprobes
      if (path.includes('Kconfig')) {
        return 'config KSU\n\tbool "KernelSU"\n\tdefault y\n\thelp\n\t  KernelSU module';
      }
      return '';
    });
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU('/kernel', '/kernel/.config', {
      version: 'v0.9.5',
      lkm: true,  // LKM mode triggers sedReplaceInRange when no kprobes
      other: false,
    }, kernelVersion);

    // Verify writeFileSync was called (sedReplaceInRange executed)
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});

describe('setupBBG', () => {
  it('downloads and runs BBG setup script', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('config LSM\n\tdefault yama,loadpin,integrity,selinux,smack,tomoyo,apparmor');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    expect(exec.exec).toHaveBeenCalledWith('curl', expect.arrayContaining([
      '-sSLf',
      expect.stringContaining('Baseband-guard'),
      '-o',
      expect.stringContaining('bbg_setup.sh'),
    ]));
    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining([expect.stringContaining('bbg_setup.sh')]),
      expect.objectContaining({ cwd: '/kernel' })
    );
  });

  it('modifies Kconfig to add baseband_guard to LSM', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Kconfig') || path.includes('.config');
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('Kconfig')) {
        // Return content that matches the regex: config LSM...default...lockdown
        return 'config LSM\n\tstring "Linux Security Module"\n\tdefault "lockdown,yama"\n\thelp';
      }
      return '';
    });
    vi.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
      isFile: () => true,
    } as fs.Stats);
    const writeFileMock = vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    expect(writeFileMock).toHaveBeenCalled();
    const callArg = writeFileMock.mock.calls[0][1] as string;
    expect(callArg).toContain('baseband_guard');
  });

  it('handles missing Kconfig file gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    // Should not throw and should still append CONFIG_BBG
    expect(fs.appendFileSync).toHaveBeenCalledWith('/kernel/.config', 'CONFIG_BBG=y\n');
  });

  it('appends CONFIG_BBG=y to config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.appendFileSync).mockImplementation((path, content) => {
      expect(content).toBe('CONFIG_BBG=y\n');
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    expect(fs.appendFileSync).toHaveBeenCalledWith('/kernel/.config', 'CONFIG_BBG=y\n');
  });
});

describe('detectKsuFork', () => {
  it('detects known forks from github.com URLs', () => {
    expect(detectKsuFork('https://github.com/SukiSU-Ultra/SukiSU-Ultra')?.id).toBe('sukisu');
    expect(detectKsuFork('https://github.com/backslashxx/KernelSU')?.id).toBe('xxksu');
    expect(detectKsuFork('https://github.com/rsuntk/KernelSU')?.id).toBe('rsuntk');
    expect(detectKsuFork('https://github.com/KernelSU-Next/KernelSU-Next')?.id).toBe('next');
    expect(detectKsuFork('https://github.com/ReSukiSU/ReSukiSU')?.id).toBe('resukisu');
  });

  it('handles .git suffix and raw.githubusercontent.com URLs', () => {
    expect(detectKsuFork('https://github.com/ShirkNeko/SukiSU-Ultra.git')?.id).toBe('sukisu');
    expect(
      detectKsuFork('https://raw.githubusercontent.com/rsuntk/KernelSU/main/kernel/setup.sh')?.id
    ).toBe('rsuntk');
  });

  it('returns undefined for unknown or invalid URLs', () => {
    expect(detectKsuFork('https://github.com/someone/unknown-kernel')).toBeUndefined();
    expect(detectKsuFork('not-a-url')).toBeUndefined();
  });
});

describe('setupKernelSU fork strategies', () => {
  beforeEach(() => {
    // appendFileSync implementations leak across tests in this file
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
  });

  it('uses fork defaults for SukiSU-Ultra when version is not pinned', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU(
      '/kernel',
      '/kernel/.config',
      { version: 'main', lkm: false, other: true, url: 'https://github.com/SukiSU-Ultra/SukiSU-Ultra' },
      { version: 5, patchlevel: 4, sublevel: 100, isGki: false }
    );

    // setup.sh fetched from the fork's pinned immutable revision
    expect(exec.exec).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining([
        '-sSLf',
        expect.stringMatching(
          /^https:\/\/github\.com\/SukiSU-Ultra\/SukiSU-Ultra\/raw\/[0-9a-f]{40}\/kernel\/setup\.sh$/
        ),
        '-o',
        '/kernel/ksu_setup.sh',
      ])
    );
    // install ref falls back to the fork default (builtin)
    expect(exec.exec).toHaveBeenCalledWith('bash', ['ksu_setup.sh', 'builtin'], {
      cwd: '/kernel',
    });
  });

  it('respects a pinned ksu-version over fork defaults', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU(
      '/kernel',
      '/kernel/.config',
      { version: 'v1.0.0', lkm: false, other: true, url: 'https://github.com/KernelSU-Next/KernelSU-Next.git' },
      { version: 5, patchlevel: 15, sublevel: 100, isGki: true }
    );

    expect(exec.exec).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining([
        '-sSLf',
        'https://github.com/KernelSU-Next/KernelSU-Next/raw/v1.0.0/kernel/setup.sh',
        '-o',
        '/kernel/ksu_setup.sh',
      ])
    );
    expect(exec.exec).toHaveBeenCalledWith('bash', ['ksu_setup.sh', 'v1.0.0'], {
      cwd: '/kernel',
    });
  });

  it('switches KernelSU-Next to legacy branch and applies workaround on <5.10 kernels', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU(
      '/kernel',
      '/kernel/.config',
      { version: 'main', lkm: false, other: true, url: 'https://github.com/KernelSU-Next/KernelSU-Next' },
      { version: 4, patchlevel: 9, sublevel: 100, isGki: false }
    );

    expect(exec.exec).toHaveBeenCalledWith('bash', ['ksu_setup.sh', 'legacy'], {
      cwd: '/kernel',
    });
    expect(fs.appendFileSync).toHaveBeenCalledWith('/kernel/.config', 'CONFIG_KSU_MANUAL_HOOK=y\n');
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      '/kernel/.config',
      'CONFIG_KSU_ALLOWLIST_WORKAROUND=y\n'
    );
  });

  it('builds the setup URL from the repository base for file URLs', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    // raw.githubusercontent.com file URL, github.com blob URL and a .git
    // suffix with trailing slash must all reduce to the same repository base
    const urlForms = [
      'https://raw.githubusercontent.com/rsuntk/KernelSU/main/kernel/setup.sh',
      'https://github.com/rsuntk/KernelSU/blob/main/kernel/setup.sh',
      'https://github.com/rsuntk/KernelSU.git/',
    ];
    for (const url of urlForms) {
      vi.clearAllMocks();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(exec.exec).mockResolvedValue(0);

      await setupKernelSU(
        '/kernel',
        '/kernel/.config',
        { version: 'main', lkm: false, other: true, url },
        { version: 5, patchlevel: 15, sublevel: 100, isGki: true }
      );

      expect(exec.exec).toHaveBeenCalledWith(
        'curl',
        expect.arrayContaining([
          '-sSLf',
          `https://github.com/rsuntk/KernelSU/raw/648e5988cf421172769f80ce07f86331b548c053/kernel/setup.sh`,
          '-o',
          '/kernel/ksu_setup.sh',
        ])
      );
    }
  });

  it('warns and falls back to generic integration for unknown fork URLs', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupKernelSU(
      '/kernel',
      '/kernel/.config',
      { version: 'v0.9.3', lkm: false, other: true, url: 'https://github.com/someone/unknown-fork' },
      { version: 5, patchlevel: 4, sublevel: 100, isGki: false }
    );

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('does not match a known KernelSU fork'));
    expect(exec.exec).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining(['https://github.com/someone/unknown-fork/raw/v0.9.3/kernel/setup.sh'])
    );
    expect(fs.appendFileSync).not.toHaveBeenCalledWith('/kernel/.config', expect.stringContaining('MANUAL_HOOK'));
  });
});

describe('setupBBG block-boot option', () => {
  beforeEach(() => {
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
  });

  it('appends CONFIG_BBG_BLOCK_BOOT when blockBoot is enabled', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config', { blockBoot: true });

    expect(fs.appendFileSync).toHaveBeenCalledWith('/kernel/.config', 'CONFIG_BBG_BLOCK_BOOT=y\n');
  });

  it('does not append CONFIG_BBG_BLOCK_BOOT by default', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    expect(fs.appendFileSync).not.toHaveBeenCalledWith(
      '/kernel/.config',
      'CONFIG_BBG_BLOCK_BOOT=y\n'
    );
  });
});

describe('setupNoMount', () => {
  beforeEach(() => {
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
  });

  it('downloads and runs the upstream setup script and enables the config', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupNoMount('/kernel', '/kernel/.config');

    expect(exec.exec).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining([
        '-sSLf',
        expect.stringMatching(
          /^https:\/\/github\.com\/maxsteeel\/nomount\/raw\/[0-9a-f]{40}\/kernel\/setup\.sh$/
        ),
        '-o',
        '/kernel/nomount_setup.sh',
      ])
    );
    expect(exec.exec).toHaveBeenCalledWith('bash', ['/kernel/nomount_setup.sh'], {
      cwd: '/kernel',
    });
    expect(fs.appendFileSync).toHaveBeenCalledWith('/kernel/.config', 'CONFIG_NOMOUNT=y\n');
  });
});

describe('setupReKernel', () => {
  it('runs Re-Kernel patch script', async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupReKernel('/kernel');

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('patch.py')]),
      expect.objectContaining({ cwd: '/kernel' })
    );
  });
});

describe('setupNetHunter', () => {
  it('runs config script', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupNetHunter('/kernel', '/kernel/.config', { patch: false });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py'), '--type', 'nethunter'])
    );
  });

  it('runs config and patch scripts when patch is true', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupNetHunter('/kernel', '/kernel/.config', { patch: true });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py'), '--type', 'nethunter'])
    );
    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('patch.py')]),
      expect.objectContaining({ cwd: '/kernel' })
    );
  });
});

describe('setupLXC', () => {
  it('runs config script', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupLXC('/kernel', '/kernel/.config', { patch: false });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py'), '--type', 'lxc'])
    );
  });

  it('runs config and patch scripts when patch is true', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupLXC('/kernel', '/kernel/.config', { patch: true });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py'), '--type', 'lxc'])
    );
    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('patch_cocci.py')]),
      expect.objectContaining({ cwd: '/kernel' })
    );
  });

});
