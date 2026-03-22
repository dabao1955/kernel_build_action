import * as core from '@actions/core';
import * as artifact from '@actions/artifact';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ArtifactConfig {
  buildDir: string;
  anykernel3: boolean;
  release: boolean;
}

/**
 * Upload build artifacts
 */
export async function uploadArtifacts(config: ArtifactConfig): Promise<void> {
  if (config.release) {
    // Don't upload artifacts if releasing
    return;
  }

  // Check if build directory exists and has files
  if (!fs.existsSync(config.buildDir)) {
    throw new Error(`Build directory not found: ${config.buildDir}`);
  }

  const entries = fs.readdirSync(config.buildDir);
  if (entries.length === 0) {
    throw new Error('No files found in build directory');
  }

  const artifactName = config.anykernel3 ? 'Anykernel3-flasher' : 'kernel-built-bootimg';

  core.startGroup(`Uploading artifact: ${artifactName}`);

  // Get all files in build directory
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(config.buildDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      files.push(fullPath);
    }
  }

  if (files.length === 0) {
    throw new Error('No files to upload');
  }

  // Upload artifacts
  const artifactClient = new artifact.DefaultArtifactClient();

  try {
    await artifactClient.uploadArtifact(artifactName, files, config.buildDir);
    core.info(`Successfully uploaded ${files.length} file(s) as ${artifactName}`);
  } catch (error) {
    throw new Error(`Failed to upload artifacts: ${error}`, { cause: error });
  }

  core.endGroup();
}

/**
 * Check if artifact exists
 */
export function artifactExists(buildDir: string): boolean {
  if (!fs.existsSync(buildDir)) {
    return false;
  }

  const entries = fs.readdirSync(buildDir);
  return entries.length > 0;
}

/**
 * Get artifact info
 */
export function getArtifactInfo(buildDir: string): { name: string; size: number }[] {
  if (!fs.existsSync(buildDir)) {
    return [];
  }

  const info: { name: string; size: number }[] = [];
  const entries = fs.readdirSync(buildDir);

  for (const entry of entries) {
    const fullPath = path.join(buildDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      info.push({
        name: entry,
        size: stat.size,
      });
    }
  }

  return info;
}

/**
 * List artifacts for logging
 */
export function logArtifacts(buildDir: string): void {
  if (!fs.existsSync(buildDir)) {
    core.info('Build directory does not exist');
    return;
  }

  const info = getArtifactInfo(buildDir);
  if (info.length === 0) {
    core.info('No artifacts found');
    return;
  }

  core.info('Build artifacts:');
  for (const item of info) {
    const sizeInMB = (item.size / 1024 / 1024).toFixed(2);
    core.info(`  - ${item.name} (${sizeInMB} MB)`);
  }
}
