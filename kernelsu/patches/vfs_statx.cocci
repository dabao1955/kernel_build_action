// Usually in `fs/stat.c`

@vfs_statx@
attribute name __user;
identifier dfd, filename, flags;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
vfs_statx(int dfd, const char __user *filename, int flags, ...) {
+#ifdef CONFIG_KSU
+ksu_handle_stat(&dfd, &filename, &flags);
+#endif
...
}

@vfs_fstatat depends on never vfs_statx@
attribute name __user;
identifier dfd, filename, stat, flag;
@@
+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
vfs_fstatat(int dfd, const char __user *filename, struct kstat *stat, int flag) {
+#ifdef CONFIG_KSU
+ksu_handle_stat(&dfd, &filename, &flag);
+#endif
...
}
