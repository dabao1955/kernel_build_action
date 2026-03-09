import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as tc from '@actions/tool-cache';
import { dirExists } from './utils';

const HOME = process.env.HOME || '/home/runner';

/**
 * Toolchain directory names
 * These are used consistently across download and cleanup operations
 */
export const TOOLCHAIN_DIRS = {
  clang: 'clang',
  gcc64: 'gcc-64',
  gcc32: 'gcc-32',
} as const;

export interface ToolchainConfig {
  aospClang: boolean;
  aospClangVersion: string;
  aospGcc: boolean;
  androidVersion: string;
  otherClangUrl: string;
  otherClangBranch: string;
  otherGcc64Url: string;
  otherGcc64Branch: string;
  otherGcc32Url: string;
  otherGcc32Branch: string;
}

export interface ToolchainPaths {
  clangPath?: string;
  gcc64Path?: string;
  gcc32Path?: string;
  gcc64Prefix?: string;
  gcc32Prefix?: string;
}

/**
 * Download and extract toolchain
 */
export async function downloadAndExtract(
  url: string,
  outputName: string,
  extractDir: string,
  branch = 'main'
): Promise<void> {
  fs.mkdirSync(extractDir, { recursive: true });

  if (url.endsWith('.zip')) {
    const zipPath = await tc.downloadTool(url, `${outputName}.zip`);
    await tc.extractZip(zipPath, extractDir);
  } else if (
    url.endsWith('.tar.gz') ||
    url.endsWith('.gz') ||
    url.endsWith('.xz') ||
    url.endsWith('.bz2')
  ) {
    const ext = url.endsWith('.tar.gz') ? '.tar.gz' : path.extname(url);
    const tarPath = await tc.downloadTool(url, `${outputName}${ext}`);
    await tc.extractTar(tarPath, extractDir);
  } else {
    // Git clone
    await exec.exec('git', ['clone', '--depth=1', '-b', branch, '--', url, extractDir]);
  }
}

/**
 * Normalize toolchain directory structure
 * Handles AOSP GCC structure: gcc-64/aarch64-linux-android-4.9/bin/ -> gcc-64/bin/
 */
export function normalizeToolchainDir(dirPath: string, dirName: string): void {
  const binDir = path.join(dirPath, 'bin');
  if (dirExists(binDir)) {
    return;
  }

  core.info(`Normalizing ${dirName} directory structure...`);

  // Look for nested directories like aarch64-linux-android-4.9/bin/
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const nestedPath = path.join(dirPath, entry.name);
      const nestedBinPath = path.join(nestedPath, 'bin');

      // Check if this nested directory has a bin subdirectory
      if (dirExists(nestedBinPath)) {
        // Create the top-level bin directory
        fs.mkdirSync(binDir, { recursive: true });

        // Move all files from nested bin to top-level bin
        const files = fs.readdirSync(nestedBinPath);
        for (const file of files) {
          const srcPath = path.join(nestedBinPath, file);
          const destPath = path.join(binDir, file);
          if (!fs.existsSync(destPath)) {
            fs.renameSync(srcPath, destPath);
          }
        }

        // Also move lib and lib64 directories if they exist
        for (const libDir of ['lib', 'lib64', 'libexec', 'include']) {
          const nestedLibPath = path.join(nestedPath, libDir);
          const topLibPath = path.join(dirPath, libDir);
          if (dirExists(nestedLibPath) && !fs.existsSync(topLibPath)) {
            fs.renameSync(nestedLibPath, topLibPath);
          }
        }

        core.info(`Normalized ${dirName}: moved contents from ${entry.name}/bin/ to bin/`);
        return;
      }
    }
  }
}

/**
 * Download AOSP Clang
 */
async function downloadAospClang(version: string, androidVersion: string): Promise<string> {
  core.startGroup('Downloading AOSP Clang');

  const clangDir = path.join(HOME, TOOLCHAIN_DIRS.clang);

  let url: string;
  if (androidVersion) {
    url = `https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+archive/refs/heads/android${androidVersion}-release/clang-${version}.tar.gz`;
  } else {
    url = `https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+archive/refs/heads/mirror-goog-main-llvm-toolchain-source/clang-${version}.tar.gz`;
  }

  await downloadAndExtract(url, 'aosp-clang', clangDir);

  core.endGroup();
  return clangDir;
}

/**
 * Download third-party Clang
 */
async function downloadOtherClang(url: string, branch: string): Promise<string> {
  core.startGroup('Downloading Third-party Clang');

  const clangDir = path.join(HOME, TOOLCHAIN_DIRS.clang);
  await downloadAndExtract(url, 'clang', clangDir, branch);
  normalizeToolchainDir(clangDir, 'Clang');

  // Check if binutils is included
  const hasBinutils = fs.readdirSync(clangDir).some((f) => f.includes('-linux-'));
  if (!hasBinutils) {
    core.info('Binutils not found in clang directory. Will download AOSP GCC');
    process.env.NEED_GCC = '1';
  }

  core.endGroup();
  return clangDir;
}

/**
 * Download AOSP GCC
 */
async function downloadAospGcc(androidVersion: string): Promise<{ gcc64: string; gcc32: string }> {
  core.startGroup('Downloading AOSP GCC');

  const gcc64Dir = path.join(HOME, TOOLCHAIN_DIRS.gcc64);
  const gcc32Dir = path.join(HOME, TOOLCHAIN_DIRS.gcc32);

  let gcc64Url: string;
  let gcc32Url: string;
  let branch = 'main';

  if (androidVersion) {
    gcc64Url = `https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/aarch64/aarch64-linux-android-4.9`;
    gcc32Url = `https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/arm/arm-linux-androideabi-4.9`;
    branch = `android${androidVersion}-release`;
  } else {
    gcc64Url = `https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/aarch64/aarch64-linux-android-4.9/+archive/refs/tags/android-12.1.0_r27.tar.gz`;
    gcc32Url = `https://android.googlesource.com/platform/prebuilts/gcc/linux-x86/arm/arm-linux-androideabi-4.9/+archive/refs/tags/android-12.1.0_r27.tar.gz`;
  }

  await Promise.all([
    downloadAndExtract(gcc64Url, 'gcc-aarch64', gcc64Dir, branch),
    downloadAndExtract(gcc32Url, 'gcc-arm', gcc32Dir, branch),
  ]);

  core.endGroup();
  return { gcc64: gcc64Dir, gcc32: gcc32Dir };
}

/**
 * Download third-party GCC
 */
async function downloadOtherGcc(
  gcc64Url: string,
  gcc64Branch: string,
  gcc32Url: string,
  gcc32Branch: string
): Promise<{ gcc64?: string; gcc32?: string }> {
  core.startGroup('Downloading Third-party GCC');

  const result: { gcc64?: string; gcc32?: string } = {};

  if (gcc64Url) {
    result.gcc64 = path.join(HOME, TOOLCHAIN_DIRS.gcc64);
    await downloadAndExtract(gcc64Url, 'gcc-aarch64', result.gcc64, gcc64Branch);
  }

  if (gcc32Url) {
    result.gcc32 = path.join(HOME, TOOLCHAIN_DIRS.gcc32);
    await downloadAndExtract(gcc32Url, 'gcc-arm', result.gcc32, gcc32Branch);
  }

  core.endGroup();
  return result;
}

/**
 * Normalize GCC directory structure and detect prefix
 */
export function normalizeGccDirs(): { gcc64Prefix?: string; gcc32Prefix?: string } {
  const gcc64Dir = path.join(HOME, TOOLCHAIN_DIRS.gcc64);
  const gcc32Dir = path.join(HOME, TOOLCHAIN_DIRS.gcc32);

  normalizeToolchainDir(gcc64Dir, 'GCC64');
  normalizeToolchainDir(gcc32Dir, 'GCC32');

  let gcc64Prefix: string | undefined;
  let gcc32Prefix: string | undefined;

  // Detect prefix by matching file names (like original bash script)
  for (const gccDir of [gcc64Dir, gcc32Dir]) {
    if (!dirExists(gccDir)) continue;
    const binDir = path.join(gccDir, 'bin');
    if (dirExists(binDir)) {
      const files = fs.readdirSync(binDir);
      for (const file of files) {
        if (!file.startsWith('.') && (file.includes('-gcc') || file.includes('-ld'))) {
          const fileName = path.basename(file);
          // Find the directory name that matches the file prefix
          const folders = fs
            .readdirSync(gccDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort()
            .reverse();

          for (const folder of folders) {
            if (fileName.startsWith(folder)) {
              if (gccDir === gcc64Dir) {
                gcc64Prefix = folder;
              } else {
                gcc32Prefix = folder;
              }
              break;
            }
          }
          // If no folder match found, try to extract prefix from filename
          // e.g., "aarch64-linux-android-4.9-gcc" -> "aarch64-linux-android-4.9"
          if ((gccDir === gcc64Dir && !gcc64Prefix) || (gccDir === gcc32Dir && !gcc32Prefix)) {
            const match = fileName.match(/^([a-z0-9-]+)-(?:gcc|ld|as|ar)$/);
            if (match) {
              if (gccDir === gcc64Dir) {
                gcc64Prefix = match[1];
              } else {
                gcc32Prefix = match[1];
              }
            }
          }
          if ((gccDir === gcc64Dir && gcc64Prefix) || (gccDir === gcc32Dir && gcc32Prefix)) {
            break;
          }
        }
      }
    }
  }

  return {
    gcc64Prefix,
    gcc32Prefix,
  };
}

/**
 * Setup and download toolchains
 */
export async function setupToolchains(config: ToolchainConfig): Promise<ToolchainPaths> {
  const result: ToolchainPaths = {};

  // Download Clang
  if (config.aospClang) {
    if (!config.aospGcc) {
      throw new Error('AOSP GCC is required when using AOSP Clang.');
    }
    result.clangPath = await downloadAospClang(config.aospClangVersion, config.androidVersion);
  } else if (config.otherClangUrl) {
    result.clangPath = await downloadOtherClang(config.otherClangUrl, config.otherClangBranch);
  }

  // Download GCC
  if (config.aospGcc || process.env.NEED_GCC === '1') {
    const { gcc64, gcc32 } = await downloadAospGcc(config.androidVersion);
    result.gcc64Path = gcc64;
    result.gcc32Path = gcc32;
  } else if (config.otherGcc64Url || config.otherGcc32Url) {
    const gccResult = await downloadOtherGcc(
      config.otherGcc64Url,
      config.otherGcc64Branch,
      config.otherGcc32Url,
      config.otherGcc32Branch
    );
    result.gcc64Path = gccResult.gcc64;
    result.gcc32Path = gccResult.gcc32;
  }

  // Normalize and detect prefixes
  const prefixes = normalizeGccDirs();
  result.gcc64Prefix = prefixes.gcc64Prefix;
  result.gcc32Prefix = prefixes.gcc32Prefix;

  return result;
}

/**
 * Get system toolchain paths
 */
export function getSystemToolchainPaths(): ToolchainPaths {
  return {
    clangPath: undefined,
    gcc64Path: undefined,
    gcc32Path: undefined,
    gcc64Prefix: 'aarch64-linux-gnu',
    gcc32Prefix: 'arm-linux-gnueabihf',
  };
}
