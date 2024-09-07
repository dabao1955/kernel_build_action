LXC in Android
======
usage:
```bash
bash config.sh -w <kernel config>
```
in kernel source directory

## About patch
### Patch 1: Solve the problem of panic in the kernel
```bash
git appply xt_qtagui.patch
```

### Patch 2 to solve the problem of running docker (find the location of the cgroup.c file and function)
```bash
git apply cgroup.patch
```
