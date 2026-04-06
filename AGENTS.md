# AGENTS.md - Android Kernel Build Action

## Project Overview

This is a GitHub Action for automatically building Android kernels. It enables developers to automate kernel compilation through GitHub Actions workflows, supporting various customization options including toolchain selection, KernelSU integration, Kali NetHunter support, and more.

**Tech Stack:**
- **TypeScript** - Primary development language
- **Node.js 24** - Runtime environment
- **Python 3** - Patch scripts and utilities
- **GitHub Actions** - Automation platform
- **esbuild** - Build tool
- **Vitest** - Testing framework (TypeScript)
- **Pytest** - Testing framework (Python)

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
├── __tests__/             # TypeScript test files (Vitest)
├── __pytest__/            # Python test files (Pytest)
│   ├── kernelsu/          # KernelSU patch tests
│   ├── lxc/               # LXC patch tests
│   ├── nethunter/         # NetHunter patch tests
│   └── rekernel/          # Re-Kernel patch tests
├── dist/                  # Compiled output (committed to repo)
├── kernelsu/              # KernelSU patch files (Python + Coccinelle)
├── lxc/                   # LXC/Docker support patches
├── nethunter/             # Kali NetHunter patches
├── rekernel/              # Re-Kernel patches and source
├── .github/workflows/     # CI/CD workflow definitions
├── action.yml             # GitHub Action input/output definitions
├── package.json           # Node.js dependencies and scripts
├── pyproject.toml         # Python project configuration
├── config.py              # Python configuration module
└── mkdtboimg.py           # DTB/DTBO image packing tool
```

## Build and Run

### Install Dependencies
```bash
# Node.js dependencies
yarn install

# Python dependencies (for development/testing)
pip install -e ".[test]"
```

### Development Commands

```bash
# Build project (compile TypeScript to dist/)
yarn build

# Run TypeScript tests
yarn test

# Run Python tests
pytest

# Run linting
yarn lint          # ESLint
yarn biome         # Biome

# Format code
yarn format        # Prettier

# Check formatting
yarn format:check
```

### Build Notes
- Uses `esbuild` to bundle into single files
- Outputs to `dist/index.js` (main) and `dist/post/index.js` (post-action)
- Build target: Node.js 24
- `dist/` directory must be committed to Git for the Action to work

## Core Modules

### 1. Toolchain Management (`toolchain.ts`)
Supports multiple toolchains:
- AOSP Clang (version-selectable)
- AOSP GCC
- Custom Clang toolchain (via URL)
- Custom GCC toolchains (32-bit and 64-bit via URL)
- System default toolchain

### 2. Kernel Source Management (`kernel.ts`)
- Clone kernel source (supports shallow clone)
- Clone vendor source (for OnePlus devices, etc.)
- Manage kernel configuration files
- Support local/relative kernel paths

### 3. Patch System (`patches.ts`)
Supported feature patches:
- **KernelSU** - Root privilege management (supports LKM mode and third-party forks)
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
- **AnyKernel3** packaging (supports custom repository)
- **boot.img** unpack/pack
- Automatic GitHub Release creation
- Artifact uploading

## Development Conventions

### Code Style
- **ESLint** with `@typescript-eslint` configuration
- **Biome** for additional linting
- **Prettier** for code formatting
- **mypy** for Python type checking
- **pylint** for Python linting
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
build(deps): bump @actions/core from 2.0.0 to 3.0.0
```

### Testing

**TypeScript Tests (Vitest):**
- Tests located in `__tests__/` directory
- Test files follow naming pattern: `<module>.test.ts`
- Coverage excludes `src/index.ts` and `src/post.ts`

**Python Tests (Pytest):**
- Tests located in `__pytest__/` directory
- Organized by module (kernelsu, lxc, nethunter, rekernel)
- Coverage tracked for Python scripts

**Commands:**
```bash
# Run TypeScript tests
yarn test

# Run TypeScript tests with coverage
yarn test --coverage

# Run Python tests
pytest

# Run Python tests with coverage
pytest --cov
```

**Test Files:**
- TypeScript: `artifact.test.ts`, `builder.test.ts`, `cache.test.ts`, `clean.test.ts`, `config.test.ts`, `error.test.ts`, `kernel.test.ts`, `packager.test.ts`, `patches.test.ts`, `release.test.ts`, `toolchain.test.ts`, `utils.test.ts`
- Python: `test_config.py`, `test_apply_cocci.py` (kernelsu), `test_patch_cocci.py` (lxc), `test_patch.py` (nethunter), `test_patch.py` (rekernel)

### Git Workflows

| Workflow | Description |
|----------|-------------|
| `main.yml` | Main CI test (builds real kernel) |
| `build.yml` | Build verification |
| `lint.yml` | ESLint checks |
| `tslint.yml` | TypeScript-specific linting |
| `biome.yml` | Biome linting |
| `pylint.yml` | Python linting |
| `pytest.yml` | Python tests |
| `tsbuild.yml` | TypeScript build verification |
| `lkm.yml` | LKM (Loadable Kernel Module) mode tests |
| `close-pr.yml` | Auto-close PR workflow |

### Pull Request Template

PRs must include:
- **Title** - Clear summary of changes
- **Description** - Detailed explanation
- **Type** - Bug fix / Feature add / Other
- **Checkbox** - Confirm no breaking changes and normal operation unaffected
- **Linked issues** - Reference issues with `fixes: #123`

## Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `kernel-url` | ✅ | - | Android kernel source repository URL or local path |
| `config` | ✅ | `defconfig` | Kernel configuration file name |
| `arch` | ✅ | `arm64` | Target architecture (arm64/arm/x86/etc.) |
| `kernel-branch` | ❌ | `main` | Kernel branch |
| `kernel-dir` | ❌ | `kernel` | Directory name for kernel source |
| `depth` | ❌ | `1` | Git clone depth |
| `vendor` | ❌ | `false` | Enable vendor kernel source |
| `vendor-url` | ❌ | - | Vendor kernel source URL |
| `vendor-branch` | ❌ | `main` | Vendor kernel branch |
| `vendor-dir` | ❌ | `vendor` | Vendor kernel directory |
| `aosp-clang` | ❌ | `false` | Use AOSP Clang toolchain |
| `aosp-gcc` | ❌ | `false` | Use AOSP GCC toolchain |
| `aosp-clang-version` | ❌ | `r383902` | AOSP Clang version |
| `android-version` | ❌ | - | Android version for toolchain |
| `other-clang-url` | ❌ | - | Custom Clang toolchain URL |
| `other-clang-branch` | ❌ | `main` | Custom Clang branch |
| `other-gcc64-url` | ❌ | - | Custom 64-bit GCC URL |
| `other-gcc64-branch` | ❌ | `main` | Custom 64-bit GCC branch |
| `other-gcc32-url` | ❌ | - | Custom 32-bit GCC URL |
| `other-gcc32-branch` | ❌ | `main` | Custom 32-bit GCC branch |
| `ksu` | ❌ | `false` | Enable KernelSU integration |
| `ksu-version` | ❌ | `main` | KernelSU version |
| `ksu-lkm` | ❌ | `false` | Build KernelSU as LKM |
| `ksu-other` | ❌ | `false` | Use third-party KernelSU fork |
| `ksu-url` | ❌ | - | Third-party KernelSU URL |
| `rekernel` | ❌ | `false` | Enable Re-Kernel support |
| `nethunter` | ❌ | `false` | Enable Kali NetHunter |
| `nethunter-patch` | ❌ | `false` | Apply NetHunter-specific patches |
| `lxc` | ❌ | `false` | Enable LXC/Docker support |
| `lxc-patch` | ❌ | `false` | Apply LXC-specific patches |
| `kvm` | ❌ | `false` | Enable KVM support |
| `bbg` | ❌ | `false` | Enable BaseBandGuard |
| `disable-lto` | ❌ | `false` | Disable Link Time Optimization |
| `ccache` | ❌ | `false` | Enable ccache acceleration |
| `anykernel3` | ❌ | `false` | Use AnyKernel3 packaging |
| `anykernel3-url` | ❌ | - | Custom AnyKernel3 repository URL |
| `bootimg-url` | ❌ | - | Original boot.img download URL |
| `release` | ❌ | `false` | Auto-create GitHub Release |
| `access-token` | ❌ | - | GitHub token for releases |
| `extra-make-args` | ❌ | `[]` | Extra make arguments (JSON array) |

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

**Production (Node.js):**
- `@actions/artifact` - Artifact management
- `@actions/cache` - Caching support
- `@actions/core` - Core Actions functionality
- `@actions/exec` - Command execution
- `@actions/github` - GitHub API client (includes Octokit)
- `@actions/tool-cache` - Tool caching

**Development (Node.js):**
- `typescript` - TypeScript compiler
- `esbuild` - Fast bundler
- `vitest` - Test framework with coverage
- `eslint` - Linting
- `@typescript-eslint/*` - TypeScript ESLint plugins
- `prettier` - Code formatting
- `@biomejs/biome` - Additional linting

**Development (Python):**
- `pytest` - Test framework
- `pytest-cov` - Coverage plugin
- `pytest-mock` - Mocking utilities

## Branch Strategy

- **main** - Production-ready code
- **feature/*** - Feature development
- **fix/*** - Bug fixes

Always create PRs to `main` branch. The `@main` tag should not be used in production workflows as it may contain experimental changes.