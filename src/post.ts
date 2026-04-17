import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { cleanAll } from './clean';
import { analyzeBuildErrors } from './error';

/**
 * Post action - cleanup and error analysis
 */
async function post(): Promise<void> {
  try {
    core.info('Running post-action cleanup...');

    // Use saved state from main action if available
    const savedKernelDir = core.getState('KERNEL_DIR');
    const isLocalKernel = core.getState('IS_LOCAL_KERNEL') === 'true';

    // Determine kernel directory
    let kernelDir: string;
    if (savedKernelDir) {
      kernelDir = savedKernelDir;
      core.info(`Using kernel directory from main action: ${kernelDir}`);
    } else {
      // Fallback to legacy calculation for backward compatibility
      const inputKernelDir = core.getInput('kernel-dir') || 'kernel';
      if (isLocalKernel) {
        kernelDir = path.resolve(inputKernelDir);
      } else {
        kernelDir = path.join('kernel', inputKernelDir);
      }
      core.warning('Using legacy kernel directory calculation');
    }

    // Check if build failed
    const buildFailed = core.getState('BUILD_FAILED') === 'true';

    if (buildFailed) {
      const buildLogPath = path.join(kernelDir, 'out', 'build.log');

      // Only analyze errors if build.log exists
      if (fs.existsSync(buildLogPath)) {
        core.startGroup('Analyzing build errors');
        analyzeBuildErrors(kernelDir);
        core.endGroup();
      }
    }

    // Cleanup
    await cleanAll({
      kernelDir,
      buildDir: 'build',
      toolchains: true,
      ccache: false,
      env: true,
    });

    core.info('Cleanup completed!');
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Post-action failed: ${error.message}`);
    }
  }
}

// Always run post action
post();
