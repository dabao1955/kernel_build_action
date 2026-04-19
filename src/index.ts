import * as core from '@actions/core';
import * as path from 'node:path';

import {
  checkEnvironment,
  installDependencies,
  getActionPath,
  installSystemClang,
  validateNoPathTraversal,
  validateBranchName,
  validatePositiveInteger,
  validateUrlSegment,
  validateKsuVersion,
} from './utils';
import { setupCcache, saveCcache, setupCcacheSymlinks } from './cache';
import {
  setupToolchains,
  type ToolchainConfig,
  type ToolchainPaths,
  getSystemToolchainPaths,
} from './toolchain';
import {
  cloneKernel,
  cloneVendor,
  getKernelVersion,
  getConfigPath,
  configExists,
  setupMkdtboimg,
  isLocalKernelPath,
  isKernelSource,
  type KernelConfig,
} from './kernel';
import { disableLto, enableKvm } from './config';
import { setupKernelSU, setupBBG, setupReKernel, setupNetHunter, setupLXC } from './patches';
import { buildKernel, isBuildSuccessful } from './builder';
import { packageKernel } from './packager';
import { uploadArtifacts } from './artifact';
import { createRelease } from './release';

/**
 * Main action - build kernel
 */
async function main(): Promise<void> {
  try {
    // Check environment
    checkEnvironment();

    const accessToken = core.getInput('access-token') || '';
    if (accessToken) {
      core.setSecret(accessToken);
    }

    // Get inputs
    const inputs = {
      kernelUrl: core.getInput('kernel-url', { required: true }),
      kernelBranch: core.getInput('kernel-branch') || 'main',
      kernelDir: core.getInput('kernel-dir') || 'kernel',
      depth: core.getInput('depth') || '1',
      config: core.getInput('config', { required: true }) || 'defconfig',
      arch: core.getInput('arch', { required: true }) || 'arm64',
      androidVersion: core.getInput('android-version') || '',
      vendor: core.getBooleanInput('vendor'),
      vendorUrl: core.getInput('vendor-url') || '',
      vendorBranch: core.getInput('vendor-branch') || 'main',
      vendorDir: core.getInput('vendor-dir') || 'vendor',
      aospClang: core.getBooleanInput('aosp-clang'),
      aospClangVersion: core.getInput('aosp-clang-version') || 'r383902',
      aospGcc: core.getBooleanInput('aosp-gcc'),
      otherClangUrl: core.getInput('other-clang-url') || '',
      otherClangBranch: core.getInput('other-clang-branch') || 'main',
      otherGcc64Url: core.getInput('other-gcc64-url') || '',
      otherGcc64Branch: core.getInput('other-gcc64-branch') || 'main',
      otherGcc32Url: core.getInput('other-gcc32-url') || '',
      otherGcc32Branch: core.getInput('other-gcc32-branch') || 'main',
      ksu: core.getBooleanInput('ksu'),
      ksuVersion: core.getInput('ksu-version') || 'main',
      ksuLkm: core.getBooleanInput('ksu-lkm'),
      ksuOther: core.getBooleanInput('ksu-other'),
      ksuUrl: core.getInput('ksu-url') || '',
      rekernel: core.getBooleanInput('rekernel'),
      nethunter: core.getBooleanInput('nethunter'),
      nethunterPatch: core.getBooleanInput('nethunter-patch'),
      lxc: core.getBooleanInput('lxc'),
      lxcPatch: core.getBooleanInput('lxc-patch'),
      kvm: core.getBooleanInput('kvm'),
      bbg: core.getBooleanInput('bbg'),
      disableLto: core.getBooleanInput('disable-lto'),
      ccache: core.getBooleanInput('ccache'),
      anykernel3: core.getBooleanInput('anykernel3'),
      anykernel3Url: core.getInput('anykernel3-url') || '',
      bootimgUrl: core.getInput('bootimg-url') || '',
      release: core.getBooleanInput('release'),
      accessToken,
      extraMakeArgs: core.getInput('extra-make-args') || '[]',
    };

    validateNoPathTraversal(inputs.kernelDir, 'kernel-dir');
    validateNoPathTraversal(inputs.vendorDir, 'vendor-dir');
    validateBranchName(inputs.kernelBranch, 'kernel-branch');
    validateBranchName(inputs.vendorBranch, 'vendor-branch');
    validateBranchName(inputs.otherClangBranch, 'other-clang-branch');
    validateBranchName(inputs.otherGcc64Branch, 'other-gcc64-branch');
    validateBranchName(inputs.otherGcc32Branch, 'other-gcc32-branch');
    validatePositiveInteger(inputs.depth, 'depth');
    if (inputs.androidVersion) {
      validateUrlSegment(inputs.androidVersion, 'android-version');
    }
    if (inputs.aospClangVersion) {
      validateUrlSegment(inputs.aospClangVersion, 'aosp-clang-version');
    }
    validateKsuVersion(inputs.ksuVersion);

    // Install dependencies
    await installDependencies();

    // Setup ccache if enabled (after dependencies to ensure proper permissions)
    if (inputs.ccache) {
      await setupCcache(inputs.config);
      await setupCcacheSymlinks();
    }

    // Setup toolchains
    let toolchainConfig: ToolchainPaths;
    if (inputs.aospClang || inputs.otherClangUrl) {
      const tcConfig: ToolchainConfig = {
        aospClang: inputs.aospClang,
        aospClangVersion: inputs.aospClangVersion,
        aospGcc: inputs.aospGcc,
        androidVersion: inputs.androidVersion,
        otherClangUrl: inputs.otherClangUrl,
        otherClangBranch: inputs.otherClangBranch,
        otherGcc64Url: inputs.otherGcc64Url,
        otherGcc64Branch: inputs.otherGcc64Branch,
        otherGcc32Url: inputs.otherGcc32Url,
        otherGcc32Branch: inputs.otherGcc32Branch,
      };
      toolchainConfig = await setupToolchains(tcConfig);
    } else if (inputs.aospGcc || inputs.otherGcc64Url || inputs.otherGcc32Url) {
      const tcConfig: ToolchainConfig = {
        aospClang: false,
        aospClangVersion: inputs.aospClangVersion,
        aospGcc: inputs.aospGcc,
        androidVersion: inputs.androidVersion,
        otherClangUrl: '',
        otherClangBranch: 'main',
        otherGcc64Url: inputs.otherGcc64Url,
        otherGcc64Branch: inputs.otherGcc64Branch,
        otherGcc32Url: inputs.otherGcc32Url,
        otherGcc32Branch: inputs.otherGcc32Branch,
      };
      toolchainConfig = await setupToolchains(tcConfig);
    } else {
      await installSystemClang();
      toolchainConfig = getSystemToolchainPaths();
    }

    // Prepare kernel source directory
    let kernelDir: string;
    const isLocal = isLocalKernelPath(inputs.kernelUrl);

    if (isLocal) {
      // Use local kernel source
      kernelDir = path.resolve(inputs.kernelUrl);
      core.info(`Using local kernel source: ${kernelDir}`);

      // Validate kernel source
      if (!isKernelSource(kernelDir)) {
        throw new Error(
          `Invalid kernel source directory: ${kernelDir}. ` +
            'Make sure it contains Makefile with VERSION, Kconfig, and arch/ directory.'
        );
      }
      core.info('Local kernel source validated successfully');
    } else {
      // Clone kernel source from remote URL
      const fullKernelDir = path.join('kernel', inputs.kernelDir);
      const kernelConfig: KernelConfig = {
        kernelUrl: inputs.kernelUrl,
        kernelBranch: inputs.kernelBranch,
        kernelDir: inputs.kernelDir,
        depth: inputs.depth,
        arch: inputs.arch,
        config: inputs.config,
        vendor: inputs.vendor,
        vendorUrl: inputs.vendorUrl,
        vendorBranch: inputs.vendorBranch,
        vendorDir: inputs.vendorDir,
      };

      await cloneKernel(
        kernelConfig.kernelUrl,
        kernelConfig.kernelBranch,
        kernelConfig.depth,
        fullKernelDir
      );

      kernelDir = fullKernelDir;

      // Clone vendor if enabled
      if (inputs.vendor && inputs.vendorUrl) {
        const fullVendorDir = path.join('kernel', inputs.vendorDir);
        await cloneVendor(
          inputs.vendorUrl,
          inputs.vendorBranch,
          inputs.depth,
          fullVendorDir,
          kernelDir,
          inputs.vendorDir
        );
      }
    }

    // Save state for post-action to use correct kernel directory
    core.saveState('KERNEL_DIR', kernelDir);
    core.saveState('IS_LOCAL_KERNEL', isLocal.toString());

    const actionPath = getActionPath();

    // Get kernel version
    const kernelVersion = getKernelVersion(kernelDir);

    // Setup mkdtboimg
    await setupMkdtboimg(kernelDir, actionPath);

    // Get config path
    const configPath = getConfigPath(kernelDir, inputs.arch, inputs.config);
    if (!configExists(kernelDir, inputs.arch, inputs.config)) {
      throw new Error(`Config file not found: ${configPath}`);
    }

    // Apply patches based on inputs
    if (inputs.ksu) {
      await setupKernelSU(
        kernelDir,
        configPath,
        {
          version: inputs.ksuVersion,
          lkm: inputs.ksuLkm,
          other: inputs.ksuOther,
          url: inputs.ksuUrl,
        },
        kernelVersion
      );
    }

    if (inputs.bbg) {
      await setupBBG(kernelDir, configPath);
    }

    if (inputs.rekernel) {
      await setupReKernel(kernelDir, configPath, inputs.arch);
    }

    if (inputs.nethunter) {
      await setupNetHunter(kernelDir, configPath, { patch: inputs.nethunterPatch });
    }

    if (inputs.disableLto) {
      disableLto(configPath);
    }

    if (inputs.kvm) {
      enableKvm(configPath);
    }

    if (inputs.lxc) {
      await setupLXC(kernelDir, configPath, { patch: inputs.lxcPatch });
    }

    // Build kernel
    const buildSuccess = await buildKernel({
      kernelDir,
      arch: inputs.arch,
      config: inputs.config,
      toolchain: toolchainConfig,
      extraMakeArgs: inputs.extraMakeArgs,
      useCcache: inputs.ccache,
    });

    if (!buildSuccess) {
      throw new Error('Kernel build failed');
    }

    // Verify build
    if (!isBuildSuccessful(kernelDir, inputs.arch)) {
      throw new Error('Kernel image not found after build');
    }

    // Package kernel
    const buildDir = 'build';
    await packageKernel({
      kernelDir,
      arch: inputs.arch,
      anykernel3: inputs.anykernel3,
      anykernel3Url: inputs.anykernel3Url,
      bootimgUrl: inputs.bootimgUrl,
      buildDir,
      release: inputs.release,
    });

    // Save ccache if enabled
    if (inputs.ccache) {
      await saveCcache(inputs.config);
    }

    // Upload artifacts or create release
    if (inputs.release) {
      process.env.RELEASE_MODE = 'true';
      await createRelease({
        token: inputs.accessToken,
        buildDir,
        kernelUrl: inputs.kernelUrl,
        kernelBranch: inputs.kernelBranch,
        config: inputs.config,
        arch: inputs.arch,
        features: {
          ksu: inputs.ksu,
          nethunter: inputs.nethunter,
          lxc: inputs.lxc,
          kvm: inputs.kvm,
          rekernel: inputs.rekernel,
        },
      });
    } else {
      await uploadArtifacts({
        buildDir,
        anykernel3: inputs.anykernel3,
        release: inputs.release,
      });
    }

    core.info('Kernel build completed successfully!');
  } catch (error) {
    // Save state for post-action
    core.saveState('BUILD_FAILED', 'true');

    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

// Run main action
main();
