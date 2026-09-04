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

/** Matches the exact `#ifdef CONFIG_KSU` line used by KernelSU hooks. */
const KSU_IFDEF_RE = /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/;
/** Any remaining preprocessor conditional on the exact CONFIG_KSU macro. */
const KSU_ANY_RE = /^\s*#\s*if(?:n?def)?\b[^\n]*\bCONFIG_KSU\b/m;
/** Any preprocessor conditional opening directive (`#if`, `#ifdef`, `#ifndef`). */
const IF_RE = /^\s*#\s*if(?:n?def)?\b/;
const ENDIF_RE = /^\s*#\s*endif\b/;

/**
 * Delete lines from `start` (inclusive) through the matching `#endif`
 * (inclusive). Nested preprocessor conditionals opened inside the block are
 * tracked so removal only ends at the *outer* `#endif`, which keeps the
 * remaining source free of unmatched directives.
 */
export function stripBlockRange(lines: string[], start: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  for (const line of lines) {
    if (depth === 0) {
      if (start.test(line)) {
        depth = 1;
      } else {
        out.push(line);
      }
      continue;
    }
    if (IF_RE.test(line)) {
      depth++;
    } else if (ENDIF_RE.test(line)) {
      depth--;
    }
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

  // Strip #ifdef CONFIG_KSU ... #endif blocks (exact macro match).
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
