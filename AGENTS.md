# AGENTS.md - Android Kernel Build Action

## Project Overview

This is a GitHub Action for automatically building Android kernels. It enables developers to automate kernel compilation through GitHub Actions workflows, supporting various customization options including toolchain selection, KernelSU integration, Kali NetHunter support, and more.

**Tech Stack:**
- **TypeScript** - Primary development language
- **Node.js 20** - Runtime environment
- **GitHub Actions** - Automation platform
- **esbuild** - Build tool
- **Vitest** - Testing framework

## Project Structure

```
/home/user/a/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main entry - orchestrates build workflow
│   ├── post.ts            # Post-action cleanup script
│   ├── builder.ts         # Kernel build logic
│   ├── toolchain.ts       # Toolchain management (GCC/Clang)
│   ├── kernel.ts          # Kernel source cloning and management
│   ├── patches.ts         # Patch application (KernelSU, LXC, etc.)
│   ├── packager.ts        # Output packaging
│   ├── artifact.ts        # Artifact uploading
│   ├── release.ts         # GitHub Release creation
│   ├── cache.ts           # ccache support
│   ├── config.ts          # Kernel configuration modifications
│   ├── clean.ts           # Cleanup logic
│   ├── utils.ts           # Utility functions
│   └── error.ts           # Error handling
├── __tests__/             # Test files (Vitest)
├── dist/                  # Compiled output (committed to repo)
├── kernelsu/              # KernelSU patch files
├── lxc/                   # LXC/Docker support patches
├── nethunter/             # Kali NetHunter patches
├── rekernel/              # Re-Kernel patches and source
├── .github/workflows/     # CI/CD workflow definitions
├── action.yml             # GitHub Action input/output definitions
├── package.json           # Node.js dependencies and scripts
└── tsconfig.json          # TypeScript configuration
```

## Build and Run

### Install Dependencies
```bash
yarn install
```

### Development Commands

```bash
# Build project (compile TypeScript to dist/)
yarn build

# Run tests
yarn test

# Run linting
yarn lint

# Format code
yarn format

# Check formatting
yarn format:check
```

### Build Notes
- Uses `esbuild` to bundle into single files
- Outputs to `dist/index.js` (main) and `dist/post/index.js` (post-action)
- `dist/` directory must be committed to Git for the Action to work

## Core Modules

### 1. Toolchain Management (`toolchain.ts`)
Supports multiple toolchains:
- AOSP Clang (version-selectable)
- AOSP GCC
- Custom Clang/GCC toolchains (via URL)
- System default toolchain

### 2. Kernel Source Management (`kernel.ts`)
- Clone kernel source (supports shallow clone)
- Clone vendor source (for OnePlus devices, etc.)
- Manage kernel configuration files

### 3. Patch System (`patches.ts`)
Supported feature patches:
- **KernelSU** - Root privilege management (supports LKM mode)
- **Re-Kernel** - Kernel optimizations
- **LXC** - Container support
- **Kali NetHunter** - Penetration testing support
- **KVM** - Virtualization support
- **BaseBandGuard** - Baseband protection

### 4. Build System (`builder.ts`)
- Cross-platform compilation (arm64, arm, x86, etc.)
- ccache acceleration
- Extra make arguments support

### 5. Packaging and Release
- **AnyKernel3** packaging
- **boot.img** unpack/pack
- Automatic GitHub Release creation
- Artifact uploading

## Development Conventions

### Code Style
- **ESLint** with `@typescript-eslint` configuration
- **Prettier** for code formatting
- Strict TypeScript config (`strict: true`)

### Commit Message Convention

This project follows a structured commit message format:

```
<module>: <type>[(scope)]: <description>
```

**Modules:**
- `actions` - Core action code changes
- `builder` - Build system changes
- `cache` - Ccache functionality
- `clean` - Cleanup functionality
- `config` - Kernel configuration handling
- `dep` - Dependency management
- `dist` - Distribution/build output updates
- `docs` - Documentation changes
- `kernel` - Kernel source handling
- `kernelsu` - KernelSU integration
- `lxc` - LXC/Docker support
- `nethunter` - Kali NetHunter support
- `packager` - Packaging logic
- `patches` - Patch application system
- `rekernel` - Re-Kernel support
- `release` - Release creation
- `scripts` - Python/shell scripts
- `test` - Test-related changes
- `toolchain` - Toolchain management
- `utils` - Utility functions
- `workflow` - GitHub workflow files

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `chore` - Maintenance tasks
- `style` - Code style changes (formatting)
- `security` - Security fixes
- `docs` - Documentation updates
- `test` - Test additions/updates
- `build` - Build system changes

**Examples:**
```
builder: fix: Add silent option to prevent duplicate build logs
test(builder): Add dangerous command recognition tests
actions: refactor: Rewritten with TypeScript
dep: chore(build): Use esbuild
rekernel: fix(zip): Fix patch extraction
gwmini: chore(style): Auto update docs
build(deps-dev): bump eslint from 9.39.2 to 10.0.0
build(deps): bump @octokit/rest from 20.1.2 to 22.0.1
```

### Testing

**Framework:** Vitest with v8 coverage provider

**Test Structure:**
- Tests located in `__tests__/` directory
- Test files follow naming pattern: `<module>.test.ts`
- Coverage excludes `src/index.ts` and `src/post.ts`

**Commands:**
```bash
# Run all tests
yarn test

# Run with coverage
yarn test --coverage

# Run specific test file
yarn test builder.test.ts
```

**Test Files:**
- `artifact.test.ts` - Artifact upload tests
- `builder.test.ts` - Build system tests
- `cache.test.ts` - Ccache functionality tests
- `clean.test.ts` - Cleanup tests
- `config.test.ts` - Configuration tests
- `error.test.ts` - Error handling tests
- `kernel.test.ts` - Kernel management tests
- `packager.test.ts` - Packaging tests
- `patches.test.ts` - Patch system tests
- `release.test.ts` - Release creation tests
- `toolchain.test.ts` - Toolchain tests
- `utils.test.ts` - Utility function tests

### Git Workflows

**main.yml** - Main CI test (builds real kernel)
**check.yml** - Code checks and validation
**lint.yml** - ESLint checks
**build.yml** - Build verification
**lkm.yml** - LKM (Loadable Kernel Module) mode tests
**close-pr.yml** - Auto-close PR workflow

### Pull Request Template

PRs must include:
- **Title** - Clear summary of changes
- **Description** - Detailed explanation
- **Type** - Bug fix / Feature add / Other
- **Checkbox** - Confirm no breaking changes and normal operation unaffected
- **Linked issues** - Reference issues with `fixes: #123`

## Action Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `kernel-url` | ✅ | Android kernel source repository URL |
| `config` | ✅ | Kernel configuration file name |
| `arch` | ✅ | Target architecture (arm64/arm/x86/etc.) |
| `kernel-branch` | ❌ | Kernel branch (default: main) |
| `depth` | ❌ | Git clone depth (default: 1) |
| `vendor` | ❌ | Enable vendor kernel source |
| `vendor-url` | ❌ | Vendor kernel source URL |
| `aosp-clang` | ❌ | Use AOSP Clang toolchain |
| `aosp-gcc` | ❌ | Use AOSP GCC toolchain |
| `aosp-clang-version` | ❌ | AOSP Clang version (default: r383902) |
| `android-version` | ❌ | Android version for toolchain |
| `ksu` | ❌ | Enable KernelSU integration |
| `ksu-version` | ❌ | KernelSU version (default: main) |
| `ksu-lkm` | ❌ | Build KernelSU as LKM |
| `rekernel` | ❌ | Enable Re-Kernel support |
| `lxc` | ❌ | Enable LXC/Docker support |
| `nethunter` | ❌ | Enable Kali NetHunter |
| `kvm` | ❌ | Enable KVM support |
| `bbg` | ❌ | Enable BaseBandGuard |
| `disable-lto` | ❌ | Disable Link Time Optimization |
| `ccache` | ❌ | Enable ccache acceleration |
| `anykernel3` | ❌ | Use AnyKernel3 packaging |
| `release` | ❌ | Auto-create GitHub Release |
| `access-token` | ❌ | GitHub token for releases |
| `extra-make-args` | ❌ | Extra make arguments (JSON array) |

## Usage Example

```yaml
name: Build Kernel
on: workflow_dispatch

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: dabao1955/kernel_build_action@v1
        with:
          kernel-url: https://github.com/username/kernel
          kernel-branch: main
          config: defconfig
          arch: arm64
          aosp-clang: true
          aosp-gcc: true
          ksu: true
          android-version: 12
          ccache: true
          anykernel3: true
          release: true
          access-token: ${{ secrets.GITHUB_TOKEN }}
```

## Security

**Supported Versions:**
- `@v1` - ✅ Supported
- `@latest` - ✅ Supported  
- `@main` - ⚠️ May have experimental changes

**Vulnerability Reporting:**
1. GitHub Security Advisories (preferred)
2. Email: dabao1955@163.com (for sensitive issues)

**Security Guidelines:**
- Use least privilege principle for tokens
- Pin to specific versions in production
- Use `GITHUB_TOKEN` with minimal permissions
- Store PAT in GitHub Secrets if required

## Dependencies

**Production:**
- `@actions/*` - GitHub Actions official SDKs
- `@octokit/*` - GitHub API clients

**Development:**
- `typescript` - TypeScript compiler
- `esbuild` - Fast bundler
- `vitest` - Test framework with coverage
- `eslint` - Linting
- `prettier` - Code formatting
- `@typescript-eslint/*` - TypeScript ESLint plugins

## Branch Strategy

- **main** - Production-ready code
- **feature/*** - Feature development
- **fix/*** - Bug fixes

Always create PRs to `main` branch. The `@main` tag should not be used in production workflows as it may contain experimental changes.
