#!/usr/bin/env python3
"""
Apply KernelSU SELinux destatic Coccinelle patches to kernel source files.
"""

import argparse
import sys
from pathlib import Path

from apply_cocci import apply_spatch as run_spatch, extract_files_from_cocci


def parse_kernel_version(value: str) -> tuple[int, int]:
    """Parse a X.Y kernel version string into (version, patchlevel)."""
    parts = value.split(".")
    if len(parts) < 2:
        print(f"Error: invalid kernel version: {value}", file=sys.stderr)
        sys.exit(1)
    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        print(f"Error: invalid kernel version: {value}", file=sys.stderr)
        sys.exit(1)


def is_below(version: int, patchlevel: int, major: int, minor: int) -> bool:
    """Return True when version.patchlevel is strictly below major.minor."""
    return version < major or (version == major and patchlevel < minor)


def select_cocci_files(version: int, patchlevel: int) -> list[str]:
    """Select destatic cocci files for the given kernel version."""
    files = ["selinux.cocci"]
    if is_below(version, patchlevel, 5, 15):
        files.append("selinux_lt_5_15.cocci")
    if is_below(version, patchlevel, 4, 19):
        files.append("selinux_lt_4_19.cocci")
    return files


def apply_spatch(cocci_file: Path, target_file: str) -> None:
    """Apply spatch, skipping targets that are absent from this tree."""
    if not Path(target_file).exists():
        print(f"Skipping missing {target_file}")
        return
    run_spatch(cocci_file, target_file)


def main() -> None:
    """Main entry point for applying SELinux destatic Coccinelle patches."""
    parser = argparse.ArgumentParser(description='Apply KernelSU SELinux destatic patches')
    parser.add_argument('--cocci-dir', required=True, help='Directory containing local cocci files')
    parser.add_argument('--kernel-version', required=True, help='Kernel version in X.Y form')
    args = parser.parse_args()

    version, patchlevel = parse_kernel_version(args.kernel_version)
    cocci_dir = Path(args.cocci_dir)

    for name in select_cocci_files(version, patchlevel):
        sp_file = cocci_dir / name
        if not sp_file.exists():
            print(f"Error: cocci file not found: {sp_file}", file=sys.stderr)
            sys.exit(1)
        for file_path in extract_files_from_cocci(sp_file):
            apply_spatch(sp_file, file_path)


if __name__ == "__main__":
    main()
