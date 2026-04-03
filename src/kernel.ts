import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dirExists, copyDir } from './utils';

export interface KernelConfig {
  kernelUrl: string;
  kernelBranch: string;
  kernelDir: string;
  depth: string;
  arch: string;
  config: string;
  vendor: boolean;
  vendorUrl: string;
  vendorBranch: string;
  vendorDir: string;
}

export interface KernelVersion {
  version: number;
  patchlevel: number;
  sublevel: number;
  isGki: boolean;
}

/**
 * Clone kernel source
 */
export async function cloneKernel(
  url: string,
  branch: string,
  depth: string,
  targetDir: string
): Promise<void> {
  core.startGroup('Pulling Kernel Source');

  fs.mkdirSync(targetDir, { recursive: true });

  const args = ['clone', '--recursive', '-b', branch];
  if (depth !== '0') {
    args.push('--depth', depth);
  }
  args.push('--', url, targetDir);

  await exec.exec('git', args);

  core.endGroup();
}

/**
 * Clone vendor source
 */
export async function cloneVendor(
  url: string,
  branch: string,
  depth: string,
  targetDir: string
): Promise<void> {
  core.startGroup('Pulling Kernel Vendor Source');

  fs.mkdirSync(targetDir, { recursive: true });

  const args = ['clone', '-b', branch];
  if (depth !== '0') {
    args.push('--depth', depth);
  }
  args.push('--', url, targetDir);

  await exec.exec('git', args);

  // Copy vendor directory if exists
  const vendorSubdir = path.join(targetDir, 'vendor');
  if (dirExists(vendorSubdir)) {
    core.info('Copying vendor directory to kernel and root');
    copyDir(vendorSubdir, 'kernel/vendor');
    copyDir(vendorSubdir, 'vendor');
  }

  core.endGroup();
}

/**
 * Check if the URL is a local/relative kernel path
 * Supports: ., ./, ./path/, ../path/, path/path/
 * Local paths must end with / (except for '.' which is a special case)
 */
export function isLocalKernelPath(url: string): boolean {
  // Special case: current directory
  if (url === '.') {
    return true;
  }

  // Must end with / for all other local paths
  if (!url.endsWith('/')) {
    return false;
  }

  // Check if it's a relative path starting with ./ or ../
  if (url.startsWith('./') || url.startsWith('../')) {
    return true;
  }

  // Check if it's a relative path without protocol
  // This handles paths like 'kernel/kernel/'
  if (!url.includes('://') && !url.startsWith('git@')) {
    return true;
  }

  return false;
}

/**
 * Check if directory is a valid kernel source directory
 * Checks for: Makefile with VERSION, Kconfig, arch/ directory
 */
export function isKernelSource(dir: string): boolean {
  const makefilePath = path.join(dir, 'Makefile');
  const kconfigPath = path.join(dir, 'Kconfig');
  const archPath = path.join(dir, 'arch');

  // Check if Makefile exists and contains VERSION
  if (!fs.existsSync(makefilePath)) {
    return false;
  }

  const makefileContent = fs.readFileSync(makefilePath, 'utf-8');
  if (!makefileContent.includes('VERSION =')) {
    return false;
  }

  // Check for Kconfig
  if (!fs.existsSync(kconfigPath)) {
    return false;
  }

  // Check for arch/ directory
  if (!dirExists(archPath)) {
    return false;
  }

  return true;
}

/**
 * Parse kernel version from Makefile
 */
export function getKernelVersion(kernelDir: string): KernelVersion {
  const makefilePath = path.join(kernelDir, 'Makefile');
  if (!fs.existsSync(makefilePath)) {
    throw new Error(`Makefile not found in ${kernelDir}`);
  }

  const content = fs.readFileSync(makefilePath, 'utf-8');

  const versionMatch = content.match(/^VERSION = (\d+)$/m);
  const patchlevelMatch = content.match(/^PATCHLEVEL = (\d+)$/m);
  const sublevelMatch = content.match(/^SUBLEVEL = (\d+)$/m);

  const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;
  const patchlevel = patchlevelMatch ? parseInt(patchlevelMatch[1], 10) : 0;
  const sublevel = sublevelMatch ? parseInt(sublevelMatch[1], 10) : 0;

  // GKI (Generic Kernel Image) was introduced in kernel 5.10
  const isGki = version > 5 || (version === 5 && patchlevel >= 10);

  return { version, patchlevel, sublevel, isGki };
}

/**
 * Get config file path
 */
export function getConfigPath(kernelDir: string, arch: string, config: string): string {
  if (arch.includes('..') || config.includes('..')) {
    throw new Error('Invalid arch or config: path traversal detected');
  }
  return path.join(kernelDir, 'arch', arch, 'configs', config);
}

/**
 * Check if config file exists
 */
export function configExists(kernelDir: string, arch: string, config: string): boolean {
  const configPath = getConfigPath(kernelDir, arch, config);
  return fs.existsSync(configPath);
}

/**
 * Setup mkdtboimg.py
 */
export async function setupMkdtboimg(kernelDir: string, actionPath: string): Promise<void> {
  const mkdtboimgPath = path.join(kernelDir, 'scripts', 'dtc', 'libfdt', 'mkdtboimg.py');
  const actionMkdtboimg = path.join(actionPath, 'mkdtboimg.py');

  if (fs.existsSync(mkdtboimgPath)) {
    const makefileLib = path.join(kernelDir, 'scripts', 'Makefile.lib');
    if (fs.existsSync(makefileLib)) {
      const content = fs.readFileSync(makefileLib, 'utf-8');

      if (content.includes('python2')) {
        core.startGroup('Using mkdtboimg Python3 version instead of Python2 version');
        fs.rmSync(mkdtboimgPath);
        fs.copyFileSync(actionMkdtboimg, mkdtboimgPath);

        // Create python2 symlink if needed
        if (!fs.existsSync('/usr/bin/python2')) {
          await exec.exec('sudo', ['ln', '-sf', '/usr/bin/python3', '/usr/bin/python2']);
        }

        core.endGroup();
      } else if (
        content.includes('scripts/ufdt') &&
        !dirExists(path.join(kernelDir, 'scripts', 'ufdt'))
      ) {
        const ufdtDir = path.join(kernelDir, 'ufdt', 'libufdt', 'utils', 'src');
        fs.mkdirSync(ufdtDir, { recursive: true });
        fs.copyFileSync(actionMkdtboimg, path.join(ufdtDir, 'mkdtboimg.py'));
      }
    }
  } else {
    core.startGroup('Downloading mkdtboimg to /usr/local/bin');
    await exec.exec('sudo', ['cp', '-v', actionMkdtboimg, '/usr/local/bin/mkdtboimg']);
    await exec.exec('sudo', ['chmod', '+x', '/usr/local/bin/mkdtboimg']);
    core.endGroup();
  }
}

/**
 * Get kernel output directory
 */
export function getOutDir(kernelDir: string): string {
  return path.join(kernelDir, 'out');
}

/**
 * Get kernel boot directory
 */
export function getBootDir(kernelDir: string, arch: string): string {
  return path.join(kernelDir, 'out', 'arch', arch, 'boot');
}

/**
 * Find kernel image in boot directory
 */
export function findKernelImage(kernelDir: string, arch: string): string | undefined {
  const bootDir = getBootDir(kernelDir, arch);
  if (!dirExists(bootDir)) {
    return undefined;
  }

  // Look for Image, Image.gz, Image.bz2, etc.
  const entries = fs.readdirSync(bootDir);

  // First look for Image with dtb
  for (const entry of entries) {
    if (entry.match(/^Image\.[^-]+-dtb$/)) {
      return path.join(bootDir, entry);
    }
  }

  // Then look for compressed Image
  for (const entry of entries) {
    if (entry.match(/^Image\.[a-z0-9]+$/)) {
      return path.join(bootDir, entry);
    }
  }

  // Finally look for raw Image
  if (entries.includes('Image')) {
    return path.join(bootDir, 'Image');
  }

  return undefined;
}

/**
 * Find dtb file
 */
export function findDtbFile(kernelDir: string, arch: string): string | undefined {
  const bootDir = getBootDir(kernelDir, arch);
  if (!dirExists(bootDir)) {
    return undefined;
  }

  const dtbPath = path.join(bootDir, 'dtb');
  const dtbImgPath = path.join(bootDir, 'dtb.img');

  if (fs.existsSync(dtbPath)) {
    return dtbPath;
  }
  if (fs.existsSync(dtbImgPath)) {
    return dtbImgPath;
  }

  return undefined;
}

/**
 * Find dtbo file
 */
export function findDtboFile(kernelDir: string, arch: string): string | undefined {
  const bootDir = getBootDir(kernelDir, arch);
  if (!dirExists(bootDir)) {
    return undefined;
  }

  const dtboPath = path.join(bootDir, 'dtbo.img');
  if (fs.existsSync(dtboPath)) {
    return dtboPath;
  }

  return undefined;
}
