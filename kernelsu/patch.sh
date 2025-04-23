#!/usr/bin/env bash
# Patches author: weishu <twsxtd@gmail.com>
# Shell authon: xiaoleGun <1592501605@qq.com>
#               bdqllW <bdqllT@gmail.com>
# Tested kernel versions: 5.4, 4.19, 4.14, 4.9
# 20240601

set -e

patch_files=(
    fs/exec.c
    fs/open.c
    fs/read_write.c
    fs/stat.c
    fs/namespace.c
    drivers/input/input.c
    fs/devpts/inode.c
    security/selinux/hooks.c
)

for i in "${patch_files[@]}"; do

    if grep -iq "ksu|ksu_sid" "$i"; then
        echo "Warning: $i contains KernelSU"
        continue
    fi

    case $i in

    # fs/ changes
    fs/exec.c)
        sed -i '/static int do_execveat_common/i\#ifdef CONFIG_KSU\nextern bool ksu_execveat_hook __read_mostly;\nextern int ksu_handle_execveat(int *fd, struct filename **filename_ptr, void *argv,\n			void *envp, int *flags);\nextern int ksu_handle_execveat_sucompat(int *fd, struct filename **filename_ptr,\n				 void *argv, void *envp, int *flags);\n#endif' fs/exec.c
        if grep -q "return __do_execve_file(fd, filename, argv, envp, flags, NULL);" fs/exec.c; then
            sed -i '/return __do_execve_file(fd, filename, argv, envp, flags, NULL);/i\	#ifdef CONFIG_KSU\n	if (unlikely(ksu_execveat_hook))\n		ksu_handle_execveat(&fd, &filename, &argv, &envp, &flags);\n	else\n		ksu_handle_execveat_sucompat(&fd, &filename, &argv, &envp, &flags);\n	#endif' fs/exec.c
        else
            sed -i '/if (IS_ERR(filename))/i\	#ifdef CONFIG_KSU\n	if (unlikely(ksu_execveat_hook))\n		ksu_handle_execveat(&fd, &filename, &argv, &envp, &flags);\n	else\n		ksu_handle_execveat_sucompat(&fd, &filename, &argv, &envp, &flags);\n	#endif' fs/exec.c
        fi
        ;;

    fs/open.c)
        if grep -q "long do_faccessat(int dfd, const char __user \*filename, int mode)" fs/open.c; then
            sed -i '/long do_faccessat(int dfd, const char __user \*filename, int mode)/i\#ifdef CONFIG_KSU\nextern int ksu_handle_faccessat(int *dfd, const char __user **filename_user, int *mode,\n			 int *flags);\n#endif' fs/open.c
        else
            sed -i '/SYSCALL_DEFINE3(faccessat, int, dfd, const char __user \*, filename, int, mode)/i\#ifdef CONFIG_KSU\nextern int ksu_handle_faccessat(int *dfd, const char __user **filename_user, int *mode,\n			 int *flags);\n#endif' fs/open.c
        fi
        sed -i '/if (mode & ~S_IRWXO)/i\	#ifdef CONFIG_KSU\n	ksu_handle_faccessat(&dfd, &filename, &mode, NULL);\n	#endif\n' fs/open.c
        ;;

    fs/read_write.c)
        sed -i '/ssize_t vfs_read(struct file/i\#ifdef CONFIG_KSU\nextern bool ksu_vfs_read_hook __read_mostly;\nextern int ksu_handle_vfs_read(struct file **file_ptr, char __user **buf_ptr,\n		size_t *count_ptr, loff_t **pos);\n#endif' fs/read_write.c
        sed -i '/ssize_t vfs_read(struct file/,/ssize_t ret;/{/ssize_t ret;/a\
    #ifdef CONFIG_KSU\
    if (unlikely(ksu_vfs_read_hook))\
        ksu_handle_vfs_read(&file, &buf, &count, &pos);\
    #endif
        }' fs/read_write.c
        ;;

    fs/stat.c)
        if grep -q "int vfs_statx(int dfd, const char __user \*filename, int flags," fs/stat.c; then
            sed -i '/int vfs_statx(int dfd, const char __user \*filename, int flags,/i\#ifdef CONFIG_KSU\nextern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);\n#endif' fs/stat.c
            sed -i '/unsigned int lookup_flags = LOOKUP_FOLLOW | LOOKUP_AUTOMOUNT;/a\\n	#ifdef CONFIG_KSU\n	ksu_handle_stat(&dfd, &filename, &flags);\n	#endif' fs/stat.c
        else
            sed -i '/int vfs_fstatat(int dfd, const char __user \*filename, struct kstat \*stat,/i\#ifdef CONFIG_KSU\nextern int ksu_handle_stat(int *dfd, const char __user **filename_user, int *flags);\n#endif\n' fs/stat.c
            sed -i '/if ((flag & ~(AT_SYMLINK_NOFOLLOW | AT_NO_AUTOMOUNT |/i\	#ifdef CONFIG_KSU\n	ksu_handle_stat(&dfd, &filename, &flag);\n	#endif\n' fs/stat.c
        fi
        ;;

    fs/namespace.c)
        if [[ $(grep -c "static int can_umount(const struct" fs/namespace.c) == 0 ]]; then
            if grep -q "may_mandlock(void)" fs/namespace.c; then
                umount='may_mandlock(void)/,/^}/ { /^}/ {n;a'
            else
                umount='int ksys_umount(char __user \*name, int flags)/i'
            fi
        sed -i "/${umount} \
#ifdef CONFIG_KSU\n\
static int can_umount(const struct path *path, int flags)\n\
{\n\
    struct mount *mnt = real_mount(path->mnt);\n\
\n\
    if (flags & ~(MNT_FORCE | MNT_DETACH | MNT_EXPIRE | UMOUNT_NOFOLLOW))\n\
        return -EINVAL;\n\
    if (!may_mount())\n\
        return -EPERM;\n\
    if (path->dentry != path->mnt->mnt_root)\n\
        return -EINVAL;\n\
    if (!check_mnt(mnt))\n\
        return -EINVAL;\n\
    if (mnt->mnt.mnt_flags & MNT_LOCKED) /* Check optimistically */\n\
        return -EINVAL;\n\
    if (flags & MNT_FORCE && !capable(CAP_SYS_ADMIN))\n\
        return -EPERM;\n\
    return 0;\n\
}\n\
\n\
int path_umount(struct path *path, int flags)\n\
{\n\
    struct mount *mnt = real_mount(path->mnt);\n\
    int ret;\n\
\n\
    ret = can_umount(path, flags);\n\
    if (!ret)\n\
        ret = do_umount(mnt, flags);\n\
\n\
    /* we must not call path_put() as that would clear mnt_expiry_mark */\n\
    dput(path->dentry);\n\
    mntput_no_expire(mnt);\n\
    return ret;\n\
}\n\
#endif
}}" fs/namespace.c
        fi
        ;;

    # drivers/input changes
    drivers/input/input.c)
        sed -i '/static void input_handle_event/i\#ifdef CONFIG_KSU\nextern bool ksu_input_hook __read_mostly;\nextern int ksu_handle_input_handle_event(unsigned int *type, unsigned int *code, int *value);\n#endif\n' drivers/input/input.c
        sed -i '/int disposition = input_get_disposition(dev, type, code, &value);/a\	#ifdef CONFIG_KSU\n	if (unlikely(ksu_input_hook))\n		ksu_handle_input_handle_event(&type, &code, &value);\n	#endif' drivers/input/input.c
        ;;

    fs/devpts/inode.c)
        sed -i '/struct dentry \*devpts_pty_new/,/return dentry;/ {
    /return dentry;/ {n; a\
#ifdef CONFIG_KSU\nextern int ksu_handle_devpts(struct inode*);\n#endif
    }
}
        /if (dentry->d_sb->s_magic != DEVPTS_SUPER_MAGIC)/i\
	#ifdef CONFIG_KSU\n	ksu_handle_devpts(dentry->d_inode);\n	#endif' fs/devpts/inode.c
        ;;

    # security/selinux/hooks.c
    security/selinux/hooks.c)
        if grep -q "^VERSION = [1-4]" Makefile; then
        sed -i '/int nnp = (bprm->unsafe & LSM_UNSAFE_NO_NEW_PRIVS);/i\    static u32 ksu_sid;\n    char *secdata;' security/selinux/hooks.c
        sed -i '/if (!nnp && !nosuid)/i\    int error;\n    u32 seclen;\n' security/selinux/hooks.c
        sed -i '/return 0; \/\* No change in credentials \*\//a\\n    if (!ksu_sid)\n        security_secctx_to_secid("u:r:su:s0", strlen("u:r:su:s0"), &ksu_sid);\n\n    error = security_secid_to_secctx(old_tsec->sid, &secdata, &seclen);\n    if (!error) {\n        rc = strcmp("u:r:init:s0", secdata);\n        security_release_secctx(secdata, seclen);\n        if (rc == 0 && new_tsec->sid == ksu_sid)\n            return 0;\n    }' security/selinux/hooks.c
        fi
        ;;
    esac

    echo "Patch applied successfully to $i"

done
