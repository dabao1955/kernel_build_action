#!/usr/bin/env bash

set -euo

sp_file="minimal.cocci"
#sp_file="classic.cocci"

aria2c https://github.com/dabao1955/kernel_build_action/raw/main/kernelsu/"$sp_file"

# Files declared as patched in the cocci file
files="$(grep -Po 'file in "\K[^"]+' "$sp_file" | sort | uniq)"

while IFS= read -r p; do
    spatch --very-quiet --sp-file "$sp_file" --in-place --linux-spacing "$p" || true
done << EOF
$files
EOF
