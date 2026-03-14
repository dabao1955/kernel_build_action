import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanKernelSource,
  cleanBuildArtifacts,
  cleanToolchains,
  cleanAnyKernel3,
  cleanEnvVars,
  cleanTempFiles,
  cleanSplitDir,
  cleanAll,
  cleanCcache,
} from '../src/clean';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Mock fs, @actions/core and @actions/exec
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cleanKernelSource', () => {
  it('removes existing kernel directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);
    const infoMock = vi.mocked(core.info);

    cleanKernelSource('kernel');
    expect(rmMock).toHaveBeenCalledWith('kernel', { recursive: true, force: true });
    expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('Removing kernel'));
  });

  it('does nothing when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const rmMock = vi.mocked(fs.rmSync);

    cleanKernelSource('kernel');
    expect(rmMock).not.toHaveBeenCalled();
  });
});

describe('cleanBuildArtifacts', () => {
  it('removes existing build directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);

    cleanBuildArtifacts('build');
    expect(rmMock).toHaveBeenCalledWith('build', { recursive: true, force: true });
  });
});

describe('cleanToolchains', () => {
  beforeEach(() => {
    process.env.HOME = '/home/runner';
  });

  it('removes clang directory', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === '/home/runner/clang');
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);

    cleanToolchains();
    expect(rmMock).toHaveBeenCalledWith('/home/runner/clang', { recursive: true, force: true });
  });

  it('removes gcc-64 and gcc-32 directories', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => String(p) === '/home/runner/gcc-64' || String(p) === '/home/runner/gcc-32'
    );
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);

    cleanToolchains();
    expect(rmMock).toHaveBeenCalledWith('/home/runner/gcc-64', { recursive: true, force: true });
    expect(rmMock).toHaveBeenCalledWith('/home/runner/gcc-32', { recursive: true, force: true });
  });

  it('warns when HOME is not set', () => {
    delete process.env.HOME;
    const warningMock = vi.mocked(core.warning);

    cleanToolchains();

    expect(warningMock).toHaveBeenCalledWith('HOME environment variable not set, skipping toolchain cleanup');
  });
});

describe('cleanAnyKernel3', () => {
  it('removes AnyKernel3 directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);

    cleanAnyKernel3();
    expect(rmMock).toHaveBeenCalledWith('AnyKernel3', { recursive: true, force: true });
  });
});

describe('cleanEnvVars', () => {
  it('cleans specified environment variables', () => {
    process.env.CMD_PATH = '/some/path';
    process.env.CCACHE_DIR = '/cache';

    cleanEnvVars();

    expect(process.env.CMD_PATH).toBeUndefined();
  });

  it('preserves variables not in list', () => {
    process.env.OTHER_VAR = 'value';

    cleanEnvVars();

    expect(process.env.OTHER_VAR).toBe('value');
    delete process.env.OTHER_VAR;
  });
});

describe('cleanTempFiles', () => {
  it('removes existing temp files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    const unlinkMock = vi.mocked(fs.unlinkSync);

    cleanTempFiles();
    expect(unlinkMock).toHaveBeenCalledWith('boot.img');
    expect(unlinkMock).toHaveBeenCalledWith('magiskboot');
  });

  it('does not remove non-existing files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const unlinkMock = vi.mocked(fs.unlinkSync);

    cleanTempFiles();
    expect(unlinkMock).not.toHaveBeenCalled();
  });
});

describe('cleanSplitDir', () => {
  it('removes split directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    const rmMock = vi.mocked(fs.rmSync);

    cleanSplitDir();
    expect(rmMock).toHaveBeenCalledWith('split', { recursive: true, force: true });
  });
});

describe('cleanAll', () => {
  beforeEach(() => {
    process.env.HOME = '/home/runner';
  });

  it('cleans all by default', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await cleanAll({});

    expect(core.startGroup).toHaveBeenCalledWith('Cleaning up');
    expect(core.endGroup).toHaveBeenCalled();
  });

  it('cleans toolchains when specified', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === '/home/runner/clang');
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    await cleanAll({ toolchains: true });

    expect(fs.rmSync).toHaveBeenCalledWith('/home/runner/clang', { recursive: true, force: true });
  });

  it('cleans ccache when specified', async () => {
    const execMock = vi.mocked(exec.exec);

    await cleanAll({ ccache: true });

    expect(execMock).toHaveBeenCalledWith('ccache', ['-C']);
  });

  it('cleans env vars when specified', async () => {
    process.env.CMD_PATH = '/some/path';

    await cleanAll({ env: true });

    expect(process.env.CMD_PATH).toBeUndefined();
  });

  it('uses custom kernel and build directories', async () => {
    // Mock for directories (kernel and build)
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return path === 'custom-kernel' || path === 'custom-build';
    });
    vi.mocked(fs.statSync).mockImplementation((p) => {
      const path = String(p);
      if (path === 'custom-kernel' || path === 'custom-build') {
        return { isDirectory: () => true, isFile: () => false } as fs.Stats;
      }
      return { isDirectory: () => false, isFile: () => true } as fs.Stats;
    });

    await cleanAll({ kernelDir: 'custom-kernel', buildDir: 'custom-build' });

    expect(fs.rmSync).toHaveBeenCalledWith('custom-kernel', { recursive: true, force: true });
    expect(fs.rmSync).toHaveBeenCalledWith('custom-build', { recursive: true, force: true });
  });
});

describe('cleanCcache', () => {
  it('clears ccache successfully', async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);
    const infoMock = vi.mocked(core.info);

    await cleanCcache();

    expect(exec.exec).toHaveBeenCalledWith('ccache', ['-C']);
    expect(infoMock).toHaveBeenCalledWith('Ccache cleared');
  });

  it('ignores error when ccache is not available', async () => {
    vi.mocked(exec.exec).mockRejectedValue(new Error('ccache not found'));

    await expect(cleanCcache()).resolves.not.toThrow();
  });
});
