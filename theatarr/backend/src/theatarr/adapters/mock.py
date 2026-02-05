"""Mock adapter for testing and development."""

import asyncio
import random
from typing import Any

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


@AdapterRegistry.register
class MockLightingAdapter(ServiceAdapter):
    """Mock lighting adapter for testing."""

    adapter_type = "mock_lighting"
    category = AdapterCategory.LIGHTING
    display_name = "Mock Lighting"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._lights: dict[str, dict[str, Any]] = {}
        self._groups: dict[str, list[str]] = {}
        self._initialize_mock_data()

    def _initialize_mock_data(self) -> None:
        """Initialize mock lights and groups."""
        self._lights = {
            "light-1": {"name": "Ceiling Light", "on": False, "color": "#FFFFFF", "brightness": 100},
            "light-2": {"name": "Floor Lamp", "on": False, "color": "#FFFFFF", "brightness": 100},
            "light-3": {"name": "Accent Light", "on": False, "color": "#FFFFFF", "brightness": 100},
        }
        self._groups = {
            "living-room": ["light-1", "light-2"],
            "cinema": ["light-1", "light-2", "light-3"],
        }

    async def connect(self) -> None:
        """Simulate connection."""
        await asyncio.sleep(0.1)  # Simulate network delay
        self._is_connected = True

    async def disconnect(self) -> None:
        """Simulate disconnection."""
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test mock connection."""
        await asyncio.sleep(0.05)
        return ConnectionTestResult(
            status=ConnectionStatus.CONNECTED,
            message="Mock connection successful",
            details={
                "lights": len(self._lights),
                "groups": len(self._groups),
            },
        )

    def get_capabilities(self) -> list[Capability]:
        """Get mock lighting capabilities."""
        return [
            Capability(
                name="set_color",
                parameters=["color", "intensity", "transition_ms", "targets"],
                description="Set light color and intensity",
            ),
            Capability(
                name="set_effect",
                parameters=["effect", "speed", "targets"],
                description="Apply lighting effect",
            ),
            Capability(
                name="power",
                parameters=["state", "targets"],
                description="Turn lights on/off",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute mock lighting command."""
        await asyncio.sleep(random.uniform(0.01, 0.05))  # Simulate latency

        targets = command.targets or list(self._lights.keys())

        if command.action == "set_color":
            color = command.parameters.get("color", "#FFFFFF")
            intensity = command.parameters.get("intensity", 100)

            for target in targets:
                if target.startswith("group:"):
                    group_name = target[6:]
                    light_ids = self._groups.get(group_name, [])
                else:
                    light_ids = [target]

                for light_id in light_ids:
                    if light_id in self._lights:
                        self._lights[light_id]["color"] = color
                        self._lights[light_id]["brightness"] = intensity
                        self._lights[light_id]["on"] = True

            return CommandResult(
                success=True,
                message=f"Set color {color} at {intensity}% on {len(targets)} targets",
                duration_ms=int(random.uniform(10, 50)),
            )

        elif command.action == "power":
            state = command.parameters.get("state", "on")
            for target in targets:
                if target in self._lights:
                    self._lights[target]["on"] = state == "on"

            return CommandResult(
                success=True,
                message=f"Power {state} on {len(targets)} lights",
                duration_ms=int(random.uniform(10, 30)),
            )

        return CommandResult(
            success=False,
            message=f"Unknown command: {command.action}",
        )

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        """Get config schema for mock adapter."""
        return {
            "type": "object",
            "properties": {
                "delay_ms": {
                    "type": "integer",
                    "description": "Simulated delay in milliseconds",
                    "default": 50,
                },
                "fail_rate": {
                    "type": "number",
                    "description": "Random failure rate (0-1)",
                    "default": 0,
                },
            },
            "required": [],
        }


@AdapterRegistry.register
class MockPlayerAdapter(ServiceAdapter):
    """Mock media player adapter for testing."""

    adapter_type = "mock_player"
    category = AdapterCategory.PLAYER
    display_name = "Mock Player"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self._state = "stopped"
        self._current_media: str | None = None
        self._position_ms = 0

    async def connect(self) -> None:
        """Simulate connection."""
        await asyncio.sleep(0.1)
        self._is_connected = True

    async def disconnect(self) -> None:
        """Simulate disconnection."""
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test mock connection."""
        await asyncio.sleep(0.05)
        return ConnectionTestResult(
            status=ConnectionStatus.CONNECTED,
            message="Mock player connection successful",
        )

    def get_capabilities(self) -> list[Capability]:
        """Get mock player capabilities."""
        return [
            Capability(name="play", parameters=["media_id", "position_ms"]),
            Capability(name="pause", parameters=[]),
            Capability(name="stop", parameters=[]),
            Capability(name="seek", parameters=["position_ms"]),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute mock player command."""
        await asyncio.sleep(random.uniform(0.01, 0.05))

        if command.action == "play":
            self._state = "playing"
            self._current_media = command.parameters.get("media_id")
            self._position_ms = command.parameters.get("position_ms", 0)
            return CommandResult(success=True, message="Playing")

        elif command.action == "pause":
            self._state = "paused"
            return CommandResult(success=True, message="Paused")

        elif command.action == "stop":
            self._state = "stopped"
            self._current_media = None
            self._position_ms = 0
            return CommandResult(success=True, message="Stopped")

        elif command.action == "seek":
            self._position_ms = command.parameters.get("position_ms", 0)
            return CommandResult(success=True, message=f"Seeked to {self._position_ms}ms")

        return CommandResult(success=False, message=f"Unknown command: {command.action}")

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        """Get config schema for mock player."""
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }
