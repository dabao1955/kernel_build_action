"""
Tests for kernelsu/apply_cocci.py - KernelSU Coccinelle patch application.

This module tests the functionality for applying KernelSU Coccinelle
patches to kernel source files using local cocci files.
"""

import sys
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "kernelsu"))
import apply_cocci


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

        result = apply_cocci.extract_files_from_cocci(cocci_file)

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

        result = apply_cocci.extract_files_from_cocci(cocci_file)

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

        result = apply_cocci.extract_files_from_cocci(cocci_file)

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

        result = apply_cocci.extract_files_from_cocci(cocci_file)

        assert not result

    def test_extract_complex_paths(self, temp_dir):
        """Test extracting files with complex paths."""
        cocci_content = '''
file in "arch/arm64/kernel/entry.S"
file in "drivers/usb/core/usb.c"
file in "net/ipv4/tcp.c"
'''
        cocci_file = temp_dir / "test.cocci"
        cocci_file.write_text(cocci_content)

        result = apply_cocci.extract_files_from_cocci(cocci_file)

        assert len(result) == 3
        assert "arch/arm64/kernel/entry.S" in result


# =============================================================================
# apply_spatch Tests
# =============================================================================


class TestApplySpatch:
    """Tests for apply_spatch function."""

    def test_apply_spatch_success(self, mock_subprocess, mock_print):
        """Test successful spatch application."""
        apply_cocci.apply_spatch(Path("test.cocci"), "kernel/file.c")

        mock_subprocess.assert_called_once()
        call_args = mock_subprocess.call_args
        cmd = call_args[0][0]

        assert "spatch" in cmd
        assert "--very-quiet" in cmd
        assert "--sp-file" in cmd
        assert "--in-place" in cmd
        assert "--linux-spacing" in cmd
        assert "kernel/file.c" in cmd

    def test_apply_spatch_error_continues(self, mock_subprocess, mock_print):
        """Test that spatch errors are silently ignored."""
        mock_subprocess.side_effect = CalledProcessError(1, "spatch")

        apply_cocci.apply_spatch(Path("test.cocci"), "kernel/file.c")

        mock_subprocess.assert_called_once()

    def test_apply_spatch_prints_message(self, mock_subprocess, mock_print):
        """Test that successful application prints message."""
        apply_cocci.apply_spatch(Path("test.cocci"), "kernel/file.c")

        mock_print.assert_called_once()
        assert "kernel/file.c" in mock_print.call_args[0][0]


# =============================================================================
# main Tests
# =============================================================================


class TestMain:
    """Tests for main function."""

    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_success(self, mock_apply, mock_extract):
        """Test main function success path."""
        mock_extract.return_value = ["kernel/file1.c", "kernel/file2.c"]

        with patch('sys.argv', ['apply_cocci.py', '--cocci-dir', '/fake/dir']):
            with patch.object(Path, 'exists', return_value=True):
                apply_cocci.main()

        mock_extract.assert_called_once()
        assert mock_apply.call_count == 2

    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_no_files(self, mock_apply, mock_extract):
        """Test main function with no files to patch."""
        mock_extract.return_value = []

        with patch('sys.argv', ['apply_cocci.py', '--cocci-dir', '/fake/dir']):
            with patch.object(Path, 'exists', return_value=True):
                apply_cocci.main()

        mock_extract.assert_called_once()
        mock_apply.assert_not_called()

    @patch('apply_cocci.extract_files_from_cocci')
    @patch('apply_cocci.apply_spatch')
    def test_main_single_file(self, mock_apply, mock_extract):
        """Test main function with single file."""
        mock_extract.return_value = ["kernel/file.c"]

        with patch('sys.argv', ['apply_cocci.py', '--cocci-dir', '/fake/dir']):
            with patch.object(Path, 'exists', return_value=True):
                apply_cocci.main()

        mock_apply.assert_called_once()

    def test_main_missing_cocci_dir(self):
        """Test main exits when cocci file not found."""
        with patch('sys.argv', ['apply_cocci.py', '--cocci-dir', '/nonexistent']):
            with pytest.raises(SystemExit):
                apply_cocci.main()


# =============================================================================
# Security Tests
# =============================================================================


class TestSecurity:
    """Security-focused tests for apply_cocci.py."""

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

        result = apply_cocci.extract_files_from_cocci(cocci_file)

        assert len(result) == 4
        assert "kernel/file with spaces.c" in result

    def test_no_remote_download(self):
        """Test that module does not expose any download functions."""
        assert not hasattr(apply_cocci, 'download_cocci_file')
        assert not hasattr(apply_cocci, 'REPO_URL')


# =============================================================================
# Integration Tests
# =============================================================================


class TestIntegration:
    """Integration tests for apply_cocci workflow."""

    @patch('subprocess.run')
    @patch('builtins.print')
    def test_full_workflow(self, mock_print, mock_run, temp_dir):
        """Test complete workflow from reading local file to application."""
        mock_run.return_value = MagicMock(returncode=0)

        cocci_content = '''
@rule1@
@@
- old_function()
+ new_function()

file in "kernel/sched/core.c"
file in "kernel/fork.c"
'''
        cocci_dir = temp_dir / "cocci"
        cocci_dir.mkdir()
        cocci_file = cocci_dir / "minimal.cocci"
        cocci_file.write_text(cocci_content)

        with patch('sys.argv', ['apply_cocci.py', '--cocci-dir', str(cocci_dir)]):
            apply_cocci.main()

        spatch_calls = [call for call in mock_run.call_args_list
                       if any("spatch" in str(arg) for arg in call[0])]
        assert len(spatch_calls) == 2
