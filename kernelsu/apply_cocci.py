#!/usr/bin/env python3
"""
Apply KernelSU Coccinelle patches to kernel source files.
"""

import argparse
import subprocess
import sys
import re
from pathlib import Path


def extract_files_from_cocci(cocci_file: Path) -> list[str]:
    """Extract file paths from the cocci file."""
    content = cocci_file.read_text(encoding='utf-8')
    matches = re.findall(r'file in "([^"]+)"', content)
    return list(dict.fromkeys(matches))


def apply_spatch(cocci_file: Path, target_file: str) -> None:
    """Apply spatch to a single file."""
    try:
        subprocess.run(
            [
                "spatch",
                "--very-quiet",
                "--sp-file", str(cocci_file),
                "--in-place",
                "--linux-spacing",
                target_file
            ],
            check=True,
            capture_output=True,
            text=True
        )
        print(f"Applied patch to {target_file}")
    except subprocess.CalledProcessError:
        pass


def main() -> None:
    """Main entry point for applying KernelSU Coccinelle patches."""
    parser = argparse.ArgumentParser(description='Apply KernelSU Coccinelle patches')
    parser.add_argument('--cocci-dir', required=True, help='Directory containing local cocci files')
    args = parser.parse_args()

    cocci_dir = Path(args.cocci_dir)
    sp_file = cocci_dir / "minimal.cocci"

    if not sp_file.exists():
        print(f"Error: cocci file not found: {sp_file}", file=sys.stderr)
        sys.exit(1)

    files = extract_files_from_cocci(sp_file)

    for file_path in files:
        apply_spatch(sp_file, file_path)


if __name__ == "__main__":
    main()
