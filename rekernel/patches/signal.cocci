// Add rekernel header includes for signal.c
@signal_includes@
@@
#include <asm/cacheflush.h>
+ #ifdef CONFIG_REKERNEL
+ #include <uapi/asm/signal.h>
+ #include <../drivers/rekernel/rekernel.h>
+ #endif /* CONFIG_REKERNEL */

// Add signal handling
@add_signal_handler@
expression sig, p;
@@
  int ret = -ESRCH;
+ #ifdef CONFIG_REKERNEL
+ if (sig == SIGKILL || sig == SIGTERM || sig == SIGABRT || sig == SIGQUIT)
+   rekernel_report(SIGNAL, sig, task_tgid_nr(current), current,
+                   task_tgid_nr(p), p, false, NULL);
+ #endif /* CONFIG_REKERNEL */
