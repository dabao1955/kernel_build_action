import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeErrorMessage } from './utils';

export interface ReleaseConfig {
  token: string;
  buildDir: string;
  kernelUrl: string;
  kernelBranch: string;
  config: string;
  arch: string;
  features: {
    ksu: boolean;
    nethunter: boolean;
    lxc: boolean;
    kvm: boolean;
    rekernel: boolean;
  };
}

/**
 * Create GitHub Release
 */
export async function createRelease(config: ReleaseConfig): Promise<void> {
  core.startGroup('Creating GitHub Release');

  if (!config.token) {
    throw new Error('access-token is required when release is set to true');
  }

  const octokit = github.getOctokit(config.token);
  const context = github.context;

  // Generate tag name
  const tagName = `last-ci-${context.sha}`;
  const releaseName = 'Last CI build kernel';

  // Generate release body
  const body = generateReleaseBody(config);

  // Get files to upload
  const files: string[] = [];
  if (fs.existsSync(config.buildDir)) {
    const entries = fs.readdirSync(config.buildDir);
    for (const entry of entries) {
      const fullPath = path.join(config.buildDir, entry);
      if (fs.statSync(fullPath).isFile()) {
        files.push(fullPath);
      }
    }
  }

  if (files.length === 0) {
    throw new Error('No files to release');
  }

  try {
    // Check if release already exists for this tag
    let releaseId = 0;
    let existingRelease = false;

    try {
      const { data: existing } = await octokit.rest.repos.getReleaseByTag({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag: tagName,
      });
      releaseId = existing.id;
      existingRelease = true;
      core.info(`Found existing release with tag ${tagName}, will update`);

      // Delete old assets
      for (const asset of existing.assets) {
        await octokit.rest.repos.deleteReleaseAsset({
          owner: context.repo.owner,
          repo: context.repo.repo,
          asset_id: asset.id,
        });
      }
    } catch {
      // Release doesn't exist, will create new one
      existingRelease = false;
    }

    if (existingRelease) {
      // Update existing release
      const { data: updated } = await octokit.rest.repos.updateRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        release_id: releaseId,
        tag_name: tagName,
        name: releaseName,
        body,
        make_latest: 'true',
      });
      core.info(`Updated release: ${updated.html_url}`);
    } else {
      // Create new release
      const { data: release } = await octokit.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag_name: tagName,
        name: releaseName,
        body,
        make_latest: 'true',
      });
      releaseId = release.id;
      core.info(`Created release: ${release.html_url}`);
    }

    // Upload files
    for (const file of files) {
      const fileName = path.basename(file);
      const fileData = fs.readFileSync(file);

      await octokit.rest.repos.uploadReleaseAsset({
        owner: context.repo.owner,
        repo: context.repo.repo,
        release_id: releaseId,
        name: fileName,
        data: fileData as Buffer,
      });

      core.info(`Uploaded: ${fileName}`);
    }

    // Cleanup old CI releases (keep last 5)
    await cleanupOldReleases(config.token, 5);
  } catch (error) {
    throw new Error(`Failed to create release: ${sanitizeErrorMessage(error)}`, { cause: error });
  }

  core.endGroup();
}

/**
 * Generate release body
 */
function generateReleaseBody(config: ReleaseConfig): string {
  const timestamp = new Date().toISOString();
  const workflow = process.env.GITHUB_WORKFLOW || 'Unknown';
  const runId = process.env.GITHUB_RUN_ID || 'Unknown';

  return `## Build Information
- **Config**: ${config.config}
- **Branch**: ${config.kernelBranch}
- **Source**: ${config.kernelUrl}
- **Architecture**: ${config.arch}

## Features
- **KernelSU**: ${config.features.ksu}
- **NetHunter**: ${config.features.nethunter}
- **LXC**: ${config.features.lxc}
- **KVM**: ${config.features.kvm}
- **Rekernel**: ${config.features.rekernel}

## Build Details
- **Timestamp**: ${timestamp}
- **Workflow**: ${workflow}
- **Run ID**: ${runId}
- **Commit**: ${process.env.GITHUB_SHA || 'Unknown'}
`;
}

/**
 * Delete old releases (optional cleanup)
 */
export async function cleanupOldReleases(token: string, keepCount: number): Promise<void> {
  const octokit = github.getOctokit(token);
  const context = github.context;

  try {
    const { data: releases } = await octokit.rest.repos.listReleases({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 100,
    });

    // Filter CI releases
    const ciReleases = releases.filter((r: { tag_name: string }) =>
      r.tag_name.startsWith('last-ci-')
    );

    if (ciReleases.length > keepCount) {
      const toDelete = ciReleases.slice(keepCount);

      for (const release of toDelete) {
        await octokit.rest.repos.deleteRelease({
          owner: context.repo.owner,
          repo: context.repo.repo,
          release_id: release.id,
        });

        // Delete tag
        await octokit.rest.git.deleteRef({
          owner: context.repo.owner,
          repo: context.repo.repo,
          ref: `tags/${release.tag_name}`,
        });

        core.info(`Deleted old release: ${release.tag_name}`);
      }
    }
  } catch (error) {
    core.warning(`Failed to cleanup old releases: ${sanitizeErrorMessage(error)}`);
  }
}
