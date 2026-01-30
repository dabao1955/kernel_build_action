#!/usr/bin/env python3
import os
import sys
import glob
import subprocess
import argparse
from pathlib import Path

DEFAULT_KDIR = "."
DEFAULT_PATCH_DIR = "./t/patches"

def info(msg):
    print(f"[INFO] {msg}", file=sys.stderr)

def warn(msg):
    print(f"[WARN] {msg}", file=sys.stderr)

def error(msg):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)

def parse_makefile_version(makefile_path):
    version = None
    patchlevel = None
    try:
        with open(makefile_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if line.startswith('VERSION'):
                    version = line.split('=', 1)[1].strip()
                elif line.startswith('PATCHLEVEL'):
                    patchlevel = line.split('=', 1)[1].strip()
                if version is not None and patchlevel is not None:
                    break
    except Exception as e:
        error(f"Failed to read Makefile: {e}")

    if version is None or patchlevel is None:
        error("Could not find VERSION and/or PATCHLEVEL in Makefile")

    return f"{version}.{patchlevel}"

def detect_suffix(kdir: Path):
    localversion = os.environ.get("LOCALVERSION", "").strip()
    if localversion:
        return localversion

    for lv_file in kdir.glob("localversion-*"):
        if lv_file.is_file():
            suffix = lv_file.name[len("localversion-"):]
            if suffix:
                return f"_{suffix}"

    config_path = kdir / ".config"
    if config_path.is_file():
        try:
            with open(config_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    if line.startswith("CONFIG_LOCALVERSION="):
                        if '"' in line:
                            value = line.split('"', 2)[1]
                            if value:
                                if value.startswith("-"):
                                    return value.replace("-", "_", 1)
                                else:
                                    return f"_{value}"
                        break
        except Exception:
            pass  # ignore .config parse errors

    return ""

def find_patch_dir(patch_dir: Path, base_ver: str, suffix: str):
    candidates = []
    if suffix:
        candidates.append(base_ver + suffix)
    candidates.append(base_ver)

    for cand in candidates:
        d = patch_dir / cand
        if d.is_dir():
            return d

    error(f"No patch directory found for kernel {base_ver}{suffix}\nTried: {candidates}")

def apply_patch(kdir: Path, patch_file: Path, dry_run_only: bool):
    info(f"Testing: {patch_file}")
    cmd = ["patch", "-d", str(kdir), "-p1", "--dry-run"]
    try:
        with open(patch_file, 'rb') as f:
            result = subprocess.run(cmd, stdin=f, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode != 0:
            raise subprocess.CalledProcessError(result.returncode, cmd)
    except Exception:
        skip_failed = os.environ.get("SKIP_FAILED", "false").lower() == "true"
        if skip_failed:
            warn(f"Skipped failed patch: {patch_file}")
            return
        else:
            error(f"Patch dry-run failed: {patch_file}")

    if not dry_run_only:
        info(f"Applying: {patch_file}")
        cmd_apply = ["patch", "-d", str(kdir), "-p1"]
        try:
            with open(patch_file, 'rb') as f:
                subprocess.run(cmd_apply, stdin=f, check=True)
        except Exception as e:
            error(f"Failed to apply patch {patch_file}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Apply kernel patches in CI mode")
    parser.add_argument("--kdir", default=DEFAULT_KDIR, help="Kernel source directory (default: .)")
    parser.add_argument("--patch-dir", default=DEFAULT_PATCH_DIR, help="Patch directory (default: ./patches)")
    parser.add_argument("--dry-run-only", action="store_true", help="Only test patches, do not apply")
    args = parser.parse_args()

    kdir = Path(args.kdir).resolve()
    patch_dir = Path(args.patch_dir).resolve()
    os.system("git clone https://gitlab.com/kalilinux/nethunter/build-scripts/kali-nethunter-kernel t --depth=1")

    if not (kdir / "Makefile").is_file():
        error(f"Makefile not found in {kdir}")

    if not patch_dir.is_dir():
        error(f"Patch directory not found: {patch_dir}")

    base_ver = parse_makefile_version(kdir / "Makefile")
    suffix = detect_suffix(kdir)

    info(f"Kernel version: {base_ver}")
    if suffix:
        info(f"Variant suffix: {suffix}")

    target_dir = find_patch_dir(patch_dir, base_ver, suffix)
    info(f"Using patch directory: {target_dir}")

    patch_files = []
    for ext in ("*.patch", "*.diff"):
        patch_files.extend(target_dir.rglob(ext))

    if not patch_files:
        info(f"No patch files found in {target_dir}")
        return

    info(f"Applying {len(patch_files)} patch(es)...")

    dry_run_only = args.dry_run_only or os.environ.get("DRY_RUN_ONLY", "false").lower() == "true"

    for pf in sorted(patch_files):
        apply_patch(kdir, pf, dry_run_only)

    info("All patches applied successfully.")

if __name__ == "__main__":
    main()
