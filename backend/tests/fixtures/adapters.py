"""Adapter fixtures for testing."""

from typing import Any

import pytest

from theatarr.adapters.base import (
    AdapterCategory,
    Capability,
    Command,
    CommandResult,
    ConnectionStatus,
    ConnectionTestResult,
    ServiceAdapter,
)
from theatarr.adapters.registry import AdapterRegistry


class TestLightingAdapter(ServiceAdapter):
    """Test lighting adapter that records all operations."""

    adapter_type = "test_lighting"
    category = AdapterCategory.LIGHTING
    display_name = "Test Lighting"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.commands_executed: list[Command] = []
        self.should_fail = config.get("should_fail", False)
        self.latency_ms = config.get("latency_ms", 0)

    async def connect(self) -> None:
        self._is_connected = True

    async def disconnect(self) -> None:
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        if self.should_fail:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Test failure",
            )
        return ConnectionTestResult(
            status=ConnectionStatus.CONNECTED,
            message="Test connection successful",
        )

    def get_capabilities(self) -> list[Capability]:
        return [
            Capability(name="set_color", parameters=["color", "intensity"]),
            Capability(name="power", parameters=["state"]),
        ]

    async def execute(self, command: Command) -> CommandResult:
        self.commands_executed.append(command)

        if self.should_fail:
            return CommandResult(
                success=False,
                message="Test failure",
            )

        return CommandResult(
            success=True,
            message=f"Executed {command.action}",
            duration_ms=self.latency_ms,
        )

    def reset(self) -> None:
        """Reset the adapter state."""
        self.commands_executed.clear()


class TestPlayerAdapter(ServiceAdapter):
    """Test player adapter that records all operations."""

    adapter_type = "test_player"
    category = AdapterCategory.PLAYER
    display_name = "Test Player"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.state = "stopped"
        self.current_media: str | None = None
        self.position_ms = 0
        self.commands_executed: list[Command] = []

    async def connect(self) -> None:
        self._is_connected = True

    async def disconnect(self) -> None:
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        return ConnectionTestResult(
            status=ConnectionStatus.CONNECTED,
            message="Test player connected",
        )

    def get_capabilities(self) -> list[Capability]:
        return [
            Capability(name="play", parameters=["media_id", "position_ms"]),
            Capability(name="pause", parameters=[]),
            Capability(name="stop", parameters=[]),
            Capability(name="seek", parameters=["position_ms"]),
        ]

    async def execute(self, command: Command) -> CommandResult:
        self.commands_executed.append(command)

        if command.action == "play":
            self.state = "playing"
            self.current_media = command.parameters.get("media_id")
            self.position_ms = command.parameters.get("position_ms", 0)
        elif command.action == "pause":
            self.state = "paused"
        elif command.action == "stop":
            self.state = "stopped"
            self.current_media = None
            self.position_ms = 0
        elif command.action == "seek":
            self.position_ms = command.parameters.get("position_ms", 0)

        return CommandResult(
            success=True,
            message=f"Player {command.action}",
        )

    def reset(self) -> None:
        """Reset the adapter state."""
        self.state = "stopped"
        self.current_media = None
        self.position_ms = 0
        self.commands_executed.clear()


@pytest.fixture
def test_lighting_adapter() -> TestLightingAdapter:
    """Create a test lighting adapter."""
    adapter = TestLightingAdapter({})
    return adapter


@pytest.fixture
def test_player_adapter() -> TestPlayerAdapter:
    """Create a test player adapter."""
    adapter = TestPlayerAdapter({})
    return adapter


@pytest.fixture
def register_test_adapters() -> None:
    """Register test adapters in the registry."""
    # Clear registry first
    AdapterRegistry.clear()

    # Register test adapters
    AdapterRegistry.register(TestLightingAdapter)
    AdapterRegistry.register(TestPlayerAdapter)

    yield

    # Clean up
    AdapterRegistry.clear()
