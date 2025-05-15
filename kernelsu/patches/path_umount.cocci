@has_can_umount@
identifier path, flags;
@@
can_umount(const struct path *path, int flags) { ... }

// For `fs/namespace.c`
@path_umount depends on file in "namespace.c" && never has_can_umount@
@@
+static int can_umount(const struct path *path, int flags)
+{
+struct mount *mnt = real_mount(path->mnt);
+
+if (flags & ~(MNT_FORCE | MNT_DETACH | MNT_EXPIRE | UMOUNT_NOFOLLOW))
+  return -EINVAL;
+if (!may_mount())
+  return -EPERM;
+if (path->dentry != path->mnt->mnt_root)
+  return -EINVAL;
+if (!check_mnt(mnt))
+  return -EINVAL;
+if (mnt->mnt.mnt_flags & MNT_LOCKED) /* Check optimistically */
+  return -EINVAL;
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
mnt_alloc_id(...) { ... }
