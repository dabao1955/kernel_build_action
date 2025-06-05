#ifndef REKERNEL_H
#define REKERNEL_H

#include <linux/netlink.h>
#include <linux/freezer.h>
#include <net/sock.h>
#include <linux/proc_fs.h>
#include <linux/sched.h>

#define NETLINK_REKERNEL_MAX     		26
#define NETLINK_REKERNEL_MIN     		22
#define USER_PORT        			    100
#define PACKET_SIZE 				    128
#define MIN_USERAPP_UID (10000)
#define MAX_SYSTEM_UID  (2000)

static struct sock *rekernel_netlink;
static int netlink_unit;

#endif
