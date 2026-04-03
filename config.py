#!/usr/bin/env python3
"""
Check and configure kernel config options for LXC/Docker or Kali NetHunter support.
"""

import argparse
import re
import sys
from pathlib import Path


# =============================================================================
# Configuration by Type
# =============================================================================

LXC_CONFIGS_ON = """
CONFIG_NAMESPACES
CONFIG_MULTIUSER
CONFIG_NET
CONFIG_NET_NS
CONFIG_PID_NS
CONFIG_POSIX_MQUEUE
CONFIG_IPC_NS
CONFIG_UTS_NS
CONFIG_CGROUPS
CONFIG_SCHED_AUTOGROUP
CONFIG_CGROUP_CPUACCT
CONFIG_CGROUP_DEVICE
CONFIG_CGROUP_FREEZER
CONFIG_CGROUP_SCHED
CONFIG_DEBUG_BLK_CGROUP
CONFIG_NETFILTER_XT_MATCH_BPF
CONFIG_CPUSETS
CONFIG_MEMCG
CONFIG_KEYS
CONFIG_NETDEVICES
CONFIG_NET_CORE
CONFIG_VETH
CONFIG_IPV6
CONFIG_IP6_NF_NAT
CONFIG_IP6_NF_TARGET_MASQUERADE
CONFIG_BRIDGE
CONFIG_NETFILTER
CONFIG_INET
CONFIG_NETFILTER_ADVANCED
CONFIG_BRIDGE_NETFILTER
CONFIG_IP_NF_FILTER
CONFIG_IP_NF_IPTABLES
CONFIG_IP_NF_NAT
CONFIG_IP_NF_TARGET_MASQUERADE
CONFIG_NETFILTER_XTABLES
CONFIG_NETFILTER_XT_MATCH_ADDRTYPE
CONFIG_NETFILTER_XT_MATCH_CONNTRACK
CONFIG_NF_CONNTRACK
CONFIG_NETFILTER_XT_MATCH_IPVS
CONFIG_IP_VS
CONFIG_NETFILTER_XT_MARK
CONFIG_NF_NAT
CONFIG_POSIX_MQUEUE
CONFIG_NF_NAT_IPV6
CONFIG_NF_NAT_IPV4
CONFIG_NF_CONNTRACK_IPV4
CONFIG_NF_CONNTRACK_IPV6
CONFIG_NF_NAT_NEEDED
CONFIG_BPF
CONFIG_CGROUP_BPF
CONFIG_BPF_SYSCALL
CONFIG_USER_NS
CONFIG_SECCOMP
CONFIG_SECCOMP_FILTER
CONFIG_CGROUP_PIDS
CONFIG_CGROUP_DEBUG
CONFIG_SWAP
CONFIG_MEMCG_SWAP
CONFIG_MEMCG_SWAP_ENABLED
CONFIG_BLOCK
CONFIG_IOSCHED_CFQ
CONFIG_BLK_CGROUP
CONFIG_CFQ_GROUP_IOSCHED
CONFIG_BLK_DEV_THROTTLING
CONFIG_PERF_EVENTS
CONFIG_CGROUP_PERF
CONFIG_HUGETLBFS
CONFIG_HUGETLB_PAGE
CONFIG_CGROUP_HUGETLB
CONFIG_NET_SCHED
CONFIG_NET_CLS_CGROUP
CONFIG_CGROUP_NET_PRIO
CONFIG_FAIR_GROUP_SCHED
CONFIG_RT_GROUP_SCHED
CONFIG_IP_NF_TARGET_REDIRECT
CONFIG_IP_VS_NFCT
CONFIG_IP_VS_PROTO_TCP
CONFIG_IP_VS_PROTO_UDP
CONFIG_IP_VS_RR
CONFIG_SECURITY
CONFIG_SECURITY_SELINUX
CONFIG_SECURITY_APPARMOR
CONFIG_EXT3_FS
CONFIG_EXT3_FS_POSIX_ACL
CONFIG_EXT3_FS_SECURITY
CONFIG_EXT4_FS
CONFIG_EXT4_FS_POSIX_ACL
CONFIG_EXT4_FS_SECURITY
CONFIG_VXLAN
CONFIG_BRIDGE
CONFIG_BRIDGE_VLAN_FILTERING
CONFIG_VLAN_8021Q
CONFIG_CRYPTO
CONFIG_CRYPTO_AEAD
CONFIG_CRYPTO_GCM
CONFIG_CRYPTO_SEQIV
CONFIG_CRYPTO_GHASH
CONFIG_CHECKPOINT_RESTORE
CONFIG_XFRM
CONFIG_XFRM_USER
CONFIG_XFRM_ALGO
CONFIG_INET_ESP
CONFIG_INET_XFRM_MODE_TRANSPORT
CONFIG_IPVLAN
CONFIG_MACVLAN
CONFIG_NET_L3_MASTER_DEV
CONFIG_DUMMY
CONFIG_NF_NAT_FTP
CONFIG_NF_CONNTRACK_FTP
CONFIG_NF_NAT_TFTP
CONFIG_NF_CONNTRACK_TFTP
CONFIG_AUFS_FS
CONFIG_BTRFS_FS
CONFIG_BTRFS_FS_POSIX_ACL
CONFIG_MD
CONFIG_BLK_DEV_DM
CONFIG_DM_THIN_PROVISIONING
CONFIG_OVERLAY_FS
CONFIG_PACKET
CONFIG_PACKET_DIAG
CONFIG_NETLINK_DIAG
CONFIG_FHANDLE
CONFIG_UNIX
CONFIG_UNIX_DIAG
CONFIG_NETFILTER_XT_TARGET_CHECKSUM
CONFIG_CFS_BANDWIDTH
"""

LXC_CONFIGS_OFF = """
CONFIG_ANDROID_PARANOID_NETWORK
CONFIG_SCHED_WALT
"""

LXC_CONFIGS_EQ = ""

NETHUNTER_CONFIGS_ON = """
CONFIG_MODULES
CONFIG_MODULE_FORCE_LOAD
CONFIG_MODULE_UNLOAD
CONFIG_MODVERSIONS

CONFIG_SYSVIPC
CONFIG_SYSVIPC_SYSCTL
CONFIG_BUILD_ARM64_APPENDED_DTB_IMAGE
CONFIG_IMG_GZ_DTB
CONFIG_BUILD_ARM64_DT_OVERLAY
CONFIG_POSIX_MQUEUE

CONFIG_IKCONFIG
CONFIG_CPUSETS
CONFIG_AUTOFS4_FS
CONFIG_TMPFS_XATTR
CONFIG_TMPFS_POSIX_ACL
CONFIG_CGROUP_DEVICE
CONFIG_CGROUPS
CONFIG_NAMESPACES
CONFIG_UTS_NS
CONFIG_IPC_NS
CONFIG_USER_NS
CONFIG_PID_NS
CONFIG_NET_NS
CONFIG_DEVTMPFS
CONFIG_DEVTMPFS_MOUNT
CONFIG_FSNOTIFY
CONFIG_DNOTIFY
CONFIG_INOTIFY_USER
CONFIG_FANOTIFY
CONFIG_FANOTIFY_ACCESS_PERMISSIONS
CONFIG_BT
CONFIG_BT_RFCOMM
CONFIG_BT_RFCOMM_TTY
CONFIG_BT_BNEP
CONFIG_BT_BNEP_MC_FILTER
CONFIG_BT_BNEP_PROTO_FILTER
CONFIG_BT_HIDP
CONFIG_BT_HCIBTUSB_BCM
CONFIG_BT_HCIBTUSB_RTL
CONFIG_BT_HCIUART
CONFIG_BT_HCIBCM203X
CONFIG_BT_HCIBPA10X
CONFIG_BT_HCIBFUSB
CONFIG_CFG80211_WEXT
CONFIG_MAC80211
CONFIG_MAC80211_MESH
CONFIG_DNS_RESOLVER
CONFIG_FHANDLE
CONFIG_EPOLL
CONFIG_SIGNALFD
CONFIG_TIMERFD
CONFIG_TMPFS_POSIX_ACL
CONFIG_USB_RTL8150
CONFIG_USB_RTL8152
CONFIG_MEDIA_DIGITAL_TV_SUPPORT
CONFIG_MEDIA_SDR_SUPPORT
CONFIG_MEDIA_TUNER_MSI001
CONFIG_USB_AIRSPY
CONFIG_USB_HACKRF
CONFIG_USB_MSI2500
CONFIG_DVB_RTL2830
CONFIG_DVB_RTL2832
CONFIG_DVB_RTL2832_SDR
CONFIG_DVB_SI2168
CONFIG_DVB_ZD1301_DEMOD

CONFIG_HIDRAW
CONFIG_USB_HID
CONFIG_HID_PID
CONFIG_HIDRAW
CONFIG_USB_HIDDEV
CONFIG_I2C_HID
CONFIG_USB_OHCI_LITTLE_ENDIAN
CONFIG_USB_SUPPORT
CONFIG_USB_COMMON
CONFIG_USB_ARCH_HAS_HCD
CONFIG_USB
CONFIG_USB_ANNOUNCE_NEW_DEVICES

CONFIG_USB_SERIAL
CONFIG_USB_SERIAL_CONSOLE
CONFIG_USB_SERIAL_GENERIC
CONFIG_USB_SERIAL_SIMPLE
CONFIG_USB_SERIAL_CP210X
CONFIG_USB_SERIAL_CH341
CONFIG_USB_SERIAL_QCAUX
CONFIG_USB_SERIAL_QUALCOMM
CONFIG_USB_ACM
CONFIG_USB_OTG
CONFIG_USB_WDM
CONFIG_USB_CONFIGFS_RMNET_BAM
CONFIG_USB_CONFIGFS_MBIM_BAM
CONFIG_USB_CONFIGFS_F_UAC1
CONFIG_USB_CONFIGFS_F_UAC2
CONFIG_USB_CONFIGFS_F_UVC
CONFIG_USB_CONFIGFS_F_PRINTER
CONFIG_USB_CONFIGFS_F_GSI
CONFIG_USB_CONFIGFS_F_IPC
CONFIG_USB_CONFIGFS_SERIAL
CONFIG_USB_CONFIGFS_ACM
CONFIG_USB_CONFIGFS_OBEX
CONFIG_USB_CONFIGFS_NCM
CONFIG_USB_CONFIGFS_ECM
CONFIG_USB_CONFIGFS_ECM_SUBSET
CONFIG_USB_CONFIGFS_RNDIS
CONFIG_USB_CONFIGFS_EEM
CONFIG_USB_CONFIGFS_MASS_STORAGE
CONFIG_USB_LAN78XX
CONFIG_WLAN_VENDOR_ATH
CONFIG_CARL9170
CONFIG_WLAN_VENDOR_MEDIATEK
CONFIG_MT7601U
CONFIG_WLAN_VENDOR_RALINK
CONFIG_RT2X00
CONFIG_RT2500USB
CONFIG_RT73USB
CONFIG_RT2800USB
CONFIG_RT2800USB_RT33XX
CONFIG_RT2800USB_RT35XX
CONFIG_RT2800USB_RT3573
CONFIG_RT2800USB_RT53XX
CONFIG_RT2800USB_RT55XX
CONFIG_RT2800USB_UNKNOWN
CONFIG_WLAN_VENDOR_REALTEK
CONFIG_RTL8187
CONFIG_RTL_CARDS
CONFIG_RTL8192CU
CONFIG_RTL8XXXU_UNTESTED
CONFIG_WLAN_VENDOR_ZYDAS
CONFIG_USB_ZD1201
CONFIG_ZD1211RW
CONFIG_USB_NET_RNDIS_WLAN
CONFIG_BT_HCIVHCI
CONFIG_MACVLAN
CONFIG_CHECKPOINT_RESTORE
CONFIG_UNIX_DIAG
CONFIG_PACKET_DIAG
CONFIG_NETLINK_DIAG
CONFIG_MEDIA_TUNER
"""

NETHUNTER_CONFIGS_OFF = """
CONFIG_DVB_AF9013
CONFIG_MEDIA_SUBDRV_AUTOSELECT
CONFIG_MEDIA_TUNER_SIMPLE
CONFIG_MEDIA_TUNER_TDA18250
CONFIG_MEDIA_TUNER_TDA8290
CONFIG_MEDIA_TUNER_TDA827X
CONFIG_MEDIA_TUNER_TDA18271
CONFIG_MEDIA_TUNER_TDA9887
CONFIG_MEDIA_TUNER_TEA5761
CONFIG_MEDIA_TUNER_TEA5767
CONFIG_MEDIA_TUNER_MT20XX
CONFIG_MEDIA_TUNER_MT2060
CONFIG_MEDIA_TUNER_MT2063
CONFIG_MEDIA_TUNER_MT2266
CONFIG_MEDIA_TUNER_MT2131
CONFIG_MEDIA_TUNER_QT1010
CONFIG_MEDIA_TUNER_XC2028
CONFIG_MEDIA_TUNER_XC5000
CONFIG_MEDIA_TUNER_XC4000
CONFIG_MEDIA_TUNER_MXL5005S
CONFIG_MEDIA_TUNER_MXL5007T
CONFIG_MEDIA_TUNER_MC44S803
CONFIG_MEDIA_TUNER_MAX2165
CONFIG_MEDIA_TUNER_TDA18218
CONFIG_MEDIA_TUNER_FC0011
CONFIG_MEDIA_TUNER_FC0012
CONFIG_MEDIA_TUNER_FC0013
CONFIG_MEDIA_TUNER_TDA18212
CONFIG_MEDIA_TUNER_FC2580
CONFIG_MEDIA_TUNER_M88RS6000T
CONFIG_MEDIA_TUNER_TUA9001
CONFIG_MEDIA_TUNER_SI2157
CONFIG_MEDIA_TUNER_IT913X
CONFIG_MEDIA_TUNER_R820T
CONFIG_MEDIA_TUNER_MXL301RF
CONFIG_MEDIA_TUNER_QM1D1C0042
CONFIG_MEDIA_TUNER_QM1D1B0004
CONFIG_DVB_STB0899
CONFIG_DVB_STB6100
CONFIG_DVB_STV090x
CONFIG_DVB_STV0910
CONFIG_DVB_STV6110x
CONFIG_DVB_STV6111
CONFIG_DVB_MXL5XX
CONFIG_DVB_DRXK
CONFIG_DVB_TDA18271C2DD
CONFIG_DVB_SI2165
CONFIG_DVB_MN88472
CONFIG_DVB_MN88473
CONFIG_DVB_CX24110
CONFIG_DVB_CX24123
CONFIG_DVB_MT312
CONFIG_DVB_ZL10036
CONFIG_DVB_ZL10039
CONFIG_DVB_S5H1420
CONFIG_DVB_STV0288
CONFIG_DVB_STB6000
CONFIG_DVB_STV0299
CONFIG_DVB_STV6110
CONFIG_DVB_STV0900
CONFIG_DVB_TDA8083
CONFIG_DVB_TDA10086
CONFIG_DVB_TDA8261
CONFIG_DVB_VES1X93
CONFIG_DVB_TUNER_ITD1000
CONFIG_DVB_TUNER_CX24113
CONFIG_DVB_TDA826X
CONFIG_DVB_TUA6100
CONFIG_DVB_CX24116
CONFIG_DVB_CX24117
CONFIG_DVB_CX24120
CONFIG_DVB_SI21XX
CONFIG_DVB_TS2020
CONFIG_DVB_DS3000
CONFIG_DVB_MB86A16
CONFIG_DVB_TDA10071
CONFIG_DVB_SP8870
CONFIG_DVB_SP887X
CONFIG_DVB_CX22700
CONFIG_DVB_CX22702
CONFIG_DVB_S5H1432
CONFIG_DVB_DRXD
CONFIG_DVB_L64781
CONFIG_DVB_TDA1004X
CONFIG_DVB_NXT6000
CONFIG_DVB_MT352
CONFIG_DVB_ZL10353
CONFIG_DVB_DIB3000MB
CONFIG_DVB_DIB3000MC
CONFIG_DVB_DIB7000M
CONFIG_DVB_DIB7000P
CONFIG_DVB_DIB9000
CONFIG_DVB_TDA10048
CONFIG_DVB_EC100
CONFIG_DVB_STV0367
CONFIG_DVB_CXD2820R
CONFIG_DVB_CXD2841ER
CONFIG_DVB_CXD2880
CONFIG_DVB_VES1820
CONFIG_DVB_TDA10021
CONFIG_DVB_TDA10023
CONFIG_DVB_STV0297
CONFIG_DVB_NXT200X
CONFIG_DVB_OR51211
CONFIG_DVB_OR51132
CONFIG_DVB_BCM3510
CONFIG_DVB_LGDT330X
CONFIG_DVB_LGDT3305
CONFIG_DVB_LG2160
CONFIG_DVB_S5H1409
CONFIG_DVB_AU8522
CONFIG_DVB_AU8522_DTV
CONFIG_DVB_AU8522_V4L
CONFIG_DVB_S5H1411
CONFIG_DVB_S921
CONFIG_DVB_DIB8000
CONFIG_DVB_MB86A20S
CONFIG_DVB_TC90522
CONFIG_DVB_MN88443X
CONFIG_DVB_PLL
CONFIG_DVB_TUNER_DIB0070
CONFIG_DVB_TUNER_DIB0090
CONFIG_DVB_DRX39XYJ
CONFIG_DVB_LNBH25
CONFIG_DVB_LNBH29
CONFIG_DVB_LNBP21
CONFIG_DVB_LNBP22
CONFIG_DVB_ISL6405
CONFIG_DVB_ISL6421
CONFIG_DVB_ISL6423
CONFIG_DVB_A8293
CONFIG_DVB_LGS8GL5
CONFIG_DVB_LGS8GXX
CONFIG_DVB_ATBM8830
CONFIG_DVB_TDA665x
CONFIG_DVB_IX2505V
CONFIG_DVB_M88RS2000
CONFIG_DVB_AF9033
CONFIG_DVB_HORUS3A
CONFIG_DVB_ASCOT2E
CONFIG_DVB_HELENE
CONFIG_DVB_CXD2099
CONFIG_DVB_SP2
"""

NETHUNTER_CONFIGS_EQ = ""

# Type configuration mapping
TYPE_CONFIGS = {
    "lxc": {
        "configs_on": LXC_CONFIGS_ON,
        "configs_off": LXC_CONFIGS_OFF,
        "configs_eq": LXC_CONFIGS_EQ,
        "description": "Check and configure kernel for LXC/Docker",
        "check_message": "Checking config file for https://github.com/wu17481748/lxc-docker specific config options.",
        "fix_message": "开启docker-lxc配置 {} 项.",
    },
    "nethunter": {
        "configs_on": NETHUNTER_CONFIGS_ON,
        "configs_off": NETHUNTER_CONFIGS_OFF,
        "configs_eq": NETHUNTER_CONFIGS_EQ,
        "description": "Check and configure kernel for Kali NetHunter",
        "check_message": "Checking config file for kali specific config options.",
        "fix_message": "Made {} fixes.",
    },
}


# =============================================================================
# Utility Functions
# =============================================================================


def color_red(text: str) -> str:
    """Return text wrapped in red ANSI color codes."""
    return f"\033[31m{text}\033[0m"


def color_green(text: str) -> str:
    """Return text wrapped in green ANSI color codes."""
    return f"\033[32m{text}\033[0m"


def color_white(text: str) -> str:
    """Return text wrapped in white ANSI color codes."""
    return f"\033[37m{text}\033[0m"


def parse_configs(config_text: str) -> list[str]:
    """Parse config list into individual items."""
    return [line.strip() for line in config_text.strip().split('\n') if line.strip()]


def count_config_occurrences(config_file: Path, config: str) -> int:
    """Count how many times a config appears in the file."""
    content = config_file.read_text(encoding='utf-8')
    pattern = r'\b' + re.escape(config) + r'\b'
    return len(re.findall(pattern, content))


def is_config_enabled(config_file: Path, config: str) -> bool:
    """Check if a config is enabled (=y or =m)."""
    content = config_file.read_text(encoding='utf-8')
    pattern = rf'^{re.escape(config)}=(y|m)$'
    return bool(re.search(pattern, content, re.MULTILINE))


def is_config_set(config_file: Path, config: str) -> bool:
    """Check if a config line exists in the file."""
    content = config_file.read_text(encoding='utf-8')
    pattern = rf'^{re.escape(config)}=.*$'
    return bool(re.search(pattern, content, re.MULTILINE))


def add_config_not_set(config_file: Path, config: str) -> None:
    """Add '# CONFIG_XXX is not set' to the file."""
    with open(config_file, 'a', encoding='utf-8') as f:
        f.write(f"# {config} is not set\n")


def enable_config(config_file: Path, config: str) -> None:
    """Enable a config by replacing '# CONFIG_XXX is not set' with 'CONFIG_XXX=y'."""
    content = config_file.read_text(encoding='utf-8')
    pattern = rf'^# {re.escape(config)} is not set$'
    replacement = f'{config}=y'
    new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    config_file.write_text(new_content, encoding='utf-8')


def disable_config(config_file: Path, config: str) -> None:
    """Disable a config by replacing 'CONFIG_XXX=...' with '# CONFIG_XXX is not set'."""
    content = config_file.read_text(encoding='utf-8')
    pattern = rf'^{re.escape(config)}=.*$'
    replacement = f'# {config} is not set'
    new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    config_file.write_text(new_content, encoding='utf-8')


def get_config_value(config_file: Path, config: str) -> str | None:
    """Get the current value of a config."""
    content = config_file.read_text(encoding='utf-8')
    pattern = rf'^{re.escape(config)}=(.+)$'
    match = re.search(pattern, content, re.MULTILINE)
    return match.group(1) if match else None


# =============================================================================
# Main Logic
# =============================================================================


def _check_configs_exist(config_file: Path, configs: list[str], write_mode: bool) -> tuple[int, int]:
    """Check that all configs exist in the config file."""
    errors = 0
    fixes = 0
    for config in configs:
        count = count_config_occurrences(config_file, config)
        if count > 1:
            print(color_red(f"{config} appears more than once in the config file, fix this"))
            errors += 1
        if count == 0:
            if write_mode:
                print(color_white(f"Creating {config}"))
                add_config_not_set(config_file, config)
                fixes += 1
            else:
                print(color_red(f"{config} is neither enabled nor disabled in the config file"))
                errors += 1
    return errors, fixes


def _enable_required_configs(config_file: Path, configs: list[str], write_mode: bool) -> tuple[int, int]:
    """Enable configs that should be on."""
    errors = 0
    fixes = 0
    for config in configs:
        if is_config_enabled(config_file, config):
            print(color_green(f"{config} is already set"))
        else:
            if write_mode:
                print(color_white(f"Setting {config}"))
                enable_config(config_file, config)
                fixes += 1
            else:
                print(color_red(f"{config} is not set, set it"))
                errors += 1
    return errors, fixes


def _handle_eq_configs(config_file: Path, configs: list[str], write_mode: bool) -> tuple[int, int]:
    """Handle CONFIGS_EQ (equality checks)."""
    errors = 0
    fixes = 0
    for config in configs:
        if '=' not in config:
            continue
        lhs, rhs = config.split('=', 1)

        if is_config_set(config_file, config):
            print(color_green(f"{config} is already set correctly."))
            continue

        if is_config_set(config_file, lhs):
            cur = get_config_value(config_file, lhs)
            print(color_red(f"{lhs} is set, but to {cur} not {rhs}."))
            if write_mode:
                print(color_green(f"Setting {config} correctly"))
                content = config_file.read_text(encoding='utf-8')
                pattern = rf'^{re.escape(lhs)}=.*$'
                replacement = f'# {lhs} was {cur}\n{config}'
                new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
                config_file.write_text(new_content, encoding='utf-8')
                fixes += 1
        else:
            if write_mode:
                print(color_white(f"Setting {config}"))
                with open(config_file, 'a', encoding='utf-8') as f:
                    f.write(f"{config}\n")
                fixes += 1
            else:
                print(color_red(f"{config} is not set"))
                errors += 1
    return errors, fixes


def _disable_configs(config_file: Path, configs: list[str], write_mode: bool) -> tuple[int, int]:
    """Disable configs that should be off."""
    errors = 0
    fixes = 0
    for config in configs:
        if is_config_enabled(config_file, config):
            if write_mode:
                print(color_white(f"Unsetting {config}"))
                disable_config(config_file, config)
                fixes += 1
            else:
                print(color_red(f"{config} is set, unset it"))
                errors += 1
        else:
            print(color_green(f"{config} is already unset"))
    return errors, fixes


def main() -> None:
    """Main entry point for checking and configuring kernel options."""
    parser = argparse.ArgumentParser(description='Check and configure kernel options')
    parser.add_argument('config_file', help='Path to kernel config file')
    parser.add_argument('--type', '-t', required=True, choices=['lxc', 'nethunter'],
                        help='Configuration type: lxc or nethunter')
    parser.add_argument('-w', action='store_true', help='Write changes to config file')
    args = parser.parse_args()

    config_file = Path(args.config_file).resolve()

    if args.type not in TYPE_CONFIGS:
        print(f"Error: Unknown type '{args.type}'. Use 'lxc' or 'nethunter'.")
        sys.exit(1)

    type_config = TYPE_CONFIGS[args.type]

    if not config_file.is_relative_to(Path.cwd()):
        print("Error: Config file must be within the current directory")
        sys.exit(1)

    if not config_file.exists():
        print("Provide a config file as argument")
        sys.exit(1)

    configs_on = parse_configs(type_config["configs_on"])
    configs_off = parse_configs(type_config["configs_off"])
    configs_eq = parse_configs(type_config["configs_eq"])

    print(f"\n\n{type_config['check_message']}\n\n")

    total_errors = 0
    total_fixes = 0

    errors, fixes = _check_configs_exist(config_file, configs_on + configs_off, args.w)
    total_errors += errors
    total_fixes += fixes

    errors, fixes = _enable_required_configs(config_file, configs_on, args.w)
    total_errors += errors
    total_fixes += fixes

    errors, fixes = _handle_eq_configs(config_file, configs_eq, args.w)
    total_errors += errors
    total_fixes += fixes

    errors, fixes = _disable_configs(config_file, configs_off, args.w)
    total_errors += errors
    total_fixes += fixes

    if total_errors == 0:
        print(color_green("\n\nConfig file checked, found no errors.\n\n"))
    else:
        print(color_red(f"\n\nConfig file checked, found {total_errors} errors that I did not fix.\n\n"))

    if total_fixes > 0:
        print(color_green(f"{type_config['fix_message'].format(total_fixes)}\n\n"))


if __name__ == "__main__":
    main()
