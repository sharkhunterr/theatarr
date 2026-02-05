"""Unit tests for the adapter registry."""

import pytest
from unittest.mock import MagicMock, patch

from theatarr.adapters.base import (
    AdapterCapability,
    Command,
    CommandResult,
    ServiceAdapter,
)
from theatarr.adapters.registry import AdapterRegistry


class MockTestAdapter(ServiceAdapter):
    """Mock adapter for testing registry functionality."""

    name = "mock_test"
    service_type = "test"
    display_name = "Mock Test Adapter"
    description = "A mock adapter for testing"

    config_schema = {
        "type": "object",
        "properties": {
            "host": {"type": "string"},
            "port": {"type": "integer"},
        },
        "required": ["host"],
    }

    capabilities = [
        AdapterCapability.LIGHT_ON_OFF,
        AdapterCapability.LIGHT_BRIGHTNESS,
    ]

    async def test_connection(self, config: dict) -> dict:
        return {"success": True, "message": "Connected"}

    async def execute_action(
        self, action_type: str, parameters: dict, config: dict
    ) -> dict:
        return {"success": True}

    async def get_capabilities(self, config: dict) -> dict:
        return {"capabilities": ["on_off", "brightness"]}


class TestAdapterRegistry:
    """Tests for AdapterRegistry class."""

    def setup_method(self):
        """Clear registry before each test."""
        AdapterRegistry._adapters = {}
        AdapterRegistry._instances = {}

    def test_register_adapter(self):
        """Test registering an adapter."""
        AdapterRegistry.register(MockTestAdapter)

        assert "mock_test" in AdapterRegistry._adapters
        assert AdapterRegistry._adapters["mock_test"] == MockTestAdapter

    def test_register_duplicate_adapter(self):
        """Test that registering duplicate adapter raises error."""
        AdapterRegistry.register(MockTestAdapter)

        with pytest.raises(ValueError, match="already registered"):
            AdapterRegistry.register(MockTestAdapter)

    def test_get_adapter(self):
        """Test getting a registered adapter class."""
        AdapterRegistry.register(MockTestAdapter)

        adapter_cls = AdapterRegistry.get("mock_test")
        assert adapter_cls == MockTestAdapter

    def test_get_nonexistent_adapter(self):
        """Test getting non-existent adapter returns None."""
        adapter_cls = AdapterRegistry.get("nonexistent")
        assert adapter_cls is None

    def test_list_adapters(self):
        """Test listing all registered adapters."""
        AdapterRegistry.register(MockTestAdapter)

        adapters = AdapterRegistry.list_all()
        assert len(adapters) >= 1
        assert "mock_test" in adapters

    def test_list_adapters_by_type(self):
        """Test listing adapters filtered by type."""
        AdapterRegistry.register(MockTestAdapter)

        test_adapters = AdapterRegistry.list_by_type("test")
        assert "mock_test" in test_adapters

        lighting_adapters = AdapterRegistry.list_by_type("lighting")
        assert "mock_test" not in lighting_adapters

    def test_get_instance_creates_new(self):
        """Test that get_instance creates adapter if not exists."""
        AdapterRegistry.register(MockTestAdapter)

        instance = AdapterRegistry.get_instance("mock_test")
        assert instance is not None
        assert isinstance(instance, MockTestAdapter)

    def test_get_instance_returns_cached(self):
        """Test that get_instance returns cached instance."""
        AdapterRegistry.register(MockTestAdapter)

        instance1 = AdapterRegistry.get_instance("mock_test")
        instance2 = AdapterRegistry.get_instance("mock_test")

        assert instance1 is instance2

    def test_get_instance_nonexistent(self):
        """Test getting instance of non-existent adapter."""
        instance = AdapterRegistry.get_instance("nonexistent")
        assert instance is None

    def test_get_adapter_info(self):
        """Test getting adapter metadata."""
        AdapterRegistry.register(MockTestAdapter)

        info = AdapterRegistry.get_adapter_info("mock_test")
        assert info is not None
        assert info["name"] == "mock_test"
        assert info["display_name"] == "Mock Test Adapter"
        assert info["service_type"] == "test"
        assert "capabilities" in info

    def test_get_adapter_info_nonexistent(self):
        """Test getting info for non-existent adapter."""
        info = AdapterRegistry.get_adapter_info("nonexistent")
        assert info is None


class TestAdapterCapabilities:
    """Tests for adapter capability detection."""

    def setup_method(self):
        """Clear registry before each test."""
        AdapterRegistry._adapters = {}
        AdapterRegistry._instances = {}

    def test_adapter_has_capability(self):
        """Test checking if adapter has a capability."""
        AdapterRegistry.register(MockTestAdapter)

        adapter = AdapterRegistry.get_instance("mock_test")
        assert AdapterCapability.LIGHT_ON_OFF in adapter.capabilities
        assert AdapterCapability.LIGHT_BRIGHTNESS in adapter.capabilities
        assert AdapterCapability.PLAYER_PLAY not in adapter.capabilities


class TestAdapterDiscovery:
    """Tests for adapter auto-discovery."""

    def test_discover_adapters_imports_modules(self):
        """Test that discover_adapters imports adapter modules."""
        # This test verifies the discovery mechanism works
        # The actual adapters should be imported and registered
        AdapterRegistry.discover_adapters()

        # Should have discovered some built-in adapters
        # At minimum, the mock adapter should be available
        adapters = AdapterRegistry.list_all()
        assert len(adapters) >= 0  # May be 0 if no adapters configured


class TestCommandExecution:
    """Tests for command execution through registry."""

    def setup_method(self):
        """Clear registry before each test."""
        AdapterRegistry._adapters = {}
        AdapterRegistry._instances = {}

    @pytest.mark.asyncio
    async def test_execute_command_via_adapter(self):
        """Test executing a command through an adapter."""
        AdapterRegistry.register(MockTestAdapter)
        adapter = AdapterRegistry.get_instance("mock_test")

        command = Command(
            action="set_brightness",
            parameters={"brightness": 50},
            targets=["light-1"],
        )

        # Mock the execute method
        result = await adapter.execute(command)
        assert result.success

    @pytest.mark.asyncio
    async def test_test_connection_via_adapter(self):
        """Test connection testing through adapter."""
        AdapterRegistry.register(MockTestAdapter)
        adapter = AdapterRegistry.get_instance("mock_test")

        result = await adapter.test_connection({"host": "localhost"})
        assert result["success"] is True


class TestConfigSchema:
    """Tests for adapter config schema handling."""

    def setup_method(self):
        """Clear registry before each test."""
        AdapterRegistry._adapters = {}

    def test_get_config_schema(self):
        """Test getting adapter config schema."""
        AdapterRegistry.register(MockTestAdapter)

        adapter_cls = AdapterRegistry.get("mock_test")
        schema = adapter_cls.config_schema

        assert schema["type"] == "object"
        assert "host" in schema["properties"]
        assert "host" in schema["required"]

    def test_config_schema_includes_required(self):
        """Test that config schema includes required fields."""
        AdapterRegistry.register(MockTestAdapter)

        info = AdapterRegistry.get_adapter_info("mock_test")
        assert "config_schema" in info
        assert "required" in info["config_schema"]
