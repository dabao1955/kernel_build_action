import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { removeDir } from './utils';
import { findKernelImage, findDtbFile, findDtboFile } from './kernel';

export interface PackageConfig {
  kernelDir: string;
  arch: string;
  anykernel3: boolean;
  anykernel3Url?: string;
  bootimgUrl?: string;
  buildDir: string;
  release?: boolean;
}

/**
 * Package kernel as boot.img
 */
export async function packageBootimg(config: PackageConfig): Promise<void> {
  core.startGroup('Packaging boot.img');

  if (!config.bootimgUrl) {
    throw new Error('bootimg-url input is required when anykernel3 is set to false');
  }

  // Create split directory
  const splitDir = 'split';
  fs.mkdirSync(splitDir, { recursive: true });

  // Download magiskboot
  const hostArch = process.arch === 'x64' ? 'x86' : 'arm';
  const magiskbootUrl = `https://github.com/Shubhamvis98/AIK/raw/4ac321dfd48e16344e6146c505708aa720ff0bb3/bin/magiskboot_${hostArch}`;
  const magiskbootPath = path.join(splitDir, 'magiskboot');

  core.info(`Downloading magiskboot for ${hostArch}...`);
  await exec.exec('aria2c', [magiskbootUrl, '-o', magiskbootPath]);
  fs.chmodSync(magiskbootPath, 0o755);

  // Download boot.img
  const bootimgPath = path.join(splitDir, 'boot.img');
  core.info(`Downloading boot.img from: ${config.bootimgUrl}`);

  // Validate URL doesn't start with hyphen to prevent command injection
  if (config.bootimgUrl.startsWith('-')) {
    throw new Error('bootimg-url must not start with a hyphen');
  }

  // Use -- separator to prevent option parsing
  // -o must come before -- to ensure URL is treated as positional argument
  await exec.exec('aria2c', ['-o', bootimgPath, '--', config.bootimgUrl]);

  // Unpack boot.img
  const nohupPath = path.join(splitDir, 'nohup.out');
  await exec.exec(magiskbootPath, ['unpack', bootimgPath], {
    cwd: splitDir,
    listeners: {
      stdout: (data: Buffer) => {
        fs.appendFileSync(nohupPath, data);
      },
      stderr: (data: Buffer) => {
        fs.appendFileSync(nohupPath, data);
      },
    },
  });

  // Parse kernel format
  const nohupContent = fs.readFileSync(nohupPath, 'utf-8');
  const fmtMatch = nohupContent.match(/KERNEL_FMT\s*\[([^\]]+)\]/);
  const fmt = fmtMatch ? fmtMatch[1] : 'raw';

  core.info(`Kernel format: ${fmt}`);

  // Find and copy kernel image
  const kernelImage = findKernelImage(config.kernelDir, config.arch);
  if (!kernelImage) {
    throw new Error('Kernel Image not found in out directory');
  }

  // Remove old kernel
  const oldKernelPath = path.join(splitDir, 'kernel');
  if (fs.existsSync(oldKernelPath)) {
    fs.rmSync(oldKernelPath);
  }

  // Copy new kernel
  fs.copyFileSync(kernelImage, oldKernelPath);
  core.info(`Copied kernel: ${kernelImage} -> kernel`);

  // Repack boot.img
  await exec.exec(magiskbootPath, ['repack', bootimgPath], { cwd: splitDir });

  // Move output to build directory
  fs.mkdirSync(config.buildDir, { recursive: true });

  // Find repacked image (prefer new.img over original boot.img)
  const entries = fs.readdirSync(splitDir);
  let repackedImg: string | undefined;
  for (const entry of entries) {
    if (entry === 'new.img') {
      repackedImg = entry;
      break;
    }
  }
  if (!repackedImg) {
    for (const entry of entries) {
      if (entry.endsWith('.img') && entry !== 'boot.img') {
        repackedImg = entry;
        break;
      }
    }
  }

  if (repackedImg) {
    const srcPath = path.join(splitDir, repackedImg);
    const destPath = path.join(config.buildDir, 'boot.img');
    fs.renameSync(srcPath, destPath);
    core.info(`Created: ${destPath}`);
  } else {
    core.warning('No repacked image found in split directory');
  }

  // Cleanup
  removeDir(splitDir);

  core.endGroup();
}

/**
 * Package kernel as AnyKernel3
 */
export async function packageAnyKernel3(config: PackageConfig): Promise<void> {
  core.startGroup('Packaging AnyKernel3 flasher');

  // Clone AnyKernel3
  const anykernelDir = 'AnyKernel3';
  if (fs.existsSync(anykernelDir)) {
    removeDir(anykernelDir);
  }

  if (config.anykernel3Url) {
    await exec.exec('git', ['clone', '--', config.anykernel3Url, anykernelDir]);
  } else {
    await exec.exec('git', ['clone', '--', 'https://github.com/osm0sis/AnyKernel3', anykernelDir]);

    // Modify anykernel.sh for generic use
    const anykernelSh = path.join(anykernelDir, 'anykernel.sh');
    if (fs.existsSync(anykernelSh)) {
      let content = fs.readFileSync(anykernelSh, 'utf-8');
      content = content.replace(
        /BLOCK=\/dev\/block\/platform\/omap\/omap_hsmmc\.0\/by-name\/boot;/g,
        'BLOCK=auto;'
      );
      content = content.replace(/do\.devicecheck=1/g, 'do.devicecheck=0');
      content = content.replace(/IS_SLOT_DEVICE=0;/g, 'IS_SLOT_DEVICE=auto;');
      fs.writeFileSync(anykernelSh, content);
    }
  }

  // Find and copy kernel image
  const kernelImage = findKernelImage(config.kernelDir, config.arch);
  if (kernelImage) {
    fs.copyFileSync(kernelImage, path.join(anykernelDir, path.basename(kernelImage)));
    core.info(`Copied kernel: ${kernelImage}`);
  } else {
    const rawImage = path.join(config.kernelDir, 'out', 'arch', config.arch, 'boot', 'Image');
    if (fs.existsSync(rawImage)) {
      fs.copyFileSync(rawImage, path.join(anykernelDir, 'Image'));
      core.info(`Copied raw kernel: ${rawImage}`);
    } else {
      throw new Error('Kernel Image not found in out directory');
    }
  }

  // Copy dtbo
  const dtboFile = findDtboFile(config.kernelDir, config.arch);
  if (dtboFile) {
    fs.copyFileSync(dtboFile, path.join(anykernelDir, 'dtbo.img'));
    core.info(`Copied dtbo: ${dtboFile}`);
  } else {
    core.info('DTBO not found, skipping');
  }

  // Copy dtb
  const dtbFile = findDtbFile(config.kernelDir, config.arch);
  if (dtbFile) {
    const destName = dtbFile.endsWith('.img') ? 'dtb.img' : 'dtb';
    fs.copyFileSync(dtbFile, path.join(anykernelDir, destName));
    core.info(`Copied dtb: ${dtbFile}`);
  } else {
    core.info('DTB not found, skipping');
  }

  // Remove unnecessary files
  const filesToRemove = ['.git', '.gitattributes', '.gitignore', 'README.md'];
  for (const file of filesToRemove) {
    const filePath = path.join(anykernelDir, file);
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).isDirectory()) {
        removeDir(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  // Create build directory and copy files
  fs.mkdirSync(config.buildDir, { recursive: true });

  // Create zip if releasing, otherwise copy files
  if (config.release) {
    const zipPath = path.resolve(config.buildDir, 'AnyKernel3-flasher.zip');
    await exec.exec('zip', ['-r', zipPath, '.'], { cwd: anykernelDir });
    core.info(`Created: ${zipPath}`);
  } else {
    // Copy all files to build directory
    const entries = fs.readdirSync(anykernelDir);
    for (const entry of entries) {
      const srcPath = path.join(anykernelDir, entry);
      const destPath = path.join(config.buildDir, entry);
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Cleanup
  removeDir(anykernelDir);

  core.endGroup();
}

/**
 * Package kernel output
 */
export async function packageKernel(config: PackageConfig): Promise<void> {
  if (config.anykernel3) {
    await packageAnyKernel3(config);
  } else {
    await packageBootimg(config);
  }
}
