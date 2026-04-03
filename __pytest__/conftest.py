"""
Shared fixtures for pytest tests.

This module provides common fixtures and utilities used across all Python tests
in the kernel_build_action project.
"""

import io
import os
import struct
import subprocess
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, mock_open

import pytest


# =============================================================================
# Path Fixtures
# =============================================================================


@pytest.fixture
def temp_dir(tmp_path: Path) -> Path:
    """Provide a temporary directory for tests."""
    return tmp_path


@pytest.fixture
def mock_kernel_src(temp_dir: Path) -> Path:
    """Create a mock kernel source directory structure."""
    kernel_src = temp_dir / "kernel"
    kernel_src.mkdir()

    # Create common directories
    (kernel_src / "drivers" / "android").mkdir(parents=True)
    (kernel_src / "drivers" / "rekernel").mkdir(parents=True)
    (kernel_src / "kernel" / "cgroup").mkdir(parents=True)
    (kernel_src / "kernel").mkdir(parents=True)
    (kernel_src / "net" / "netfilter").mkdir(parents=True)
    (kernel_src / "include" / "linux").mkdir(parents=True)
    (kernel_src / "arch" / "arm64" / "configs").mkdir(parents=True)

    return kernel_src


@pytest.fixture
def mock_config_file(temp_dir: Path) -> Path:
    """Create a mock kernel config file."""
    config_file = temp_dir / ".config"
    config_content = """
CONFIG_TEST=y
CONFIG_MODULE=m
# CONFIG_DISABLED is not set
CONFIG_VALUE=123
CONFIG_STRING="test"
"""
    config_file.write_text(config_content)
    return config_file


# =============================================================================
# Mock Fixtures
# =============================================================================


@pytest.fixture
def mock_subprocess(mocker: Any) -> MagicMock:
    """Mock subprocess.run for all tests."""
    mock = mocker.patch('subprocess.run')
    mock.return_value = MagicMock(returncode=0, stdout="", stderr="")
    return mock


@pytest.fixture
def mock_subprocess_error(mocker: Any) -> MagicMock:
    """Mock subprocess.run to raise CalledProcessError."""
    def side_effect(*args, **kwargs):
        raise subprocess.CalledProcessError(1, args[0] if args else "cmd")

    mock = mocker.patch('subprocess.run')
    mock.side_effect = side_effect
    return mock


@pytest.fixture
def mock_shutil_which(mocker: Any) -> MagicMock:
    """Mock shutil.which to simulate command availability."""
    return mocker.patch('shutil.which')


@pytest.fixture
def mock_path_read_text(mocker: Any) -> MagicMock:
    """Mock Path.read_text method."""
    return mocker.patch.object(Path, 'read_text')


@pytest.fixture
def mock_path_write_text(mocker: Any) -> MagicMock:
    """Mock Path.write_text method."""
    return mocker.patch.object(Path, 'write_text')


@pytest.fixture
def mock_open_builtin(mocker: Any) -> MagicMock:
    """Mock built-in open function."""
    return mocker.patch('builtins.open', mock_open())


@pytest.fixture
def mock_os_fstat(mocker: Any) -> MagicMock:
    """Mock os.fstat for file size operations."""
    mock_stat = MagicMock()
    mock_stat.st_size = 1024
    return mocker.patch('os.fstat', return_value=mock_stat)


@pytest.fixture
def mock_os_system(mocker: Any) -> MagicMock:
    """Mock os.system for shell command execution."""
    return mocker.patch('os.system', return_value=0)


@pytest.fixture
def mock_os_walk(mocker: Any) -> MagicMock:
    """Mock os.walk for directory traversal."""
    return mocker.patch('os.walk')


@pytest.fixture
def mock_shutil_move(mocker: Any) -> MagicMock:
    """Mock shutil.move for file operations."""
    return mocker.patch('shutil.move')


@pytest.fixture
def mock_shutil_rmtree(mocker: Any) -> MagicMock:
    """Mock shutil.rmtree for directory removal."""
    return mocker.patch('shutil.rmtree')


@pytest.fixture
def mock_zipfile(mocker: Any) -> MagicMock:
    """Mock zipfile.ZipFile for archive operations."""
    mock_zip = MagicMock()
    mock_zip.namelist.return_value = ["test.txt", "dir/"]
    mock_zip.open.return_value = io.BytesIO(b"test content")

    mock_zip_class = mocker.patch('zipfile.ZipFile')
    mock_zip_class.return_value.__enter__ = MagicMock(return_value=mock_zip)
    mock_zip_class.return_value.__exit__ = MagicMock(return_value=False)

    return mock_zip


@pytest.fixture
def mock_zlib(mocker: Any) -> MagicMock:
    """Mock zlib compression/decompression."""
    mock = mocker.patch('zlib.compressobj')
    mock_compressobj = MagicMock()
    mock_compressobj.compress.return_value = b"compressed_data"
    mock_compressobj.flush.return_value = b""
    mock.return_value = mock_compressobj

    mocker.patch('zlib.decompress', return_value=b"decompressed_data")
    return mock


@pytest.fixture
def mock_sys_exit(mocker: Any) -> MagicMock:
    """Mock sys.exit to prevent tests from terminating."""
    return mocker.patch('sys.exit')


@pytest.fixture
def mock_stderr(mocker: Any) -> MagicMock:
    """Mock sys.stderr for error output capture."""
    return mocker.patch('sys.stderr', new_callable=io.StringIO)


@pytest.fixture
def mock_stdout(mocker: Any) -> MagicMock:
    """Mock sys.stdout for output capture."""
    return mocker.patch('sys.stdout', new_callable=io.StringIO)


@pytest.fixture
def mock_print(mocker: Any) -> MagicMock:
    """Mock built-in print function."""
    return mocker.patch('builtins.print')


# =============================================================================
# ThreadPoolExecutor Fixture
# =============================================================================


@pytest.fixture
def mock_thread_pool_executor(mocker: Any) -> MagicMock:
    """Mock ThreadPoolExecutor for parallel operations."""
    mock_executor = MagicMock()
    mock_future = MagicMock()
    mock_future.result.return_value = Path("/tmp/test.patch")

    mock_executor.submit.return_value = mock_future
    mock_executor.__enter__ = MagicMock(return_value=mock_executor)
    mock_executor.__exit__ = MagicMock(return_value=False)

    mock_executor_class = mocker.patch('concurrent.futures.ThreadPoolExecutor')
    mock_executor_class.return_value = mock_executor

    return mock_executor


@pytest.fixture
def mock_as_completed(mocker: Any) -> MagicMock:
    """Mock concurrent.futures.as_completed."""
    def as_completed_side_effect(futures):
        return futures

    return mocker.patch('concurrent.futures.as_completed', side_effect=as_completed_side_effect)


# =============================================================================
# Environment Fixtures
# =============================================================================


@pytest.fixture
def mock_environ(mocker: Any) -> dict[str, str]:
    """Provide a mock environment variables dictionary."""
    env: dict[str, str] = {}
    mocker.patch.dict(os.environ, env, clear=True)
    return env


@pytest.fixture
def mock_cwd(mocker: Any, temp_dir: Path) -> Path:
    """Mock the current working directory."""
    mocker.patch('os.getcwd', return_value=str(temp_dir))
    return temp_dir


# =============================================================================
# DTBO Test Helpers
# =============================================================================


@pytest.fixture
def dtbo_header_v0() -> bytes:
    """Create a valid DTBO header for version 0."""
    # DTBO magic, total_size, header_size, dt_entry_size, dt_entry_count,
    # dt_entries_offset, page_size, version
    return struct.pack('>8I',
        0xd7b7ab1e,  # magic
        256,         # total_size
        32,          # header_size
        32,          # dt_entry_size
        1,           # dt_entry_count
        32,          # dt_entries_offset
        2048,        # page_size
        0            # version
    )


@pytest.fixture
def dtbo_header_v1() -> bytes:
    """Create a valid DTBO header for version 1."""
    return struct.pack('>8I',
        0xd7b7ab1e,  # magic
        256,         # total_size
        32,          # header_size
        32,          # dt_entry_size
        1,           # dt_entry_count
        32,          # dt_entries_offset
        2048,        # page_size
        1            # version
    )


@pytest.fixture
def invalid_dtbo_header() -> bytes:
    """Create an invalid DTBO header (wrong magic)."""
    return struct.pack('>8I',
        0xdeadbeef,  # invalid magic
        256,         # total_size
        32,          # header_size
        32,          # dt_entry_size
        1,           # dt_entry_count
        32,          # dt_entries_offset
        2048,        # page_size
        0            # version
    )


# =============================================================================
# Coccinelle Patch Fixtures
# =============================================================================


@pytest.fixture
def sample_cocci_content() -> str:
    """Sample Coccinelle patch content for testing."""
    return '''
@rule1@
@@
- old_function()
+ new_function()

file in "kernel/cgroup.c"
file in "kernel/cgroup/cgroup.c"
'''


@pytest.fixture
def sample_cocci_files() -> list[str]:
    """List of files extracted from sample cocci content."""
    return ["kernel/cgroup.c", "kernel/cgroup/cgroup.c"]


# =============================================================================
# Makefile Fixtures
# =============================================================================


@pytest.fixture
def sample_makefile() -> str:
    """Sample kernel Makefile content."""
    return """VERSION = 5
PATCHLEVEL = 15
SUBLEVEL = 0
EXTRAVERSION =
NAME = bleed for me

# *DOCUMENTATION*
"""


@pytest.fixture
def sample_localversion() -> str:
    """Sample localversion file content."""
    return "-test"


# =============================================================================
# Kernel Config Fixtures
# =============================================================================


@pytest.fixture
def sample_kernel_config() -> str:
    """Sample kernel config file content."""
    return """
# Test kernel configuration
CONFIG_ENABLED=y
CONFIG_MODULE=m
# CONFIG_DISABLED is not set
CONFIG_VALUE=123
CONFIG_STRING="test value"
"""


# =============================================================================
# Path Existence Fixtures
# =============================================================================


@pytest.fixture
def mock_path_exists(mocker: Any) -> MagicMock:
    """Mock Path.exists method."""
    return mocker.patch.object(Path, 'exists', return_value=True)


@pytest.fixture
def mock_path_is_file(mocker: Any) -> MagicMock:
    """Mock Path.is_file method."""
    return mocker.patch.object(Path, 'is_file', return_value=True)


@pytest.fixture
def mock_path_is_dir(mocker: Any) -> MagicMock:
    """Mock Path.is_dir method."""
    return mocker.patch.object(Path, 'is_dir', return_value=True)


@pytest.fixture
def mock_path_resolve(mocker: Any, temp_dir: Path) -> MagicMock:
    """Mock Path.resolve method."""
    def resolve_side_effect(self):
        return temp_dir / self.name

    return mocker.patch.object(Path, 'resolve', side_effect=resolve_side_effect)


@pytest.fixture
def mock_path_mkdir(mocker: Any) -> MagicMock:
    """Mock Path.mkdir method."""
    return mocker.patch.object(Path, 'mkdir')


@pytest.fixture
def mock_path_glob(mocker: Any) -> MagicMock:
    """Mock Path.glob method."""
    return mocker.patch.object(Path, 'glob')


@pytest.fixture
def mock_path_rglob(mocker: Any) -> MagicMock:
    """Mock Path.rglob method."""
    return mocker.patch.object(Path, 'rglob')


# =============================================================================
# Session-scoped Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def project_root() -> Path:
    """Return the project root directory."""
    return Path(__file__).parent.parent


@pytest.fixture(scope="session")
def python_files(project_root: Path) -> list[Path]:
    """Return list of all Python files in the project."""
    files: list[Path] = []
    for pattern in ["*.py", "**/*.py"]:
        files.extend(project_root.glob(pattern))
    return [f for f in files if "node_modules" not in str(f) and "__pycache__" not in str(f)]
