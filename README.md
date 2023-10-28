<div align="center">
  <h1>Android Kernel Build Action</h1>
  <h3><i>Powered By GitHub Actions</i></h3>
</div>

A Workflow to build Android Kernel automatically

## ⚠️ Tips
 This workflow is universal. You need to have a certain foundation in writing github workflows and a little knowledge of the Android kernel to use this.

## ⚠️⚠️⚠️Warning

Strongly recommends using the stable version (such as v1.2) instead of the development version (main), which may have some technical problems.

A Simple workflow Usage(not need to fork!):

```
name: CI

on:
  workflow_dispatch:

jobs:
  build-linux:
    name: Build Kernel
    runs-on: ubuntu-20.04
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Test
        uses: dabao1955/kernel_build_action@main
        with:
          kernel-url: https://github.com/AcmeUI-Devices/android_kernel_xiaomi_cas
          branch: taffy
          config: cas_defconfig
          arch: arm64
          aosp-gcc: true
          aosp-clang: true
          android-version: 12
          aosp-clang-version: r383902
```
## Inputs
| input               | required | description | Example Value |
|---------------------|----------|-------------|---------|
| kernel-url | true | URL of Android kernel source code for your phone | https://github.com/username/project |
| kernel-dir | false | The directory name of the Android kernel source code. This option may be used for OPLUS Kernel source code. | kernel |
| vendor | false | Enable additional source code for the Android kernel source code. This option may be used for OPLUS source code. | false |
| vendor-url | false | | https://github.com/username/project|
| vendor-dir | false | | vendor |
| branch | true | The branch of the source code that needs to be cloned, defaults branch to git clone is main | main |
| config | true | Compile the selected configuration file for the Android kernel | defconfig |
| arch | true | The architecture of your mobile phone SOC is arm64 by default | arm64 |
| android-version | true | Android Version | 12 |
| ksu | false | Enable KernelSU | true |
| ksu-version | false | KernelSU version | v0.6.6 |
| disable-lto | false | | false |
| overlayfs | false | Enable OverlayFS to config | false |
| lxc | false | Enable LXC and docker to config | false |
| lxc-patch | false | Add patch avoid not booting after enable lxc | false |
| kvm | false | | false |
| ccache | false | Enable ccache(Only valid when compiled with clang) | false |
| aosp-gcc |true | Use aosp-gcc to compile the kernel or assist in compiling the kernel (when aosp-clang is enabled) | false |
| aosp-clang | false | Compile the kernel using aosp-clang | false |
| aosp-clang-version | false | | r383902 |
| android-ndk | false | Use Android-NDK to compile kernel . Before enable this option，you should disable aosp-gcc and aosp-clang bacause android-ndk will conflict with them | false |
android-ndk-version | false | | r23b |
android-ndk-x64 | false | If use the ndk version <r23,please enable it. | false | 
| python-27 | false | Use python2.7 instead of python3, this is helpful for some kernel compilations | false |
| anykernel3 | false | Package the compiled kernel using anykernel3. If this option is disabled, only the kernel file will be uploaded by default | false |
| extra-cmd | false | Compile the kernel with extra options, such as LD=ld.lld | AS=llvm-as |

## Todo

- Improve documentation

- Add more options

- Modify unreasonable options

## Credits
- [KernelSU](https://github.com/tiann/KernelSU)
- [KernelSU_Action](https://github.com/XiaoleGun/KernelSU_Action)
- [slimhub_actions](https://github.com/rokibhasansagar/slimhub_actions)
