@simplify_stats@
identifier func, m, p, iface_entry, stats;
fresh identifier no_dev_stats = "no_dev_stats";
@@

static int func(struct seq_file *m, void *v)
{
    struct proc_iface_stat_fmt_info *p = m->private;
    struct iface_stat *iface_entry;
-   struct rtnl_link_stats64 dev_stats, *stats;
+   struct rtnl_link_stats64 *stats;
    struct rtnl_link_stats64 no_dev_stats = {0};
    ...
    iface_entry = list_entry(v, struct iface_stat, list);
-   if (iface_entry->active) {
-       stats = dev_get_stats(iface_entry->net_dev,
-                            &dev_stats);
-   } else {
-       stats = &no_dev_stats;
-   }
+   stats = &no_dev_stats;
}

@script:python@
@@
coccinelle.report("Simplified stats initialization in xt_qtaguid.c")
