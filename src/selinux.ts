import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists } from './utils';
import type { KernelVersion } from './kernel';

/**
 * KernelSU's static-export check links against a handful of SELinux internals
 * that some kernels declare `static`. On non-GKI kernels without kprobes the
 * manual hooks reuse those symbols, so the `static` qualifier has to be
 * dropped before the build or the link stage fails with unresolved symbols.
 *
 * Behaviour ported from the no-kprobe handling in
 * JackA1ltman/NonGKI_Kernel_Build_2nd (.github/workflows/patch-no-kprobe/action.yml).
 */

interface DeStaticRule {
  file: string;
  pattern: RegExp;
  replacement: string;
  /** Optional kernel-version condition, true for kernels below the given version. */
  when?: (kernelVersion: KernelVersion) => boolean;
}

function isKernelBelow(version: number, patchlevel: number, kv: KernelVersion): boolean {
  return kv.version < version || (kv.version === version && kv.patchlevel < patchlevel);
}

const DE_STATIC_RULES: DeStaticRule[] = [
  {
    file: 'security/selinux/selinuxfs.c',
    pattern: /static ssize_t \(\*const write_op\[\]\)\(/g,
    replacement: 'ssize_t (*const write_op[])(',
  },
  {
    file: 'security/selinux/selinuxfs.c',
    pattern: /static ssize_t \(\*write_op\[\]\)\(/g,
    replacement: 'ssize_t (*write_op[])(',
  },
  {
    file: 'security/selinux/selinuxfs.c',
    pattern: /^static const struct file_operations sel_handle_status_ops = \{/m,
    replacement: 'const struct file_operations sel_handle_status_ops = {',
  },
  {
    file: 'security/selinux/selinuxfs.c',
    pattern: /^static DEFINE_MUTEX\(sel_mutex\)/m,
    replacement: 'DEFINE_MUTEX(sel_mutex)',
    when: (kv) => isKernelBelow(5, 15, kv),
  },
  {
    file: 'security/selinux/ss/status.c',
    pattern: /^static struct page \*selinux_status_page/m,
    replacement: 'struct page *selinux_status_page',
    when: (kv) => isKernelBelow(5, 15, kv),
  },
  {
    file: 'security/selinux/ss/status.c',
    pattern: /^static DEFINE_MUTEX\(selinux_status_lock\)/m,
    replacement: 'DEFINE_MUTEX(selinux_status_lock)',
    when: (kv) => isKernelBelow(5, 15, kv),
  },
  {
    file: 'security/selinux/hooks.c',
    pattern: /^static struct security_operations selinux_ops/m,
    replacement: 'struct security_operations selinux_ops',
    when: (kv) => isKernelBelow(4, 19, kv),
  },
];

function isConfigEnabled(configPath: string, option: string): boolean {
  if (!fileExists(configPath)) {
    return false;
  }
  return new RegExp(`^${option}=y$`, 'm').test(fs.readFileSync(configPath, 'utf-8'));
}

/**
 * The de-static changes are only required when KernelSU ships its
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
 * kernels. Returns the list of files that were modified.
 */
export function deStaticizeSelinuxForKsu(
  kernelDir: string,
  configPath: string,
  kernelVersion: KernelVersion
): string[] {
  if (!shouldDeStaticizeSelinux(kernelDir, configPath)) {
    return [];
  }

  core.startGroup('Removing SELinux static qualifiers for KernelSU');
  const changed: string[] = [];

  for (const rule of DE_STATIC_RULES) {
    if (rule.when && !rule.when(kernelVersion)) {
      continue;
    }
    const filePath = path.join(kernelDir, rule.file);
    if (!fileExists(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = content.replace(rule.pattern, rule.replacement);
    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      if (!changed.includes(rule.file)) {
        changed.push(rule.file);
      }
      core.info(`Removed static qualifier in ${rule.file}`);
    }
  }

  if (changed.length === 0) {
    core.info('No SELinux static qualifiers needed removal.');
  }
  core.endGroup();
  return changed;
}
