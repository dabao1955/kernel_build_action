import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldDeStaticizeSelinux, deStaticizeSelinuxForKsu } from '../src/selinux';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');

const KERNEL = '/kernel';
const MARKER = `${KERNEL}/drivers/kernelsu/tools/static_export_check.mk`;
const CONFIG = `${KERNEL}/defconfig`;

function mockFile(path: string): fs.Stats {
  return { isFile: () => path.length > 0, isDirectory: () => false } as fs.Stats;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.statSync).mockImplementation((p) => mockFile(String(p)));
  vi.mocked(exec.exec).mockResolvedValue(0);
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
  function enableDestatic() {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (String(p) === MARKER) return 'check_symbol_export';
      return 'CONFIG_KALLSYMS=y\n';
    });
  }

  it('does nothing when the marker is absent', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await deStaticizeSelinuxForKsu(KERNEL, CONFIG, {
      version: 4,
      patchlevel: 14,
      sublevel: 0,
      isGki: false,
    });
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('runs the destatic Coccinelle helper with the kernel version', async () => {
    enableDestatic();

    await deStaticizeSelinuxForKsu(KERNEL, CONFIG, {
      version: 4,
      patchlevel: 14,
      sublevel: 0,
      isGki: false,
    });

    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining([
        '-c',
        expect.stringMatching(/selinux\.py.*--kernel-version 4\.14/),
      ]),
      expect.objectContaining({ cwd: KERNEL })
    );
  });

  it('passes 5.15 through to the helper for version-gated cocci selection', async () => {
    enableDestatic();

    await deStaticizeSelinuxForKsu(KERNEL, CONFIG, {
      version: 5,
      patchlevel: 15,
      sublevel: 0,
      isGki: false,
    });

    expect(exec.exec).toHaveBeenCalledWith(
      'bash',
      expect.arrayContaining(['-c', expect.stringContaining('--kernel-version 5.15')]),
      expect.objectContaining({ cwd: KERNEL })
    );
  });

  it('warns when the destatic helper fails', async () => {
    enableDestatic();
    vi.mocked(exec.exec).mockRejectedValue(new Error('spatch failed'));

    await deStaticizeSelinuxForKsu(KERNEL, CONFIG, {
      version: 4,
      patchlevel: 14,
      sublevel: 0,
      isGki: false,
    });

    expect(core.warning).toHaveBeenCalledWith('Failed to apply SELinux destatic patches');
  });
});
