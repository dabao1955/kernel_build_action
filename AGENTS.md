# Android Kernel Build Action - Project Context

## Agent Quick Start

- For significant features or refactors, sketch a plan first; keep it updated as you work.
- Default to `rg` for searching and keep edits ASCII unless the file already uses non-ASCII.
- Run the component-specific checks below before handing work off; do not skip failing steps.
- When unsure which path to take, favor minimal risk changes that can run the workflow successfully.


## Project Overview

This is the **Android Kernel Build Action** - a comprehensive GitHub Action that automates the building of Android kernel source code. The project provides a flexible, configurable workflow for compiling Android kernels with support for various toolchains, architectures, and kernel modifications.

### Key Technologies
- **GitHub Actions** (YAML-based CI/CD automation)
- **Bash scripting** (main build logic)
- **Python 3** (mkdtboimg.py tool for DTB/DTBO image handling)
- **Android NDK/AOSP toolchains** (GCC and Clang)
- **Various kernel modification frameworks** (KernelSU, NetHunter, LXC, Re-Kernel)

## Project Structure

```
/home/user/kernel_build_action/
├── action.yml              # Main GitHub Action definition
├── README.md               # Comprehensive usage documentation
├── mkdtboimg.py            # Python tool for DTB/DTBO image manipulation
├── .yamllint               # YAML linting configuration
├── LICENSE                 # Apache License 2.0
├── SECURITY.md             # Security policy documentation
├── kernelsu/               # KernelSU integration scripts
│   ├── apply_cocci.sh      # Coccinelle patch application
│   ├── classic.cocci       # Classic kernel patches
│   ├── minimal.cocci       # Minimal kernel patches
│   └── patch.sh            # Main KernelSU patch script
├── lxc/                    # LXC/Docker support
├── nethunter/              # Kali NetHunter integration
└── rekernel/               # Re-Kernel support patches
```

## Building and Running

### Primary Usage
This is a GitHub Action that runs in CI/CD pipelines. Users typically:

1. Create a GitHub workflow file (`.github/workflows/*.yml`)
2. Use the action with required inputs:
   ```yaml
   - name: Build Kernel
     uses: dabao1955/kernel_build_action@main
     with:
       kernel-url: https://github.com/username/kernel_repo
       kernel-branch: main
       config: defconfig
       arch: arm64
       aosp-clang: true
       android-version: 12
   ```

### Local Development
- **No local build process** - this project is specifically designed for GitHub Actions
- **Testing**: Run workflows manually via `workflow_dispatch` trigger
- **Validation**: Check YAML syntax with `yamllint` tool

### Key Build Commands
The action automatically handles the entire build pipeline:
- Installing system dependencies (`apt-get install`)
- Downloading and configuring toolchains (AOSP GCC/Clang)
- Cloning and patching kernel source code
- Compiling the kernel using `make`
- Packaging the output (AnyKernel3 or boot.img)

## Action.yml Detailed Analysis

### Basic Information
```yaml
name: 'Android Kernel Build Action'
description: "An action to build android kernel."
branding:
  icon: 'activity'
  color: 'blue'
```
- **name**: The action name displayed in the GitHub Actions marketplace
- **description**: A concise description explaining the action's functionality
- **branding**: Visual branding configuration using a blue theme with an activity icon

### Input Parameters (inputs) Detailed Description
ignored, read action.yml first
### Execution Flow (runs) Detailed Analysis

#### Step 1: Setup ccache
```yaml
- name: Setup ccache
  if: inputs.ccache == 'true'
  uses: hendrikmuhs/ccache-action@v1.2
  with:
    key: ${{ inputs.config }}-0cb68f9cbcbb3de9c966cf66ed51471fbe51419e
    max-size: 4G
    create-symlink: true
```
- **Function**: Configures compilation caching to accelerate repeated build processes
- **Condition**: Only executes when ccache is explicitly enabled via input parameter
- **Cache key**: Generated based on configuration file hash for cache isolation
- **Cache size**: Limited to maximum 4GB to prevent excessive disk usage

#### Step 2: Build Kernel (Main Build Process)
This is the most comprehensive step, encompassing the entire kernel compilation workflow with the following sub-processes:

##### 2.1 Environment Check and Utility Functions
```bash
#!/bin/bash
set -euo pipefail

error() {
    echo "Error: $1" >&2
    exit 1
}

SU() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

download_and_extract() {
    # Handle different download and extraction formats
}
```
- **Error handling**: Implements robust error handling with immediate exit on failures
- **Privilege management**: Smart sudo detection and execution
- **Download utilities**: Flexible download and extraction for various file formats

##### 2.2 System Environment Validation
- Validates that the action is running in a Debian-based GitHub Actions environment
- Confirms availability of essential system tools and utilities
- Ensures compatibility with the expected runtime environment

##### 2.3 Dependency Installation
```bash
SU apt-get install --no-install-recommends -y \
    binutils git make bc bison openssl curl zip kmod cpio flex libelf-dev \
    libssl-dev libtfm-dev libc6-dev device-tree-compiler ca-certificates \
    python3 xz-utils aria2 build-essential ccache pigz parallel jq opam libpcre3-dev
```
- **Core compilation tools**: Essential toolchain components (binutils, gcc, make, etc.)
- **Kernel-specific tools**: Device tree compiler, kernel build utilities
- **Specialized utilities**: aria2 (parallel downloads), pigz (fast compression), jq (JSON processing), opam (OCaml package management for Coccinelle)

##### 2.4 Toolchain Download and Configuration
The action intelligently selects and configures the appropriate toolchain based on input parameters:

**AOSP Clang Path**:
- Downloads the official Android Clang toolchain from Google's repositories
- Automatically selects toolchains compatible with specified Android versions
- Handles toolchain extraction, path configuration, and environment setup

**Custom Toolchain Path**:
- Supports integration of third-party GCC and Clang toolchains
- Intelligently detects toolchain directory structure and adjusts paths accordingly
- Supports multiple compression formats including .tar.xz, .zip, .tar, and .git repositories

**System Toolchain Path**:
- Falls back to system-installed clang and cross-compilation tools when needed
- Provides a reliable baseline when custom toolchains are unavailable

##### 2.5 Kernel Source Acquisition
```bash
git clone --recursive -b "${{ inputs.kernel-branch }}" --depth="${{ inputs.depth }}" \
    "${{ inputs.kernel-url }}" "kernel/${{ inputs.kernel-dir }}"
```
- **Recursive clone**: Fetches all kernel submodules and dependencies
- **Branch specification**: Checks out the exact branch specified in inputs
- **Depth optimization**: Uses shallow cloning to minimize download time and storage requirements

##### 2.6 Vendor Source Integration (Optional)
```bash
if [ "${{ inputs.vendor }}" == "true" ]; then
    git clone -b "${{ inputs.vendor-branch }}" --depth="${{ inputs.depth }}" \
        "${{ inputs.vendor-url }}" "kernel/${{ inputs.vendor-dir }}"
    # Copy vendor directory to kernel source
fi
```
- **Vendor integration**: Downloads additional vendor-specific kernel sources when required
- **Directory management**: Organizes vendor sources in separate directories for clean separation
- **Automatic copying**: Merges vendor sources into the main kernel tree when appropriate

##### 2.7 Kernel Version Detection
```bash
VERSION=$(grep -E '^VERSION = ' Makefile | awk '{print $3}')
PATCHLEVEL=$(grep -E '^PATCHLEVEL = ' Makefile | awk '{print $3}')
SUBLEVEL=$(grep -E '^SUBLEVEL = ' Makefile | awk '{print $3}')
```
- **Version parsing**: Extracts kernel version information directly from the Makefile
- **GKI detection**: Automatically determines if the kernel is a Generic Kernel Image (GKI)
- **Compatibility assessment**: Provides version-specific adaptations for tools like KernelSU that have version-dependent behavior

##### 2.8 KernelSU Integration (Optional)
```bash
if [ "${{ inputs.ksu }}" == "true" ]; then
    # Download KernelSU setup script
    # Select appropriate KernelSU version based on kernel version
    # Apply kernel patches
    # Configure compilation options
fi
```
- **Intelligent version selection**: Automatically detects kernel version and selects the most compatible KernelSU version
- **Patch management**: Applies necessary patches specifically for non-GKI kernels that require additional modifications
- **LKM support**: Provides optional Loadable Kernel Module (LKM) build mode for devices that cannot integrate KernelSU directly

##### 2.9 Re-Kernel Integration (Optional)
```bash
if [ "${{ inputs.rekernel }}" == "true" ]; then
    # Download and apply Re-Kernel patches
fi
```
- **Enhanced kernel features**: Integrates additional kernel enhancements and optimizations provided by Re-Kernel
- **Patch application**: Automatically downloads and applies Re-Kernel-specific patches

##### 2.10 mkdtboimg Tool Configuration
```bash
if [ -f scripts/dtc/libfdt/mkdtboimg.py ]; then
    # Replace with Python3 version
    # Handle different kernel build systems
else
    # Install to system path
fi
```
- **Python version management**: Ensures compatibility by replacing Python2 versions with Python3
- **Build system integration**: Adapts to different kernel build system structures
- **System installation**: Installs the tool system-wide when not present in kernel source

##### 2.11 NetHunter Integration (Optional)
```bash
if [ "${{ inputs.nethunter }}" == "true" ]; then
    # Configure NetHunter
    # Apply WiFi injection patches
    # Fix driver naming conflicts
fi
```
- **Security tool integration**: Configures Kali NetHunter penetration testing framework
- **WiFi injection support**: Applies patches to enable WiFi packet injection capabilities
- **Driver compatibility**: Resolves naming conflicts and compatibility issues with wireless drivers

##### 2.12 LTO Configuration
```bash
if [ "${{ inputs.disable-lto }}" == "true" ]; then
    # Disable various LTO options
    # Add CONFIG_LTO_NONE
fi
```
- **LTO management**: Disables Link Time Optimization when it causes compilation or runtime issues
- **Configuration modification**: Updates kernel configuration to explicitly disable LTO options

##### 2.13 KVM Support
```bash
if [ "${{ inputs.kvm }}" == "true" ]; then
    # Enable virtualization-related configurations
fi
```
- **Virtualization enablement**: Activates Kernel-based Virtual Machine (KVM) support
- **Hardware acceleration**: Enables hardware virtualization for improved VM performance

##### 2.14 LXC Support
```bash
if [ "${{ inputs.lxc }}" == "true" ]; then
    # Configure LXC support
    # Apply container-related patches
fi
```
- **Container support**: Enables Linux Container (LXC) functionality
- **Boot compatibility**: Applies patches to resolve container boot issues in the built kernel

##### 2.15 Kernel Compilation
```bash
# Build parameter setup
make_args=(
    -j"$(nproc --all)"
    "${{ inputs.config }}"
    "ARCH=${{ inputs.arch }}"
    "O=out"
    all
    "${SAFE_EXTRA_ARGS[@]}"
)

# Compiler configuration
if [[ -d "$HOME/clang/bin" ]]; then
    CMD_PATH="$HOME/clang/bin"
    CMD_CC="clang"
    # Configure cross-compilation parameters
fi

# Execute compilation
make \
    CC="$CMD_CC" \
    CROSS_COMPILE="$CMD_CROSS_COMPILE" \
    CROSS_COMPILE_ARM32="$CMD_CROSS_COMPILE_ARM32" \
    CLANG_TRIPLE="$CMD_CLANG_TRIPLE" \
    "${make_args[@]}"
```
- **Parallel compilation**: Utilizes all available CPU cores for faster build times
- **Toolchain selection**: Intelligently selects the appropriate compiler based on configured toolchains
- **Cross-compilation setup**: Configures proper cross-compilation environment for target architecture
- **Custom parameters**: Incorporates user-specified additional make arguments safely

##### 2.16 Output Packaging
The action provides two distinct packaging methods based on the `anykernel3` parameter:

**boot.img Packaging**:
- Downloads Android Image Kitchen (AIK) tools for boot image manipulation
- Unpacks the original boot.img to extract kernel and ramdisk components
- Replaces the kernel image with the newly compiled kernel
- Repackages the boot.img with the updated kernel

**AnyKernel3 Packaging**:
- Clones the AnyKernel3 repository for flashable package generation
- Copies the compiled kernel image and device tree files to the package
- Generates a flashable ZIP package compatible with custom recovery tools
- Provides device-agnostic flashing capabilities

#### Step 3: Artifact Upload
```yaml
- id: uploadi
  if: ${{ inputs.release == 'false' && inputs.anykernel3 == 'false' }}
  uses: actions/upload-artifact@v5
  with:
    name: kernel-built-bootimg
    path: build/*
    if-no-files-found: error
    overwrite: true
```
- **Conditional upload**: Only uploads artifacts when not creating releases
- **Artifact naming**: Uses descriptive names for easy identification
- **Error handling**: Fails the workflow if no artifacts are found

#### Step 4: GitHub Release (Optional)
```yaml
- id: release
  if: inputs.release == 'true'
  uses: softprops/action-gh-release@v2
  with:
    name: Last CI build kernel
    tag_name: last-ci-${{ github.sha }}
    files: build/*
    body: |
      # Build Information
      # Features
      # Build Details
```
- **Automatic release creation**: Creates GitHub releases with build artifacts
- **Metadata inclusion**: Includes comprehensive build information and feature details
- **Version tagging**: Uses unique tags based on commit SHA for version tracking

### Error Handling Mechanisms
The action implements comprehensive error handling throughout the build process:

- **Input validation**: Thoroughly validates all required parameters and their formats before execution
- **Network error management**: Implements retry mechanisms and provides detailed error messages for network-related failures
- **Compilation error handling**: Preserves detailed build logs and error output for effective debugging
- **File existence verification**: Validates the presence of critical files and dependencies before proceeding

### Security Considerations
The action incorporates multiple security measures to ensure safe operation:

- **Parameter filtering**: Prevents dangerous make parameter overrides that could compromise the build system
- **URL validation**: Thoroughly checks the trustworthiness and validity of all download sources
- **Token security**: Implements secure handling and storage of GitHub access tokens
- **Path security**: Prevents path traversal attacks through careful path validation and sanitization

## Development Conventions

### Code Style Guidelines
The project follows established coding standards to ensure consistency and maintainability:

- **YAML**: Strictly adheres to `.yamllint` configuration rules with maximum line length of 768 characters and trailing spaces enabled
- **Bash**: Implements robust error handling using `set -euo pipefail`. Shell scripts should be validated with shellcheck before modifications
- **Python**: Follows PEP 8 style guidelines as demonstrated in the mkdtboimg.py implementation
- **Shell scripts**: Organized using functions for better modularity, reusability, and comprehensive error handling

### Configuration Management
The project employs systematic configuration management practices:

- **Input validation**: Implements comprehensive parameter validation in `action.yml` to ensure data integrity
- **Error handling**: Provides detailed, informative error messages with specific exit codes for different failure scenarios
- **Logging**: Extensively uses `echo "::group::"` syntax to create collapsible log sections for better readability and debugging

### Security Practices
Security is integrated throughout the development process:

- **Token management**: GitHub access tokens are handled with strict security protocols and minimal exposure
- **URL validation**: All input URLs undergo thorough validation before download to prevent malicious sources
- **File permissions**: Proper chmod operations ensure executable scripts have appropriate permissions

## Core Features

### Kernel Source Management
The action provides comprehensive kernel source management capabilities:

- **Multi-repository support**: Seamlessly handles both main kernel sources and additional vendor-specific repositories
- **Branch selection**: Offers flexible configuration of kernel and vendor repository branches
- **Depth optimization**: Implements intelligent git clone depth to minimize download times and storage requirements
- **Vendor integration**: Automatically integrates vendor sources when required for device-specific builds

### Toolchain Support
Extensive toolchain compatibility ensures broad kernel support:

- **AOSP GCC**: Full support for Android Open Source Project GCC cross-compilation toolchains
- **AOSP Clang**: Complete integration with official Android Clang toolchains including version-specific selection
- **Custom toolchains**: Flexible support for third-party GCC and Clang toolchains from various sources
- **Architecture support**: Comprehensive coverage for arm64, arm, and x86_64 target architectures

### Kernel Modifications
Built-in support for popular kernel enhancement frameworks:

- **KernelSU**: Integrated root access framework with optional Loadable Kernel Module (LKM) support
- **NetHunter**: Complete Kali Linux penetration testing and security assessment tool integration
- **LXC/Docker**: Full containerization support with optional compatibility patches
- **Re-Kernel**: Additional kernel enhancements and performance optimizations
- **KVM**: Kernel Virtual Machine support for hardware virtualization capabilities

### Build Optimization
Advanced optimization features for efficient compilation:

- **ccache**: Intelligent compilation caching to dramatically accelerate rebuild processes
- **LTO control**: Configurable Link Time Optimization with disable options for compatibility
- **Parallel builds**: Automatic CPU core detection and utilization for optimal build performance
- **Extra make arguments**: Flexible system for passing custom compilation flags and parameters

### Output Packaging
Multiple packaging options for different distribution needs:

- **AnyKernel3**: Automatic generation of flashable ZIP packages compatible with custom recovery tools
- **boot.img**: Direct boot image packaging and repackaging capabilities
- **Automatic releases**: Seamless GitHub release creation with comprehensive build artifact management
- **Artifact management**: Intelligent upload and organization of build outputs as GitHub artifacts

## Input Parameters Summary

### Required Inputs
These parameters must be provided for the action to function:

- **`kernel-url`**: URL of the kernel source repository to clone and build
- **`config`**: Name of the kernel configuration file for compilation
- **`arch`**: Target CPU architecture for cross-compilation (arm64/arm)

### Optional Inputs
The action supports numerous optional parameters organized by functionality:

- **Source control**: `kernel-dir`, `kernel-branch`, `depth`, `vendor`, `vendor-url`, `vendor-dir`, `vendor-branch`
- **Android version**: `android-version` for AOSP toolchain selection
- **Kernel modifications**: `ksu`, `ksu-version`, `ksu-lkm`, `ksu-other`, `ksu-url`, `rekernel`, `nethunter`, `nethunter-patch`, `lxc`, `lxc-patch`
- **Build optimization**: `disable-lto`, `kvm`, `ccache`, `extra-make-args`
- **Toolchain selection**: `aosp-gcc`, `aosp-clang`, `aosp-clang-version`, `other-gcc32-url`, `other-gcc64-url`, `other-clang-url`
- **Packaging options**: `anykernel3`, `anykernel3-url`, `bootimg-url`, `release`, `access-token`

## Integration Points

### External Dependencies
The action integrates with several external projects and services:

- **AOSP repositories**: Google's official Android Open Source Project repositories for toolchain downloads
- **KernelSU**: External root framework integration for kernel-level access capabilities
- **AnyKernel3**: Flashable package generation system for custom recovery compatibility
- **AIK (Android Image Kitchen)**: Specialized boot.img manipulation tools for kernel replacement

### GitHub Integration
Seamless integration with GitHub's ecosystem:

- **Workflow dispatch**: Support for manual workflow triggers via `workflow_dispatch`
- **Artifacts**: Automatic upload and organization of build outputs as GitHub artifacts
- **Releases**: GitHub release creation with comprehensive metadata and build information
- **Actions**: Utilizes various GitHub Actions including ccache-action and gh-release-action

## Troubleshooting

### Common Issues and Solutions
The following are the most frequently encountered issues and their resolution strategies:

- **Toolchain download failures**: Verify the validity of toolchain URLs and ensure proper network connectivity to external repositories
- **Compilation errors**: Confirm kernel source compatibility with the selected toolchain version and verify all dependencies are properly installed
- **Configuration issues**: Ensure the specified configuration file exists in the kernel source repository and matches the target architecture
- **Architecture mismatches**: Verify that cross-compilation toolchains are available for the specified target architecture

### Debug Information
The action provides comprehensive debugging capabilities:

- **Verbose logging**: Extensive console output with collapsible sections for easy navigation and analysis
- **Error messages**: Detailed, actionable error descriptions with suggested solutions and next steps
- **Build artifacts**: Complete preservation of build logs and intermediate files for thorough post-build analysis

## Credits and Dependencies

- **KernelSU**: Root access framework
- **KernelSU_Action**: Original inspiration
- **slimhub_actions**: Build optimization techniques
- **AOSP**: Toolchain and build system references

## License

Apache License 2.0 - see LICENSE file for details

## Security

See SECURITY.md for security policy and vulnerability reporting procedures.

## Git Commit

- Mirror existing history style: 
```
component: <type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```
example:
```
rekernel: feat(patch): Using cocci patch
Convert C code modifications from sed to coccinelle semantic patches for
better code maintainability and reliability. Retain sed for Kconfig and
Makefile changes as they are not supported by coccinelle.

This separates the concerns between C code transformations and
configuration file modifications, making the patches more robust and
easier to maintain.

fix #123

Signed-off-by: dabao1955 <dabao1955@163.com>
```
Keep the summary concise, sentence case, and avoid trailing period.
- Prefer one scope; if multiple areas change, pick the primary one or spilt to a couple of scopes rather than chaining scopes. 
- Keep subject lines brief (target ≤72 chars), no body unless necessary. If referencing a PR/issue, append `(fix #123)` at the end as seen in history.
- Before committing, glance at recent `git log --oneline` to stay consistent with current prefixes and capitalization used in this repo.
- Before committing, run `yamllint` for yml modification or run `shellcheck` for shell script modification.
