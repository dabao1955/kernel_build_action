import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists } from './utils';

/**
 * Idempotent cleanup of KernelSU leftovers in a kernel tree.
 *
 * Kernel sources sometimes already carry KernelSU hooks (e.g. vendor trees
 * forked from a rooted build, or re-runs over a dirty workspace). Building
 * on top of such a tree double-hooks the kernel and breaks the build.
 * This module strips the well-known KernelSU leftovers before the patch is
 * applied.
 *
 * Note: SuSFS integration is intentionally left untouched. This action does
 * not integrate SuSFS itself, so removing pre-existing SuSFS hooks would
 * silently change kernels whose sources carry it on purpose.
 */

/** Directories that contain a full KernelSU checkout / integration. */
const KSU_DIRS = ['drivers/kernelsu', 'KernelSU', 'KernelSU-Next'];

/** Files that receive `#ifdef CONFIG_KSU ... #endif` hook blocks. */
const KSU_HOOK_FILES = [
  'fs/exec.c',
  'fs/read_write.c',
  'fs/open.c',
  'fs/stat.c',
  'fs/devpts/inode.c',
  'fs/namei.c',
  'drivers/input/input.c',
  'drivers/tty/pty.c',
  'security/selinux/hooks.c',
  'kernel/reboot.c',
  'kernel/sys.c',
];

/** Matches `#ifdef CONFIG_KSU` exactly, so CONFIG_KSU_SUSFS is not touched. */
const KSU_IFDEF_RE = /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/;
/** Any remaining preprocessor conditional on the exact CONFIG_KSU macro. */
const KSU_ANY_RE = /^\s*#\s*if(?:n?def)?\b[^\n]*\bCONFIG_KSU\b/m;
const ENDIF_RE = /^\s*#\s*endif\b/;

/**
 * Delete lines from `start` (inclusive) until the first `#endif` (inclusive).
 */
export function stripBlockRange(lines: string[], start: RegExp): string[] {
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && start.test(line)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (ENDIF_RE.test(line)) {
        skipping = false;
      }
      continue;
    }
    out.push(line);
  }
  return out;
}

function cleanFile(filePath: string, transforms: ((lines: string[]) => string[])[]): boolean {
  if (!fileExists(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const cleaned = transforms.reduce((acc, fn) => fn(acc), lines);
  const newContent = cleaned.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    return true;
  }
  return false;
}

/**
 * Remove pre-existing KernelSU integration from a kernel tree.
 * Run after the kernel source is assembled and before any patches.
 */
export function cleanExistingHooks(kernelDir: string): void {
  core.startGroup('Cleaning existing KernelSU hooks');

  // Remove KernelSU directories
  for (const dir of KSU_DIRS) {
    const dirPath = path.join(kernelDir, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      core.info(`Removed directory: ${dir}`);
    }
  }

  // Strip #ifdef CONFIG_KSU ... #endif blocks (exact macro match: SuSFS
  // guards such as #ifdef CONFIG_KSU_SUSFS are deliberately left alone).
  for (const file of KSU_HOOK_FILES) {
    const filePath = path.join(kernelDir, file);
    if (cleanFile(filePath, [(lines) => stripBlockRange(lines, KSU_IFDEF_RE)])) {
      core.info(`Cleaned KernelSU hooks in: ${file}`);
    }
    if (fileExists(filePath) && KSU_ANY_RE.test(fs.readFileSync(filePath, 'utf-8'))) {
      core.warning(`Possible KernelSU leftovers remain in ${file} (non-ifdef reference)`);
    }
  }

  core.endGroup();
}
