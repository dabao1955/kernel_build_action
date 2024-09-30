<div align="center">
  <h1>Android Kernel Build Action</h1>
  <h3><i>Powered By GitHub Actions</i></h3>
</div>

A Workflow to build Android Kernel automatically

[![](https://img.shields.io/github/actions/workflow/status/dabao1955/kernel_build_action/main.yml?style=for-the-badge&color=fee4d0&logo=githubactions&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/actions/workflows/main.yml)
[![](https://img.shields.io/github/issues/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=files&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/issues)
[![](https://img.shields.io/github/stars/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=starship&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/stargazers)
[![](https://img.shields.io/github/forks/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=git&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/forks)
[![](https://img.shields.io/github/license/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=apache&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/blob/main/LICENSE)
[![](https://img.shields.io/github/v/release/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=github&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/releases/latest)
[![](https://img.shields.io/github/last-commit/dabao1955/kernel_build_action?style=for-the-badge&color=fee4d0&logo=codeigniter&logoColor=fee4d0)](https://github.com/dabao1955/kernel_build_action/commits/main/)



## Note
 This workflow is universal. You need to have a certain foundation in writing github workflows and a little knowledge of the Android kernel to use this.

## Warning

Strongly recommends using the stable version (tags such as v1.2) instead of the development version (main branch), because main branch is not a stable branch which may have some technical problems.

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
    runs-on: ubuntu-20.04
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
> [!WARNING]
>
> enable lxc or nethunter input options may cause kernel compilation failed!

| input               | required | description | example value |
|---------------------|----------|-------------|---------|
| kernel-url | true | URL of Android kernel source code for your phone | https://github.com/username/project |
| kernel-dir | false | The directory name of the Android kernel source code. This option may be used for OPLUS Kernel source code. | kernel |
| depth | false | | 1 |
| vendor | false | | false |
| vendor-url | false | url of additional source code for the Android kernel source code. This option may be used for OPLUS source code. | https://github.com/username/project|
| vendor-dir | false | | vendor |
| kernel-branch | true | The branch of the source code that needs to be cloned, defaults branch to git clone is main | main |
| vendor-branch | true | The branch of the vendor source code that needs to be cloned, defaults branch to git clone is main | main |
| config | true | Compile the selected configuration file for the Android kernel | defconfig |
| arch | true | The architecture of your mobile phone SOC is arm64 by default | arm64 |
| android-version | true | The Android version required when downloading aosp-clang. If you want to use the latest aosp-clang or you do not use aosp-clang to compile the kernel, please ignore this option | 12 |
| ksu | false | Enable KernelSU | true |
| ksu-version | false | KernelSU version | v0.9.5 |
| ksu-lkm(may not build successfully for non-GKI devices) | false | Build KernelSU as a linux kernel module | true |
| ksu-other | false | | false |
| ksu-url | false | Ude 3rd KernelSU | https://github.com/xxx/KernelSU/ |
| disable-lto | false | | false |
| lxc | false | Enable LXC and docker to config | false | 
 | lxc-patch | false | Add patch avoid not booting after enable lxc | false | 
 | nethunter | false | Enable Kali nethunter | false | 
 | nethunter-patch | false | | false |
| kvm | false | | false |
| ccache | false | Enable ccache(Only valid when compiled with clang) | false |
| aosp-gcc |true | Use aosp-gcc to compile the kernel or assist in compiling the kernel (when aosp-clang is enabled) | false |
| aosp-clang | false | Compile the kernel using aosp-clang | false |
| aosp-clang-version | false | please search for them according to your own needs at [official website](https://android.googlesource.com/platform/prebuilts/clang/host/linux-x86) and choose the appropriate clang according to the Android system version instead of blindly choosing `r383902` | r383902 |
| other-clang-url | false | Please fill in the download link of other clang in this option. Supports .zip, .tar and .git formats | https://github.com/kdrag0n/proton-clang |
| other-clang-branch | false | | 10.0|
| android-ndk | false | Use Android-NDK to compile kernel . Before enable this option，you should disable aosp-gcc and aosp-clang bacause android-ndk will conflict with them | false |
| android-ndk-version | false | | r23b |
| anykernel3 | false | Package the compiled kernel using AnyKernel3. If this option is disabled, You need to fill `bootimg-url`. | false |
| anykernel3-url | false | 3rdparty AnyKernel3 url | https://github.com/username/AnyKernel3 |
| release | flase | After the kernel compilation is completed, it will be automatically published to the releases page | true |
| access-token | false | Please fill it if you want to release kernel | ghp_xxxxxx |
| bootimg-url | false | A URL that can download the local boot.img | https://127.0.0.1/boot.img |
| extra-cmd | false | Compile the kernel with extra options, such as LD=ld.lld | AS=llvm-as |

## Todo
- Support use 3rd party gcc to compile

## FAQ
> [!CAUTION]
> Please Read this first if you have some questions!

### How to use 3rd clang？
You should disable aosp-clang and android-ndk options to use it.

### Why KernelSU version built with this action is still v0.9.5？
See [KernelSU 's release note](https://github.com/tiann/KernelSU/releases/tag/v1.0.0) for more details.

### How to submit issue about features requests?
In principle, it only accept Bug Reports and do not accept external Feature Requests; if you want new features, you are welcome to submit a Pull Request. We will still develop new features that we think are useful.

### Why the workflow exits with a code with an error value of some nubmer？
- If you get an error while downloading the toolchain or pulling the source code, please check whether your option or source code address is legitimate.
- If you encounter problems during compilation, consider replacing the source code or replacing the compiler.
- If action has some typo problem,PR welcome！

## Credits
- [KernelSU](https://github.com/tiann/KernelSU)
- [KernelSU_Action](https://github.com/XiaoleGun/KernelSU_Action)
- [slimhub_actions](https://github.com/rokibhasansagar/slimhub_actions)
