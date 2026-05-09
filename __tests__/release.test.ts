import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createRelease,
  cleanupOldReleases,
  ReleaseConfig,
} from '../src/release';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as github from '@actions/github';

// Mock dependencies
vi.mock('fs');
vi.mock('@actions/core');
vi.mock('@actions/github');

const mockGetReleaseByTag = vi.fn();
const mockCreateRelease = vi.fn();
const mockUploadReleaseAsset = vi.fn();
const mockListReleases = vi.fn();
const mockDeleteRelease = vi.fn();
const mockDeleteRef = vi.fn();
const mockPaginate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Setup mock GitHub context
  Object.defineProperty(github, 'context', {
    value: {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      sha: 'abc123def456',
    },
    writable: true,
  });

  // Setup mock octokit
  vi.mocked(github.getOctokit).mockReturnValue({
    rest: {
      repos: {
        getReleaseByTag: mockGetReleaseByTag,
        createRelease: mockCreateRelease,
        uploadReleaseAsset: mockUploadReleaseAsset,
        listReleases: mockListReleases,
        deleteRelease: mockDeleteRelease,
      },
      git: {
        deleteRef: mockDeleteRef,
      },
    },
    paginate: mockPaginate,
  } as any);
});

describe('createRelease', () => {
  beforeEach(() => {
    mockGetReleaseByTag.mockRejectedValue({ status: 404 });
    mockPaginate.mockResolvedValue([]);
  });

  const baseConfig: ReleaseConfig = {
    token: 'test-token',
    buildDir: '/build',
    kernelUrl: 'https://github.com/test/kernel',
    kernelBranch: 'main',
    config: 'defconfig',
    arch: 'arm64',
    features: {
      ksu: true,
      nethunter: false,
      lxc: true,
      kvm: false,
      rekernel: false,
    },
  };

  it('throws error when token is not provided', async () => {
    const config = { ...baseConfig, token: '' };

    await expect(createRelease(config)).rejects.toThrow(
      'access-token is required when release is set to true'
    );
  });

  it('creates release with correct tag name', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

    mockCreateRelease.mockResolvedValue({
      data: { id: 123, html_url: 'https://github.com/test-owner/test-repo/releases/tag/last-ci-abc123def456' },
    });
    mockUploadReleaseAsset.mockResolvedValue({});

    await createRelease(baseConfig);

    expect(mockCreateRelease).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'test-owner',
      repo: 'test-repo',
      tag_name: 'last-ci-abc123def456',
      name: 'Last CI build kernel',
      make_latest: 'true',
    }));
  });

  it('uploads files to release', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img', 'dtbo.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

    mockCreateRelease.mockResolvedValue({
      data: { id: 123, html_url: 'https://github.com/test-owner/test-repo/releases/tag/v1.0.0' },
    });
    mockUploadReleaseAsset.mockResolvedValue({});

    await createRelease(baseConfig);

    expect(mockUploadReleaseAsset).toHaveBeenCalledTimes(2);
    expect(mockUploadReleaseAsset).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'test-owner',
      repo: 'test-repo',
      release_id: 123,
    }));
  });

  it('throws error when no files to release', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as any);

    await expect(createRelease(baseConfig)).rejects.toThrow('No files to release');
  });

  it('throws error when build directory does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(createRelease(baseConfig)).rejects.toThrow('No files to release');
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    mockCreateRelease.mockRejectedValue(new Error('API error'));

    await expect(createRelease(baseConfig)).rejects.toThrow('Failed to create release');
  });

  it('includes build information in release body', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

    mockCreateRelease.mockResolvedValue({
      data: { id: 123, html_url: 'https://github.com/test-owner/test-repo/releases/tag/v1.0.0' },
    });
    mockUploadReleaseAsset.mockResolvedValue({});

    await createRelease(baseConfig);

    const callArgs = mockCreateRelease.mock.calls[0][0];
    expect(callArgs.body).toContain('defconfig');
    expect(callArgs.body).toContain('arm64');
    // Check for KernelSU (the format may have HTML/Markdown formatting)
    expect(callArgs.body.toLowerCase()).toContain('kernelsu');
    expect(callArgs.body.toLowerCase()).toContain('true');
  });

  it('logs release URL on success', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

    mockCreateRelease.mockResolvedValue({
      data: { id: 123, html_url: 'https://github.com/test-owner/test-repo/releases/tag/v1.0.0' },
    });
    mockUploadReleaseAsset.mockResolvedValue({});

    await createRelease(baseConfig);

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Created release:'));
  });

  it('logs uploaded file names', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['boot.img'] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('test'));

    mockCreateRelease.mockResolvedValue({
      data: { id: 123, html_url: 'https://github.com/test-owner/test-repo/releases/tag/v1.0.0' },
    });
    mockUploadReleaseAsset.mockResolvedValue({});

    await createRelease(baseConfig);

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Uploaded: boot.img'));
  });
});

describe('cleanupOldReleases', () => {
  beforeEach(() => {
    mockPaginate.mockResolvedValue([
      { id: 1, tag_name: 'last-ci-abc123' },
      { id: 2, tag_name: 'last-ci-def456' },
      { id: 3, tag_name: 'last-ci-ghi789' },
      { id: 4, tag_name: 'v1.0.0' }, // Not a CI release
    ]);
    mockDeleteRelease.mockResolvedValue({});
    mockDeleteRef.mockResolvedValue({});
  });

  it('deletes old CI releases exceeding keep count', async () => {
    await cleanupOldReleases('test-token', 1);

    // Should delete releases with IDs 2 and 3 (keeping only 1)
    expect(mockDeleteRelease).toHaveBeenCalledTimes(2);
  });

  it('keeps non-CI releases', async () => {
    await cleanupOldReleases('test-token', 1);

    // Should not delete v1.0.0 release
    expect(mockDeleteRelease).not.toHaveBeenCalledWith(expect.objectContaining({
      release_id: 4,
    }));
  });

  it('does not delete when CI releases are within keep count', async () => {
    await cleanupOldReleases('test-token', 5);

    expect(mockDeleteRelease).not.toHaveBeenCalled();
  });

  it('deletes tag after deleting release', async () => {
    await cleanupOldReleases('test-token', 1);

    expect(mockDeleteRef).toHaveBeenCalledWith(expect.objectContaining({
      ref: 'tags/last-ci-def456',
    }));
    expect(mockDeleteRef).toHaveBeenCalledWith(expect.objectContaining({
      ref: 'tags/last-ci-ghi789',
    }));
  });

  it('logs deleted releases', async () => {
    await cleanupOldReleases('test-token', 1);

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('Deleted old release:'));
  });

  it('handles API errors gracefully', async () => {
    mockPaginate.mockRejectedValue(new Error('API error'));

    await cleanupOldReleases('test-token', 1);

    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to cleanup old releases'));
  });

  it('does nothing when no CI releases exist', async () => {
    mockPaginate.mockResolvedValue([
      { id: 1, tag_name: 'v1.0.0' },
      { id: 2, tag_name: 'v2.0.0' },
    ]);

    await cleanupOldReleases('test-token', 1);

    expect(mockDeleteRelease).not.toHaveBeenCalled();
  });
});
