@signal@
expression sig, info, p, group;
@@

int do_send_sig_info(int sig, struct siginfo *info, struct task_struct *p,
                     bool group)
{
  unsigned long flags;
  int ret = -ESRCH;
+ if (start_rekernel_server() == 0) {
+   if (line_is_frozen(current) && (sig == SIGKILL || sig == SIGTERM || sig == SIGABRT || sig == SIGQUIT)) {
+     char binder_kmsg[PACKET_SIZE];
+     snprintf(binder_kmsg, sizeof(binder_kmsg),
+             "type=Signal,signal=%d,killer_pid=%d,killer=%d,dst_pid=%d,dst=%d;",
+             sig, task_tgid_nr(p), task_uid(p).val,
+             task_tgid_nr(current), task_uid(current).val);
+     send_netlink_message(binder_kmsg, strlen(binder_kmsg));
+   }
+ }
  if (lock_task_sighand(p, &flags)) {
    ret = send_signal(sig, info, p, group);
    unlock_task_sighand(p, &flags);
  }

  return ret;
}
