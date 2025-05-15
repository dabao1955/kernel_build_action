// Usually in `fs/devpts/inode.c`

@devpts_get_priv@
identifier dentry;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_devpts(struct inode*);
+#endif
devpts_get_priv(struct dentry *dentry) {
+#ifdef CONFIG_KSU
+ksu_handle_devpts(dentry->d_inode);
+#endif
...
}
