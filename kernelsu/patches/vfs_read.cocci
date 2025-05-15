// Usually in `fs/read_write.c`

@vfs_read@
attribute name __read_mostly, __user;
identifier file, buf, count, pos;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_vfs_read_hook __read_mostly;
+extern int ksu_handle_vfs_read(struct file **file_ptr, char __user **buf_ptr, size_t *count_ptr, loff_t **pos);
+#endif
vfs_read(struct file *file, char __user *buf, size_t count, loff_t *pos) {
+#ifdef CONFIG_KSU
+if (unlikely(ksu_vfs_read_hook))
+  ksu_handle_vfs_read(&file, &buf, &count, &pos);
+#endif
...
}
