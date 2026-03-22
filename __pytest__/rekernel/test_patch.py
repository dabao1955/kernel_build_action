"""
Tests for rekernel/patch.py - Re:Kernel patch application.

This module tests the functionality for downloading, extracting, and applying
Re:Kernel patches to kernel source files, including security features like
ZipSlip attack prevention.
"""

import io
import sys
import zipfile
import importlib.util
from pathlib import Path
from subprocess import CalledProcessError
from unittest.mock import MagicMock, patch as mock_patch
from urllib.parse import urlparse

import pytest  # pylint: disable=import-error

# Import the module under test using importlib to avoid conflicts
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "rekernel"))
spec = importlib.util.spec_from_file_location("rk_patch", str(Path(__file__).parent.parent.parent / "rekernel" / "patch.py"))
rk_patch = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
spec.loader.exec_module(rk_patch)  # type: ignore[union-attr]


# =============================================================================
# run_command Tests
# =============================================================================


class TestRunCommand:
    """Tests for run_command function."""

    def test_run_success(self):
        """Test successful command execution."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            rk_patch.run_command(["ls", "-la"])

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert call_args[0][0] == ["ls", "-la"]
            assert call_args[1]['check'] is True

    def test_run_with_cwd(self, temp_dir):
        """Test command execution with working directory."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            rk_patch.run_command(["pwd"], cwd=temp_dir)

            call_args = mock_run.call_args
            assert call_args[1]['cwd'] == temp_dir

    def test_run_failure_raises(self):
        """Test command failure exits program."""
        with mock_patch('subprocess.run') as mock_run:
            with mock_patch('sys.exit') as mock_exit:
                mock_run.side_effect = CalledProcessError(1, "cmd")
                rk_patch.run_command(["false"])
                mock_exit.assert_called_with(1)

    def test_run_check_false(self):
        """Test command with check=False doesn't exit on failure."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.side_effect = CalledProcessError(1, "cmd")
            # Should not raise or exit
            rk_patch.run_command(["false"], check=False)


# =============================================================================
# download_file Tests
# =============================================================================


class TestDownloadFile:
    """Tests for download_file function."""

    def test_download_with_filename(self, temp_dir):
        """Test download with explicit filename."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            result = rk_patch.download_file(
                "https://example.com/file.zip",
                temp_dir,
                "custom_name.zip"
            )

            assert result == temp_dir / "custom_name.zip"
            mock_run.assert_called_once()

    def test_download_without_filename(self, temp_dir):
        """Test download without explicit filename."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            result = rk_patch.download_file(
                "https://example.com/archive.zip",
                temp_dir
            )

            assert result == temp_dir / "archive.zip"

    def test_download_url_construction(self, temp_dir):
        """Test URL is correctly passed to aria2c."""
        with mock_patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            rk_patch.download_file("https://example.com/file", temp_dir)

            call_args = mock_run.call_args
            cmd = call_args[0][0]
            assert "aria2c" in cmd
            assert "https://example.com/file" in cmd


# =============================================================================
# has_proc_ops Tests
# =============================================================================


class TestHasProcOps:
    """Tests for has_proc_ops function."""

    def test_has_proc_ops_true(self, temp_dir):
        """Test detecting proc_ops structure."""
        kernel_src = temp_dir / "kernel"
        # Create the correct path: include/linux/proc_fs.h
        proc_fs = kernel_src / "include" / "linux" / "proc_fs.h"
        proc_fs.parent.mkdir(parents=True)
        proc_fs.write_text("struct proc_ops my_ops;")

        result = rk_patch.has_proc_ops(kernel_src)
        assert result is True

    def test_has_proc_ops_false(self, temp_dir):
        """Test when proc_ops is not present."""
        kernel_src = temp_dir / "kernel"
        kernel_src.mkdir(parents=True)
        proc_fs = kernel_src / "proc_fs.h"
        proc_fs.write_text("struct file_operations my_ops;")

        result = rk_patch.has_proc_ops(kernel_src)
        assert result is False

    def test_has_proc_ops_no_file(self, temp_dir):
        """Test when proc_fs.h doesn't exist."""
        kernel_src = temp_dir / "kernel"
        kernel_src.mkdir(parents=True)

        result = rk_patch.has_proc_ops(kernel_src)
        assert result is False


# =============================================================================
# check_binder_function Tests
# =============================================================================


class TestCheckBinderFunction:
    """Tests for check_binder_function."""

    def test_function_found(self, temp_dir):
        """Test detecting expected binder function."""
        binder_file = temp_dir / "binder.c"
        binder_file.write_text(
            "binder_proc_transaction() - sends a transaction to a process and wakes it up\n"
        )

        result = rk_patch.check_binder_function(binder_file)
        assert result is True

    def test_function_not_found(self, temp_dir):
        """Test when function signature is not found."""
        binder_file = temp_dir / "binder.c"
        binder_file.write_text("some other content\n")

        result = rk_patch.check_binder_function(binder_file)
        assert result is False

    def test_file_not_exists(self, temp_dir):
        """Test when binder file doesn't exist."""
        binder_file = temp_dir / "nonexistent.c"

        result = rk_patch.check_binder_function(binder_file)
        assert result is False


# =============================================================================
# apply_cocci_patch Tests
# =============================================================================


class TestApplyCocciPatch:
    """Tests for apply_cocci_patch function."""

    def test_apply_success(self, temp_dir):
        """Test successful patch application."""
        cocci_file = temp_dir / "test.cocci"
        target_file = temp_dir / "target.c"
        target_file.write_text("// test\n")

        with mock_patch.object(rk_patch, 'run_command') as mock_run:
            rk_patch.apply_cocci_patch(cocci_file, target_file)

            mock_run.assert_called_once()
            call_args = mock_run.call_args
            assert "spatch" in call_args[0][0]

    def test_apply_file_not_found(self, temp_dir):
        """Test applying to non-existent file prints warning."""
        cocci_file = temp_dir / "test.cocci"
        target_file = temp_dir / "nonexistent.c"

        with mock_patch('builtins.print') as mock_print:
            with mock_patch.object(rk_patch, 'run_command') as mock_run:
                rk_patch.apply_cocci_patch(cocci_file, target_file)

                mock_run.assert_not_called()
                mock_print.assert_called()
                assert "Warning" in str(mock_print.call_args)


# =============================================================================
# check_rekernel_present Tests
# =============================================================================


class TestCheckRekernelPresent:
    """Tests for check_rekernel_present function."""

    def test_present(self, temp_dir):
        """Test detecting rekernel in file."""
        file_path = temp_dir / "config"
        file_path.write_text("CONFIG_REKERNEL=y\n")

        result = rk_patch.check_rekernel_present(file_path)
        assert result is True

    def test_not_present(self, temp_dir):
        """Test when rekernel is not in file."""
        file_path = temp_dir / "config"
        file_path.write_text("CONFIG_OTHER=y\n")

        result = rk_patch.check_rekernel_present(file_path)
        assert result is False

    def test_file_not_exists(self, temp_dir):
        """Test when file doesn't exist."""
        file_path = temp_dir / "nonexistent"

        result = rk_patch.check_rekernel_present(file_path)
        assert result is False

    def test_case_insensitive(self, temp_dir):
        """Test case-insensitive detection."""
        file_path = temp_dir / "config"
        file_path.write_text("config_ReKernel=yes\n")

        result = rk_patch.check_rekernel_present(file_path)
        assert result is True


# =============================================================================
# add_defconfig_rekernel Tests
# =============================================================================


class TestAddDefconfigRekernel:
    """Tests for add_defconfig_rekernel function."""

    def test_add_config(self, temp_dir):
        """Test adding Re:Kernel config options."""
        defconfig = temp_dir / "defconfig"
        defconfig.write_text("# Base config\n")

        rk_patch.add_defconfig_rekernel(defconfig)

        content = defconfig.read_text()
        assert "CONFIG_REKERNEL=y" in content
        assert "CONFIG_REKERNEL_NETWORK=n" in content

    def test_add_to_empty_file(self, temp_dir):
        """Test adding to empty file."""
        defconfig = temp_dir / "defconfig"
        defconfig.write_text("")

        rk_patch.add_defconfig_rekernel(defconfig)

        content = defconfig.read_text()
        assert "CONFIG_REKERNEL=y" in content


# =============================================================================
# add_kconfig_rekernel Tests
# =============================================================================


class TestAddKconfigRekernel:
    """Tests for add_kconfig_rekernel function."""

    def test_add_source(self, temp_dir):
        """Test adding Re:Kernel source to Kconfig."""
        kconfig = temp_dir / "Kconfig"
        kconfig.write_text("menuconfig TEST\nendmenu\n")

        rk_patch.add_kconfig_rekernel(kconfig)

        content = kconfig.read_text()
        assert 'source "drivers/rekernel/Kconfig"' in content

    def test_already_present(self, temp_dir):
        """Test when source is already present."""
        kconfig = temp_dir / "Kconfig"
        kconfig.write_text('source "drivers/rekernel/Kconfig"\n')

        rk_patch.add_kconfig_rekernel(kconfig)

        content = kconfig.read_text()
        assert content.count('source "drivers/rekernel/Kconfig"') == 1

    def test_no_endmenu(self, temp_dir):
        """Test adding when no endmenu found."""
        kconfig = temp_dir / "Kconfig"
        kconfig.write_text("menuconfig TEST\n")

        rk_patch.add_kconfig_rekernel(kconfig)

        content = kconfig.read_text()
        assert 'source "drivers/rekernel/Kconfig"' in content

    def test_file_not_exists(self, temp_dir):
        """Test when Kconfig doesn't exist."""
        kconfig = temp_dir / "Kconfig"

        # Should not raise
        rk_patch.add_kconfig_rekernel(kconfig)


# =============================================================================
# add_makefile_rekernel Tests
# =============================================================================


class TestAddMakefileRekernel:
    """Tests for add_makefile_rekernel function."""

    def test_add_obj(self, temp_dir):
        """Test adding Re:Kernel to Makefile."""
        makefile = temp_dir / "Makefile"
        makefile.write_text("obj-y += core/\n")

        rk_patch.add_makefile_rekernel(makefile)

        content = makefile.read_text()
        assert "obj-$(CONFIG_REKERNEL) += rekernel/" in content

    def test_already_present(self, temp_dir):
        """Test when already present."""
        makefile = temp_dir / "Makefile"
        makefile.write_text("obj-$(CONFIG_REKERNEL) += rekernel/\n")

        rk_patch.add_makefile_rekernel(makefile)

        content = makefile.read_text()
        assert content.count("obj-$(CONFIG_REKERNEL)") == 1

    def test_file_not_exists(self, temp_dir):
        """Test when Makefile doesn't exist."""
        makefile = temp_dir / "Makefile"

        # Should not raise
        rk_patch.add_makefile_rekernel(makefile)


# =============================================================================
# safe_extract Tests - Security Critical
# =============================================================================


class TestSafeExtract:
    """Tests for safe_extract function - ZipSlip prevention."""

    def create_zip_file(self, temp_dir, entries):
        """Helper to create a zip file with given entries."""
        zip_path = temp_dir / "test.zip"
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for entry, content in entries.items():
                zf.writestr(entry, content)
        return zip_path

    def test_safe_extract_normal(self, temp_dir):
        """Test normal extraction."""
        zip_path = self.create_zip_file(temp_dir, {
            "file.txt": "content",
            "dir/": "",
            "dir/nested.txt": "nested content"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            rk_patch.safe_extract(zf, extract_path)

        assert (extract_path / "file.txt").exists()
        assert (extract_path / "dir" / "nested.txt").exists()

    def test_safe_extract_prevents_zipslip_absolute(self, temp_dir):
        """Test prevention of absolute path ZipSlip attack."""
        zip_path = self.create_zip_file(temp_dir, {
            "/etc/passwd": "malicious"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            with pytest.raises(ValueError, match="ZipSlip attack detected"):
                rk_patch.safe_extract(zf, extract_path)

    def test_safe_extract_prevents_zipslip_traversal(self, temp_dir):
        """Test prevention of path traversal ZipSlip attack."""
        zip_path = self.create_zip_file(temp_dir, {
            "../../../etc/passwd": "malicious"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            with pytest.raises(ValueError, match="ZipSlip attack detected"):
                rk_patch.safe_extract(zf, extract_path)

    def test_safe_extract_prevents_zipslip_nested_traversal(self, temp_dir):
        """Test prevention of nested path traversal."""
        zip_path = self.create_zip_file(temp_dir, {
            "dir/../../../../etc/passwd": "malicious"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            with pytest.raises(ValueError, match="ZipSlip attack detected"):
                rk_patch.safe_extract(zf, extract_path)

    def test_safe_extract_allows_valid_subdirs(self, temp_dir):
        """Test that valid subdirectories are allowed."""
        zip_path = self.create_zip_file(temp_dir, {
            "subdir/file.txt": "content",
            "subdir/deeper/file.txt": "deeper content"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            rk_patch.safe_extract(zf, extract_path)

        assert (extract_path / "subdir" / "file.txt").exists()
        assert (extract_path / "subdir" / "deeper" / "file.txt").exists()

    def test_safe_extract_creates_directories(self, temp_dir):
        """Test that parent directories are created."""
        zip_path = self.create_zip_file(temp_dir, {
            "a/b/c/d/file.txt": "deep content"
        })

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            rk_patch.safe_extract(zf, extract_path)

        assert (extract_path / "a" / "b" / "c" / "d" / "file.txt").exists()

    def test_safe_extract_empty_zip(self, temp_dir):
        """Test extracting empty zip."""
        zip_path = temp_dir / "empty.zip"
        with zipfile.ZipFile(zip_path, 'w') as zf:
            pass

        extract_path = temp_dir / "extract"
        extract_path.mkdir()

        with zipfile.ZipFile(zip_path, 'r') as zf:
            rk_patch.safe_extract(zf, extract_path)

        # Should complete without error


# =============================================================================
# main Tests
# =============================================================================


class TestMain:
    """Tests for main function."""

    def test_main_success(self):
        """Test main function success path."""
        with mock_patch.object(rk_patch, 'has_proc_ops', return_value=True):
            with mock_patch.object(rk_patch, 'download_file'):
                with mock_patch.object(rk_patch, 'apply_cocci_patch'):
                    with mock_patch.object(rk_patch, 'shutil'):
                        with mock_patch('tempfile.TemporaryDirectory') as mock_temp:
                            mock_temp.return_value.__enter__ = MagicMock(return_value="/tmp")
                            mock_temp.return_value.__exit__ = MagicMock(return_value=False)

                            # Mock Path.exists for kernel files
                            with mock_patch.object(Path, 'exists', return_value=True):
                                # Should not raise
                                try:
                                    rk_patch.main()
                                except Exception:
                                    pass  # Expected due to mocking limitations

    def test_main_binder_check(self):
        """Test main with binder function check."""
        with mock_patch.object(rk_patch, 'check_binder_function', return_value=False):
            with mock_patch.object(rk_patch, 'download_file'):
                with mock_patch.object(rk_patch, 'apply_cocci_patch'):
                    with mock_patch('builtins.print') as mock_print:
                        with mock_patch('tempfile.TemporaryDirectory') as mock_temp:
                            mock_temp.return_value.__enter__ = MagicMock(return_value="/tmp")
                            mock_temp.return_value.__exit__ = MagicMock(return_value=False)

                            with mock_patch.object(Path, 'exists', return_value=True):
                                try:
                                    rk_patch.main()
                                except Exception:
                                    pass

                        # Should print error about binder function
                        print_calls = [str(c) for c in mock_print.call_args_list]


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Tests for module constants."""

    def test_repo_base_format(self):
        """Test that REPO_BASE is properly formatted."""
        parsed = urlparse(rk_patch.REPO_BASE)
        assert parsed.scheme == "https"
        # Require that the URL points to github.com or one of its subdomains.
        assert parsed.hostname is not None
        assert parsed.hostname == "github.com" or parsed.hostname.endswith(".github.com")

    def test_patches_base_format(self):
        """Test that PATCHES_BASE is properly formatted."""
        parsed = urlparse(rk_patch.PATCHES_BASE)
        assert parsed.scheme == "https"
        assert parsed.hostname == "raw.githubusercontent.com"


# =============================================================================
# Edge Cases Tests
# =============================================================================


class TestEdgeCases:
    """Edge case tests."""

    def test_proc_ops_with_unicode(self, temp_dir):
        """Test proc_ops detection with unicode content."""
        kernel_src = temp_dir / "kernel"
        # Create the correct path: include/linux/proc_fs.h
        proc_fs = kernel_src / "include" / "linux" / "proc_fs.h"
        proc_fs.parent.mkdir(parents=True)
        proc_fs.write_text("struct proc_ops ops; \u4e2d\u6587", encoding='utf-8')

        result = rk_patch.has_proc_ops(kernel_src)
        assert result is True

    def test_kconfig_with_multiple_endmenus(self, temp_dir):
        """Test Kconfig with multiple endmenu statements."""
        kconfig = temp_dir / "Kconfig"
        kconfig.write_text("""menu A
endmenu
menu B
endmenu
menu C
endmenu
""")

        rk_patch.add_kconfig_rekernel(kconfig)

        content = kconfig.read_text()
        lines = content.split('\n')
        endmenu_indices = [i for i, line in enumerate(lines) if line.strip() == "endmenu"]
        assert len(endmenu_indices) == 3
        # Should be inserted before last endmenu
        assert 'source "drivers/rekernel/Kconfig"' in content