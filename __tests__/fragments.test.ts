import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfigFragments } from '../src/fragments';
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
});

describe('resolveConfigFragments', () => {
  it('rejects invalid JSON', async () => {
    await expect(resolveConfigFragments('{oops', '/kernel')).rejects.toThrow(
      /must be a JSON array/
    );
  });

  it('rejects non-array input', async () => {
    await expect(resolveConfigFragments('"fragment.config"', '/kernel')).rejects.toThrow(
      /must be a JSON array/
    );
  });

  it('rejects non-string entries', async () => {
    await expect(resolveConfigFragments('[1, 2]', '/kernel')).rejects.toThrow(/only contain strings/);
  });

  it('returns an empty list for an empty array', async () => {
    const result = await resolveConfigFragments('[]', '/kernel');
    expect(result).toEqual([]);
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('resolves local paths relative to the kernel directory', async () => {
    const result = await resolveConfigFragments('["arch/arm64/configs/my.config"]', '/kernel');
    expect(result).toEqual(['/kernel/arch/arm64/configs/my.config']);
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('rejects path traversal outside the kernel directory', async () => {
    await expect(resolveConfigFragments('["../../etc/passwd"]', '/kernel')).rejects.toThrow(
      /escapes the kernel directory/
    );
  });

  it('rejects missing local fragment files', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(resolveConfigFragments('["gone.config"]', '/kernel')).rejects.toThrow(/not found/);
  });

  it('downloads URL fragments into the kernel out directory', async () => {
    const result = await resolveConfigFragments(
      '["https://example.com/frag.config"]',
      '/kernel'
    );
    expect(result).toEqual(['/kernel/out/config-fragments/fragment_0.config']);
    expect(exec.exec).toHaveBeenCalledWith(
      'curl',
      expect.arrayContaining([
        '-sSLf',
        '--proto',
        '=https',
        '--proto-redir',
        '=https',
        '--',
        'https://example.com/frag.config',
        '-o',
        '/kernel/out/config-fragments/fragment_0.config',
      ])
    );
  });

  it('rejects plain-http fragment URLs', async () => {
    await expect(
      resolveConfigFragments('["http://example.com/frag.config"]', '/kernel')
    ).rejects.toThrow(/must use https:\/\/ URLs/);
    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('rejects entries starting with a hyphen', async () => {
    await expect(resolveConfigFragments('["-o evil"]', '/kernel')).rejects.toThrow(/hyphen/);
  });
});
