@@ struct binder_proc; struct binder_thread; struct binder_transaction_data; @@

// First pattern - for reply transactions
@reply@
expression proc, target_proc, target_thread;
@@
  if (target_thread->transaction_stack != in_reply_to) {
    ...
  }
  target_proc = target_thread->proc;
  target_proc->tmp_ref++;
  binder_inner_proc_unlock(target_thread->proc);
+ if (start_rekernel_server() == 0) {
+   if (target_proc
+       && (NULL != target_proc->tsk)
+       && (NULL != proc->tsk)
+       && (task_uid(target_proc->tsk).val <= MAX_SYSTEM_UID)
+       && (proc->pid != target_proc->pid)
+       && line_is_frozen(target_proc->tsk)) {
+     char binder_kmsg[PACKET_SIZE];
+     snprintf(binder_kmsg, sizeof(binder_kmsg), 
+             "type=Binder,bindertype=reply,oneway=0,from_pid=%d,from=%d,target_pid=%d,target=%d;",
+             proc->pid, task_uid(proc->tsk).val, target_proc->pid, task_uid(target_proc->tsk).val);
+     send_netlink_message(binder_kmsg, strlen(binder_kmsg));
+   }
+ }

// Second pattern - for regular transactions
@transaction@
expression proc, target_proc, target_node, e, tr;
@@
  e->to_node = target_node->debug_id;
+ if (start_rekernel_server() == 0) {
+   if (target_proc
+       && (NULL != target_proc->tsk)
+       && (NULL != proc->tsk)
+       && (task_uid(target_proc->tsk).val > MIN_USERAPP_UID)
+       && (proc->pid != target_proc->pid)
+       && line_is_frozen(target_proc->tsk)) {
+     char binder_kmsg[PACKET_SIZE];
+     snprintf(binder_kmsg, sizeof(binder_kmsg),
+             "type=Binder,bindertype=transaction,oneway=%d,from_pid=%d,from=%d,target_pid=%d,target=%d;",
+             tr->flags & TF_ONE_WAY, proc->pid, task_uid(proc->tsk).val, target_proc->pid, task_uid(target_proc->tsk).val);
+     send_netlink_message(binder_kmsg, strlen(binder_kmsg));
+   }
+ }
  if (security_binder_transaction(proc->cred, target_proc->cred) < 0) {
