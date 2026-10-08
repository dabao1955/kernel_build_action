// Drop static from KernelSU-imported SELinux symbols in selinuxfs.c.

@write_op_const depends on file in "security/selinux/selinuxfs.c"@
identifier write_op;
@@
- static ssize_t (*const write_op[])(...)
+ ssize_t (*const write_op[])(...)

@write_op depends on file in "security/selinux/selinuxfs.c"@
identifier write_op;
@@
- static ssize_t (*write_op[])(...)
+ ssize_t (*write_op[])(...)

@sel_handle_status_ops depends on file in "security/selinux/selinuxfs.c"@
identifier sel_handle_status_ops;
@@
- static const struct file_operations sel_handle_status_ops
+ const struct file_operations sel_handle_status_ops
