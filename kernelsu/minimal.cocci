// Coccinelle scope-minimized patches for KernelSU
// From: https://github.com/backslashxx/KernelSU/issues/5#issuecomment-2878532104


// File: fs/exec.c
// Adds hook to asmlinkage int sys_execve()

@do_execve_hook_minimized depends on file in "fs/exec.c"@
identifier filenam, __argv, __envp;
identifier argv, envp;
type T1, T2;
attribute name __read_mostly;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv,
+			void *envp, int *flags);
+extern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr,
+				 void *argv, void *envp, int *flags);
+#endif
do_execve(struct filename *filenam, T1 __argv, T2 __envp) {
...
 	struct user_arg_ptr argv = { .ptr.native = __argv };
 	struct user_arg_ptr envp = { .ptr.native = __envp };

+#ifdef CONFIG_KSU
+	if (unlikely(ksu_execveat_hook))
+		ksu_handle_execveat((int *)AT_FDCWD, &filenam, &argv, &envp, 0);
+	else
+		ksu_handle_execveat_sucompat((int *)AT_FDCWD, &filenam, NULL, NULL, NULL);
+#endif
...
}

@compat_do_execve_hook_minimized depends on file in "fs/exec.c"@
identifier filenam, argv, envp;
@@

compat_do_execve(struct filename *filenam, ...) {
...
+#ifdef CONFIG_KSU // 32-bit su, 32-on-64 ksud support
+	if (unlikely(ksu_execveat_hook))
+		ksu_handle_execveat((int *)AT_FDCWD, &filenam, &argv, &envp, 0);
+	else
+		ksu_handle_execveat_sucompat((int *)AT_FDCWD, &filenam, NULL, NULL, NULL);
+#endif
 	return do_execveat_common(AT_FDCWD, filenam, argv, envp, 0);
}

// Alternative for Linux <= 3.4
// File arch/arm/kernel/sys_arm.c
// Adds hook to asmlinkage int sys_execve()
@do_execve_hook_minimized_alternative depends on file in "arch/arm/kernel/sys_arm.c" && never do_execve_hook_minimized@
identifier filenamei, argv, envp;
identifier error, filenam;
type T1;
attribute name __user, __read_mostly;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv,
+ 			void *envp, int *flags);
+extern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr,
+ 				 void *argv, void *envp, int *flags);
+#endif
sys_execve(T1 filenamei, const char __user *const __user *argv, const char __user *const __user *envp, ...) {
	int error;
	struct filename *filenam;

	filenam = getname(filenamei);
	error = PTR_ERR(filenam);
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_execveat_hook))
+		ksu_handle_execveat((int *)AT_FDCWD, &filenam, &argv, &envp, 0);
+	else
+		ksu_handle_execveat_sucompat((int *)AT_FDCWD, &filenam, NULL, NULL, NULL);
+#endif
...
}

// Another alternative for Linux <= 3.4 (char * instead of struct filename *)
// File arch/arm/kernel/sys_arm.c
// Adds hook to asmlinkage int sys_execve()
@do_execve_hook_minimized_alternative2 depends on file in "arch/arm/kernel/sys_arm.c" && never do_execve_hook_minimized@
identifier filenamei, argv;
identifier error, filename;
type T1;
attribute name __user, __read_mostly;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execve_sucompat(int *fd, const char __user **filename_user,
+			       void *__never_use_argv, void *__never_use_envp,
+			       int *__never_use_flags);
+extern int ksu_handle_execve_ksud(const char __user *filename_user,
+			const char __user *const __user *__argv);
+#endif

sys_execve(T1 filenamei, const char __user *const __user *argv, ...) {
	int error;
	char *filename;

	filename = getname(filenamei);
	error = PTR_ERR(filename);

+#ifdef CONFIG_KSU
+	if (unlikely(ksu_execveat_hook))
+		ksu_handle_execve_ksud(filename, argv);
+	else
+		ksu_handle_execve_sucompat((int *)AT_FDCWD, &filename, NULL, NULL, NULL);
+#endif
...
}

// Alternative for Linux 3.10
// File fs/exec.c
// Adds hook to SYSCALL_DEFINE3(execve, ...).
@do_execve_hook_minimized_alternative3_1 depends on file in "fs/exec.c" && never do_execve_hook_minimized && never do_execve_hook_minimized_alternative && never do_execve_hook_minimized_alternative2@
identifier filenam, argv, envp;
identifier path, error;
type T1;
attribute name __user, __read_mostly;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_execveat_hook __read_mostly;
+extern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv,
+			void *envp, int *flags);
+extern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr,
+				 void *argv, void *envp, int *flags);
+#endif
execve(T1 filenam, const char __user *const __user *argv, const char __user *const __user *envp) {
	struct filename *path = getname(filenam);
	int error = PTR_ERR(path);
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_execveat_hook))
+		ksu_handle_execveat((int *)AT_FDCWD, &path, &argv, &envp, 0);
+	else
+		ksu_handle_execveat_sucompat((int *)AT_FDCWD, &path, NULL, NULL, NULL);
+#endif
...
}

// Second part of alternative for Linux 3.10
@do_execve_hook_minimized_alternative3_2 depends on do_execve_hook_minimized_alternative3_1 exists@
identifier filenam, error;
identifier path;
type T1;
@@
compat_sys_execve(T1 filenam, ...) {
	struct filename *path = getname(filenam);
	int error = PTR_ERR(path);
...
+#ifdef CONFIG_KSU
+	if (!ksu_execveat_hook)
+		ksu_handle_execveat_sucompat((int *)AT_FDCWD, &path, NULL, NULL, NULL); /* 32-bit su */
+#endif
error = compat_do_execve(...);
...
}

// File: fs/open.c
// Adds hook to SYSCALL_DEFINE3(faccessat, ...).

@sys_faccessat_hook_minimized depends on file in "fs/open.c"@
identifier dfd, filename, mode;
statement S1, S2;
attribute name __user;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_faccessat(int *dfd, const char __user **filename_user, int *mode,
+			                    int *flags);
+#endif
faccessat(int dfd, const char __user *filename, int mode) {
... when != S1
+#ifdef CONFIG_KSU
+	ksu_handle_faccessat(&dfd, &filename, &mode, NULL);
+#endif
S2
...
}

// File: fs/read_write.c
// Adds hook to SYSCALL_DEFINE3(read, ...).

@sys_read_hook_minimized depends on file in "fs/read_write.c" exists@
identifier fd, buf, count, ret, pos;
attribute name __user, __read_mostly;
@@

+#ifdef CONFIG_KSU
+extern bool ksu_vfs_read_hook __read_mostly;
+extern int ksu_handle_sys_read(unsigned int fd, char __user **buf_ptr,
+			size_t *count_ptr);
+#endif
read(unsigned int fd, char __user *buf, size_t count) {
...
(
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_vfs_read_hook))
+		ksu_handle_sys_read(fd, &buf, &count);
+#endif
  return ksys_read(fd, buf, count);
|
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_vfs_read_hook))
+		ksu_handle_sys_read(fd, &buf, &count);
+#endif
  ret = vfs_read(..., buf, count, &pos);
)
...
}

// File: fs/stat.c
// Adds hook to SYSCALL_DEFINE4(newfstatat, ...)

@sys_newfstatat_hook_minimized depends on file in "fs/stat.c" exists@
identifier dfd, filename, flag, error, stat;
attribute name __user;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
newfstatat(int dfd, const char __user *filename, ..., int flag) {
...
+#ifdef CONFIG_KSU
+	ksu_handle_stat(&dfd, &filename, &flag);
+#endif
error = vfs_fstatat(dfd, filename, &stat, flag);
...
}

// File: fs/stat.c
// Adds hook to SYSCALL_DEFINE4(fstatat64, ...).

@sys_fstatat64_hook_minimized depends on file in "fs/stat.c" exists@
identifier dfd, filename, stat, flag, error;
attribute name __user;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);
+#endif
fstatat64(int dfd, const char __user *filename, ..., int flag) {
...
+#ifdef CONFIG_KSU // 32-bit su
+	ksu_handle_stat(&dfd, &filename, &flag);
+#endif
error = vfs_fstatat(dfd, filename, &stat, flag);
...
}

// File: drivers/input/input.c
// Adds hook to input_event(...).

@input_event_hook_minimized depends on file in "drivers/input/input.c"@
identifier dev, typ, code, value;
attribute name __read_mostly;
statement S1, S2;
@@

+#if defined(CONFIG_KSU_KPROBES_HOOK) || defined(CONFIG_KSU_HOOK_KPROBES) || defined(CONFIG_KSU_WITH_KPROBES)
+#error KernelSU: Manual hooks are incompatible with CONFIG_KSU_KPROBES_HOOK, CONFIG_KSU_HOOK_KPROBES, or CONFIG_KSU_WITH_KPROBES. Disable them in your defconfig and/or KSU config.
+#endif
+
+#ifdef CONFIG_KSU
+extern bool ksu_input_hook __read_mostly;
+extern int ksu_handle_input_handle_event(unsigned int *type, unsigned int *code, int *value);
+#endif
input_event(struct input_dev *dev, unsigned int typ, unsigned int code, int value) {
... when != S1
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_input_hook))
+		ksu_handle_input_handle_event(&typ, &code, &value);
+#endif
S2
...
}

// Alternative for Linux >= 5.4
// File: drivers/input/input.c
// Adds hook to input_handle_event(...).

@input_event_hook_minimized_alternative depends on file in "drivers/input/input.c" && never input_event_hook_minimized@
identifier dev, typ, code, value;
attribute name __read_mostly;
statement S1, S2;
@@

+#if defined(CONFIG_KSU_KPROBES_HOOK) || defined(CONFIG_KSU_HOOK_KPROBES) || defined(CONFIG_KSU_WITH_KPROBES)
+#error KernelSU: You're using manual hooks but you also enabled CONFIG_KSU_KPROBES_HOOK or CONFIG_KSU_HOOK_KPROBES or CONFIG_KSU_WITH_KPROBES. Disable all of them in your defconfig and/or KSU config.
+#endif
+
+#ifdef CONFIG_KSU
+extern bool ksu_input_hook __read_mostly;
+extern int ksu_handle_input_handle_event(unsigned int *type, unsigned int *code, int *value);
+#endif
input_handle_event(struct input_dev *dev, unsigned int typ, unsigned int code, int value) {
... when != S1
+#ifdef CONFIG_KSU
+	if (unlikely(ksu_input_hook))
+		ksu_handle_input_handle_event(&typ, &code, &value);
+#endif
S2
...
}


// File: drivers/tty/pty.c
// Adds hook to pts_unix98_lookup(...) with struct file* parameter.

@pts_unix98_lookup_file_hook_minimized depends on file in "drivers/tty/pty.c"@
identifier file;
statement S1, S2;
@@
+#ifdef CONFIG_KSU
+extern int ksu_handle_devpts(struct inode*);
+#endif
pts_unix98_lookup(..., struct file *file, ...) {
... when != S1
+#ifdef CONFIG_KSU
+	ksu_handle_devpts((struct inode *)file->f_path.dentry->d_inode);
+#endif
S2
...
}

// File: drivers/tty/pty.c
// Adds hook to pts_unix98_lookup(...) with struct inode* parameter.

@pts_unix98_lookup_file_hook_minimized_alternative depends on file in "drivers/tty/pty.c"@
identifier pts_inode;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_devpts(struct inode*);
+#endif
pts_unix98_lookup(..., struct inode *pts_inode, ...) {
... when != S1
+#ifdef CONFIG_KSU
+	ksu_handle_devpts(pts_inode);
+#endif
S2
...
}

// Alternative for Linux >= 5.4
// File: fs/devpts/inode.c
// Adds hook to devpts_get_priv(...).

@devpts_get_priv depends on file in "fs/devpts/inode.c"@
identifier dentry;
statement S1, S2;
@@

+#ifdef CONFIG_KSU
+extern int ksu_handle_devpts(struct inode*);
+#endif
devpts_get_priv(struct dentry *dentry) {
... when != S1
+#ifdef CONFIG_KSU
+	ksu_handle_devpts(dentry->d_inode);
+#endif
S2
...
}


@has_can_umount@
identifier path, flags;
@@
can_umount(const struct path *path, int flags) { ... }

// Backport for Linux < 5.9
// File: fs/namespace.c
@path_umount depends on file in "fs/namespace.c" && never has_can_umount@
@@
do_umount(...) { ... }
+static int can_umount(const struct path *path, int flags)
+{
+struct mount *mnt = real_mount(path->mnt);
+
+if (flags & ~(MNT_FORCE | MNT_DETACH | MNT_EXPIRE | UMOUNT_NOFOLLOW))
+  return -EINVAL;
+if (!ns_capable(current->nsproxy->mnt_ns->user_ns, CAP_SYS_ADMIN))
+  return -EPERM;
+if (path->dentry != path->mnt->mnt_root)
+  return -EINVAL;
+if (!check_mnt(mnt))
+  return -EINVAL;
+#ifdef MNT_LOCKED /* Only available on Linux 3.12+ https://github.com/torvalds/linux/commit/5ff9d8a65ce80efb509ce4e8051394e9ed2cd942 */
+if (mnt->mnt.mnt_flags & MNT_LOCKED) /* Check optimistically */
+  return -EINVAL;
+#endif
+if (flags & MNT_FORCE && !capable(CAP_SYS_ADMIN))
+  return -EPERM;
+return 0;
+}
+
+int path_umount(struct path *path, int flags)
+{
+struct mount *mnt = real_mount(path->mnt);
+int ret;
+
+ret = can_umount(path, flags);
+if (!ret)
+  ret = do_umount(mnt, flags);
+
+/* we mustn't call path_put() as that would clear mnt_expiry_mark */
+dput(path->dentry);
+mntput_no_expire(mnt);
+return ret;
+}


// File: security/selinux/hooks.c
// Backport for Linux < 4.14
@selinux_no_nnp_transition depends on file in "security/selinux/hooks.c"@
identifier new_tsec, old_tsec;
@@

check_nnp_nosuid(...) {
	...
if (new_tsec->sid == old_tsec->sid)
	return 0;
+
+#ifdef CONFIG_KSU
+static u32 ksu_sid;
+char *secdata;
+int error;
+u32 seclen;
+if (!ksu_sid) {
+		security_secctx_to_secid("u:r:su:s0", strlen("u:r:su:s0"), &ksu_sid);
+}
+error = security_secid_to_secctx(old_tsec->sid, &secdata, &seclen);
+if (!error) {
+	rc = strcmp("u:r:init:s0",secdata);
+	security_release_secctx(secdata, seclen);
+	if (rc == 0 && new_tsec->sid == ksu_sid) {
+		return 0;
+	}
+}
+#endif
... when != selinux_policycap_nnp_nosuid_transition
}


// File: include/linux/cred.h
@has_get_cred_rcu depends on file in "include/linux/cred.h"@
@@
get_cred_rcu(const struct cred *cred) { ... }

// File: include/linux/cred.h
// Backport for Linux < 5.0
@get_cred_rcu_h depends on file in "include/linux/cred.h" && never has_get_cred_rcu@
@@

get_cred(...) { ... }

+static inline const struct cred *get_cred_rcu(const struct cred *cred)
+{
+	struct cred *nonconst_cred = (struct cred *) cred;
+	if (!cred)
+		return NULL;
+#ifdef atomic_inc_not_zero
+	if (!atomic_inc_not_zero(&nonconst_cred->usage))
+		return NULL;
+#else
+	if (!atomic_long_inc_not_zero(&nonconst_cred->usage))
+		return NULL;
+#endif
+	validate_creds(cred);
+	return cred;
+}

// File: kernel/cred.c
// Backport for Linux < 5.0
@get_cred_rcu depends on file in "kernel/cred.c"@
identifier atomic_inc_not_zero =~ "atomic_inc_not_zero|atomic_long_inc_not_zero";
@@

get_task_cred(...) {
...
do { ... } while (
-!atomic_inc_not_zero(&((struct cred *)cred)->usage)
+!get_cred_rcu(cred)
	);
...
}

// File: include/linux/cred.h
// Backport for Linux < 4.15
@has_groups_sort_h depends on file in "include/linux/cred.h"@
@@
extern void groups_sort(struct group_info *);

// Note: for some reason if I don't have a - line that patch never applies... Maybe a bug from Coccinelle?
// So instead of putting the line as an anchor, I put it with a - and then a + and it somehow fixes the problem
@groups_sort_h depends on file in "include/linux/cred.h" && never has_groups_sort_h@
@@
-extern bool may_setgroups(void);
+extern bool may_setgroups(void);
+extern void groups_sort(struct group_info *);

// File: kernel/groups.c
// Backport for Linux < 4.15
@groups_sort depends on file in "kernel/groups.c"@
@@
-static void groups_sort(struct group_info *group_info)
+void groups_sort(struct group_info *group_info)
{
	...
}
+EXPORT_SYMBOL(groups_sort);
