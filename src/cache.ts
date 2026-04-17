import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dirExists } from './utils';

const CCACHE_DIR = path.join(process.env.HOME || os.homedir(), '.ccache');

/**
 * Setup ccache cache
 */
export async function setupCcache(config: string): Promise<void> {
  core.startGroup('Setting up ccache');

  // Ensure ccache directory exists
  if (!dirExists(CCACHE_DIR)) {
    fs.mkdirSync(CCACHE_DIR, { recursive: true });
  }

  // Set ccache max size to 4GB
  await exec.exec('ccache', ['-M', '4G']);

  // Restore cache
  const key = `ccache-${config}-${process.env.GITHUB_SHA || 'default'}`;
  const restoreKeys = [`ccache-${config}-`];

  try {
    const cacheHit = await cache.restoreCache([CCACHE_DIR], key, restoreKeys);
    if (cacheHit) {
      core.info(`Cache restored from key: ${cacheHit}`);
    } else {
      core.info('Cache not found');
    }
  } catch (error) {
    core.warning(`Failed to restore cache: ${error}`);
  }

  core.endGroup();
}

/**
 * Save ccache cache
 */
export async function saveCcache(config: string): Promise<void> {
  core.startGroup('Saving ccache');

  const key = `ccache-${config}-${process.env.GITHUB_SHA || 'default'}`;

  try {
    await cache.saveCache([CCACHE_DIR], key);
    core.info(`Cache saved with key: ${key}`);
  } catch (error) {
    core.warning(`Failed to save cache: ${error}`);
  }

  core.endGroup();
}

/**
 * Setup ccache symlinks
 */
export async function setupCcacheSymlinks(): Promise<void> {
  core.startGroup('Setting up ccache symlinks');

  const ccacheDir = '/usr/lib/ccache';
  if (!dirExists(ccacheDir)) {
    try {
      await exec.exec('sudo', ['mkdir', '-p', ccacheDir]);
    } catch {
      core.warning('Failed to create ccache directory, trying without sudo');
      fs.mkdirSync(ccacheDir, { recursive: true });
    }
  }

  const compilers = ['gcc', 'g++', 'clang', 'clang++', 'cc', 'c++'];
  for (const compiler of compilers) {
    const symlinkPath = path.join(ccacheDir, compiler);
    if (!fs.existsSync(symlinkPath)) {
      try {
        await exec.exec('sudo', ['ln', '-sf', '/usr/bin/ccache', symlinkPath]);
      } catch {
        core.warning(`Failed to create symlink for ${compiler}, trying without sudo`);
        try {
          fs.symlinkSync('/usr/bin/ccache', symlinkPath);
        } catch {
          // Ignore if symlink creation fails
        }
      }
    }
  }

  core.endGroup();
}

/**
 * Show ccache statistics
 */
export async function showCcacheStats(): Promise<void> {
  core.startGroup('ccache statistics');
  await exec.exec('ccache', ['-s']);
  core.endGroup();
}

/**
 * Clear ccache
 */
export async function clearCcache(): Promise<void> {
  core.info('Clearing ccache...');
  await exec.exec('ccache', ['-C']);
}

/**
 * Get ccache environment variables
 */
export function getCcacheEnv(): { [key: string]: string } {
  // Calculate at runtime to allow testing with different HOME values
  const ccacheDir = path.join(process.env.HOME || os.homedir(), '.ccache');
  return {
    CCACHE_DIR: ccacheDir,
    USE_CCACHE: '1',
  };
}

/**
 * Add ccache to PATH
 */
export function addCcacheToPath(): void {
  const ccachePaths = ['/usr/lib/ccache', '/usr/local/opt/ccache/libexec'];
  for (const ccachePath of ccachePaths) {
    if (dirExists(ccachePath)) {
      core.addPath(ccachePath);
    }
  }
}
