@@ struct binder_alloc; @@

@buffer_alloc@
identifier alloc, size, is_async;
expression pid;
fresh identifier proc_task;
@@

static struct binder_buffer *binder_alloc_new_buf_locked(struct binder_alloc *alloc,
                       size_t data_size,
                       size_t offsets_size,
                       size_t extra_buffers_size,
                       int is_async,
                       int pid)
{
+ struct task_struct *proc_task = NULL;
  struct rb_node *n = alloc->free_buffers.rb_node;
  ...
  size = data_offsets_size + ALIGN(extra_buffers_size, sizeof(void *));
  ...
+ if (is_async
+     && (alloc->free_async_space < 3 * (size + sizeof(struct binder_buffer))
+     || (alloc->free_async_space < WARN_AHEAD_SPACE))) {
+   rcu_read_lock();
+   proc_task = find_task_by_vpid(alloc->pid);
+   rcu_read_unlock();
+   if (proc_task != NULL && start_rekernel_server() == 0) {
+     if (line_is_frozen(proc_task)) {
+       char binder_kmsg[PACKET_SIZE];
+       snprintf(binder_kmsg, sizeof(binder_kmsg),
+               "type=Binder,bindertype=free_buffer_full,oneway=1,from_pid=%d,from=%d,target_pid=%d,target=%d;",
+               current->pid, task_uid(current).val, proc_task->pid, task_uid(proc_task).val);
+       send_netlink_message(binder_kmsg, strlen(binder_kmsg));
+     }
+   }
+ }
  if (is_async &&
      alloc->free_async_space < size + sizeof(struct binder_buffer)) {
    ...
  }
}
