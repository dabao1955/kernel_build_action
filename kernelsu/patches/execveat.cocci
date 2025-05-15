// Usually in `fs/exec.c`

@@
attribute name __read_mostly;
identifier fd, filename, argv, envp, flags;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv, void *envp, int *flags);
+extern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr, void *argv, void *envp, int *flags);
+#endif
do_execveat_common(int fd, struct filename *filename, struct user_arg_ptr argv, struct user_arg_ptr envp, int flags) {
+#ifdef CONFIG_KSU
+if (unlikely(ksu_execveat_hook))
+  ksu_handle_execveat(&fd, &filename, &argv, &envp, &flags);
+else
+  ksu_handle_execveat_sucompat(&fd, &filename, &argv, &envp, &flags);
+#endif
...
}
