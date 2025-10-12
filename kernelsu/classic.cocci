// File: fs/devpts/inode.c

@devpts_get_priv depends on file in "fs/devpts/inode.c"@
identifier dentry;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_devpts(struct inode*);
+#endif
devpts_get_priv(struct dentry *dentry) {
... when != S1
+#ifdef CONFIG_KSU
+ksu_handle_devpts(dentry->d_inode);
+#endif
S2
...
}


// File: fs/exec.c
@depends on file in "fs/exec.c"@
attribute name __read_mostly;
identifier fd, filename, argv, envp, flags;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv, void *envp, int *flags);
+extern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr, void *argv, void *envp, int *flags);
+#endif
do_execveat_common(int fd, struct filename *filename, struct user_arg_ptr argv, struct user_arg_ptr envp, int flags) {
... when != S1
+#ifdef CONFIG_KSU
+if (unlikely(ksu_execveat_hook))
+  ksu_handle_execveat(&fd, &filename, &argv, &envp, &flags);
+else
+  ksu_handle_execveat_sucompat(&fd, &filename, &argv, &envp, &flags);
+#endif
S2
...
}

// File: fs/open.c
@do_faccesssat depends on file in "fs/open.c"@
attribute name __user;
identifier dfd, filename, mode;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_faccessat(int *dfd, const char __user **filename_user, int *mode, int *flags);
+#endif
do_faccessat(int dfd, const char __user *filename, int mode) {
... when != S1
+#ifdef CONFIG_KSU
+ksu_handle_faccessat(&dfd, &filename, &mode, NULL);
+#endif
S2
...
}

// File: fs/open.c
@syscall_faccesssat depends on file in "fs/open.c" && never do_faccesssat@
attribute name __user;
identifier dfd, filename, mode;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_faccessat(int *dfd, const char __user **filename_user, int *mode, int *flags);
+#endif
// SYSCALL_DEFINE3(faccessat, ...) {}
faccessat(int dfd, const char __user * filename, int mode) {
... when != S1
+#ifdef CONFIG_KSU
+ksu_handle_faccessat(&dfd, &filename, &mode, NULL);
+#endif
S2
...
}

// File: drivers/input/input.c
@input_handle_event depends on file in "drivers/input/input.c"@
attribute name __read_mostly;
identifier disposition, dev, type, code, value;
@@

+#if defined(CONFIG_KSU_KPROBES_HOOK) || defined(CONFIG_KSU_HOOK_KPROBES) || defined(CONFIG_KSU_WITH_KPROBES)
+#error KernelSU: Manual hooks are incompatible with CONFIG_KSU_KPROBES_HOOK, CONFIG_KSU_HOOK_KPROBES, or CONFIG_KSU_WITH_KPROBES. Disable them in your defconfig and/or KSU config.
+#endif
+
+#ifdef CONFIG_KSU
+extern bool ksu_input_hook __read_mostly;
+extern int ksu_handle_input_handle_event(unsigned int *type, unsigned int *code, int *value);
+#endif
input_handle_event(struct input_dev *dev, unsigned int type, unsigned int code, int value) {
...
int disposition = input_get_disposition(dev, type, code, &value);
+#ifdef CONFIG_KSU
+if (unlikely(ksu_input_hook))
+  ksu_handle_input_handle_event(&type, &code, &value);
+#endif
...
}

// File: fs/namespace.c
@has_can_umount depends on file in "fs/namespace.c"@
identifier path, flags;
@@
can_umount(const struct path *path, int flags) { ... }

// File: fs/namespace.c
@path_umount depends on file in "fs/namespace.c" && never has_can_umount@
@@
+static int can_umount(const struct path *path, int flags)
+{
+struct mount *mnt = real_mount(path->mnt);
+
+if (flags & ~(MNT_FORCE | MNT_DETACH | MNT_EXPIRE | UMOUNT_NOFOLLOW))
+  return -EINVAL;
+if (!may_mount())
+  return -EPERM;
+if (path->dentry != path->mnt->mnt_root)
+  return -EINVAL;
+if (!check_mnt(mnt))
+  return -EINVAL;
+if (mnt->mnt.mnt_flags & MNT_LOCKED) /* Check optimistically */
+  return -EINVAL;
+if (flags & MNT_FORCE && !capable(CAP_SYS_ADMIN))
+  return -EPERM;
+return 0;
+}
+
+int path_umount(struct path *path, int flags)
+{
+struct mount *mnt = real_mount(path->mnt);
+int ret;
+
+ret = can_umount(path, flags);
+if (!ret)
+  ret = do_umount(mnt, flags);
+
+/* we mustn't call path_put() as that would clear mnt_expiry_mark */
+dput(path->dentry);
+mntput_no_expire(mnt);
+return ret;
+}
mnt_alloc_id(...) { ... }


// File: fs/read_write.c
@vfs_read depends on file in "fs/read_write.c"@
attribute name __read_mostly, __user;
identifier file, buf, count, pos;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_vfs_read_hook __read_mostly;
+extern int ksu_handle_vfs_read(struct file **file_ptr, char __user **buf_ptr, size_t *count_ptr, loff_t **pos);
+#endif
vfs_read(struct file *file, char __user *buf, size_t count, loff_t *pos) {
... when != S1
+#ifdef CONFIG_KSU
+if (unlikely(ksu_vfs_read_hook))
+  ksu_handle_vfs_read(&file, &buf, &count, &pos);
+#endif
S2
...
}

// File: fs/stat.c
@vfs_statx depends on file in "fs/stat.c"@
attribute name __user;
identifier dfd, filename, flags;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
vfs_statx(int dfd, const char __user *filename, int flags, ...) {
... when != S1
+#ifdef CONFIG_KSU
+ksu_handle_stat(&dfd, &filename, &flags);
+#endif
S2
...
}

// File: fs/stat.c
@vfs_fstatat depends on file in "fs/stat.c" && never vfs_statx@
attribute name __user;
identifier dfd, filename, stat, flag;
statement S1, S2;
@@
+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
vfs_fstatat(int dfd, const char __user *filename, struct kstat *stat, int flag) {
... when != S1
+#ifdef CONFIG_KSU
+ksu_handle_stat(&dfd, &filename, &flag);
+#endif
S2
...
}
