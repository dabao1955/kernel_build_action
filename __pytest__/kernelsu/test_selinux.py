"""
Tests for kernelsu/selinux.py - KernelSU SELinux destatic Coccinelle patches.
"""

import sys
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "kernelsu"))
import selinux  # pylint: disable=wrong-import-position


class TestParseKernelVersion:
    """Tests for parse_kernel_version."""

    def test_parses_major_minor(self):
        """Test parsing a two-component version."""
        assert selinux.parse_kernel_version("4.14") == (4, 14)

    def test_parses_three_component_version(self):
        """Test that a third component is ignored."""
        assert selinux.parse_kernel_version("5.15.100") == (5, 15)

    def test_rejects_single_component(self):
        """Test that a bare major version exits."""
        with pytest.raises(SystemExit):
            selinux.parse_kernel_version("4")

    def test_rejects_non_numeric(self):
        """Test that a non-numeric version exits."""
        with pytest.raises(SystemExit):
            selinux.parse_kernel_version("x.y")


class TestIsBelow:
    """Tests for is_below."""

    def test_lower_major(self):
        """Test a strictly lower major version."""
        assert selinux.is_below(4, 19, 5, 15)

    def test_same_major_lower_minor(self):
        """Test the same major with a lower patchlevel."""
        assert selinux.is_below(5, 10, 5, 15)

    def test_equal_is_not_below(self):
        """Test that an equal version is not below the threshold."""
        assert not selinux.is_below(5, 15, 5, 15)

    def test_higher_is_not_below(self):
        """Test that a higher version is not below the threshold."""
        assert not selinux.is_below(5, 16, 5, 15)


class TestSelectCocciFiles:
    """Tests for select_cocci_files."""

    def test_modern_kernel_only_base(self):
        """Test 5.15 and above only get the unconditional destatic patch."""
        assert selinux.select_cocci_files(5, 15) == ["selinux.cocci"]

    def test_below_5_15(self):
        """Test kernels below 5.15 also get the 5.15-gated patch."""
        assert selinux.select_cocci_files(5, 14) == [
            "selinux.cocci",
            "selinux_lt_5_15.cocci",
        ]

    def test_below_4_19(self):
        """Test kernels below 4.19 get every destatic patch."""
        assert selinux.select_cocci_files(4, 14) == [
            "selinux.cocci",
            "selinux_lt_5_15.cocci",
            "selinux_lt_4_19.cocci",
        ]

    def test_exactly_4_19(self):
        """Test 4.19 skips the 4.19-gated patch."""
        assert selinux.select_cocci_files(4, 19) == [
            "selinux.cocci",
            "selinux_lt_5_15.cocci",
        ]


class TestExtractFilesFromCocci:
    """Tests for extract_files_from_cocci."""

    def test_extract_unique_files(self, temp_dir):
        """Test extracting unique file paths from a destatic cocci file."""
        content = '''
@rule depends on file in "security/selinux/selinuxfs.c"@
@@
- static DEFINE_MUTEX(sel_mutex);
+ DEFINE_MUTEX(sel_mutex);

@other depends on file in "security/selinux/ss/status.c"@
@@
- static struct page *selinux_status_page;
+ struct page *selinux_status_page;
'''
        cocci_file = temp_dir / "selinux.cocci"
        cocci_file.write_text(content)

        result = selinux.extract_files_from_cocci(cocci_file)

        assert result == [
            "security/selinux/selinuxfs.c",
            "security/selinux/ss/status.c",
        ]


class TestApplySpatch:
    """Tests for apply_spatch."""

    def test_apply_spatch_success(self, mock_subprocess, mock_print, temp_dir):
        """Test successful spatch application."""
        target = temp_dir / "selinuxfs.c"
        target.write_text("static DEFINE_MUTEX(sel_mutex);\n")

        selinux.apply_spatch(Path("selinux.cocci"), str(target))

        mock_subprocess.assert_called_once()
        cmd = mock_subprocess.call_args[0][0]
        assert "spatch" in cmd
        assert "--very-quiet" in cmd
        assert "--sp-file" in cmd
        assert "--in-place" in cmd
        assert "--linux-spacing" in cmd
        mock_print.assert_called_once()

    def test_apply_spatch_skips_missing_target(self, mock_subprocess, mock_print):
        """Test missing targets are skipped."""
        selinux.apply_spatch(Path("selinux.cocci"), "missing.c")

        mock_subprocess.assert_not_called()
        mock_print.assert_called_once()
        assert "missing.c" in mock_print.call_args[0][0]

    def test_apply_spatch_error_continues(self, mock_subprocess, mock_print, temp_dir):
        """Test that a failed patch application produces an error."""
        target = temp_dir / "selinuxfs.c"
        target.write_text("static DEFINE_MUTEX(sel_mutex);\n")
        mock_subprocess.side_effect = CalledProcessError(1, "spatch")

        with pytest.raises(CalledProcessError):
            selinux.apply_spatch(Path("selinux.cocci"), str(target))

        mock_subprocess.assert_called_once()


class TestMain:
    """Tests for main."""

    @patch('selinux.extract_files_from_cocci')
    @patch('selinux.apply_spatch')
    def test_main_selects_versioned_patches(self, mock_apply, mock_extract, temp_dir):
        """Test main applies every patch selected for 4.14."""
        mock_extract.side_effect = [
            ["security/selinux/selinuxfs.c"],
            ["security/selinux/selinuxfs.c", "security/selinux/ss/status.c"],
            ["security/selinux/hooks.c"],
        ]
        for name in ("selinux.cocci", "selinux_lt_5_15.cocci", "selinux_lt_4_19.cocci"):
            (temp_dir / name).write_text("// patch\n")

        with patch('sys.argv', [
            'selinux.py',
            '--cocci-dir', str(temp_dir),
            '--kernel-version', '4.14',
        ]):
            selinux.main()

        assert mock_extract.call_count == 3
        assert mock_apply.call_count == 4

    @patch('selinux.extract_files_from_cocci')
    @patch('selinux.apply_spatch')
    def test_main_modern_kernel(self, mock_apply, mock_extract, temp_dir):
        """Test 5.15 only applies the unconditional destatic patch."""
        mock_extract.return_value = ["security/selinux/selinuxfs.c"]
        (temp_dir / "selinux.cocci").write_text("// patch\n")

        with patch('sys.argv', [
            'selinux.py',
            '--cocci-dir', str(temp_dir),
            '--kernel-version', '5.15',
        ]):
            selinux.main()

        mock_extract.assert_called_once()
        mock_apply.assert_called_once()

    def test_main_missing_cocci_file(self, temp_dir):
        """Test main exits when a selected cocci file is missing."""
        with patch('sys.argv', [
            'selinux.py',
            '--cocci-dir', str(temp_dir),
            '--kernel-version', '5.15',
        ]):
            with pytest.raises(SystemExit):
                selinux.main()

    def test_main_invalid_version(self, temp_dir):
        """Test main exits on an invalid kernel version."""
        with patch('sys.argv', [
            'selinux.py',
            '--cocci-dir', str(temp_dir),
            '--kernel-version', 'bad',
        ]):
            with pytest.raises(SystemExit):
                selinux.main()
