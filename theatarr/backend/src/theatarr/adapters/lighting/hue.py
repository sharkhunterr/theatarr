"""Philips Hue lighting adapter."""

import asyncio
from typing import Any

import httpx

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
class HueAdapter(ServiceAdapter):
    """Adapter for Philips Hue lighting systems."""

    adapter_type = "hue"
    category = AdapterCategory.LIGHTING
    display_name = "Philips Hue"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.bridge_ip = config.get("bridge_ip", "")
        self.api_key = config.get("api_key", "")
        self._base_url = f"http://{self.bridge_ip}/api/{self.api_key}"
        self._client: httpx.AsyncClient | None = None
        self._lights: dict[str, dict] = {}
        self._groups: dict[str, dict] = {}

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "bridge_ip": {
                    "type": "string",
                    "description": "IP address of the Hue Bridge",
                },
                "api_key": {
                    "type": "string",
                    "description": "API key (username) for the Hue Bridge",
                },
            },
            "required": ["bridge_ip", "api_key"],
        }

    async def connect(self) -> None:
        """Establish connection to Hue Bridge."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)

        # Verify connection and cache device info
        try:
            response = await self._client.get(f"{self._base_url}/lights")
            response.raise_for_status()
            self._lights = response.json()

            response = await self._client.get(f"{self._base_url}/groups")
            response.raise_for_status()
            self._groups = response.json()

            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Hue Bridge: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Hue Bridge."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to Hue Bridge."""
        try:
            client = httpx.AsyncClient(timeout=5.0)
            try:
                response = await client.get(f"{self._base_url}/config")
                data = response.json()

                # Check for error response
                if isinstance(data, list) and data and "error" in data[0]:
                    return ConnectionTestResult(
                        status=ConnectionStatus.ERROR,
                        message=data[0]["error"].get("description", "Authentication failed"),
                    )

                # Success - got bridge config
                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to Hue Bridge",
                    details={
                        "name": data.get("name"),
                        "bridge_id": data.get("bridgeid"),
                        "model_id": data.get("modelid"),
                        "api_version": data.get("apiversion"),
                    },
                )
            finally:
                await client.aclose()
        except httpx.TimeoutException:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Connection timed out - check bridge IP address",
            )
        except httpx.ConnectError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Could not connect to bridge - verify IP address",
            )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=str(e),
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Hue capabilities."""
        return [
            Capability(
                name="set_color",
                parameters=["targets", "color", "brightness", "transition_ms"],
                description="Set light color and brightness",
            ),
            Capability(
                name="set_brightness",
                parameters=["targets", "brightness", "transition_ms"],
                description="Set light brightness",
            ),
            Capability(
                name="turn_on",
                parameters=["targets", "transition_ms"],
                description="Turn lights on",
            ),
            Capability(
                name="turn_off",
                parameters=["targets", "transition_ms"],
                description="Turn lights off",
            ),
            Capability(
                name="set_scene",
                parameters=["scene"],
                description="Activate a Hue scene",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Hue lights."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "set_color":
                return await self._set_color(command.parameters, command.targets)
            elif command.action == "set_brightness":
                return await self._set_brightness(command.parameters, command.targets)
            elif command.action == "turn_on":
                return await self._set_power(True, command.parameters, command.targets)
            elif command.action == "turn_off":
                return await self._set_power(False, command.parameters, command.targets)
            elif command.action == "set_scene":
                return await self._set_scene(command.parameters)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(
                success=False,
                message=str(e),
            )

    async def _set_color(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light color."""
        color = parameters.get("color", "#ffffff")
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        # Convert hex color to Hue xy values
        xy = self._hex_to_xy(color)
        bri = int((brightness / 100) * 254)
        transition_time = transition_ms // 100  # Hue uses 100ms units

        state = {
            "on": True,
            "xy": xy,
            "bri": bri,
            "transitiontime": transition_time,
        }

        return await self._apply_state(state, targets)

    async def _set_brightness(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light brightness."""
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        bri = int((brightness / 100) * 254)
        transition_time = transition_ms // 100

        state = {
            "on": True,
            "bri": bri,
            "transitiontime": transition_time,
        }

        return await self._apply_state(state, targets)

    async def _set_power(
        self,
        on: bool,
        parameters: dict[str, Any],
        targets: list[str] | None,
    ) -> CommandResult:
        """Turn lights on or off."""
        transition_ms = parameters.get("transition_ms", 400)
        transition_time = transition_ms // 100

        state = {
            "on": on,
            "transitiontime": transition_time,
        }

        return await self._apply_state(state, targets)

    async def _set_scene(self, parameters: dict[str, Any]) -> CommandResult:
        """Activate a Hue scene."""
        scene_name = parameters.get("scene", "")

        if not self._client:
            return CommandResult(success=False, message="Not connected")

        try:
            # Find scene by name
            response = await self._client.get(f"{self._base_url}/scenes")
            scenes = response.json()

            scene_id = None
            for sid, scene_data in scenes.items():
                if scene_data.get("name", "").lower() == scene_name.lower():
                    scene_id = sid
                    break

            if not scene_id:
                return CommandResult(
                    success=False,
                    message=f"Scene not found: {scene_name}",
                )

            # Activate scene
            response = await self._client.put(
                f"{self._base_url}/groups/0/action",
                json={"scene": scene_id},
            )

            return CommandResult(
                success=True,
                message=f"Activated scene: {scene_name}",
            )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _apply_state(
        self, state: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Apply state to lights or groups."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        try:
            if targets is None or "all" in targets:
                # Apply to all lights (group 0)
                response = await self._client.put(
                    f"{self._base_url}/groups/0/action",
                    json=state,
                )
            else:
                # Apply to specific targets
                for target in targets:
                    # Check if target is a group
                    if target in self._groups:
                        await self._client.put(
                            f"{self._base_url}/groups/{target}/action",
                            json=state,
                        )
                    # Check if target is a light name or ID
                    else:
                        light_id = self._find_light_id(target)
                        if light_id:
                            await self._client.put(
                                f"{self._base_url}/lights/{light_id}/state",
                                json=state,
                            )

            return CommandResult(success=True, message="State applied successfully")
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    def _find_light_id(self, name_or_id: str) -> str | None:
        """Find light ID by name or ID."""
        # Check if it's already an ID
        if name_or_id in self._lights:
            return name_or_id

        # Search by name
        for light_id, light_data in self._lights.items():
            if light_data.get("name", "").lower() == name_or_id.lower():
                return light_id

        return None

    def _hex_to_xy(self, hex_color: str) -> list[float]:
        """Convert hex color to Hue XY color space."""
        # Remove # if present
        hex_color = hex_color.lstrip("#")

        # Parse RGB
        r = int(hex_color[0:2], 16) / 255
        g = int(hex_color[2:4], 16) / 255
        b = int(hex_color[4:6], 16) / 255

        # Apply gamma correction
        r = ((r + 0.055) / (1.0 + 0.055)) ** 2.4 if r > 0.04045 else r / 12.92
        g = ((g + 0.055) / (1.0 + 0.055)) ** 2.4 if g > 0.04045 else g / 12.92
        b = ((b + 0.055) / (1.0 + 0.055)) ** 2.4 if b > 0.04045 else b / 12.92

        # Convert to XYZ
        X = r * 0.4124 + g * 0.3576 + b * 0.1805
        Y = r * 0.2126 + g * 0.7152 + b * 0.0722
        Z = r * 0.0193 + g * 0.1192 + b * 0.9505

        # Convert to xy
        total = X + Y + Z
        if total == 0:
            return [0.0, 0.0]

        x = X / total
        y = Y / total

        return [round(x, 4), round(y, 4)]
