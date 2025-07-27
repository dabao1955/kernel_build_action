#!/usr/bin/env bash

# Set strict mode
set -euo pipefail
IFS=$'\n\t'

# Configuration
readonly REPO_URL="https://github.com/dabao1955/kernel_build_action/raw/main/kernelsu/patches"

# Define patches array
declare -ra PATCHES=(
    "selinux_hooks_bprm_creds.cocci:security/selinux/hooks.c"
    "execveat.cocci:fs/exec.c"
    "faccessat.cocci:fs/open.c"
    "vfs_read.cocci:fs/read_write.c"
    "vfs_statx.cocci:fs/stat.c"
    "path_umount.cocci:fs/namespace.c"
    "input_handle_event.cocci:drivers/input/input.c"
    "devpts_get_priv.cocci:fs/devpts/inode.c"
)

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl > /dev/null 2>&1; then
        missing_deps+=("curl")
    fi
    
    if ! command -v spatch > /dev/null 2>&1; then
        missing_deps+=("coccinelle")
    fi
    
    if (( ${#missing_deps[@]} > 0 )); then
        echo "Error: Missing required dependencies: ${missing_deps[*]}" >&2
        exit 1
    fi
}

# Download single patch
download_patch() {
    local patch_name="$1"
    local url="$REPO_URL/$patch_name"
    
    if ! curl -sSfL "$url" -o "$patch_name" 2>/dev/null; then
        echo "Error: Failed to download $patch_name" >&2
        return 1
    fi
}

# Apply single patch
apply_patch() {
    local patch_file="$1"
    local target_file="$2"
    local target_path="$KERNEL_SRC/$target_file"
    
    if [[ ! -f "$target_path" ]]; then
        echo "Warning: Target file not found: $target_path" >&2
        return 1
    fi
    
    echo "Applying $patch_file to $target_file"
    if ! spatch --sp-file "$patch_file" "$target_path" > /dev/null 2>&1; then
        echo "Error: Failed to apply $patch_file" >&2
        return 1
    fi
}

# Main execution
main() {
    src="$(pwd)"
    readonly KERNEL_SRC="$src"

    # Check dependencies
    check_dependencies

    # Create temporary directory for downloads
    local temp_dir
    temp_dir="$(mktemp -d)"
    cd "$temp_dir" || exit 1

    # Extract patch names for parallel download
    local patch_names=()
    for patch_entry in "${PATCHES[@]}"; do
        patch_names+=("${patch_entry%%:*}")
    done

    # Download patches sequentially instead of using parallel
    echo "Downloading patches..."
    for patch_name in "${patch_names[@]}"; do
        if ! download_patch "$patch_name"; then
            echo "Error: Failed to download patches" >&2
            rm -rf "$temp_dir"
            exit 1
        fi
    done

    # Apply patches
    echo "Applying patches..."
    for patch_entry in "${PATCHES[@]}"; do
        patch_file="${patch_entry%%:*}"
        target_file="${patch_entry#*:}"

        if ! apply_patch "$patch_file" "$target_file"; then
            echo "Error: Failed to process $patch_file" >&2
            rm -rf "$temp_dir"
            exit 1
        fi
    done

    # Cleanup
    rm -rf "$temp_dir"
    echo "All patches processed successfully"
}

# Run main function with provided arguments
main "$@"
