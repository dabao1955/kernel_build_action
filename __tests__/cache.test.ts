import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCcacheEnv,
  addCcacheToPath,
  setupCcacheSymlinks,
  showCcacheStats,
  clearCcache,
  setupCcache,
  saveCcache,
} from '../src/cache';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as cache from '@actions/cache';

// Mock all dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('@actions/cache');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCcacheEnv', () => {
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it('returns ccache environment variables', () => {
    process.env.HOME = '/test/home';
    const env = getCcacheEnv();
    expect(env).toHaveProperty('CCACHE_DIR');
    expect(env).toHaveProperty('USE_CCACHE');
    expect(env.USE_CCACHE).toBe('1');
    expect(env.CCACHE_DIR).toContain('.ccache');
  });

  it('uses HOME environment variable', () => {
    process.env.HOME = '/custom/home';
    const env = getCcacheEnv();
    expect(env.CCACHE_DIR).toBe('/custom/home/.ccache');
  });

  it('falls back to default when HOME not set', () => {
    delete process.env.HOME;
    const env = getCcacheEnv();
    // Should fall back to /home/runner/.ccache
    expect(env.CCACHE_DIR).toMatch(/\/.ccache$/);
  });
});

describe('addCcacheToPath', () => {
  it('adds ccache path when directory exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    addCcacheToPath();

    expect(core.addPath).toHaveBeenCalledWith('/usr/lib/ccache');
  });

  it('does not add path when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    addCcacheToPath();

    expect(core.addPath).not.toHaveBeenCalled();
  });

  it('checks both ccache paths', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => p === '/usr/local/opt/ccache/libexec'
    );
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    addCcacheToPath();

    expect(core.addPath).toHaveBeenCalledWith('/usr/local/opt/ccache/libexec');
  });
});

describe('setupCcacheSymlinks', () => {
  it('creates symlinks for all compilers', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const symlinkMock = vi.mocked(fs.symlinkSync);

    await setupCcacheSymlinks();

    expect(symlinkMock).toHaveBeenCalledTimes(6);
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/gcc');
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/g++');
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/clang');
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/clang++');
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/cc');
    expect(symlinkMock).toHaveBeenCalledWith('/usr/bin/ccache', '/usr/lib/ccache/c++');
  });

  it('creates ccache directory if not exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const mkdirMock = vi.mocked(fs.mkdirSync);

    await setupCcacheSymlinks();

    expect(mkdirMock).toHaveBeenCalledWith('/usr/lib/ccache', { recursive: true });
  });

  it('skips existing symlinks', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const symlinkMock = vi.mocked(fs.symlinkSync);

    await setupCcacheSymlinks();

    expect(symlinkMock).not.toHaveBeenCalled();
  });

  it('handles symlink creation errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.symlinkSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    await expect(setupCcacheSymlinks()).resolves.not.toThrow();
  });
});

describe('showCcacheStats', () => {
  it('executes ccache -s command', async () => {
    const execMock = vi.mocked(exec.exec);

    await showCcacheStats();

    expect(execMock).toHaveBeenCalledWith('ccache', ['-s']);
    expect(core.startGroup).toHaveBeenCalledWith('ccache statistics');
    expect(core.endGroup).toHaveBeenCalled();
  });
});

describe('clearCcache', () => {
  it('executes ccache -C command', async () => {
    const execMock = vi.mocked(exec.exec);
    const infoMock = vi.mocked(core.info);

    await clearCcache();

    expect(execMock).toHaveBeenCalledWith('ccache', ['-C']);
    expect(infoMock).toHaveBeenCalledWith('Clearing ccache...');
  });
});

describe('setupCcache', () => {
  it('sets up ccache directory and restores cache on hit', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(cache.restoreCache).mockResolvedValue('ccache-defconfig-abc123');

    await setupCcache('defconfig');

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.ccache'), { recursive: true });
    expect(exec.exec).toHaveBeenCalledWith('ccache', ['-M', '4G']);
    expect(cache.restoreCache).toHaveBeenCalledWith(
      [expect.stringContaining('.ccache')],
      expect.stringContaining('ccache-defconfig-'),
      [expect.stringContaining('ccache-defconfig-')]
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Cache restored'));
  });

  it('handles cache miss gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(cache.restoreCache).mockResolvedValue(undefined);

    await setupCcache('defconfig');

    expect(core.info).toHaveBeenCalledWith('Cache not found');
  });

  it('handles cache restore errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(cache.restoreCache).mockRejectedValue(new Error('Network error'));

    await setupCcache('defconfig');

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to restore cache'));
  });

  it('skips directory creation if already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
    vi.mocked(cache.restoreCache).mockResolvedValue('ccache-defconfig-abc123');

    await setupCcache('defconfig');

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('creates directory when ccache dir does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(cache.restoreCache).mockResolvedValue('ccache-defconfig-abc123');

    await setupCcache('defconfig');

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('.ccache'), { recursive: true });
  });
});

describe('saveCcache', () => {
  it('saves ccache successfully', async () => {
    vi.mocked(cache.saveCache).mockResolvedValue(123);

    await saveCcache('defconfig');

    expect(cache.saveCache).toHaveBeenCalledWith(
      [expect.stringContaining('.ccache')],
      expect.stringContaining('ccache-defconfig-')
    );
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Cache saved'));
  });

  it('handles save cache errors gracefully', async () => {
    vi.mocked(cache.saveCache).mockRejectedValue(new Error('Network error'));

    await saveCcache('defconfig');

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to save cache'));
  });
});
