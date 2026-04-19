import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Execute command with sudo if not running as root
 */
export async function sudoExec(
  command: string,
  args: string[],
  options?: exec.ExecOptions
): Promise<number> {
  const isRoot = process.getuid && process.getuid() === 0;
  if (isRoot) {
    return await exec.exec(command, args, options);
  } else {
    return await exec.exec('sudo', [command, ...args], options);
  }
}

/**
 * Detect package manager (apt or pacman)
 */
export function detectPackageManager(): string {
  if (fs.existsSync('/bin/apt') || fs.existsSync('/usr/bin/apt')) {
    return 'apt';
  }
  if (fs.existsSync('/bin/pacman') || fs.existsSync('/usr/bin/pacman')) {
    return 'pacman';
  }
  return 'unknown';
}

/**
 * Check if running in GitHub Actions Linux environment
 */
export function checkEnvironment(): void {
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  const osType = process.platform;
  const pkgMgr = detectPackageManager();

  if (!isGitHubActions || osType !== 'linux' || pkgMgr === 'unknown') {
    throw new Error(
      `This action requires GitHub Actions Linux runners (Debian-based or ArchLinux-based). ` +
        `Current: platform=${osType}, GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}`
    );
  }
}

/**
 * Install system dependencies
 */
export async function installDependencies(): Promise<void> {
  const pkgMgr = detectPackageManager();
  core.startGroup('Installing dependency packages');

  if (pkgMgr === 'apt') {
    await sudoExec('apt-get', ['update']);
    await sudoExec('apt-get', [
      'install',
      '--no-install-recommends',
      '-y',
      'binutils',
      'git',
      'make',
      'bc',
      'bison',
      'openssl',
      'curl',
      'zip',
      'kmod',
      'cpio',
      'flex',
      'libelf-dev',
      'libssl-dev',
      'libtfm-dev',
      'libc6-dev',
      'device-tree-compiler',
      'ca-certificates',
      'python3',
      'xz-utils',
      'aria2',
      'build-essential',
      'ccache',
      'pigz',
      'parallel',
      'jq',
      'opam',
      'libpcre3-dev',
    ]);
  } else if (pkgMgr === 'pacman') {
    await sudoExec('pacman', ['-Syyu', '--noconfirm']);
    await sudoExec('pacman', [
      '-S',
      '--noconfirm',
      'git',
      'base-devel',
      'opam',
      'aria2',
      'python3',
      'ccache',
      'pigz',
      'parallel',
      'jq',
      'pcre2',
    ]);
  }

  core.endGroup();
}

/**
 * Install clang and binutils from system
 */
export async function installSystemClang(): Promise<void> {
  const pkgMgr = detectPackageManager();

  if (pkgMgr === 'apt') {
    await sudoExec('apt-get', ['install', '-y', 'clang', 'lld']);
    await sudoExec('apt-get', [
      'install',
      '-y',
      'binutils-aarch64-linux-gnu',
      'binutils-arm-linux-gnueabihf',
    ]);
  } else if (pkgMgr === 'pacman') {
    await sudoExec('pacman', ['-S', '--noconfirm', 'clang', 'lld', 'llvm']);
  }
}

/**
 * Get action path
 */
export function getActionPath(): string {
  return process.env.GITHUB_ACTION_PATH || path.join(__dirname, '..');
}

/**
 * Parse extra make arguments from JSON string
 */
export function parseExtraMakeArgs(jsonStr: string): string[] {
  try {
    const args = JSON.parse(jsonStr);
    if (Array.isArray(args)) {
      return args;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Filter out dangerous make arguments
 * Enhanced with: case-insensitive matching, shell metachar detection,
 * dangerous make flags filtering, and audit logging
 */
export function filterMakeArgs(args: string[]): string[] {
  // Dangerous variable prefixes (case-insensitive)
  const dangerousVars = [
    'CC=',
    'CXX=',
    'LD=',
    'AS=',
    'AR=',
    'NM=',
    'STRIP=',
    'OBJCOPY=',
    'OBJDUMP=',
    'HOSTCC=',
    'KBUILD_HOSTCC=',
    'SHELL=',
    'MAKEFLAGS=',
    'MAKE=',
    'CROSS_COMPILE=',
    'CLANG_TRIPLE=',
    'LLVM=',
    'CLVM=',
    'O=',
    'ARCH=',
  ];

  // Dangerous make flags that could change build behavior or execute arbitrary commands
  const dangerousFlags = [
    '-C',
    '--directory',
    '-f',
    '--file',
    '--makefile',
    '-e',
    '--environment-overrides',
  ];

  // Shell metacharacters that could enable command injection
  const shellMetachars = /[`$\\;|&<>(){}[\]]/;

  return args.filter((arg) => {
    const upperArg = arg.toUpperCase();

    // Check 1: Dangerous variable override (case-insensitive)
    for (const prefix of dangerousVars) {
      if (upperArg.startsWith(prefix.toUpperCase())) {
        core.warning(`[FILTER:VAR] Ignoring critical variable override: ${arg}`);
        return false;
      }
    }

    // Check 2: Dangerous make flags
    for (const flag of dangerousFlags) {
      if (arg === flag || arg.startsWith(`${flag}=`)) {
        core.warning(`[FILTER:FLAG] Ignoring dangerous make flag: ${arg}`);
        return false;
      }
    }

    // Check 3: Shell metacharacters (command injection prevention)
    if (shellMetachars.test(arg)) {
      core.warning(`[FILTER:SHELL] Ignoring argument with shell metacharacters: ${arg}`);
      return false;
    }

    return true;
  });
}

/**
 * Detect host architecture
 */
export function detectHostArch(): string {
  const arch = process.arch;
  switch (arch) {
    case 'arm':
    case 'arm64':
      return 'arm';
    case 'x64':
      return 'x86_64';
    default:
      return arch;
  }
}

/**
 * Check if directory exists
 */
export function dirExists(dirPath: string): boolean {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

/**
 * Read file content
 */
export function readFile(filePath: string): string {
  if (!fileExists(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write file content
 */
export function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Append to file
 */
export function appendFile(filePath: string, content: string): void {
  fs.appendFileSync(filePath, content, 'utf-8');
}

/**
 * Remove directory recursively
 */
export function removeDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Copy directory recursively
 */
export function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Find files matching pattern
 */
export function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

export function validateNoPathTraversal(value: string, name: string): void {
  if (value.includes('..')) {
    throw new Error(`${name} must not contain path traversal sequences (..)`);
  }
}

export function validateBranchName(branch: string, name: string): void {
  if (branch.startsWith('-')) {
    throw new Error(`${name} must not start with a hyphen`);
  }
}

export function validatePositiveInteger(value: string, name: string): void {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer, got: ${value}`);
  }
}

export function validateUrlSegment(value: string, name: string): void {
  if (value.includes('..') || value.includes('/')) {
    throw new Error(`${name} must not contain path traversal sequences or slashes`);
  }
}

export function validateKsuVersion(version: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(version)) {
    throw new Error(
      `ksu-version contains invalid characters: ${version}. Only alphanumeric characters, dots, hyphens, and underscores are allowed`
    );
  }
}

export function sanitizeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.replace(/token[=:]\s*\S+/gi, 'token=***');
}
