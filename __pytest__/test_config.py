"""Tests for config.py - Unified kernel configuration checker.

This module tests the functionality for checking and configuring kernel
config options for LXC/Docker and Kali NetHunter support.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch as mock_patch, mock_open

import pytest  # pylint: disable=import-error

# Import the module under test
sys.path.insert(0, str(Path(__file__).parent.parent))
import config  # pylint: disable=import-error,wrong-import-position


# =============================================================================
# Color Function Tests
# =============================================================================


class TestColorFunctions:
    """Tests for color output functions."""

    def test_color_red(self):
        """Test red color wrapper."""
        result = config.color_red("test")
        assert result == "\033[31mtest\033[0m"
        assert "\033[31m" in result  # Red ANSI code

    def test_color_green(self):
        """Test green color wrapper."""
        result = config.color_green("test")
        assert result == "\033[32mtest\033[0m"
        assert "\033[32m" in result  # Green ANSI code

    def test_color_white(self):
        """Test white color wrapper."""
        result = config.color_white("test")
        assert result == "\033[37mtest\033[0m"
        assert "\033[37m" in result  # White ANSI code

    def test_color_functions_with_empty_string(self):
        """Test color functions with empty string."""
        assert config.color_red("") == "\033[31m\033[0m"
        assert config.color_green("") == "\033[32m\033[0m"
        assert config.color_white("") == "\033[37m\033[0m"

    def test_color_functions_with_special_chars(self):
        """Test color functions with special characters."""
        text = "test [INFO] with $pecial #chars"
        assert config.color_red(text).endswith("\033[0m")
        assert config.color_green(text).endswith("\033[0m")
        assert config.color_white(text).endswith("\033[0m")


# =============================================================================
# parse_configs Tests
# =============================================================================


class TestParseConfigs:
    """Tests for parse_configs function."""

    def test_parse_configs_basic(self):
        """Test basic config list parsing."""
        config_text = """
CONFIG_OPTION1
CONFIG_OPTION2
CONFIG_OPTION3
"""
        result = config.parse_configs(config_text)
        assert result == ["CONFIG_OPTION1", "CONFIG_OPTION2", "CONFIG_OPTION3"]

    def test_parse_configs_with_empty_lines(self):
        """Test parsing with empty lines."""
        config_text = """
CONFIG_OPTION1

CONFIG_OPTION2

"""
        result = config.parse_configs(config_text)
        assert result == ["CONFIG_OPTION1", "CONFIG_OPTION2"]

    def test_parse_configs_with_whitespace(self):
        """Test parsing with whitespace."""
        config_text = """
  CONFIG_OPTION1
CONFIG_OPTION2  
  CONFIG_OPTION3  
"""
        result = config.parse_configs(config_text)
        assert result == ["CONFIG_OPTION1", "CONFIG_OPTION2", "CONFIG_OPTION3"]

    def test_parse_configs_empty(self):
        """Test parsing empty config text."""
        result = config.parse_configs("")
        assert result == []

    def test_parse_configs_only_whitespace(self):
        """Test parsing whitespace-only config text."""
        result = config.parse_configs("   \n   \n   ")
        assert result == []


# =============================================================================
# count_config_occurrences Tests
# =============================================================================


class TestCountConfigOccurrences:
    """Tests for count_config_occurrences function."""

    def test_count_single_occurrence(self, temp_dir):
        """Test counting single occurrence."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        result = config.count_config_occurrences(config_file, "CONFIG_TEST")
        assert result == 1

    def test_count_multiple_occurrences(self, temp_dir):
        """Test counting multiple occurrences."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\nCONFIG_TEST=m\n")

        result = config.count_config_occurrences(config_file, "CONFIG_TEST")
        assert result == 2

    def test_count_no_occurrence(self, temp_dir):
        """Test counting no occurrences."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_OTHER=y\n")

        result = config.count_config_occurrences(config_file, "CONFIG_TEST")
        assert result == 0

    def test_count_with_word_boundary(self, temp_dir):
        """Test word boundary matching."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\nCONFIG_TEST_OTHER=y\n")

        result = config.count_config_occurrences(config_file, "CONFIG_TEST")
        assert result == 1  # Should not match CONFIG_TEST_OTHER


# =============================================================================
# is_config_enabled Tests
# =============================================================================


class TestIsConfigEnabled:
    """Tests for is_config_enabled function."""

    def test_enabled_y(self, temp_dir):
        """Test detecting =y config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        result = config.is_config_enabled(config_file, "CONFIG_TEST")
        assert result is True

    def test_enabled_m(self, temp_dir):
        """Test detecting =m config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=m\n")

        result = config.is_config_enabled(config_file, "CONFIG_TEST")
        assert result is True

    def test_not_enabled_value(self, temp_dir):
        """Test detecting non-enabled config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=n\n")

        result = config.is_config_enabled(config_file, "CONFIG_TEST")
        assert result is False

    def test_not_set(self, temp_dir):
        """Test detecting missing config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_OTHER=y\n")

        result = config.is_config_enabled(config_file, "CONFIG_TEST")
        assert result is False

    def test_partial_match_rejected(self, temp_dir):
        """Test that partial matches are rejected."""
        config_file = temp_dir / ".config"
        config_file.write_text("MY_CONFIG_TEST=y\n")

        result = config.is_config_enabled(config_file, "CONFIG_TEST")
        assert result is False


# =============================================================================
# is_config_set Tests
# =============================================================================


class TestIsConfigSet:
    """Tests for is_config_set function."""

    def test_config_set_y(self, temp_dir):
        """Test detecting set config with =y."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        result = config.is_config_set(config_file, "CONFIG_TEST")
        assert result is True

    def test_config_set_value(self, temp_dir):
        """Test detecting set config with any value."""
        config_file = temp_dir / ".config"
        config_file.write_text('CONFIG_TEST="some value"\n')

        result = config.is_config_set(config_file, "CONFIG_TEST")
        assert result is True

    def test_config_not_set(self, temp_dir):
        """Test detecting unset config."""
        config_file = temp_dir / ".config"
        config_file.write_text("# CONFIG_TEST is not set\n")

        result = config.is_config_set(config_file, "CONFIG_TEST")
        assert result is False

    def test_config_missing(self, temp_dir):
        """Test detecting missing config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_OTHER=y\n")

        result = config.is_config_set(config_file, "CONFIG_TEST")
        assert result is False


# =============================================================================
# add_config_not_set Tests
# =============================================================================


class TestAddConfigNotSet:
    """Tests for add_config_not_set function."""

    def test_add_not_set(self, temp_dir):
        """Test adding # CONFIG_XXX is not set."""
        config_file = temp_dir / ".config"
        config_file.write_text("# Existing config\n")

        config.add_config_not_set(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert "# CONFIG_TEST is not set" in content
        assert "# Existing config" in content

    def test_add_not_set_to_empty_file(self, temp_dir):
        """Test adding to empty file."""
        config_file = temp_dir / ".config"
        config_file.write_text("")

        config.add_config_not_set(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert content.strip() == "# CONFIG_TEST is not set"


# =============================================================================
# enable_config Tests
# =============================================================================


class TestEnableConfig:
    """Tests for enable_config function."""

    def test_enable_config(self, temp_dir):
        """Test enabling a config."""
        config_file = temp_dir / ".config"
        config_file.write_text("# CONFIG_TEST is not set\n")

        config.enable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert "CONFIG_TEST=y" in content
        assert "# CONFIG_TEST is not set" not in content

    def test_enable_already_enabled(self, temp_dir):
        """Test enabling already enabled config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        config.enable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert content.count("CONFIG_TEST") == 1  # No duplicate

    def test_enable_multiple_occurrences(self, temp_dir):
        """Test enabling with multiple occurrences."""
        config_file = temp_dir / ".config"
        config_file.write_text("# CONFIG_TEST is not set\n# CONFIG_TEST is not set\n")

        config.enable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert content.count("CONFIG_TEST=y") == 2


# =============================================================================
# disable_config Tests
# =============================================================================


class TestDisableConfig:
    """Tests for disable_config function."""

    def test_disable_config_y(self, temp_dir):
        """Test disabling =y config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        config.disable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert "# CONFIG_TEST is not set" in content
        assert "CONFIG_TEST=y" not in content

    def test_disable_config_m(self, temp_dir):
        """Test disabling =m config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=m\n")

        config.disable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert "# CONFIG_TEST is not set" in content
        assert "CONFIG_TEST=m" not in content

    def test_disable_config_value(self, temp_dir):
        """Test disabling config with value."""
        config_file = temp_dir / ".config"
        config_file.write_text('CONFIG_TEST="value"\n')

        config.disable_config(config_file, "CONFIG_TEST")

        content = config_file.read_text()
        assert "# CONFIG_TEST is not set" in content


# =============================================================================
# get_config_value Tests
# =============================================================================


class TestGetConfigValue:
    """Tests for get_config_value function."""

    def test_get_value_y(self, temp_dir):
        """Test getting =y value."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=y\n")

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert result == "y"

    def test_get_value_string(self, temp_dir):
        """Test getting string value."""
        config_file = temp_dir / ".config"
        config_file.write_text('CONFIG_TEST="test value"\n')

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert result == '"test value"'

    def test_get_value_numeric(self, temp_dir):
        """Test getting numeric value."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_TEST=123\n")

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert result == "123"

    def test_get_value_not_set(self, temp_dir):
        """Test getting value for unset config."""
        config_file = temp_dir / ".config"
        config_file.write_text("# CONFIG_TEST is not set\n")

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert result is None

    def test_get_value_missing(self, temp_dir):
        """Test getting value for missing config."""
        config_file = temp_dir / ".config"
        config_file.write_text("CONFIG_OTHER=y\n")

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert result is None


# =============================================================================
# TYPE_CONFIGS Tests
# =============================================================================


class TestTypeConfigs:
    """Tests for type configuration constants."""

    def test_lxc_configs_on_not_empty(self):
        """Test that LXC_CONFIGS_ON is not empty."""
        configs = config.parse_configs(config.LXC_CONFIGS_ON)
        assert len(configs) > 0
        assert all(c.startswith("CONFIG_") for c in configs)

    def test_nethunter_configs_on_not_empty(self):
        """Test that NETHUNTER_CONFIGS_ON is not empty."""
        configs = config.parse_configs(config.NETHUNTER_CONFIGS_ON)
        assert len(configs) > 0
        assert all(c.startswith("CONFIG_") for c in configs)

    def test_type_configs_has_both_types(self):
        """Test that TYPE_CONFIGS has both lxc and nethunter."""
        assert "lxc" in config.TYPE_CONFIGS
        assert "nethunter" in config.TYPE_CONFIGS

    def test_type_configs_structure(self):
        """Test TYPE_CONFIGS has required keys."""
        required_keys = ["configs_on", "configs_off", "configs_eq", "description", "check_message", "fix_message"]
        for type_name, type_config in config.TYPE_CONFIGS.items():
            for key in required_keys:
                assert key in type_config, f"{type_name} missing {key}"


# =============================================================================
# main Tests
# =============================================================================


class TestMain:
    """Tests for main function."""

    def test_main_missing_type_exits(self):
        """Test main without --type argument exits with error."""
        with mock_patch('sys.argv', ['config.py', 'config_file']):
            with pytest.raises(SystemExit):
                config.main()

    def test_main_invalid_type_exits(self):
        """Test main with invalid type exits with error."""
        with mock_patch('sys.argv', ['config.py', '--type', 'invalid', 'config_file']):
            with pytest.raises(SystemExit):
                config.main()

    @mock_patch('sys.exit')
    @mock_patch('builtins.print')
    def test_main_config_outside_cwd(self, mock_print, mock_exit, temp_dir):
        """Test main with config file outside current directory exits with error."""
        # Create a file outside of temp_dir (simulating /tmp)
        outside_dir = temp_dir.parent / "outside_cwd"
        outside_dir.mkdir(exist_ok=True)
        outside_file = outside_dir / "config"
        outside_file.write_text("CONFIG_TEST=y\n")

        # Change to temp_dir so outside_file is not relative to cwd
        import os
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)
            with mock_patch('sys.argv', ['config.py', '--type', 'lxc', str(outside_file)]):
                config.main()
            mock_exit.assert_called_with(1)
        finally:
            os.chdir(original_cwd)


# =============================================================================
# Security Tests
# =============================================================================


class TestSecurity:
    """Security-focused tests."""

    @mock_patch('sys.exit')
    @mock_patch('builtins.print')
    def test_path_traversal_blocked(self, mock_print, mock_exit, temp_dir):
        """Test that path traversal is blocked."""
        import os
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)
            # Create a file outside of temp_dir
            outside_dir = temp_dir.parent / "outside_for_test"
            outside_dir.mkdir(exist_ok=True)
            malicious_path = outside_dir / "passwd"
            malicious_path.write_text("test\n")

            with mock_patch('sys.argv', ['config.py', '--type', 'lxc', str(malicious_path)]):
                config.main()

            mock_exit.assert_called_with(1)
        finally:
            os.chdir(original_cwd)

    def test_special_chars_in_config_names(self, temp_dir):
        """Test handling of special characters in config names."""
        config_file = temp_dir / ".config"
        # Write config with special regex characters
        config_file.write_text("CONFIG_TEST[]=$value\n")

        # Should not raise exception
        result = config.is_config_set(config_file, "CONFIG_TEST[]")
        # The function uses re.escape, so it should handle special chars


# =============================================================================
# Edge Cases Tests
# =============================================================================


class TestEdgeCases:
    """Edge case tests."""

    def test_empty_config_file(self, temp_dir):
        """Test operations on empty config file."""
        config_file = temp_dir / ".config"
        config_file.write_text("")

        assert config.is_config_enabled(config_file, "CONFIG_TEST") is False
        assert config.is_config_set(config_file, "CONFIG_TEST") is False
        assert config.get_config_value(config_file, "CONFIG_TEST") is None

    def test_very_long_config_value(self, temp_dir):
        """Test handling very long config values."""
        config_file = temp_dir / ".config"
        long_value = "x" * 10000
        config_file.write_text(f'CONFIG_TEST="{long_value}"\n')

        result = config.get_config_value(config_file, "CONFIG_TEST")
        assert long_value in result

    def test_unicode_in_config(self, temp_dir):
        """Test handling unicode in config."""
        config_file = temp_dir / ".config"
        config_file.write_text('CONFIG_TEST="unicode: \u4e2d\u6587"\n', encoding='utf-8')

        result = config.is_config_set(config_file, "CONFIG_TEST")
        assert result is True
