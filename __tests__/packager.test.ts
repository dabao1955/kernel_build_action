import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  packageKernel,
  packageBootimg,
  packageAnyKernel3,
  PackageConfig,
} from '../src/packager';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as kernel from '../src/kernel';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('../src/kernel');

// Helper to create mock dirent
const createMockDirent = (name: string, isDir: boolean) => ({
  name,
  isDirectory: () => isDir,
  isFile: () => !isDir,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset kernel module mocks to default behavior (return undefined)
  vi.mocked(kernel.findKernelImage).mockReturnValue(undefined);
  vi.mocked(kernel.findDtboFile).mockReturnValue(undefined);
  vi.mocked(kernel.findDtbFile).mockReturnValue(undefined);
});

describe('packageBootimg', () => {
  const baseConfig: PackageConfig = {
    kernelDir: '/kernel',
    arch: 'arm64',
    anykernel3: false,
    bootimgUrl: 'https://example.com/boot.img',
    buildDir: '/build',
  };

  it('throws error when bootimgUrl is not provided', async () => {
    const config = { ...baseConfig, bootimgUrl: undefined };

    await expect(packageBootimg(config)).rejects.toThrow(
      'bootimg-url input is required when anykernel3 is set to false'
    );
  });

  it('throws error for bootimgUrl starting with hyphen', async () => {
    const config = { ...baseConfig, bootimgUrl: '-malicious' };

    await expect(packageBootimg(config)).rejects.toThrow(
      'bootimg-url must not start with a hyphen'
    );
  });

  it('packages boot.img successfully', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining(['--', 'https://example.com/boot.img'])
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith('split', { recursive: true });
  });

  it('downloads correct magiskboot for x64 architecture', async () => {
    const originalArch = process.arch;
    Object.defineProperty(process, 'arch', { value: 'x64' });

    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining([expect.stringContaining('magiskboot_x86')])
    );

    Object.defineProperty(process, 'arch', { value: originalArch });
  });

  it('downloads correct magiskboot for arm architecture', async () => {
    const originalArch = process.arch;
    Object.defineProperty(process, 'arch', { value: 'arm64' });

    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining([expect.stringContaining('magiskboot_arm')])
    );

    Object.defineProperty(process, 'arch', { value: originalArch });
  });

  it('throws error when kernel Image is not found', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('boot')) {
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [] as any; // No kernel images
        }
        return [] as any;
      }
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await expect(packageBootimg(baseConfig)).rejects.toThrow('Kernel Image not found in out directory');
  });

  it('handles different kernel formats (gzip)', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [gzip]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return !path.includes('old_kernel'); // old kernel doesn't exist
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(core.info).toHaveBeenCalledWith('Kernel format: gzip');
    expect(fs.copyFileSync).toHaveBeenCalled();
  });

  it('handles raw kernel format', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('Some output without KERNEL_FMT');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(core.info).toHaveBeenCalledWith('Kernel format: raw');
  });

  it('removes old kernel before copying new one', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true); // old kernel exists
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageBootimg(baseConfig);

    expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('kernel'));
    expect(fs.copyFileSync).toHaveBeenCalled();
  });
});

describe('packageAnyKernel3', () => {
  const baseConfig: PackageConfig = {
    kernelDir: '/kernel',
    arch: 'arm64',
    anykernel3: true,
    buildDir: '/build',
  };

  it('clones AnyKernel3 from default URL', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Image') || path.includes('anykernel.sh');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('BLOCK=/dev/block/platform/boot;');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone', '--', 'https://github.com/osm0sis/AnyKernel3'])
    );
  });

  it('clones AnyKernel3 from custom URL', async () => {
    const config = { ...baseConfig, anykernel3Url: 'https://github.com/custom/AnyKernel3' };

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Image') || !path.includes('AnyKernel3');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(config);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone', '--', 'https://github.com/custom/AnyKernel3'])
    );
  });

  it('creates zip when release is true', async () => {
    const config = { ...baseConfig, release: true };

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Image') || !path.includes('AnyKernel3');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['anykernel.sh', 'Image'] as any);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(config);

    expect(exec.exec).toHaveBeenCalledWith(
      'zip',
      expect.arrayContaining(['-r', expect.stringContaining('AnyKernel3-flasher.zip')]),
      expect.objectContaining({ cwd: 'AnyKernel3' })
    );
  });

  it('copies files instead of zip when release is false', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Simulate Image exists in kernel out directory
      if (path.includes('/kernel/out/arch/arm64/boot/Image')) return true;
      // Simulate AnyKernel3 files exist after clone
      if (path.includes('AnyKernel3')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      return { isDirectory: () => path.includes('subdir'), isFile: () => !path.includes('subdir') } as fs.Stats;
    });
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockImplementation((p, options) => {
      const path = String(p);
      if (path.includes('boot')) {
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [createMockDirent('Image', false)] as any;
        }
        return ['Image'] as any;
      }
      if (path.includes('AnyKernel3')) {
        return ['anykernel.sh', 'Image', 'subdir'] as any;
      }
      return [] as any;
    });
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(fs.cpSync).toHaveBeenCalled();
    expect(exec.exec).not.toHaveBeenCalledWith('zip', expect.any(Array), expect.any(Object));
  });

  it('modifies anykernel.sh for generic use with default URL', async () => {
    const originalContent = `BLOCK=/dev/block/platform/omap/omap_hsmmc.0/by-name/boot;
do.devicecheck=1
IS_SLOT_DEVICE=0;`;

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('anykernel.sh') || path.includes('Image');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(originalContent);
    vi.mocked(fs.writeFileSync).mockImplementation((path, content) => {
      expect(content).toContain('BLOCK=auto;');
      expect(content).toContain('do.devicecheck=0');
      expect(content).toContain('IS_SLOT_DEVICE=auto;');
    });
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['anykernel.sh', 'Image'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('handles missing DTBO and DTB files gracefully', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Only Image exists, no dtbo or dtb
      if (path.includes('Image')) return true;
      if (path.includes('anykernel.sh')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(core.info).toHaveBeenCalledWith('DTBO not found, skipping');
    expect(core.info).toHaveBeenCalledWith('DTB not found, skipping');
  });

  it('copies kernelImage when found by findKernelImage', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(kernel.findDtboFile).mockReturnValue(undefined);
    vi.mocked(kernel.findDtbFile).mockReturnValue(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('Image.gz-dtb')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image.gz-dtb', 'anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(kernel.findKernelImage).toHaveBeenCalledWith('/kernel', 'arm64');
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/kernel/out/arch/arm64/boot/Image.gz-dtb',
      expect.stringContaining('Image.gz-dtb')
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied kernel'));
  });

  it('copies DTBO file when found', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image');
    vi.mocked(kernel.findDtboFile).mockReturnValue('/kernel/out/arch/arm64/boot/dtbo.img');
    vi.mocked(kernel.findDtbFile).mockReturnValue(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('Image')) return true;
      if (path.includes('dtbo.img')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image', 'anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(kernel.findDtboFile).toHaveBeenCalledWith('/kernel', 'arm64');
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/kernel/out/arch/arm64/boot/dtbo.img',
      expect.stringContaining('dtbo.img')
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied dtbo'));
  });

  it('copies DTB file when found', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image');
    vi.mocked(kernel.findDtboFile).mockReturnValue(undefined);
    vi.mocked(kernel.findDtbFile).mockReturnValue('/kernel/out/arch/arm64/boot/dtb');

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('Image')) return true;
      if (path.includes('dtb') && !path.includes('.img')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image', 'anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(kernel.findDtbFile).toHaveBeenCalledWith('/kernel', 'arm64');
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/kernel/out/arch/arm64/boot/dtb',
      expect.stringContaining('dtb')
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied dtb'));
  });

  it('copies DTB img file with correct name when found', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image');
    vi.mocked(kernel.findDtboFile).mockReturnValue(undefined);
    vi.mocked(kernel.findDtbFile).mockReturnValue('/kernel/out/arch/arm64/boot/dtb.img');

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('Image')) return true;
      if (path.includes('dtb.img')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image', 'anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(fs.copyFileSync).toHaveBeenCalledWith(
      '/kernel/out/arch/arm64/boot/dtb.img',
      expect.stringContaining('dtb.img')
    );
  });

  it('copies all files when kernelImage, DTBO, and DTB are all found', async () => {
    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz');
    vi.mocked(kernel.findDtboFile).mockReturnValue('/kernel/out/arch/arm64/boot/dtbo.img');
    vi.mocked(kernel.findDtbFile).mockReturnValue('/kernel/out/arch/arm64/boot/dtb');

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('Image.gz')) return true;
      if (path.includes('dtbo.img')) return true;
      if (path.includes('dtb') && !path.includes('.img')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image.gz', 'anykernel.sh'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    expect(fs.copyFileSync).toHaveBeenCalledTimes(5); // kernel + dtbo + dtb + anykernel.sh copy + file removal loop
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied kernel'));
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied dtbo'));
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied dtb'));
  });



  it('removes unnecessary files from AnyKernel3 directory', async () => {
    const existingFiles = new Set(['.git', '.gitattributes', '.gitignore', 'README.md', 'Image']);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      for (const file of existingFiles) {
        if (path.includes(file)) return true;
      }
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      return {
        isDirectory: () => path.includes('.git'),
        isFile: () => !path.includes('.git')
      } as fs.Stats;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['.git', '.gitattributes', '.gitignore', 'README.md', 'Image'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(baseConfig);

    // .git directory should be removed with removeDir, files with unlinkSync
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('handles raw Image fallback when compressed formats not found', async () => {
    const config = { ...baseConfig };

    // Mock findKernelImage to return undefined (no compressed format found)
    vi.mocked(kernel.findKernelImage).mockReturnValue(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // Only raw Image exists, no compressed formats
      if (path.includes('/kernel/out/arch/arm64/boot/Image')) return true;
      if (path.includes('Image.gz')) return false;
      if (path.includes('Image.lz4')) return false;
      if (path.includes('Image-dtb')) return false;
      if (path.includes('anykernel.sh')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockImplementation((p, options) => {
      const path = String(p);
      if (path.includes('boot')) {
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [createMockDirent('Image', false)] as any;
        }
        return ['Image'] as any;
      }
      return ['Image', 'anykernel.sh'] as any;
    });
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(config);

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Copied raw kernel'));
    expect(fs.copyFileSync).toHaveBeenCalledWith(
      expect.stringContaining('Image'),
      expect.stringContaining('Image')
    );
  });

  it('throws error when kernel Image is not found in any format', async () => {
    const config = { ...baseConfig };

    // Mock findKernelImage to return undefined
    vi.mocked(kernel.findKernelImage).mockReturnValue(undefined);

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      // No kernel images exist
      if (path.includes('Image')) return false;
      if (path.includes('anykernel.sh')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockImplementation((p, options) => {
      const path = String(p);
      if (path.includes('boot')) {
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [] as any;
        }
        return [] as any;
      }
      return ['anykernel.sh'] as any;
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await expect(packageAnyKernel3(config)).rejects.toThrow('Kernel Image not found in out directory');
  });

  it('copies files recursively in non-release mode with subdirectories', async () => {
    const config = { ...baseConfig, release: false };

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('/kernel/out/arch/arm64/boot/Image')) return true;
      if (path.includes('anykernel.sh')) return true;
      if (path.includes('AnyKernel3')) return true;
      if (path.includes('subdir')) return true;
      return false;
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      return { isDirectory: () => path.includes('subdir') } as fs.Stats;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('do.devicecheck=1');
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockImplementation((p, options) => {
      const path = String(p);
      if (path.includes('boot')) {
        if (options && typeof options === 'object' && 'withFileTypes' in options) {
          return [createMockDirent('Image', false)] as any;
        }
        return ['Image'] as any;
      }
      if (path.includes('AnyKernel3')) {
        return ['anykernel.sh', 'Image', 'subdir'] as any;
      }
      return [] as any;
    });
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageAnyKernel3(config);

    expect(fs.cpSync).toHaveBeenCalledWith(
      expect.stringContaining('subdir'),
      expect.stringContaining('subdir'),
      { recursive: true }
    );
    expect(fs.copyFileSync).toHaveBeenCalled();
    expect(exec.exec).not.toHaveBeenCalledWith('zip', expect.any(Array), expect.any(Object));
  });


});

describe('packageKernel', () => {
  it('calls packageAnyKernel3 when anykernel3 is true', async () => {
    const config: PackageConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      anykernel3: true,
      buildDir: '/build',
    };

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path.includes('Image') || !path.includes('AnyKernel3');
    });
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image'] as any);
    vi.mocked(fs.cpSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageKernel(config);

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone'])
    );
  });

  it('calls packageBootimg when anykernel3 is false', async () => {
    const config: PackageConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      anykernel3: false,
      bootimgUrl: 'https://example.com/boot.img',
      buildDir: '/build',
    };

    vi.mocked(kernel.findKernelImage).mockReturnValue('/kernel/out/arch/arm64/boot/Image.gz-dtb');
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.chmodSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('KERNEL_FMT [raw]');
    vi.mocked(fs.readdirSync).mockImplementation((path, options) => {
      const p = String(path);
      if (p.includes('split')) return ['new.img'] as any;
      return [] as any;
    });
    vi.mocked(fs.renameSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(fs.rmSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    await packageKernel(config);

    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining([expect.stringContaining('boot.img')])
    );
  });
});
