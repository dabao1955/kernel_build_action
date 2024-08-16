--- a/kernel/cgroup/cgroup.c
+++ b/kernel/cgroup/cgroup.c
@@ -3786,6 +3786,10 @@ static int cgroup_add_file(struct cgroup_subsys_state *css, struct cgroup *cgrp,
 		cfile->kn = kn;
 		spin_unlock_irq(&cgroup_file_kn_lock);
 	}
+	if (cft->ss && (cgrp->root->flags & CGRP_ROOT_NOPREFIX) && !(cft->flags & CFTYPE_NO_PREFIX)) {
+				snprintf(name, CGROUP_FILE_NAME_MAX, "%s.%s", cft->ss->name, cft->name);
+				kernfs_create_link(cgrp->kn, name, kn);
+	}
 
 	return 0;
 }
