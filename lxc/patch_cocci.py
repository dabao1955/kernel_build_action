#!/usr/bin/env python3
"""
Download and apply LXC Coccinelle patches to kernel source files.
Uses parallel downloads for efficiency.
"""

import subprocess
import sys
import shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from tempfile import TemporaryDirectory


REPO_URL = "https://github.com/dabao1955/kernel_build_action/raw/main/lxc"


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

    if not shutil.which("aria2c"):
        missing.append("aria2c")
    if not shutil.which("spatch"):
        missing.append("coccinelle")

    if missing:
        print(f"Error: Missing required dependencies: {' '.join(missing)}", file=sys.stderr)
        sys.exit(1)


def download_patch(patch_name: str, temp_dir: Path) -> Path:
    """Download a single patch file using aria2c."""
    url = f"{REPO_URL}/{patch_name}"
    output_path = temp_dir / patch_name

    try:
        subprocess.run(
            ["aria2c", "-d", str(temp_dir), "-o", patch_name, url],
            check=True,
            capture_output=True,
            text=True
        )
        return output_path
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to download {patch_name}: {e}") from e


def download_patches_parallel(patch_names: list[str], temp_dir: Path) -> dict[str, Path]:
    """Download multiple patches in parallel."""
    downloaded = {}

    with ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(download_patch, name, temp_dir): name
            for name in patch_names
        }

        for future in as_completed(futures):
            name = futures[future]
            try:
                path = future.result()
                downloaded[name] = path
                print(f"Downloaded {name}")
            except Exception as e:
                print(f"Error: {e}", file=sys.stderr)
                raise

    return downloaded


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
    """Main fcuntion."""
    kernel_src = Path.cwd()

    # Check dependencies
    check_dependencies()

    # Get patches configuration
    patches = get_patches(kernel_src)

    # Extract patch names
    patch_names = [p[0] for p in patches]

    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Download patches in parallel
        print("Downloading patches...")
        downloaded = download_patches_parallel(patch_names, temp_path)

        # Apply patches
        print("Applying patches...")
        for patch_name, target_file in patches:
            patch_file = downloaded[patch_name]
            try:
                apply_patch(patch_file, Path(target_file), kernel_src)
            except RuntimeError as e:
                print(f"Error: {e}", file=sys.stderr)
                sys.exit(1)

    print("All patches processed successfully")


if __name__ == "__main__":
    main()
