<div align="center">
  <h1>Android Kernel Build Action</h1>
  <h3><i>Powered By GitHub Actions</i></h3>
</div>

A Workflow to build Android Kernel automatically

## ⚠️ Warning
 This workflow is universal. You need to have a certain foundation in writing github workflows and a little knowledge of the Android kernel to use this.

A Simple Usage:

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
          version: android12
          aosp-clang-version: r383902
```
## Inputs
| input               | required | description |
|---------------------|----------|-------------|
| kernel-url | true | URL of Android kernel source code for your phone |
| kernel-dir | false | The directory name of the Android kernel source code. This option may be used for OPLUS Kernel source code.
| vendor | false | Enable additional source code for the Android kernel source code. This option may be used for OPLUS source code. |
| vendor-url | false | |
| vendor-dir | false | |
| branch | false | The branch of the source code that needs to be cloned, defaults to the default selected branch of the warehouse | 
| config | true | Compile the selected configuration file for the Android kernel |
| arch | true | The architecture of your mobile phone SOC is arm64 by default |
| version | true | Android Version |
| ksu | false | Enable KernelSU |
| ksu-version | false | KernelSU version |
| aosp-gcc |true | Use aosp-gcc to compile the kernel or assist in compiling the kernel (when aosp-clang is enabled) |
| aosp-clang | false | Compile the kernel using aosp-clang |
| aosp-clang-version | false | |
| python-27 | false | Use python2.7 instead of python3, this is helpful for some kernel compilations |
| anykernel3 | false | Package the compiled kernel using anykernel3. If this option is disabled, only the kernel file will be uploaded by default |
| extra-cmd | false | Compile the kernel with extra options, such as LD=ld.lld |

## Todo

- [ ] Improve documentation
- [ ] Add more options
- [ ] Modify unreasonable options

## Credits
- [KernrlSU](https://github.com/tiann/KernelSU)
- [KernelSU_Action](https://github.com/XiaoleGun/KernelSU_Action)
- [slimhub_actions](https://github.com/rokibhasansagar/slimhub_actions)
