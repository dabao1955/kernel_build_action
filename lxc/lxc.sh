#!/usr/bin/env bash

set -e

if grep -q "int cgroup_add_file" kernel/cgroup.c >/dev/null 2>&1; then
    cgroup='kernel/cgroup.c'
else
    cgroup='kernel/cgroup/cgroup.c'
fi

patch_files=(
    "$cgroup"
    net/netfilter/xt_qtaguid.c
)

for i in "${patch_files[@]}"; do

    if [[ "$i" == "$cgroup" ]]; then
        if grep -Fq "snprintf(name, CGROUP_FILE_NAME_MAX" "$i"; then
            echo "Warning: $i contains LXC"
            continue
        fi
    fi

    if [[ "$i" == "net/netfilter/xt_qtaguid.c" ]]; then
        if grep -Fq "struct rtnl_link_stats64 *stats" "$i"; then
            echo "Warning: $i contains LXC"
            continue
        fi
    fi

    case $i in

    "$cgroup")
        sed -i '/int cgroup_add_file/,/return 0;/{
        /return 0;/i\
    \tif (cft->ss && (cgrp->root->flags & CGRP_ROOT_NOPREFIX) && !(cft->flags & CFTYPE_NO_PREFIX)) {\
        \tsnprintf(name, CGROUP_FILE_NAME_MAX, "%s.%s", cft->ss->name, cft->name);\
        \tkernfs_create_link(cgrp->kn, name, kn);\
    \t}
}' "$cgroup"
        ;;

    net/netfilter/xt_qtaguid.c)
        sed -i '/int iface_stat_fmt_proc_show/,/^}/ {
    s/struct rtnl_link_stats64 dev_stats, \*stats/struct rtnl_link_stats64 \*stats/
    /if (iface_entry->active)/i\
    \tstats = &no_dev_stats;
    /if (iface_entry->active)/,+5d
}' net/netfilter/xt_qtaguid.c
        ;;
    esac

    echo "Patch applied successfully to $i"

done
