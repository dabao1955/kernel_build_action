import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldDeStaticizeSelinux, deStaticizeSelinuxForKsu } from '../src/selinux';
import * as fs from 'fs';
import * as core from '@actions/core';

vi.mock('fs');
vi.mock('@actions/core');

const KERNEL = '/kernel';
const MARKER = `${KERNEL}/drivers/kernelsu/tools/static_export_check.mk`;
const CONFIG = `${KERNEL}/defconfig`;
const SELINUXFS = `${KERNEL}/security/selinux/selinuxfs.c`;
const STATUS = `${KERNEL}/security/selinux/ss/status.c`;
const HOOKS = `${KERNEL}/security/selinux/hooks.c`;

function mockFile(path: string): fs.Stats {
  return { isFile: () => path.length > 0, isDirectory: () => false } as fs.Stats;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.statSync).mockImplementation((p) => mockFile(String(p)));
  vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
});

describe('shouldDeStaticizeSelinux', () => {
  it('returns false when the KernelSU static-export marker is absent', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(shouldDeStaticizeSelinux(KERNEL, CONFIG)).toBe(false);
  });

  it('returns false when the marker does not contain check_symbol_export', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('some other helper');
    expect(shouldDeStaticizeSelinux(KERNEL, CONFIG)).toBe(false);
  });

  it('returns false when KALLSYMS and KALLSYMS_ALL are both enabled', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === MARKER) return 'check_symbol_export';
      return 'CONFIG_KALLSYMS=y\nCONFIG_KALLSYMS_ALL=y\n';
    });
    expect(shouldDeStaticizeSelinux(KERNEL, CONFIG)).toBe(false);
  });

  it('returns true when the marker is present and KALLSYMS_ALL is missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === MARKER) return 'check_symbol_export';
      return 'CONFIG_KALLSYMS=y\n';
    });
    expect(shouldDeStaticizeSelinux(KERNEL, CONFIG)).toBe(true);
  });
});

describe('deStaticizeSelinuxForKsu', () => {
  it('does nothing when the marker is absent', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = deStaticizeSelinuxForKsu(
      KERNEL,
      CONFIG,
      { version: 4, patchlevel: 14, sublevel: 0, isGki: false }
    );
    expect(result).toEqual([]);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('removes static qualifiers across SELinux files on 4.14', () => {
    const store: Record<string, string> = {
      [MARKER]: 'check_symbol_export',
      [CONFIG]: 'CONFIG_KALLSYMS=y\n',
      [SELINUXFS]: [
        'static ssize_t (*const write_op[])(struct file *, char *, size_t)',
        'static const struct file_operations sel_handle_status_ops = {',
        'static DEFINE_MUTEX(sel_mutex)',
      ].join('\n'),
      [STATUS]: [
        'static struct page *selinux_status_page;',
        'static DEFINE_MUTEX(selinux_status_lock)',
      ].join('\n'),
      [HOOKS]: 'static struct security_operations selinux_ops = {',
    };
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) in store);
    vi.mocked(fs.readFileSync).mockImplementation((p) => store[String(p)] ?? '');
    vi.mocked(fs.writeFileSync).mockImplementation((p, content) => {
      store[String(p)] = String(content);
    });

    const result = deStaticizeSelinuxForKsu(
      KERNEL,
      CONFIG,
      { version: 4, patchlevel: 14, sublevel: 0, isGki: false }
    );

    expect(result).toEqual([
      'security/selinux/selinuxfs.c',
      'security/selinux/ss/status.c',
      'security/selinux/hooks.c',
    ]);
    expect(store[SELINUXFS]).toContain('ssize_t (*const write_op[])(');
    expect(store[SELINUXFS]).not.toContain('static ssize_t (*const write_op[])(');
    expect(store[SELINUXFS]).not.toContain('static const struct file_operations');
    expect(store[SELINUXFS]).not.toContain('static DEFINE_MUTEX(sel_mutex)');
    expect(store[STATUS]).not.toContain('static struct page');
    expect(store[STATUS]).not.toContain('static DEFINE_MUTEX(selinux_status_lock)');
    expect(store[HOOKS]).not.toContain('static struct security_operations');
  });

  it('keeps version-gated qualifiers on 5.15 and above', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return [MARKER, CONFIG, SELINUXFS, STATUS, HOOKS].includes(path);
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      switch (String(p)) {
        case MARKER:
          return 'check_symbol_export';
        case CONFIG:
          return 'CONFIG_KALLSYMS=y\n';
        case SELINUXFS:
          return 'static ssize_t (*const write_op[])(struct file *, char *, size_t)';
        case STATUS:
          return 'static struct page *selinux_status_page;';
        case HOOKS:
          return 'static struct security_operations selinux_ops = {';
        default:
          return '';
      }
    });

    const result = deStaticizeSelinuxForKsu(
      KERNEL,
      CONFIG,
      { version: 5, patchlevel: 15, sublevel: 0, isGki: false }
    );

    // Only the unconditional selinuxfs rule applies.
    expect(result).toEqual(['security/selinux/selinuxfs.c']);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it('logs when no rule matched', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const path = String(p);
      return [MARKER, CONFIG, SELINUXFS].includes(path);
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === MARKER) return 'check_symbol_export';
      if (String(p) === CONFIG) return 'CONFIG_KALLSYMS=y\n';
      return 'nothing to change';
    });

    const result = deStaticizeSelinuxForKsu(
      KERNEL,
      CONFIG,
      { version: 5, patchlevel: 15, sublevel: 0, isGki: false }
    );

    expect(result).toEqual([]);
    expect(core.info).toHaveBeenCalledWith('No SELinux static qualifiers needed removal.');
  });
});
