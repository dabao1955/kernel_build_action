import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setupKernelSU,
  setupBBG,
  setupReKernel,
  setupNetHunter,
  setupLXC,
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
});

describe('setupBBG', () => {
  it('downloads and runs BBG setup script', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('config LSM\n\tdefault yama,loadpin,integrity,selinux,smack,tomoyo,apparmor');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupBBG('/kernel', '/kernel/.config');

    expect(exec.exec).toHaveBeenCalledWith('bash', expect.arrayContaining([
      '-c',
      expect.stringContaining('Baseband-guard'),
    ]));
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
      expect.arrayContaining([expect.stringContaining('nethunter/config.py')])
    );
  });

  it('runs config and patch scripts when patch is true', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupNetHunter('/kernel', '/kernel/.config', { patch: true });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py')])
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
      expect.arrayContaining([expect.stringContaining('lxc/config.py')])
    );
  });

  it('runs config and patch scripts when patch is true', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupLXC('/kernel', '/kernel/.config', { patch: true });

    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('config.py')])
    );
    expect(exec.exec).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining([expect.stringContaining('patch_cocci.py')]),
      expect.objectContaining({ cwd: '/kernel' })
    );
  });
});
