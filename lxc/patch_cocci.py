#!/usr/bin/env python3
"""
Apply LXC Coccinelle patches to kernel source files.
"""

import argparse
import subprocess
import sys
import shutil
from pathlib import Path


def find_cgroup_file(kernel_src: Path) -> str:
    """Determine the cgroup file path based on kernel version."""
    cgroup_old = kernel_src / "kernel" / "cgroup.c"
    if cgroup_old.exists():
        content = cgroup_old.read_text(encoding='utf-8')
        if "int cgroup_add_file" in content:
            return "kernel/cgroup.c"
    return "kernel/cgroup/cgroup.c"


def get_patches(kernel_src: Path) -> list[tuple[str, str]]:
    """Get list of patches with their target files."""
    cgroup = find_cgroup_file(kernel_src)
    return [
        ("cgroup.cocci", cgroup),
        ("xt_qtaguid.cocci", "net/netfilter/xt_qtaguid.c")
    ]


def check_dependencies() -> None:
    """Check that required dependencies are installed."""
    missing = []

    if not shutil.which("spatch"):
        missing.append("coccinelle")

    if missing:
        print(f"Error: Missing required dependencies: {' '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def apply_patch(patch_file: Path, target_file: Path, kernel_src: Path) -> None:
    """Apply a single Coccinelle patch."""
    target_path = kernel_src / target_file

    if not target_path.exists():
        raise RuntimeError(f"Target file not found: {target_path}")

    print(f"Applying {patch_file.name} to {target_file}")

    try:
        subprocess.run(
            ["spatch", "--in-place", "--sp-file", str(patch_file), str(target_path)],
            check=True,
            capture_output=True,
            text=True
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to apply {patch_file.name}: {e}") from e


def main() -> None:
    """Main entry point for applying LXC Coccinelle patches."""
    parser = argparse.ArgumentParser(description='Apply LXC Coccinelle patches')
    parser.add_argument('--cocci-dir', required=True, help='Directory containing local cocci files')
    args = parser.parse_args()

    cocci_dir = Path(args.cocci_dir)
    kernel_src = Path.cwd()

    check_dependencies()

    patches = get_patches(kernel_src)

    print("Applying patches...")
    for patch_name, target_file in patches:
        patch_file = cocci_dir / patch_name
        if not patch_file.exists():
            print(f"Error: cocci file not found: {patch_file}", file=sys.stderr)
            sys.exit(1)
        try:
            apply_patch(patch_file, Path(target_file), kernel_src)
        except RuntimeError as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)

    print("All patches processed successfully")


if __name__ == "__main__":
    main()
