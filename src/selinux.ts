import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists, getActionPath } from './utils';
import type { KernelVersion } from './kernel';

/**
 * KernelSU's static-export check links against a handful of SELinux internals
 * that some kernels declare `static`. On non-GKI kernels without kprobes the
 * manual hooks reuse those symbols, so the `static` qualifier has to be
 * dropped with Coccinelle before the build or the link stage fails.
 */

function isConfigEnabled(configPath: string, option: string): boolean {
  if (!fileExists(configPath)) {
    return false;
  }
  return new RegExp(`^${option}=y$`, 'm').test(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * The destatic patches are only required when KernelSU ships its
 * `static_export_check.mk` helper. KALLSYMS_ALL also makes the symbols
 * resolvable by name, which makes the changes unnecessary.
 */
export function shouldDeStaticizeSelinux(kernelDir: string, configPath: string): boolean {
  const markers = [
    path.join(kernelDir, 'drivers', 'kernelsu', 'tools', 'static_export_check.mk'),
    path.join(kernelDir, 'KernelSU', 'kernel', 'tools', 'static_export_check.mk'),
  ];
  const marker = markers.find((candidate) => fileExists(candidate));
  if (!marker) {
    return false;
  }
  if (!fs.readFileSync(marker, 'utf-8').includes('check_symbol_export')) {
    return false;
  }
  if (
    isConfigEnabled(configPath, 'CONFIG_KALLSYMS') &&
    isConfigEnabled(configPath, 'CONFIG_KALLSYMS_ALL')
  ) {
    return false;
  }
  return true;
}

/**
 * Remove `static` from the SELinux symbols KernelSU imports on non-GKI
 * kernels, using the versioned Coccinelle patches in `kernelsu/`.
 */
export async function deStaticizeSelinuxForKsu(
  kernelDir: string,
  configPath: string,
  kernelVersion: KernelVersion
): Promise<void> {
  if (!shouldDeStaticizeSelinux(kernelDir, configPath)) {
    return;
  }

  core.startGroup('Removing SELinux static qualifiers for KernelSU');
  const script = path.join(getActionPath(), 'kernelsu', 'selinux.py');
  const cocciDir = path.join(getActionPath(), 'kernelsu');
  const version = `${kernelVersion.version}.${kernelVersion.patchlevel}`;
  try {
    await exec.exec(
      'bash',
      [
        '-c',
        `eval $(opam env) && python3 ${script} --cocci-dir ${cocciDir} --kernel-version ${version}`,
      ],
      { cwd: kernelDir }
    );
  } catch {
    core.warning('Failed to apply SELinux destatic patches');
  }
  core.endGroup();
}
