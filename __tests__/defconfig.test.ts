import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractDefconfigFromBoot } from '../src/defconfig';
import * as fs from 'fs';
import * as exec from '@actions/exec';

vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/exec');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.statSync).mockReturnValue({
    isDirectory: () => false,
    isFile: () => true,
  } as fs.Stats);
  vi.mocked(exec.exec).mockResolvedValue(0);
  vi.mocked(exec.getExecOutput).mockResolvedValue({
    exitCode: 0,
    stdout: '#\n# Automatically generated\n#\nCONFIG_ARM64=y\nCONFIG_IKCONFIG=y\n',
    stderr: '',
  });
});

describe('extractDefconfigFromBoot', () => {
  it('downloads, unpacks and extracts the config into the defconfig path', async () => {
    const result = await extractDefconfigFromBoot(
      '/kernel',
      'arm64',
      'stock_defconfig',
      'https://example.com/boot.img'
    );

    expect(result).toBe('/kernel/arch/arm64/configs/stock_defconfig');

    // magiskboot + boot image downloaded
    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining([expect.stringContaining('magiskboot')])
    );
    expect(exec.exec).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining(['-o', expect.stringContaining('boot.img'), '--', 'https://example.com/boot.img'])
    );
    // unpacked
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringContaining('magiskboot'),
      ['unpack', expect.stringContaining('boot.img')],
      expect.anything()
    );
    // extract-ikconfig ran against the unpacked kernel image
    expect(exec.getExecOutput).toHaveBeenCalledWith(
      'bash',
      ['/kernel/scripts/extract-ikconfig', expect.stringContaining('kernel')],
      expect.objectContaining({ cwd: '/kernel' })
    );
    // config written
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/kernel/arch/arm64/configs/stock_defconfig',
      expect.stringContaining('CONFIG_ARM64=y')
    );
  });

  it('throws without a boot image URL', async () => {
    await expect(extractDefconfigFromBoot('/kernel', 'arm64', 'defconfig', '')).rejects.toThrow(
      /requires the bootimg-url/
    );
  });

  it('throws when the stock kernel carries no embedded config', async () => {
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      exitCode: 0,
      stdout: 'nothing here\n',
      stderr: '',
    });

    await expect(
      extractDefconfigFromBoot('/kernel', 'arm64', 'defconfig', 'https://example.com/boot.img')
    ).rejects.toThrow(/built without CONFIG_IKCONFIG\./);
  });

  it('throws when extract-ikconfig fails', async () => {
    vi.mocked(exec.getExecOutput).mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: 'boom',
    });

    await expect(
      extractDefconfigFromBoot('/kernel', 'arm64', 'defconfig', 'https://example.com/boot.img')
    ).rejects.toThrow(/extract-ikconfig failed/);
  });

  it('throws when the kernel source has no extract-ikconfig script', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) =>
      !String(p).includes('extract-ikconfig')
    );

    await expect(
      extractDefconfigFromBoot('/kernel', 'arm64', 'defconfig', 'https://example.com/boot.img')
    ).rejects.toThrow(/extract-ikconfig/);
  });
});
