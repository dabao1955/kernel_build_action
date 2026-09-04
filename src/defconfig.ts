import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileExists } from './utils';
import { getConfigPath } from './kernel';

/**
 * Extract a defconfig from a stock boot image.
 *
 * Downloads the reference boot.img, unpacks the kernel image with magiskboot
 * and runs the kernel's own `scripts/extract-ikconfig` to recover the config
 * that the stock kernel was built with (requires the vendor kernel to carry
 * its config, i.e. CONFIG_IKCONFIG). The result is written to
 * `arch/<arch>/configs/<config>` so the rest of the action treats it like a
 * regular defconfig.
 */
export async function extractDefconfigFromBoot(
  kernelDir: string,
  arch: string,
  config: string,
  bootimgUrl: string
): Promise<string> {
  core.startGroup(`Extracting defconfig '${config}' from boot image`);

  if (!bootimgUrl) {
    throw new Error('config-from-boot requires the bootimg-url input');
  }
  if (bootimgUrl.startsWith('-')) {
    throw new Error('bootimg-url must not start with a hyphen');
  }

  const workDir = path.resolve('defconfig-extract');
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // Download magiskboot (same pinned source as the packager)
    const hostArch = process.arch === 'x64' ? 'x86' : 'arm';
    const magiskbootUrl = `https://github.com/Shubhamvis98/AIK/raw/4ac321dfd48e16344e6146c505708aa720ff0bb3/bin/magiskboot_${hostArch}`;
    const magiskbootPath = path.join(workDir, 'magiskboot');
    core.info(`Downloading magiskboot for ${hostArch}...`);
    await exec.exec('aria2c', [magiskbootUrl, '-o', magiskbootPath]);
    fs.chmodSync(magiskbootPath, 0o755);

    // Download the stock boot image
    const bootimgPath = path.join(workDir, 'boot.img');
    core.info(`Downloading boot image from: ${bootimgUrl}`);
    await exec.exec('aria2c', ['-o', bootimgPath, '--', bootimgUrl]);

    // Unpack it
    await exec.exec(magiskbootPath, ['unpack', bootimgPath], { cwd: workDir });

    const kernelImagePath = path.join(workDir, 'kernel');
    if (!fileExists(kernelImagePath)) {
      throw new Error('magiskboot did not produce a kernel image from the boot image');
    }

    // Run the kernel's extract-ikconfig
    const extractScript = path.join(kernelDir, 'scripts', 'extract-ikconfig');
    if (!fileExists(extractScript)) {
      throw new Error(`scripts/extract-ikconfig not found in kernel source: ${extractScript}`);
    }

    const result = await exec.getExecOutput('bash', [extractScript, kernelImagePath], {
      cwd: kernelDir,
      silent: true,
    });
    if (result.exitCode !== 0) {
      throw new Error(`extract-ikconfig failed with exit code ${result.exitCode}`);
    }

    const configText = result.stdout;
    if (!configText.includes('CONFIG_')) {
      throw new Error(
        'extract-ikconfig produced no kernel config. ' +
          'The stock kernel was likely built without CONFIG_IKCONFIG.'
      );
    }

    const configPath = getConfigPath(kernelDir, arch, config);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, configText);
    core.info(`Wrote extracted defconfig to: ${configPath}`);

    return configPath;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
    core.endGroup();
  }
}
