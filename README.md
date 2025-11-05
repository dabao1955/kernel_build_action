<div align="center">
  <h1>Android Kernel Build Action</h1>
  <h3><i>Powered By GitHub Actions</i></h3>
</div>

A workflow to automatically build an Android kernel

[![](https://img.shields.io/github/actions/workflow/status/dabao1955/kernel_build_action/main.yml?style=for-the-badge&color=fee4d0&logo=githubactions&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/actions/workflows/main.yml)
[![](https://img.shields.io/github/issues/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=files&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/issues)
[![](https://img.shields.io/github/stars/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=starship&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/stargazers)
[![](https://img.shields.io/github/forks/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=git&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/forks)
[![](https://img.shields.io/github/license/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=apache&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/blob/main/LICENSE)
[![](https://img.shields.io/github/v/release/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=github&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/releases/latest)
[![](https://img.shields.io/github/last-commit/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=codeigniter&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/commits/main/)

## Security Policy
See [Security.md](./SECURITY.md) for more details.


## How to use?
- First, you need to determine the kernel source code and configuration files.
- Find your kernel source repository and configure the workflow file according to the following example and README.md:

```yml
name: CI

on:
  workflow_dispatch:

jobs:
  build-kernel:
    name: Build Kernel
    runs-on: ubuntu-22.04
    steps:
      - name: Build
        uses: dabao1955/kernel_build_action@main
        with:
          kernel-url: https://github.com/AcmeUI-Devices/android_kernel_xiaomi_cas
          kernel-branch: taffy
          config: cas_defconfig
          arch: arm64
          aosp-gcc: true
          aosp-clang: true
          android-version: 12
          aosp-clang-version: r383902
```
Or use the [preset workflow file](https://github.com/dabao1955/kernel_build_action/blob/main/.github/workflows/build.yml) to modify it.

> [!NOTE]
> You do not need to fork this repository.
>
> If you just want to compile the kernel, please do not submit PR after modification!

- Finally, run the workflow you just wrote.
## Inputs
| input               | required | description | example value |
|---------------------|----------|-------------|---------|
| kernel-url | true | URL of the Android kernel source code | https://github.com/username/project |
| kernel-dir | false | Directory name for kernel source. Useful for OnePlus kernel sources | kernel |
| depth | false | Use git clone depth to save time and storage space | 1 |
| vendor | false | Enable vendor kernel source code | false |
| vendor-url | false | URL of vendor kernel source code (used on OnePlus kernel) | https://github.com/username/project|
| vendor-dir | false | Directory name for vendor kernel source | vendor |
| kernel-branch | false | Branch name of kernel source code (default = main) | main |
| vendor-branch | false | Branch name of vendor kernel source code (default = main) | main |
| config | true | Specific kernel config file to compile (default = defconfig) | defconfig |
| arch | true | CPU architecture (default = arm64) | arm64 |
| android-version | true | Android version for AOSP toolchain (Ignore if you want to use latest AOSP clang or use other clang) | 12 |
| ksu | false | Integrate KernelSU on kernel build | true |
| ksu-version | false | KernelSU version (default = v0.9.5) | v0.9.5 |
| ksu-lkm | false | Build KernelSU as kernel module (may fail on non-GKI devices) | true |
| ksu-other | false | Use third-party KernelSU fork | false |
| ksu-url | false | URL of third-party KernelSU fork (if you enable `ksu-other` flag) | https://github.com/username/KernelSU/ |
| rekernel | false | Enable Re-Kernel support | true |
| disable-lto | false | Disable [Link Time Optimization](https://llvm.org/docs/LinkTimeOptimization.html) support | false |
| lxc | false | Enable LXC/Docker support | false | 
| lxc-patch | false | Apply patch to avoid boot issues with LXC | false | 
| nethunter | false | Enable Kali NetHunter support | false | 
| nethunter-patch | false | Apply patch for Kali NetHunter support | false |
| kvm | false | Enable [KVM (Kernel Virtual Machine)](https://linux-kvm.org/page/Main_Page) support | false |
| ccache | false | Enable ccache (clang only) to speed up kernel compilation | false |
| aosp-gcc | false | Use AOSP GCC toolchain to compile the kernel (Enable when using AOSP clang toolchain) | false |
| other-gcc32-url | false | URL of custom GCC arm32 toolchain (Supports .xz, .zip, .tar and .git formats) | https://github.com/username/gcc |
| other-gcc32-branch | false | Branch name of GCC arm32 toolchain | main |
| other-gcc64-url | false | URL of custom GCC arm64 toolchain (Supports .xz, .zip, .tar and .git formats) | https://github.com/username/gcc |
| other-gcc64-branch | false | Branch name of GCC arm64 toolchain | main |
| aosp-clang | false | Use AOSP clang toolchain to compile the kernel | false |
| aosp-clang-version | false | AOSP clang version. [See all AOSP clang versions](https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86/+/mirror-goog-main-llvm-toolchain-source/README.md). (default = r383902) | r383902 |
| other-clang-url | false | URL of custom clang toolchain (Supports .xz, .zip, .tar and .git formats) | https://github.com/username/clang |
| other-clang-branch | false | Branch name of clang toolchain | main |
| anykernel3 | false | Use AnyKernel3 to package the compiled kernel. (if false, must provide bootimg-url) | false |
| anykernel3-url | false | URL for third-party AnyKernel3 | https://github.com/username/AnyKernel3 |
| release | false | Auto-publish kernel release after build | true |
| access-token | false | GitHub access token (needed for auto release) | ghp_xxxxxx |
| bootimg-url | false | URL to download local boot.img (required if anykernel3 = false) | https://127.0.0.1/boot.img |
| extra-make-args | false | Extra arguments for `make`, as a JSON array of strings support spaces and special characters | ["LOCALVERSION= (CI)", "AS=llvm-as"] |

## FAQ
> [!CAUTION]
> Please Read this first if you have some questions!

### How to use 3rd clang？
You should disable aosp-clang and android-ndk options to use it.

### Why KernelSU version built with this action is still v0.9.5？
See [KernelSU 's release note](https://github.com/tiann/KernelSU/releases/tag/v1.0.0) for more details.

### How to submit issue about features requests?
In principle, it only accepts Bug Reports and does not accept external Feature Requests; if you want new features, you are welcome to submit a Pull Request. We will still develop new features that we think are useful.

### Why the workflow exits with a code with an error value of some number？
- If you get an error while downloading the toolchain or pulling the source code, please check whether your option or source code address is legitimate.
- If you encounter problems during compilation, consider replacing the source code or replacing the compiler.
- If the action has a typo problem, PR welcome!

### Build failed while using third-party GCC ?
Try add LLVM=1 option with clang.

## Credits
- [KernelSU](https://github.com/tiann/KernelSU)
- [KernelSU_Action](https://github.com/XiaoleGun/KernelSU_Action)
- [slimhub_actions](https://github.com/rokibhasansagar/slimhub_actions)
