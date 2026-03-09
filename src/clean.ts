import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import { TOOLCHAIN_DIRS } from './toolchain';
import { dirExists, fileExists, removeDir, detectPackageManager } from './utils';

// Environment variables to clean
const ENV_VARS_TO_CLEAN = [
  'CMD_PATH',
  'CMD_CC',
  'CMD_CLANG_TRIPLE',
  'CMD_CROSS_COMPILE',
  'CMD_CROSS_COMPILE_ARM32',
  'USE_CCACHE',
  'CLANG_PATH',
  'HOMES',
  'KVER',
  'SWAP_FILE',
  'SUBLEVEL',
  'PATCHLEVEL',
  'VERSION',
  'GCC_DIR',
  'FILE',
  'FILE_NAME',
  'MATCHED_DIR',
  'FOLDER',
  'FOLDER_NAME',
  'GCC64',
  'GCC32',
  'NEED_GCC',
  'AOSP_CLANG_URL',
  'OTHER_CLANG_URL',
  'AOSP_GCC64_URL',
  'AOSP_GCC32_URL',
  'AOSP_GCC_BRANCH',
  'OTHER_GCC64_URL',
  'OTHER_GCC32_URL',
  'EXTRA_ARGS',
  'make_args',
  'SAFE_EXTRA_ARGS',
  'EXTRA_CMD',
  'FMT',
  'HOST_ARCH',
];

/**
 * Clean kernel source directory
 */
export function cleanKernelSource(kernelDir: string): void {
  if (dirExists(kernelDir)) {
    core.info(`Removing kernel directory: ${kernelDir}`);
    removeDir(kernelDir);
  }
}

/**
 * Clean build artifacts
 */
export function cleanBuildArtifacts(buildDir: string): void {
  if (dirExists(buildDir)) {
    core.info(`Removing build directory: ${buildDir}`);
    removeDir(buildDir);
  }
}

/**
 * Clean downloaded toolchains
 */
export function cleanToolchains(): void {
  const home = process.env.HOME;
  if (!home) {
    core.warning('HOME environment variable not set, skipping toolchain cleanup');
    return;
  }

  const toolchains = [
    path.join(home, TOOLCHAIN_DIRS.clang),
    path.join(home, TOOLCHAIN_DIRS.gcc64),
    path.join(home, TOOLCHAIN_DIRS.gcc32),
  ];

  for (const toolchain of toolchains) {
    if (dirExists(toolchain)) {
      core.info(`Removing toolchain: ${toolchain}`);
      removeDir(toolchain);
    }
  }
}

/**
 * Clean AnyKernel3 directory
 */
export function cleanAnyKernel3(): void {
  const anykernelDir = 'AnyKernel3';
  if (dirExists(anykernelDir)) {
    core.info(`Removing AnyKernel3 directory: ${anykernelDir}`);
    removeDir(anykernelDir);
  }
}

/**
 * Clean ccache
 */
export async function cleanCcache(): Promise<void> {
  try {
    await exec.exec('ccache', ['-C']);
    core.info('Ccache cleared');
  } catch {
    // Ignore if ccache is not available
  }
}

/**
 * Clean environment variables
 */
export function cleanEnvVars(): void {
  for (const varName of ENV_VARS_TO_CLEAN) {
    if (process.env[varName]) {
      core.info(`Unsetting ${varName}`);
      delete process.env[varName];
    }
  }
}

/**
 * Clean temporary files
 */
export function cleanTempFiles(): void {
  const tempFiles = ['boot.img', 'magiskboot', 'nohup.out'];
  for (const file of tempFiles) {
    if (fileExists(file)) {
      core.info(`Removing temporary file: ${file}`);
      fs.unlinkSync(file);
    }
  }
}

/**
 * Clean split directory
 */
export function cleanSplitDir(): void {
  const splitDir = 'split';
  if (dirExists(splitDir)) {
    core.info(`Removing split directory: ${splitDir}`);
    removeDir(splitDir);
  }
}

/**
 * Clean all build artifacts
 */
export async function cleanAll(options: {
  kernelDir?: string;
  buildDir?: string;
  toolchains?: boolean;
  ccache?: boolean;
  env?: boolean;
}): Promise<void> {
  const kernelDir = options.kernelDir || 'kernel';
  const buildDir = options.buildDir || 'build';

  core.startGroup('Cleaning up');
  core.info('Cleaning build artifacts...');

  cleanKernelSource(kernelDir);
  cleanBuildArtifacts(buildDir);
  cleanAnyKernel3();
  cleanTempFiles();
  cleanSplitDir();

  if (options.toolchains) {
    cleanToolchains();
  }

  if (options.ccache) {
    await cleanCcache();
  }

  if (options.env) {
    cleanEnvVars();
  }

  const pkgMgr = detectPackageManager();
  core.info(`Detected package manager: ${pkgMgr}`);
  core.info('Clean completed!');
  core.endGroup();
}
