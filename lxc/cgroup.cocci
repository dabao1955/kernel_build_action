@add_prefix_link@
identifier fn, css, cgrp, cft, kn, name, cfile;
@@

static int fn(struct cgroup_subsys_state *css, struct cgroup *cgrp,
             struct cftype *cft, struct kernfs_node *kn)
{
    char name[CGROUP_FILE_NAME_MAX];
    struct cgroup_file *cfile;
    ...
    spin_lock_irq(&cgroup_file_kn_lock);
    cfile->kn = kn;
    spin_unlock_irq(&cgroup_file_kn_lock);
+	if (cft->ss && (cgrp->root->flags & CGRP_ROOT_NOPREFIX) && !(cft->flags & CFTYPE_NO_PREFIX)) {
+		snprintf(name, CGROUP_FILE_NAME_MAX, "%s.%s", cft->ss->name, cft->name);
+		kernfs_create_link(cgrp->kn, name, kn);
+	}

    return 0;
}
