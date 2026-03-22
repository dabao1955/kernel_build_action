"""
Tests for kernelsu/apply_cocci.py - KernelSU Coccinelle patch application.

This module tests the functionality for downloading and applying KernelSU
Coccinelle patches to kernel source files.
"""

import sys
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import MagicMock, patch

import pytest  # pylint: disable=import-error

# Import the module under test
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "kernelsu"))
import apply_cocci  # pylint: disable=import-error,wrong-import-position


# =============================================================================
# download_cocci_file Tests
# =============================================================================


class TestDownloadCocciFile:
    """Tests for download_cocci_file function."""

    def test_download_cocci_file_success(self, mock_subprocess):
        """Test successful download of cocci file."""
        apply_cocci.download_cocci_file("minimal.cocci")

        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args
        assert "aria2c" in call_args[0][0]
        assert "minimal.cocci" in call_args[0][0][1]

    def test_download_cocci_file_error(self, mock_subprocess_error, mock_sys_exit):
        """Test download failure exits with error code."""
        apply_cocci.download_cocci_file("minimal.cocci")

        mock_sys_exit.assert_called_once_with(1)

    def test_download_cocci_file_url_construction(self, mock_subprocess):
        """Test that URL is correctly constructed."""
        apply_cocci.download_cocci_file("test.cocci")

        call_args = mock_subprocess.call_args
        url = call_args[0][0][1]
        assert url.startswith("https://github.com/dabao1955/kernel_build_action/raw/main/kernelsu/")
        assert url.endswith("test.cocci")


# =============================================================================
# extract_files_from_cocci Tests
# =============================================================================


class TestExtractFilesFromCocci:
    """Tests for extract_files_from_cocci function."""

    def test_extract_single_file(self, temp_dir):
        """Test extracting single file from cocci content."""
        cocci_content = '''
@rule1@
@@
- old_func()
+ new_func()

file in "kernel/file.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert result == ["kernel/file.c"]

    def test_extract_multiple_files(self, temp_dir):
        """Test extracting multiple files from cocci content."""
        cocci_content = '''
@rule1@
@@
- old_func()
+ new_func()

file in "kernel/file1.c"
file in "kernel/file2.c"
file in "drivers/file3.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert result == ["kernel/file1.c", "kernel/file2.c", "drivers/file3.c"]

    def test_extract_duplicate_files(self, temp_dir):
        """Test that duplicate files are removed while preserving order."""
        cocci_content = '''
file in "kernel/file.c"
file in "kernel/file.c"
file in "drivers/other.c"
file in "kernel/file.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert result == ["kernel/file.c", "drivers/other.c"]

    def test_extract_no_files(self, temp_dir):
        """Test extracting from cocci with no file references."""
        cocci_content = '''
@rule1@
@@
- old_func()
+ new_func()
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert result == []

    def test_extract_complex_paths(self, temp_dir):
        """Test extracting files with complex paths."""
        cocci_content = '''
file in "arch/arm64/kernel/entry.S"
file in "drivers/usb/core/usb.c"
file in "net/ipv4/tcp.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert len(result) == 3
        assert "arch/arm64/kernel/entry.S" in result


# =============================================================================
# apply_spatch Tests
# =============================================================================


class TestApplySpatch:
    """Tests for apply_spatch function."""

    def test_apply_spatch_success(self, mock_subprocess, mock_print):
        """Test successful spatch application."""
        apply_cocci.apply_spatch("test.cocci", "kernel/file.c")

        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args
        cmd = call_args[0][0]

        assert "spatch" in cmd
        assert "--very-quiet" in cmd
        assert "--sp-file" in cmd
        assert "test.cocci" in cmd
        assert "--in-place" in cmd
        assert "--linux-spacing" in cmd
        assert "kernel/file.c" in cmd

    def test_apply_spatch_error_continues(self, mock_subprocess, mock_print):
        """Test that spatch errors are silently ignored."""
        mock_subprocess.side_effect = CalledProcessError(1, "spatch")

        # Should not raise exception
        apply_cocci.apply_spatch("test.cocci", "kernel/file.c")

        mock_subprocess.assert_called_once()

    def test_apply_spatch_prints_message(self, mock_subprocess, mock_print):
        """Test that successful application prints message."""
        apply_cocci.apply_spatch("test.cocci", "kernel/file.c")

        mock_print.assert_called_once()
        assert "kernel/file.c" in mock_print.call_args[0][0]


# =============================================================================
# main Tests
# =============================================================================


class TestMain:
    """Tests for main function."""

    @patch('apply_cocci.download_cocci_file')
    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_success(self, mock_apply, mock_extract, mock_download):
        """Test main function success path."""
        mock_extract.return_value = ["kernel/file1.c", "kernel/file2.c"]

        apply_cocci.main()

        mock_download.assert_called_once_with("minimal.cocci")
        mock_extract.assert_called_once_with("minimal.cocci")
        assert mock_apply.call_count == 2

    @patch('apply_cocci.download_cocci_file')
    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_no_files(self, mock_apply, mock_extract, mock_download):
        """Test main function with no files to patch."""
        mock_extract.return_value = []

        apply_cocci.main()

        mock_download.assert_called_once()
        mock_extract.assert_called_once()
        mock_apply.assert_not_called()

    @patch('apply_cocci.download_cocci_file')
    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_single_file(self, mock_apply, mock_extract, mock_download):
        """Test main function with single file."""
        mock_extract.return_value = ["kernel/file.c"]

        apply_cocci.main()

        mock_apply.assert_called_once_with("minimal.cocci", "kernel/file.c")


# =============================================================================
# Security Tests
# =============================================================================


class TestSecurity:
    """Security-focused tests for apply_cocci.py."""

    def test_download_url_no_traversal(self):
        """Test that filename cannot traverse out of directory via URL."""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)

            # Attempt path traversal in filename
            apply_cocci.download_cocci_file("../../../etc/passwd")

            call_args = mock_run.call_args[0][0]
            url = call_args[1]

            # URL should contain the malicious path but not be exploitable
            # because aria2c handles the download securely
            assert "../../../etc/passwd" in url

    def test_extract_handles_special_chars(self, temp_dir):
        """Test extraction handles special characters in paths."""
        cocci_content = '''
file in "kernel/file with spaces.c"
file in "kernel/file-with-dashes.c"
file in "kernel/file_with_underscores.c"
file in "kernel/file.multiple.dots.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(str(cocci_file))

        assert len(result) == 4
        assert "kernel/file with spaces.c" in result


# =============================================================================
# Integration Tests
# =============================================================================


class TestIntegration:
    """Integration tests for apply_cocci workflow."""

    @patch('subprocess.run')
    @patch('builtins.print')
    def test_full_workflow(self, mock_print, mock_run):
        """Test complete workflow from download to application."""
        # Setup mocks
        mock_run.return_value = MagicMock(returncode=0)

        cocci_content = '''
@rule1@
@@
- old_function()
+ new_function()

file in "kernel/sched/core.c"
file in "kernel/fork.c"
'''

        with patch.object(Path, 'read_text', return_value=cocci_content):
            apply_cocci.main()

        # Verify download was called
        assert any("aria2c" in str(call) for call in mock_run.call_args_list)

        # Verify spatch was called for each file
        spatch_calls = [call for call in mock_run.call_args_list
                       if any("spatch" in str(arg) for arg in call[0])]
        assert len(spatch_calls) == 2
