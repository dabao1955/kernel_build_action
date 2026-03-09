import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ToolchainPaths } from './toolchain';
import { filterMakeArgs, parseExtraMakeArgs } from './utils';

export interface BuildConfig {
  kernelDir: string;
  arch: string;
  config: string;
  toolchain: ToolchainPaths;
  extraMakeArgs: string;
  useCcache: boolean;
}

/**
 * Build the kernel
 * Matches the behavior of action.yml.1 bash script
 */
export async function buildKernel(config: BuildConfig): Promise<boolean> {
  core.startGroup('Building Kernel with selected cross compiler');

  // Validate config doesn't start with hyphen to prevent command injection
  if (config.config.startsWith('-')) {
    throw new Error('config input must not start with a hyphen');
  }

  // Validate arch matches expected patterns to prevent command injection
  const validArchs = ['arm', 'arm64', 'x86', 'x86_64', 'riscv', 'riscv64', 'mips', 'mips64'];
  if (!validArchs.includes(config.arch)) {
    throw new Error(
      `Invalid architecture: ${config.arch}. Valid options: ${validArchs.join(', ')}`
    );
  }

  const outDir = path.join(config.kernelDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  // Build CMD_PATH for toolchains (matches original bash script exactly)
  let cmdPath = '';
  let cmdCc: string;
  let cmdCrossCompile: string | undefined;
  let cmdCrossCompileArm32: string | undefined;
  let cmdClangTriple: string;

  if (config.toolchain.clangPath) {
    // Use Clang
    cmdPath = path.join(config.toolchain.clangPath, 'bin');
    cmdCc = 'clang';

    if (config.toolchain.gcc64Path || config.toolchain.gcc32Path) {
      if (config.toolchain.gcc64Path && config.toolchain.gcc64Prefix) {
        cmdCrossCompile = path.join(
          config.toolchain.gcc64Path,
          'bin',
          `${config.toolchain.gcc64Prefix}-`
        );
      }
      if (config.toolchain.gcc32Path && config.toolchain.gcc32Prefix) {
        cmdCrossCompileArm32 = path.join(
          config.toolchain.gcc32Path,
          'bin',
          `${config.toolchain.gcc32Prefix}-`
        );
      }
    }
  } else if (config.toolchain.gcc64Path || config.toolchain.gcc32Path) {
    // Use GCC only
    if (config.toolchain.gcc64Path && config.toolchain.gcc64Prefix) {
      cmdCc = path.join(config.toolchain.gcc64Path, 'bin', `${config.toolchain.gcc64Prefix}-gcc`);
      cmdCrossCompile = `${config.toolchain.gcc64Prefix}-`;
      cmdPath = path.join(config.toolchain.gcc64Path, 'bin');
    } else if (config.toolchain.gcc32Path && config.toolchain.gcc32Prefix) {
      cmdCc = path.join(config.toolchain.gcc32Path, 'bin', `${config.toolchain.gcc32Prefix}-gcc`);
      cmdCrossCompile = `${config.toolchain.gcc32Prefix}-`;
      cmdPath = path.join(config.toolchain.gcc32Path, 'bin');
    } else {
      cmdCc = '/usr/bin/gcc';
    }

    // Add gcc-32 bin to PATH if available
    if (config.toolchain.gcc32Path && config.toolchain.gcc32Prefix) {
      cmdCrossCompileArm32 = `${config.toolchain.gcc32Prefix}-`;
      if (cmdPath) {
        cmdPath += `:${path.join(config.toolchain.gcc32Path, 'bin')}`;
      } else {
        cmdPath = path.join(config.toolchain.gcc32Path, 'bin');
      }
    }
  } else {
    // System toolchain
    cmdCc = '/usr/bin/clang';
    cmdCrossCompile = '/usr/bin/aarch64-linux-gnu-';
    cmdCrossCompileArm32 = 'arm-linux-gnueabihf-';
  }

  // Setup CLANG_TRIPLE (matches bash script)
  if (config.arch === 'arm') {
    cmdClangTriple = cmdCrossCompileArm32 || 'arm-linux-gnueabihf-';
  } else {
    cmdClangTriple = 'aarch64-linux-gnu-';
  }

  // Add ccache to path if enabled (matches bash: CMD_PATH="/usr/lib/ccache:$CMD_PATH")
  if (config.useCcache) {
    const ccachePath = '/usr/lib/ccache';
    if (cmdPath) {
      cmdPath = `${ccachePath}:${cmdPath}`;
    } else {
      cmdPath = ccachePath;
    }
  }

  // Parse extra make arguments
  const extraArgs = parseExtraMakeArgs(config.extraMakeArgs);
  const safeExtraArgs = filterMakeArgs(extraArgs);

  // Build make arguments (matches bash script exactly)
  const makeArgs = [
    `-j${os.cpus().length}`,
    config.config,
    `ARCH=${config.arch}`,
    'O=out',
    'all',
    ...safeExtraArgs,
  ];

  core.info(`CC: ${cmdCc}`);
  core.info(`CROSS_COMPILE: ${cmdCrossCompile || 'not set'}`);
  core.info(`CROSS_COMPILE_ARM32: ${cmdCrossCompileArm32 || 'not set'}`);
  core.info(`CLANG_TRIPLE: ${cmdClangTriple}`);
  core.info(`Make args: ${makeArgs.join(' ')}`);

  // Build the make command exactly like bash script
  // export PATH="$CMD_PATH:$PATH"
  // make CC="$CMD_CC" CROSS_COMPILE="$CMD_CROSS_COMPILE" ...
  const logFile = path.join(outDir, 'build.log');

  // Construct environment variables for make (matching bash export statements)
  const envVars: { [key: string]: string } = {};

  // export USE_CCACHE=1 (if enabled)
  if (config.useCcache) {
    envVars.USE_CCACHE = '1';
  }

  // Build the command line arguments with variable assignments (like bash does)
  const makeCmdArgs: string[] = [];

  // Add PATH export: export PATH="$CMD_PATH:$PATH"
  const currentPath = process.env.PATH || '';
  const newPath = cmdPath ? `${cmdPath}:${currentPath}` : currentPath;
  envVars.PATH = newPath;

  // Add make variable assignments (matching bash: make CC="$CMD_CC" ...)
  makeCmdArgs.push(`CC=${cmdCc}`);
  if (cmdCrossCompile) {
    makeCmdArgs.push(`CROSS_COMPILE=${cmdCrossCompile}`);
  }
  if (cmdCrossCompileArm32) {
    makeCmdArgs.push(`CROSS_COMPILE_ARM32=${cmdCrossCompileArm32}`);
  }
  makeCmdArgs.push(`CLANG_TRIPLE=${cmdClangTriple}`);

  // Add the rest of make arguments
  makeCmdArgs.push(...makeArgs);

  core.info(`Environment variables being set:`);
  core.info(`  PATH=${newPath.substring(0, 200)}...`);
  if (config.useCcache) {
    core.info(`  USE_CCACHE=1`);
  }
  core.info(`Make command: make ${makeCmdArgs.join(' ')}`);

  // Test if clang can be found in PATH
  try {
    await exec.exec('which', ['clang'], {
      cwd: config.kernelDir,
      env: { ...process.env, PATH: newPath },
      silent: true,
    });
    core.info('✓ clang found in PATH');
  } catch {
    core.warning('✗ clang NOT found in PATH');
  }

  // Run make using bash to match the bash script behavior exactly
  // This ensures environment variables are handled the same way
  let exitCode: number;
  try {
    // Use exec.exec with the constructed environment
    exitCode = await exec.exec('make', makeCmdArgs, {
      cwd: config.kernelDir,
      env: { ...process.env, ...envVars } as { [key: string]: string },
      silent: true,
      listeners: {
        stdout: (data: Buffer) => {
          fs.appendFileSync(logFile, data);
          process.stdout.write(data);
        },
        stderr: (data: Buffer) => {
          fs.appendFileSync(logFile, data);
          process.stderr.write(data);
        },
      },
    });
  } catch (error) {
    core.debug(`Build command failed: ${error}`);
    exitCode = 1;
  }

  core.endGroup();

  return exitCode === 0;
}

/**
 * Check if kernel build was successful
 */
export function isBuildSuccessful(kernelDir: string, arch: string): boolean {
  const bootDir = path.join(kernelDir, 'out', 'arch', arch, 'boot');

  if (!fs.existsSync(bootDir)) {
    return false;
  }

  const entries = fs.readdirSync(bootDir);

  // Check for Image or Image.*
  return entries.some((entry) => entry.startsWith('Image'));
}
