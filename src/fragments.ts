import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists } from './utils';

/**
 * Resolve the `merge-configs` input (a JSON array of strings) into a list of
 * local absolute config fragment paths.
 *
 * Each entry is either:
 *  - an https URL, which is downloaded into the kernel tree, or
 *  - a path relative to the kernel source directory.
 *
 * Fragments are merged over the expanded defconfig with
 * `scripts/kconfig/merge_config.sh` during the build stage.
 */
export async function resolveConfigFragments(
  mergeConfigs: string,
  kernelDir: string
): Promise<string[]> {
  let entries: unknown;
  try {
    entries = JSON.parse(mergeConfigs || '[]');
  } catch (error) {
    throw new Error(
      `merge-configs must be a JSON array of strings: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }

  if (!Array.isArray(entries)) {
    throw new Error('merge-configs must be a JSON array of strings');
  }
  if (entries.some((entry) => typeof entry !== 'string')) {
    throw new Error('merge-configs must only contain strings');
  }

  const resolved: string[] = [];
  const fragmentsDir = path.join(kernelDir, 'out', 'config-fragments');
  const absKernelDir = path.resolve(kernelDir);
  let index = 0;

  for (const entry of entries as string[]) {
    if (entry.startsWith('-')) {
      throw new Error(`merge-configs entries must not start with a hyphen: ${entry}`);
    }

    if (/^https?:\/\//.test(entry)) {
      fs.mkdirSync(fragmentsDir, { recursive: true });
      const fragmentPath = path.join(fragmentsDir, `fragment_${index}.config`);
      core.info(`Downloading config fragment: ${entry}`);
      await exec.exec('curl', ['-sSLf', '--', entry, '-o', fragmentPath]);
      resolved.push(fragmentPath);
    } else {
      const fragmentPath = path.resolve(kernelDir, entry);
      if (!fragmentPath.startsWith(absKernelDir + path.sep)) {
        throw new Error(
          `merge-configs entry escapes the kernel directory: ${entry} (path traversal is not allowed)`
        );
      }
      if (!fileExists(fragmentPath)) {
        throw new Error(`merge-configs entry not found in kernel source: ${entry}`);
      }
      resolved.push(fragmentPath);
    }
    index++;
  }

  return resolved;
}
