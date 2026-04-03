import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getKernelVersion,
  getConfigPath,
  configExists,
  getOutDir,
  getBootDir,
  findKernelImage,
  findDtbFile,
  findDtboFile,
  cloneKernel,
  cloneVendor,
  setupMkdtboimg,
  isLocalKernelPath,
  isKernelSource,
} from '../src/kernel';
import * as fs from 'fs';
import * as exec from '@actions/exec';
import * as core from '@actions/core';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/exec');
vi.mock('@actions/core');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getKernelVersion', () => {
  it('parses version from Makefile', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
VERSION = 5
PATCHLEVEL = 15
SUBLEVEL = 100
`);

    const version = getKernelVersion('/kernel');

    expect(version.version).toBe(5);
    expect(version.patchlevel).toBe(15);
    expect(version.sublevel).toBe(100);
  });

  it('detects GKI for kernel >= 5.10', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
VERSION = 5
PATCHLEVEL = 10
SUBLEVEL = 0
`);

    const version = getKernelVersion('/kernel');
    expect(version.isGki).toBe(true);
  });

  it('detects non-GKI for kernel < 5.10', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(`
VERSION = 5
PATCHLEVEL = 4
SUBLEVEL = 0
`);

    const version = getKernelVersion('/kernel');
    expect(version.isGki).toBe(false);
  });

  it('returns 0 for missing version fields', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('');

    const version = getKernelVersion('/kernel');
    expect(version.version).toBe(0);
    expect(version.patchlevel).toBe(0);
    expect(version.sublevel).toBe(0);
  });

  it('throws error when Makefile not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => getKernelVersion('/kernel')).toThrow('Makefile not found');
  });
});

describe('getConfigPath', () => {
  it('returns correct config path', () => {
    const path = getConfigPath('/kernel', 'arm64', 'defconfig');
    expect(path).toBe('/kernel/arch/arm64/configs/defconfig');
  });

  it('throws on path traversal in arch', () => {
    expect(() => getConfigPath('/kernel', '../etc', 'defconfig')).toThrow('path traversal');
  });

  it('throws on path traversal in config', () => {
    expect(() => getConfigPath('/kernel', 'arm64', '../passwd')).toThrow('path traversal');
  });
});

describe('configExists', () => {
  it('returns true when config exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(configExists('/kernel', 'arm64', 'defconfig')).toBe(true);
  });

  it('returns false when config does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(configExists('/kernel', 'arm64', 'nonexistent')).toBe(false);
  });
});

describe('getOutDir', () => {
  it('returns out directory path', () => {
    const path = getOutDir('/kernel');
    expect(path).toBe('/kernel/out');
  });
});

describe('getBootDir', () => {
  it('returns boot directory path', () => {
    const path = getBootDir('/kernel', 'arm64');
    expect(path).toBe('/kernel/out/arch/arm64/boot');
  });
});

describe('findKernelImage', () => {
  it('finds Image with dtb suffix', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image.gz-dtb', 'Image']);

    const image = findKernelImage('/kernel', 'arm64');
    expect(image).toContain('Image.gz-dtb');
  });

  it('finds compressed Image', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image.gz', 'Image.bz2']);

    const image = findKernelImage('/kernel', 'arm64');
    expect(image).toContain('Image.gz');
  });

  it('finds raw Image as fallback', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image']);

    const image = findKernelImage('/kernel', 'arm64');
    expect(image).toContain('Image');
  });

  it('returns undefined when no image found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    const image = findKernelImage('/kernel', 'arm64');
    expect(image).toBeUndefined();
  });

  it('returns undefined when boot dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const image = findKernelImage('/kernel', 'arm64');
    expect(image).toBeUndefined();
  });
});

describe('findDtbFile', () => {
  it('returns undefined when boot dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const dtb = findDtbFile('/kernel', 'arm64');
    expect(dtb).toBeUndefined();
  });

  it('returns dtb path when dtb file exists', () => {
    const expectedPath = '/kernel/out/arch/arm64/boot/dtb';
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // Return true for boot directory and dtb file
      return String(p) === expectedPath || String(p).includes('boot');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const dtb = findDtbFile('/kernel', 'arm64');
    expect(dtb).toBe(expectedPath);
  });

  it('returns dtb.img path when dtb.img file exists', () => {
    const expectedPath = '/kernel/out/arch/arm64/boot/dtb.img';
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      // Return false for dtb, true for dtb.img
      if (String(p) === '/kernel/out/arch/arm64/boot/dtb') return false;
      return String(p) === expectedPath || String(p).includes('boot');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const dtb = findDtbFile('/kernel', 'arm64');
    expect(dtb).toBe(expectedPath);
  });

  it('returns undefined when no dtb found', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // boot directory exists, but dtb and dtb.img files don't
      if (path.includes('boot') && !path.includes('dtb')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      return { isDirectory: () => path.includes('boot'), isFile: () => !path.includes('boot') } as fs.Stats;
    });

    const dtb = findDtbFile('/kernel', 'arm64');
    expect(dtb).toBeUndefined();
  });
});

describe('findDtboFile', () => {
  it('returns undefined when boot dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const dtbo = findDtboFile('/kernel', 'arm64');
    expect(dtbo).toBeUndefined();
  });

  it('returns dtbo.img path when file exists', () => {
    const expectedPath = '/kernel/out/arch/arm64/boot/dtbo.img';
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p) === expectedPath || String(p).includes('boot');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const dtbo = findDtboFile('/kernel', 'arm64');
    expect(dtbo).toBe(expectedPath);
  });

  it('returns undefined when no dtbo found', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // boot directory exists, but dtbo.img doesn't
      if (path.includes('boot') && !path.includes('dtbo.img')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      return { isDirectory: () => path.includes('boot'), isFile: () => !path.includes('boot') } as fs.Stats;
    });

    const dtbo = findDtboFile('/kernel', 'arm64');
    expect(dtbo).toBeUndefined();
  });
});

describe('cloneKernel', () => {
  it('clones kernel with depth', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await cloneKernel('https://github.com/test/kernel.git', 'main', '1', '/kernel');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/kernel', { recursive: true });
    expect(exec.exec).toHaveBeenCalledWith('git', [
      'clone', '--recursive', '-b', 'main',
      '--depth', '1',
      '--', 'https://github.com/test/kernel.git', '/kernel',
    ]);
  });

  it('clones kernel without depth when depth is 0', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await cloneKernel('https://github.com/test/kernel.git', 'develop', '0', '/kernel');

    expect(exec.exec).toHaveBeenCalledWith('git', [
      'clone', '--recursive', '-b', 'develop',
      '--', 'https://github.com/test/kernel.git', '/kernel',
    ]);
  });
});

describe('cloneVendor', () => {
  it('clones vendor and copies vendor directory', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p === '/vendor/vendor') {
        // When checking vendor subdir
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [{ name: 'file.txt', isDirectory: () => false, isFile: () => true }] as any;
        }
        return ['file.txt'] as any;
      }
      // When checking if vendor subdir exists
      return ['vendor'] as any;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      // Return true for /vendor/vendor path (the vendor subdirectory)
      if (path === '/vendor/vendor') {
        return { isDirectory: () => true, isFile: () => false } as fs.Stats;
      }
      return { isDirectory: () => false, isFile: () => true } as fs.Stats;
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Return true for vendor subdirectory
      if (path === '/vendor/vendor') return true;
      return false;
    });
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);

    await cloneVendor('https://github.com/test/vendor.git', 'main', '1', '/vendor');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/vendor', { recursive: true });
    expect(exec.exec).toHaveBeenCalledWith('git', expect.arrayContaining(['clone']));
    expect(core.info).toHaveBeenCalledWith('Copying vendor directory to kernel and root');
  });

  it('clones vendor without copying when no vendor subdir', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(fs.readdirSync).mockReturnValue(['README.md'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false, isFile: () => true } as fs.Stats);
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await cloneVendor('https://github.com/test/vendor.git', 'main', '1', '/vendor');

    expect(fs.cpSync).not.toHaveBeenCalled();
  });
});

describe('setupMkdtboimg', () => {
  it('replaces python2 version with python3 when python2 is detected', async () => {
    const makefilePath = '/kernel/scripts/Makefile.lib';
    const mkdtboimgPath = '/kernel/scripts/dtc/libfdt/mkdtboimg.py';

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path === makefilePath || path === mkdtboimgPath;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('MKDTIMG := python2 $(srctree)/scripts/dtc/libfdt/mkdtboimg.py');
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupMkdtboimg('/kernel', '/action');

    expect(fs.rmSync).toHaveBeenCalledWith(mkdtboimgPath);
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/action/mkdtboimg.py',
      mkdtboimgPath
    );
  });

  it('copies to ufdt directory when ufdt is referenced but missing', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Makefile.lib') || path.includes('mkdtboimg.py');
    });
    vi.mocked(fs.readFileSync).mockReturnValue('scripts/ufdt/mkdtboimg.py');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);

    await setupMkdtboimg('/kernel', '/action');

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      '/kernel/ufdt/libufdt/utils/src',
      { recursive: true }
    );
  });

  it('copies to /usr/local/bin when mkdtboimg.py does not exist in kernel', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return !String(p).includes('mkdtboimg.py');
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await setupMkdtboimg('/kernel', '/action');

    expect(exec.exec).toHaveBeenCalledWith('sudo', [
      'cp', '-v', '/action/mkdtboimg.py', '/usr/local/bin/mkdtboimg'
    ]);
  });
});

describe('isLocalKernelPath', () => {
  it('returns true for "." (current directory)', () => {
    expect(isLocalKernelPath('.')).toBe(true);
  });

  it('returns true for "./" (current directory with slash)', () => {
    expect(isLocalKernelPath('./')).toBe(true);
  });

  it('returns true for "./kernel/"', () => {
    expect(isLocalKernelPath('./kernel/')).toBe(true);
  });

  it('returns true for "../kernel/"', () => {
    expect(isLocalKernelPath('../kernel/')).toBe(true);
  });

  it('returns true for relative path without ./ prefix', () => {
    expect(isLocalKernelPath('kernel/source/')).toBe(true);
  });

  it('returns false for path without trailing slash (except ".")', () => {
    expect(isLocalKernelPath('./kernel')).toBe(false);
    expect(isLocalKernelPath('../kernel')).toBe(false);
    expect(isLocalKernelPath('kernel/source')).toBe(false);
  });

  it('returns false for remote URL with https://', () => {
    expect(isLocalKernelPath('https://github.com/user/kernel')).toBe(false);
  });

  it('returns false for remote URL with git@', () => {
    expect(isLocalKernelPath('git@github.com:user/kernel.git')).toBe(false);
  });

  it('returns false for remote URL with http://', () => {
    expect(isLocalKernelPath('http://github.com/user/kernel')).toBe(false);
  });

  it('returns false for remote URL with trailing slash', () => {
    expect(isLocalKernelPath('https://github.com/user/kernel/')).toBe(false);
    expect(isLocalKernelPath('ftp://example.com/path/')).toBe(false);
  });

  it('returns false for git URL with trailing slash', () => {
    expect(isLocalKernelPath('git@github.com:user/kernel.git/')).toBe(false);
  });
});

describe('isKernelSource', () => {
  it('returns true for valid kernel source directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('VERSION = 5\nPATCHLEVEL = 10\n');
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    expect(isKernelSource('/kernel')).toBe(true);
  });

  it('returns false when Makefile does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(isKernelSource('/kernel')).toBe(false);
  });

  it('returns false when Makefile does not contain VERSION', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# Not a kernel Makefile\n');

    expect(isKernelSource('/kernel')).toBe(false);
  });

  it('returns false when Kconfig does not exist', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Makefile') && !path.includes('Kconfig');
    });
    vi.mocked(fs.readFileSync).mockReturnValue('VERSION = 5\n');

    expect(isKernelSource('/kernel')).toBe(false);
  });

  it('returns false when arch/ directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('VERSION = 5\n');
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);

    expect(isKernelSource('/kernel')).toBe(false);
  });
});
