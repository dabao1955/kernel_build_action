// Drop static from selinux_ops on kernels below 4.19.

@selinux_ops depends on file in "security/selinux/hooks.c"@
@@
- static struct security_operations selinux_ops
+ struct security_operations selinux_ops
