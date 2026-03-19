import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseExtraMakeArgs,
  filterMakeArgs,
  detectHostArch,
  dirExists,
  fileExists,
  readFile,
  writeFile,
  appendFile,
  removeDir,
  copyDir,
  findFiles,
  getActionPath,
  detectPackageManager,
} from '../src/utils';
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

// Mock modules
vi.mock('fs');
vi.mock('@actions/core');

// Mock process.getuid for sudoExec tests
const originalGetuid = process.getuid;
beforeEach(() => {
  vi.clearAllMocks();
  // Restore getuid mock before each test
  Object.defineProperty(process, 'getuid', {
    value: originalGetuid,
    writable: true,
    configurable: true,
  });
});

describe('parseExtraMakeArgs', () => {
  it('parses valid JSON array', () => {
    expect(parseExtraMakeArgs('["-j8", "V=1"]')).toEqual(['-j8', 'V=1']);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseExtraMakeArgs('invalid json')).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseExtraMakeArgs('{"key": "value"}')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseExtraMakeArgs('')).toEqual([]);
  });
});

describe('filterMakeArgs', () => {
  it('allows safe arguments', () => {
    const args = ['-j8', 'V=1', 'DEBUG=1'];
    expect(filterMakeArgs(args)).toEqual(['-j8', 'V=1', 'DEBUG=1']);
  });

  it('filters out dangerous CC override', () => {
    const args = ['-j8', 'CC=malicious'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out CROSS_COMPILE override', () => {
    const args = ['CROSS_COMPILE=arm-', 'DEBUG=1'];
    expect(filterMakeArgs(args)).toEqual(['DEBUG=1']);
  });

  it('filters all dangerous arguments', () => {
    const dangerousArgs = [
      'CC=gcc',
      'CXX=g++',
      'LD=ld',
      'SHELL=/bin/bash',
      'CROSS_COMPILE=arm-',
      'DEBUG=1',
    ];
    expect(filterMakeArgs(dangerousArgs)).toEqual(['DEBUG=1']);
  });

  // Security enhancement tests - case-insensitive matching
  it('filters out lowercase cc= override (case-insensitive)', () => {
    const args = ['-j8', 'cc=/bin/sh', 'DEBUG=1'];
    expect(filterMakeArgs(args)).toEqual(['-j8', 'DEBUG=1']);
  });

  it('filters out mixed case Cc= override', () => {
    const args = ['Cc=/bin/sh', 'cC=/bin/bash', 'DEBUG=1'];
    expect(filterMakeArgs(args)).toEqual(['DEBUG=1']);
  });

  it('filters out lowercase cross_compile= override', () => {
    const args = ['cross_compile=arm-', 'DEBUG=1'];
    expect(filterMakeArgs(args)).toEqual(['DEBUG=1']);
  });

  // Security enhancement tests - shell metacharacter injection
  it('filters out command substitution with $()', () => {
    const args = ['-j8', 'CFLAGS=$(id)'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out backtick command substitution', () => {
    const args = ['-j8', 'CFLAGS=`whoami`'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out semicolon injection', () => {
    const args = ['-j8', 'CFLAGS=;rm -rf /'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out pipe injection', () => {
    const args = ['-j8', 'CFLAGS=|cat /etc/passwd'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out ampersand injection', () => {
    const args = ['-j8', 'CFLAGS=&malicious'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out backslash injection', () => {
    const args = ['-j8', 'CFLAGS=\\n malicious'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out brace expansion injection', () => {
    const args = ['-j8', 'CFLAGS={a,b}'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  it('filters out parenthesis injection', () => {
    const args = ['-j8', 'CFLAGS=(echo pwned)'];
    expect(filterMakeArgs(args)).toEqual(['-j8']);
  });

  // Security enhancement tests - dangerous make flags
  it('filters out -C directory change', () => {
    const args = ['-C', '/etc', 'all'];
    // Only -C is filtered, /etc and all remain
    expect(filterMakeArgs(args)).toEqual(['/etc', 'all']);
  });

  it('filters out -C=/path format', () => {
    const args = ['-C=/root', 'all'];
    expect(filterMakeArgs(args)).toEqual(['all']);
  });

  it('filters out --directory flag', () => {
    const args = ['--directory=/root', 'all'];
    expect(filterMakeArgs(args)).toEqual(['all']);
  });

  it('filters out -f file override', () => {
    const args = ['-f', '/etc/passwd'];
    // Only -f is filtered, /etc/passwd remains
    expect(filterMakeArgs(args)).toEqual(['/etc/passwd']);
  });

  it('filters out -f=/path format', () => {
    const args = ['-f=/etc/shadow', 'all'];
    expect(filterMakeArgs(args)).toEqual(['all']);
  });

  it('filters out --file flag', () => {
    const args = ['--file=/etc/passwd'];
    expect(filterMakeArgs(args)).toEqual([]);
  });

  it('filters out --makefile flag', () => {
    const args = ['--makefile=/tmp/malicious.mk'];
    expect(filterMakeArgs(args)).toEqual([]);
  });

  it('filters out -e environment override', () => {
    const args = ['-e', 'all'];
    expect(filterMakeArgs(args)).toEqual(['all']);
  });

  it('filters out --environment-overrides flag', () => {
    const args = ['--environment-overrides', 'all'];
    expect(filterMakeArgs(args)).toEqual(['all']);
  });

  // Audit logging tests
  it('logs [FILTER:VAR] warning for variable override', () => {
    filterMakeArgs(['CC=/bin/sh']);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('[FILTER:VAR]')
    );
  });

  it('logs [FILTER:FLAG] warning for dangerous flag', () => {
    filterMakeArgs(['-C', '/etc']);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('[FILTER:FLAG]')
    );
  });

  it('logs [FILTER:SHELL] warning for shell metacharacters', () => {
    filterMakeArgs(['CFLAGS=$(id)']);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('[FILTER:SHELL]')
    );
  });

  it('logs warning with original argument content', () => {
    filterMakeArgs(['cc=/bin/sh']);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('cc=/bin/sh')
    );
  });
});

describe('detectHostArch', () => {
  it('returns arm for arm arch', () => {
    vi.spyOn(process, 'arch', 'get').mockReturnValue('arm');
    expect(detectHostArch()).toBe('arm');
  });

  it('returns arm for arm64 arch', () => {
    vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64');
    expect(detectHostArch()).toBe('arm');
  });

  it('returns x86_64 for x64 arch', () => {
    vi.spyOn(process, 'arch', 'get').mockReturnValue('x64');
    expect(detectHostArch()).toBe('x86_64');
  });

  it('returns original arch for unknown', () => {
    vi.spyOn(process, 'arch', 'get').mockReturnValue('riscv');
    expect(detectHostArch()).toBe('riscv');
  });
});

describe('dirExists', () => {
  it('returns true for existing directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    expect(dirExists('/some/dir')).toBe(true);
  });

  it('returns false for non-existing path', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(dirExists('/nonexistent')).toBe(false);
  });

  it('returns false for file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);
    expect(dirExists('/some/file')).toBe(false);
  });
});

describe('fileExists', () => {
  it('returns true for existing file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    expect(fileExists('/some/file.txt')).toBe(true);
  });

  it('returns false for non-existing path', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(fileExists('/nonexistent')).toBe(false);
  });

  it('returns false for directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as fs.Stats);
    expect(fileExists('/some/dir')).toBe(false);
  });
});

describe('readFile', () => {
  it('returns file content', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue('file content');
    expect(readFile('/some/file.txt')).toBe('file content');
  });

  it('returns empty string for non-existing file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readFile('/nonexistent')).toBe('');
  });
});

describe('writeFile', () => {
  it('writes content to file', () => {
    const writeMock = vi.mocked(fs.writeFileSync);
    writeFile('/some/file.txt', 'content');
    expect(writeMock).toHaveBeenCalledWith('/some/file.txt', 'content', 'utf-8');
  });
});

describe('appendFile', () => {
  it('appends content to file', () => {
    const appendMock = vi.mocked(fs.appendFileSync);
    appendFile('/some/file.txt', 'more content');
    expect(appendMock).toHaveBeenCalledWith('/some/file.txt', 'more content', 'utf-8');
  });
});

describe('removeDir', () => {
  it('removes existing directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const rmMock = vi.mocked(fs.rmSync);
    removeDir('/some/dir');
    expect(rmMock).toHaveBeenCalledWith('/some/dir', { recursive: true, force: true });
  });

  it('does nothing for non-existing directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const rmMock = vi.mocked(fs.rmSync);
    removeDir('/nonexistent');
    expect(rmMock).not.toHaveBeenCalled();
  });
});

describe('copyDir', () => {
  it('copies directory recursively', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync);
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    
    copyDir('/src', '/dest');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/dest', { recursive: true });
  });
});

describe('findFiles', () => {
  it('finds files matching pattern', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'file1.ts', isDirectory: () => false },
      { name: 'file2.js', isDirectory: () => false },
    ] as fs.Dirent[]);
    
    const results = findFiles('/dir', /\.ts$/);
    expect(results).toContain('/dir/file1.ts');
    expect(results).not.toContain('/dir/file2.js');
  });

  it('returns empty array for non-existing directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(findFiles('/nonexistent', /.*/)).toEqual([]);
  });

  it('recursively finds files in subdirectories', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    let callCount = 0;
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call - root directory
        return [
          { name: 'subdir', isDirectory: () => true, isFile: () => false },
          { name: 'root.ts', isDirectory: () => false, isFile: () => true },
        ] as fs.Dirent[];
      } else {
        // Second call - subdirectory
        return [
          { name: 'nested.ts', isDirectory: () => false, isFile: () => true },
        ] as fs.Dirent[];
      }
    });
    
    const results = findFiles('/dir', /\.ts$/);
    expect(results).toContain('/dir/root.ts');
    expect(results).toContain('/dir/subdir/nested.ts');
  });
});

describe('getActionPath', () => {
  it('returns env GITHUB_ACTION_PATH if set', () => {
    process.env.GITHUB_ACTION_PATH = '/action/path';
    expect(getActionPath()).toBe('/action/path');
    delete process.env.GITHUB_ACTION_PATH;
  });

  it('returns fallback path if env not set', () => {
    delete process.env.GITHUB_ACTION_PATH;
    const result = getActionPath();
    // Should return a path (either from __dirname or fallback)
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('detectPackageManager', () => {
  it('returns apt when apt exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );
    expect(detectPackageManager()).toBe('apt');
  });

  it('returns pacman when pacman exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/pacman' || p === '/bin/pacman'
    );
    expect(detectPackageManager()).toBe('pacman');
  });

  it('returns unknown when neither exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(detectPackageManager()).toBe('unknown');
  });
});

// Additional imports for new tests
import {
  sudoExec,
  checkEnvironment,
  installDependencies,
  installSystemClang,
} from '../src/utils';
import * as exec from '@actions/exec';

// Mock exec module
vi.mock('@actions/exec');

describe('sudoExec', () => {
  it('executes command directly when running as root', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await sudoExec('ls', ['-la']);

    expect(exec.exec).toHaveBeenCalledWith('ls', ['-la'], undefined);
  });

  it('executes command with sudo when not running as root', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 1000,
      writable: true,
      configurable: true,
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await sudoExec('apt-get', ['install', 'git']);

    expect(exec.exec).toHaveBeenCalledWith('sudo', ['apt-get', 'install', 'git'], undefined);
  });

  it('passes options to exec', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(exec.exec).mockResolvedValue(0);
    const options = { cwd: '/tmp', silent: true };

    await sudoExec('ls', ['-la'], options);

    expect(exec.exec).toHaveBeenCalledWith('ls', ['-la'], options);
  });

  it('handles when getuid is undefined (non-POSIX)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    vi.mocked(exec.exec).mockResolvedValue(0);

    await sudoExec('ls', ['-la']);

    // When getuid is undefined, it should use sudo (not root)
    expect(exec.exec).toHaveBeenCalledWith('sudo', ['ls', '-la'], undefined);
  });
});

describe('checkEnvironment', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  it('does not throw when running in GitHub Actions Linux with apt', () => {
    process.env.GITHUB_ACTIONS = 'true';
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    expect(() => checkEnvironment()).not.toThrow();
  });

  it('throws error when not in GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'false';
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    expect(() => checkEnvironment()).toThrow('This action requires GitHub Actions Linux runners');
  });

  it('throws error when not on Linux', () => {
    process.env.GITHUB_ACTIONS = 'true';
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    expect(() => checkEnvironment()).toThrow('This action requires GitHub Actions Linux runners');
  });

  it('throws error when package manager is unknown', () => {
    process.env.GITHUB_ACTIONS = 'true';
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => checkEnvironment()).toThrow('This action requires GitHub Actions Linux runners');
  });
});

describe('installDependencies', () => {
  beforeEach(() => {
    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(core.startGroup).mockImplementation(() => undefined);
    vi.mocked(core.endGroup).mockImplementation(() => undefined);
  });

  it('installs dependencies with apt (as root)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    await installDependencies();

    expect(exec.exec).toHaveBeenCalledWith('apt-get', ['update'], undefined);
    expect(exec.exec).toHaveBeenCalledWith(
      'apt-get',
      expect.arrayContaining(['install', '--no-install-recommends', '-y', 'git', 'make']),
      undefined
    );
  });

  it('installs dependencies with apt (with sudo)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 1000,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    await installDependencies();

    expect(exec.exec).toHaveBeenCalledWith('sudo', ['apt-get', 'update'], undefined);
  });

  it('installs dependencies with pacman', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/pacman' || p === '/bin/pacman'
    );

    await installDependencies();

    expect(exec.exec).toHaveBeenCalledWith('pacman', ['-Syyu', '--noconfirm'], undefined);
    expect(exec.exec).toHaveBeenCalledWith(
      'pacman',
      expect.arrayContaining(['-S', '--noconfirm', 'git']),
      undefined
    );
  });
});

describe('installSystemClang', () => {
  beforeEach(() => {
    vi.mocked(exec.exec).mockResolvedValue(0);
    vi.mocked(core.startGroup).mockImplementation(() => undefined);
    vi.mocked(core.endGroup).mockImplementation(() => undefined);
  });

  it('installs clang with apt (as root)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    await installSystemClang();

    expect(exec.exec).toHaveBeenCalledWith('apt-get', ['install', '-y', 'clang', 'lld'], undefined);
    expect(exec.exec).toHaveBeenCalledWith(
      'apt-get',
      expect.arrayContaining(['install', '-y', 'binutils-aarch64-linux-gnu']),
      undefined
    );
  });

  it('installs clang with pacman (as root)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 0,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/pacman' || p === '/bin/pacman'
    );

    await installSystemClang();

    expect(exec.exec).toHaveBeenCalledWith(
      'pacman',
      ['-S', '--noconfirm', 'clang', 'lld', 'llvm'],
      undefined
    );
  });

  it('installs clang with apt (using sudo)', async () => {
    Object.defineProperty(process, 'getuid', {
      value: () => 1000,
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockImplementation((p) => 
      p === '/usr/bin/apt' || p === '/bin/apt'
    );

    await installSystemClang();

    expect(exec.exec).toHaveBeenCalledWith('sudo', expect.arrayContaining(['apt-get', 'install', '-y', 'clang']), undefined);
  });
});

describe('copyDir', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies files recursively with nested directories', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);
    
    // Simulate nested directory structure
    let callCount = 0;
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call - root level
        return [
          { name: 'subdir', isDirectory: () => true, isFile: () => false },
          { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        ] as fs.Dirent[];
      } else {
        // Second call - nested directory
        return [
          { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
        ] as fs.Dirent[];
      }
    });

    copyDir('/src', '/dest');

    expect(fs.mkdirSync).toHaveBeenCalledWith('/dest', { recursive: true });
    expect(fs.copyFileSync).toHaveBeenCalledWith('/src/file1.txt', '/dest/file1.txt');
    expect(fs.copyFileSync).toHaveBeenCalledWith('/src/subdir/file2.txt', '/dest/subdir/file2.txt');
  });

  it('handles existing destination directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'file.txt', isDirectory: () => false, isFile: () => true },
    ] as fs.Dirent[]);
    vi.mocked(fs.copyFileSync).mockImplementation(() => undefined);

    copyDir('/src', '/dest');

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.copyFileSync).toHaveBeenCalledWith('/src/file.txt', '/dest/file.txt');
  });
});
