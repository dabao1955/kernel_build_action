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

    // Check if build failed
    const buildFailed = core.getState('BUILD_FAILED') === 'true';

    if (buildFailed) {
      const kernelDir = core.getInput('kernel-dir') || 'kernel';
      const fullKernelDir = path.join('kernel', kernelDir);
      const buildLogPath = path.join(fullKernelDir, 'out', 'build.log');

      // Only analyze errors if build.log exists
      if (fs.existsSync(buildLogPath)) {
        core.startGroup('Analyzing build errors');
        analyzeBuildErrors(fullKernelDir);
        core.endGroup();
      }
    }

    // Cleanup
    const kernelDir = core.getInput('kernel-dir') || 'kernel';
    const fullKernelDir = path.join('kernel', kernelDir);

    await cleanAll({
      kernelDir: fullKernelDir,
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
