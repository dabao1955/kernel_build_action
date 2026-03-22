import * as core from '@actions/core';
import * as fs from 'node:fs';

/**
 * Disable LTO in kernel config
 */
export function disableLto(configPath: string): void {
  core.startGroup('Disabling LTO');

  if (!fs.existsSync(configPath)) {
    core.warning(`Config file not found: ${configPath}`);
    core.endGroup();
    return;
  }

  core.info('Disabling LTO...');

  let content = fs.readFileSync(configPath, 'utf-8');

  // Replace LTO options
  content = content.replace(/CONFIG_LTO=y/g, 'CONFIG_LTO=n');
  content = content.replace(/CONFIG_LTO_CLANG=y/g, 'CONFIG_LTO_CLANG=n');
  content = content.replace(/CONFIG_THINLTO=y/g, 'CONFIG_THINLTO=n');

  // Add CONFIG_LTO_NONE if not present
  if (!content.includes('CONFIG_LTO_NONE')) {
    content += '\nCONFIG_LTO_NONE=y\n';
  }

  fs.writeFileSync(configPath, content);
  core.info('LTO disabled');

  core.endGroup();
}

/**
 * Enable KVM support
 */
export function enableKvm(configPath: string): void {
  core.startGroup('Enabling KVM support');

  core.info('Enabling KVM support...');

  const kvmOptions = [
    'CONFIG_VIRTUALIZATION=y',
    'CONFIG_KVM=y',
    'CONFIG_KVM_MMIO=y',
    'CONFIG_KVM_ARM_HOST=y',
  ];

  for (const option of kvmOptions) {
    appendConfig(configPath, option);
  }

  core.info('KVM support enabled');

  core.endGroup();
}

/**
 * Append config option to file
 */
export function appendConfig(configPath: string, option: string): void {
  fs.appendFileSync(configPath, `${option}\n`);
}

/**
 * Set config option
 */
export function setConfig(configPath: string, option: string, value: string): void {
  if (!fs.existsSync(configPath)) {
    core.warning(`Config file not found: ${configPath}`);
    return;
  }

  let content = fs.readFileSync(configPath, 'utf-8');

  // Check if option already exists
  const regex = new RegExp(`^${option}=.*$`, 'm');
  if (regex.test(content)) {
    // Replace existing
    content = content.replace(regex, `${option}=${value}`);
  } else {
    // Append new
    content += `${option}=${value}\n`;
  }

  fs.writeFileSync(configPath, content);
}

/**
 * Check if config option is enabled
 */
export function isConfigEnabled(configPath: string, option: string): boolean {
  if (!fs.existsSync(configPath)) {
    return false;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const regex = new RegExp(`^${option}=y$`, 'm');
  return regex.test(content);
}

/**
 * Get config value
 */
export function getConfigValue(configPath: string, option: string): string | undefined {
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const regex = new RegExp(`^${option}=(.*)$`, 'm');
  const match = content.match(regex);

  return match ? match[1] : undefined;
}

/**
 * Apply kernel configuration
 */
export function applyKernelConfig(
  configPath: string,
  options: {
    disableLto?: boolean;
    kvm?: boolean;
  }
): void {
  if (options.disableLto) {
    disableLto(configPath);
  }

  if (options.kvm) {
    enableKvm(configPath);
  }
}

/**
 * Read kernel configuration file
 */
export function readKernelConfig(configPath: string): string {
  if (!fs.existsSync(configPath)) {
    return '';
  }
  return fs.readFileSync(configPath, 'utf-8');
}

/**
 * Write kernel configuration file
 */
export function writeKernelConfig(configPath: string, content: string): void {
  fs.writeFileSync(configPath, content);
}
