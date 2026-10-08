// Drop static from SELinux symbols KernelSU imports on kernels below 5.15.

@sel_mutex depends on file in "security/selinux/selinuxfs.c"@
declarer name DEFINE_MUTEX;
identifier sel_mutex;
@@
- static DEFINE_MUTEX(sel_mutex);
+ DEFINE_MUTEX(sel_mutex);

@sel_mutex_no_semi depends on file in "security/selinux/selinuxfs.c"@
declarer name DEFINE_MUTEX;
identifier sel_mutex;
@@
- static DEFINE_MUTEX(sel_mutex)
+ DEFINE_MUTEX(sel_mutex)

@status_page depends on file in "security/selinux/ss/status.c"@
identifier selinux_status_page;
@@
- static struct page *selinux_status_page;
+ struct page *selinux_status_page;

@status_page_no_semi depends on file in "security/selinux/ss/status.c"@
identifier selinux_status_page;
@@
- static struct page *selinux_status_page
+ struct page *selinux_status_page

@status_lock depends on file in "security/selinux/ss/status.c"@
declarer name DEFINE_MUTEX;
identifier selinux_status_lock;
@@
- static DEFINE_MUTEX(selinux_status_lock);
+ DEFINE_MUTEX(selinux_status_lock);

@status_lock_no_semi depends on file in "security/selinux/ss/status.c"@
declarer name DEFINE_MUTEX;
identifier selinux_status_lock;
@@
- static DEFINE_MUTEX(selinux_status_lock)
+ DEFINE_MUTEX(selinux_status_lock)
