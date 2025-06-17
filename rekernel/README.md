# Integrate Re:Kernel for non GKI or QGKI kernels
First, you should be able to build a bootable kernel from your kernel source code. If the kernel is not open source, this is almost impossible.

If you have made the above preparations, you can integrate Re:Kernel into your kernel as follows

## Automatically modify with Kernel Modifier
Firstly, you need to download and place the Kernel Modifier in the root directory of the kernel source code, Then run the Kernel modifier using Java version 17 and above. If nothing unexpected happens, the modifier will automatically modify the kernel source code and insert ReKernel into your kernel. Next, you only need to recompile the kernel once.

## Modification
Run patch.sh in kernel source directory:
```Shell
curl -SsL https://github.com/dabao1955/kernel_build_action/raw/main/rekernel/patch.sh | bash
```
