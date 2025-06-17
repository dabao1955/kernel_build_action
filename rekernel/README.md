# Integrate Re:Kernel for non GKI or QGKI kernels
First, you should be able to build a bootable kernel from your kernel source code. If the kernel is not open source, this is almost impossible.

If you have made the above preparations, you can integrate Re:Kernel into your kernel as follows.

## Modification
Run patch.sh in kernel source directory:
```Shell
curl -SsL https://github.com/dabao1955/kernel_build_action/raw/main/rekernel/patch.sh | bash
```
