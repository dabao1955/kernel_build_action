// Usually in `drivers/input/input.c`

@input_handle_event@
attribute name __read_mostly;
identifier disposition, dev, type, code, value;
@@
+#if defined(CONFIG_KPROBES) || defined(CONFIG_HAVE_KPROBES)
+#error KernelSU: You're using manual hooks but you also enabled CONFIG_KPROBES or CONFIG_HAVE_KPROBES. Remove CONFIG_KPROBES=y and CONFIG_HAVE_KPROBES=y from your defconfig, noob.
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
