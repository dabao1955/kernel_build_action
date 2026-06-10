import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadArtifacts,
  artifactExists,
  getArtifactInfo,
  logArtifacts,
  ArtifactConfig,
} from '../src/artifact';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as artifact from '@actions/artifact';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/artifact');

beforeEach(() => {
  vi.clearAllMocks();
});

function mockArtifactClientUpload(uploadArtifact: ReturnType<typeof vi.fn>): void {
  vi.mocked(artifact.DefaultArtifactClient).mockImplementation(
    class {
      uploadArtifact = uploadArtifact;
    } as any
  );
}

describe('uploadArtifacts', () => {
  const baseConfig: ArtifactConfig = {
    buildDir: '/build',
    anykernel3: false,
    release: false,
  };

  it('skips upload when release is true', async () => {
    const config = { ...baseConfig, release: true };

    await uploadArtifacts(config);

    expect(artifact.DefaultArtifactClient).not.toHaveBeenCalled();
  });

  it('throws error when build directory does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(uploadArtifacts(baseConfig)).rejects.toThrow(
      'Build directory not found: /build'
    );
  });

  it('throws error when build directory is empty', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    await expect(uploadArtifacts(baseConfig)).rejects.toThrow(
      'No files found in build directory'
    );
  });

  it('uploads kernel bootimg artifact', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const mockUpload = vi.fn().mockResolvedValue(undefined);
    mockArtifactClientUpload(mockUpload);

    await uploadArtifacts(baseConfig);

    expect(mockUpload).toHaveBeenCalledWith(
      'kernel-built-bootimg',
      ['/build/boot.img'],
      '/build'
    );
  });

  it('uploads AnyKernel3 artifact', async () => {
    const config = { ...baseConfig, anykernel3: true };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['anykernel.zip'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const mockUpload = vi.fn().mockResolvedValue(undefined);
    mockArtifactClientUpload(mockUpload);

    await uploadArtifacts(config);

    expect(mockUpload).toHaveBeenCalledWith(
      'Anykernel3-flasher',
      ['/build/anykernel.zip'],
      '/build'
    );
  });

  it('throws error when no files to upload', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['subdir'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as fs.Stats);

    await expect(uploadArtifacts(baseConfig)).rejects.toThrow('No files to upload');
  });

  it('handles upload errors', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const mockUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));
    mockArtifactClientUpload(mockUpload);

    await expect(uploadArtifacts(baseConfig)).rejects.toThrow('Failed to upload artifacts');
  });

  it('uploads multiple files', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img', 'dtbo.img', 'dtb'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const mockUpload = vi.fn().mockResolvedValue(undefined);
    mockArtifactClientUpload(mockUpload);

    await uploadArtifacts(baseConfig);

    expect(mockUpload).toHaveBeenCalledWith(
      'kernel-built-bootimg',
      ['/build/boot.img', '/build/dtbo.img', '/build/dtb'],
      '/build'
    );
  });
});

describe('artifactExists', () => {
  it('returns true when build directory has files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);

    const result = artifactExists('/build');

    expect(result).toBe(true);
  });

  it('returns false when build directory is empty', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    const result = artifactExists('/build');

    expect(result).toBe(false);
  });

  it('returns false when build directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = artifactExists('/build');

    expect(result).toBe(false);
  });
});

describe('getArtifactInfo', () => {
  it('returns file info for build directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img', 'dtbo.img'] as any);
    vi.mocked(fs.statSync).mockImplementation((path) => {
      const sizes: { [key: string]: number } = {
        '/build/boot.img': 1024 * 1024 * 10, // 10 MB
        '/build/dtbo.img': 1024 * 1024 * 2,  // 2 MB
      };
      return {
        isFile: () => true,
        size: sizes[String(path)] || 0,
      } as fs.Stats;
    });

    const result = getArtifactInfo('/build');

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('name');
    expect(result[0]).toHaveProperty('size');
    expect(result[0].size).toBeGreaterThan(0);
  });

  it('returns empty array when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getArtifactInfo('/build');

    expect(result).toEqual([]);
  });

  it('returns empty array when directory has no files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    const result = getArtifactInfo('/build');

    expect(result).toEqual([]);
  });

  it('ignores directories', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img', 'subdir'] as any);
    vi.mocked(fs.statSync).mockImplementation((path) => {
      return {
        isFile: () => String(path).endsWith('.img'),
        size: 1024 * 1024,
      } as fs.Stats;
    });

    const result = getArtifactInfo('/build');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('boot.img');
  });
});

describe('logArtifacts', () => {
  it('logs artifact information', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      size: 1024 * 1024 * 15,
    } as fs.Stats);

    logArtifacts('/build');

    expect(core.info).toHaveBeenCalledWith('Build artifacts:');
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('boot.img'));
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('15.00 MB'));
  });

  it('logs message when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    logArtifacts('/build');

    expect(core.info).toHaveBeenCalledWith('Build directory does not exist');
  });

  it('logs message when no artifacts found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    logArtifacts('/build');

    expect(core.info).toHaveBeenCalledWith('No artifacts found');
  });

  it('logs multiple artifacts', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img', 'dtbo.img', 'dtb'] as any);
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      size: 1024 * 1024 * 10,
    } as fs.Stats);

    logArtifacts('/build');

    expect(core.info).toHaveBeenCalledWith('Build artifacts:');
    expect(core.info).toHaveBeenCalledTimes(4); // header + 3 files
  });
});
