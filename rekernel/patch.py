#!/usr/bin/env python3
"""
Download and apply Re:Kernel patches to kernel source.
Includes Coccinelle patches for C files and sed for config files.
"""

import subprocess
import sys
import shutil
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory


REPO_BASE = "https://github.com/dabao1955/kernel_build_action/raw/main/rekernel"
PATCHES_BASE = "https://raw.githubusercontent.com/dabao1955/kernel_build_action/main/rekernel/patches"


def run_command(cmd: list[str], cwd: Path | None = None, check: bool = True) -> None:
    """Run a shell command."""
    try:
        subprocess.run(cmd, cwd=cwd, check=check, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"Command failed: {' '.join(cmd)}", file=sys.stderr)
        print(f"Error: {e.stderr}", file=sys.stderr)
        if check:
            sys.exit(1)


def download_file(url: str, output_dir: Path, filename: str | None = None) -> Path:
    """Download a file using aria2c."""
    if filename:
        output_path = output_dir / filename
        run_command(["aria2c", "-d", str(output_dir), "-o", filename, url])
        return output_path
    run_command(["aria2c", url], cwd=output_dir)
    return output_dir / url.split('/')[-1]


def has_proc_ops(kernel_src: Path) -> bool:
    """Check if kernel uses proc_ops structure."""
    proc_fs = kernel_src / "include" / "linux" / "proc_fs.h"
    if not proc_fs.exists():
        return False
    return "struct proc_ops" in proc_fs.read_text(encoding='utf-8')


def check_binder_function(binder_file: Path) -> bool:
    """Check if binder.c contains the expected function signature."""
    if not binder_file.exists():
        return False
    content = binder_file.read_text(encoding='utf-8')
    return "binder_proc_transaction() - sends a transaction to a process and wakes it up" in content


def apply_cocci_patch(cocci_file: Path, target_file: Path) -> None:
    """Apply a Coccinelle patch to a file."""
    if not target_file.exists():
        print(f"Warning: Target file not found: {target_file}")
        return

    print(f"Applying {cocci_file.name} to {target_file}")
    run_command([
        "spatch", "--in-place", "--sp-file", str(cocci_file), str(target_file)
    ], check=False)  # Continue on error like original script


def check_rekernel_present(file_path: Path) -> bool:
    """Check if file already contains Re:Kernel configuration."""
    if not file_path.exists():
        return False
    content = file_path.read_text(encoding='utf-8')
    return "rekernel" in content.lower()


def add_defconfig_rekernel(defconfig: Path) -> None:
    """Add Re:Kernel config options to defconfig."""
    with open(defconfig, 'a', encoding='utf-8') as f:
        f.write("\nCONFIG_REKERNEL=y\n")
        f.write("CONFIG_REKERNEL_NETWORK=n\n")


def add_config_rekernel(config_path: Path) -> None:
    """Add Re:Kernel config options to the specified config file."""
    with open(config_path, 'a', encoding='utf-8') as f:
        f.write("\nCONFIG_REKERNEL=y\n")
        f.write("CONFIG_REKERNEL_NETWORK=n\n")


def add_kconfig_rekernel(kconfig: Path) -> None:
    """Add Re:Kernel source to drivers/Kconfig."""
    if not kconfig.exists():
        return

    content = kconfig.read_text(encoding='utf-8')

    # Check if already present
    if 'source "drivers/rekernel/Kconfig"' in content:
        return

    # Find the last endmenu and insert before it
    lines = content.split('\n')
    endmenu_indices = [i for i, line in enumerate(lines) if line.strip() == "endmenu"]

    if endmenu_indices:
        # Insert before the last endmenu
        insert_pos = endmenu_indices[-1]
        lines.insert(insert_pos, 'source "drivers/rekernel/Kconfig"')
    else:
        # Append to end
        lines.append('source "drivers/rekernel/Kconfig"')

    kconfig.write_text('\n'.join(lines), encoding='utf-8')


def add_makefile_rekernel(makefile: Path) -> None:
    """Add Re:Kernel to drivers/Makefile."""
    if not makefile.exists():
        return

    content = makefile.read_text(encoding='utf-8')

    # Check if already present
    if "obj-$(CONFIG_REKERNEL) += rekernel/" in content:
        return

    with open(makefile, 'a', encoding='utf-8') as f:
        f.write("\nobj-$(CONFIG_REKERNEL) += rekernel/\n")

def safe_extract(zip_file: zipfile.ZipFile, extract_path: Path) -> None:
    """
    Safely extract zip file contents, preventing ZipSlip attacks.
    Validates that all extracted files stay within the target directory.
    """
    extract_path_resolved = extract_path.resolve()
    for member in zip_file.namelist():
        member_path = (extract_path / member).resolve()

        # Check for path traversal attempts
        if extract_path_resolved != member_path and extract_path_resolved not in member_path.parents:
            raise ValueError(f"ZipSlip attack detected: {member} attempts to escape target directory")

        # Create parent directories if needed
        if member.endswith('/'):
            member_path.mkdir(parents=True, exist_ok=True)
        else:
            member_path.parent.mkdir(parents=True, exist_ok=True)
            # Extract the member
            with zip_file.open(member) as src, open(member_path, 'wb') as dst:
                shutil.copyfileobj(src, dst)

def main() -> None:
    """Main entry point for applying Re:Kernel patches."""
    kernel_src = Path.cwd()

    config_path = None
    _arch = "arm64"  # Reserved for future architecture-specific config selection

    if len(sys.argv) > 1:
        for i in range(1, len(sys.argv)):
            if sys.argv[i] == '--config' and i + 1 < len(sys.argv):
                config_path = Path(sys.argv[i + 1])
            elif sys.argv[i] == '--arch' and i + 1 < len(sys.argv):
                _arch = sys.argv[i + 1]

    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        cocci_dir = temp_path / "cocci"
        cocci_dir.mkdir()

        # Download source and patches
        print("Downloading Re:Kernel source and patches...")
        download_file(f"{REPO_BASE}/src.zip", temp_path)
        download_file(f"{PATCHES_BASE}/proc_ops.cocci", cocci_dir)
        download_file(f"{PATCHES_BASE}/binder.cocci", cocci_dir)
        download_file(f"{PATCHES_BASE}/signal.cocci", cocci_dir)

        # Extract source
        print("Extracting source...")
        src_zip = temp_path / "src.zip"
        with zipfile.ZipFile(src_zip, 'r') as z:
            safe_extract(z, temp_path)

        # Move rekernel to drivers/
        rekernel_src = temp_path / "rekernel"
        rekernel_dst = kernel_src / "drivers" / "rekernel"
        if rekernel_dst.exists():
            shutil.rmtree(rekernel_dst)
        shutil.move(str(rekernel_src), str(rekernel_dst))
        print(f"Moved rekernel to {rekernel_dst}")

        # Apply Coccinelle patches to C files
        rekernel_file = rekernel_dst / "rekernel.c"

        if has_proc_ops(kernel_src):
            apply_cocci_patch(cocci_dir / "proc_ops.cocci", rekernel_file)

        patch_files = [
            (cocci_dir / "binder.cocci", kernel_src / "drivers" / "android" / "binder.c"),
            (cocci_dir / "signal.cocci", kernel_src / "kernel" / "signal.c"),
        ]

        for cocci_file, target_file in patch_files:
            if not target_file.exists():
                print(f"Warning: {target_file} not found, skipping")
                continue

            if cocci_file.name == "binder.cocci":
                if not check_binder_function(target_file):
                    print(f"Error: Could not find 'binder_proc_transaction()' in '{target_file}'")
                    continue

            apply_cocci_patch(cocci_file, target_file)

        # Handle config files with Python equivalents of sed operations
        print("Configuring kernel build files...")

        patch_configs = []

        if config_path:
            patch_configs.append(config_path)
            print(f"Using user-specified config: {config_path}")

        patch_configs.extend([
            kernel_src / "drivers" / "Kconfig",
            kernel_src / "drivers" / "Makefile",
        ])

        for config_file in patch_configs:
            if not config_file.exists():
                print(f"Warning: '{config_file}' does not exist, skipping")
                continue

            if check_rekernel_present(config_file):
                print(f"Warning: '{config_file}' contains Re:Kernel")
                continue

            if config_file.name.endswith('_defconfig') or config_file.name == 'defconfig':
                add_config_rekernel(config_file)
                print(f"Updated {config_file}")
            elif config_file.name == "Kconfig":
                add_kconfig_rekernel(config_file)
                print(f"Updated {config_file}")
            elif config_file.name == "Makefile":
                add_makefile_rekernel(config_file)
                print(f"Updated {config_file}")

    print("Re:Kernel patches applied successfully!")


if __name__ == "__main__":
    main()
