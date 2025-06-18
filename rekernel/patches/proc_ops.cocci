// Convert file_operations to proc_ops and rename its members
@ops@
identifier i;
@@
- struct file_operations i
+ struct proc_ops i

@ops_members@
identifier ops.i;
@@
i = {
  ...
- .open = 
+ .proc_open = 
  ...
- .read = 
+ .proc_read = 
  ...
- .llseek = 
+ .proc_llseek = 
  ...
- .release = 
+ .proc_release = 
  ...
}
