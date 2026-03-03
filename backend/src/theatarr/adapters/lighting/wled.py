"""WLED WiFi LED controller adapter."""

import logging
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

logger = logging.getLogger(__name__)


@AdapterRegistry.register
class WLEDAdapter(ServiceAdapter):
    """Adapter for WLED WiFi LED controllers."""

    adapter_type = "wled"
    category = AdapterCategory.LIGHTING
    display_name = "WLED"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.host = config.get("host", "")
        self.port = config.get("port", 80)
        self._base_url = f"http://{self.host}:{self.port}/json"
        self._client: httpx.AsyncClient | None = None
        self._segments: list[dict] = []
        self._effects: list[str] = []
        self._palettes: list[str] = []
        self._device_name: str = ""

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "host": {
                    "type": "string",
                    "description": "IP address or hostname of the WLED device",
                },
                "port": {
                    "type": "integer",
                    "description": "HTTP port (default 80)",
                    "default": 80,
                },
            },
            "required": ["host"],
        }

    async def connect(self) -> None:
        """Establish connection and cache device info."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)

        try:
            # Fetch device info
            resp = await self._client.get(f"{self._base_url}/info")
            resp.raise_for_status()
            info = resp.json()
            self._device_name = info.get("name", "WLED")

            # Fetch current state (segments)
            resp = await self._client.get(f"{self._base_url}/state")
            resp.raise_for_status()
            state = resp.json()
            self._segments = state.get("seg", [])

            # Fetch effects
            resp = await self._client.get(f"{self._base_url}/effects")
            resp.raise_for_status()
            self._effects = resp.json()

            # Fetch palettes
            resp = await self._client.get(f"{self._base_url}/palettes")
            resp.raise_for_status()
            self._palettes = resp.json()

            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to WLED: {e}")

    async def disconnect(self) -> None:
        """Disconnect from WLED device."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to WLED device."""
        try:
            client = httpx.AsyncClient(timeout=5.0)
            try:
                resp = await client.get(f"{self._base_url}/info")
                resp.raise_for_status()
                info = resp.json()

                leds = info.get("leds", {})
                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message=f"Connected to {info.get('name', 'WLED')}",
                    details={
                        "name": info.get("name"),
                        "version": info.get("ver"),
                        "led_count": leds.get("count", 0),
                        "max_power": leds.get("maxpwr", 0),
                        "brand": info.get("brand", "WLED"),
                        "arch": info.get("arch"),
                    },
                )
            finally:
                await client.aclose()
        except httpx.TimeoutException:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Connection timed out - check WLED IP address",
            )
        except httpx.ConnectError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Could not connect - verify IP address and port",
            )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=str(e),
            )

    def get_capabilities(self) -> list[Capability]:
        """Get WLED capabilities."""
        return [
            Capability(
                name="get_lights",
                parameters=[],
                description="List WLED segments",
            ),
            Capability(
                name="get_scenes",
                parameters=[],
                description="List WLED effects",
            ),
            Capability(
                name="set_color",
                parameters=["targets", "color", "brightness", "transition_ms"],
                description="Set segment color and brightness",
            ),
            Capability(
                name="set_brightness",
                parameters=["targets", "brightness", "transition_ms"],
                description="Set segment brightness",
            ),
            Capability(
                name="turn_on",
                parameters=["targets", "transition_ms"],
                description="Turn on LEDs",
            ),
            Capability(
                name="turn_off",
                parameters=["targets", "transition_ms"],
                description="Turn off LEDs",
            ),
            Capability(
                name="set_effect",
                parameters=["targets", "effect", "speed", "intensity", "palette"],
                description="Set LED effect with speed and intensity",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on the WLED device."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "get_lights":
                return await self._get_lights()
            elif command.action == "get_scenes":
                return await self._get_scenes()
            elif command.action == "set_color":
                return await self._set_color(command.parameters, command.targets)
            elif command.action == "set_brightness":
                return await self._set_brightness(command.parameters, command.targets)
            elif command.action == "turn_on":
                return await self._set_power(True, command.parameters, command.targets)
            elif command.action == "turn_off":
                return await self._set_power(False, command.parameters, command.targets)
            elif command.action == "set_effect":
                return await self._set_effect(command.parameters, command.targets)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _get_lights(self) -> CommandResult:
        """Get WLED segments as light items."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        try:
            resp = await self._client.get(f"{self._base_url}/state")
            resp.raise_for_status()
            state = resp.json()
            self._segments = state.get("seg", [])
        except Exception:
            pass

        if len(self._segments) <= 1:
            items = [{"id": "0", "name": f"{self._device_name} — Toutes les LEDs"}]
        else:
            items = []
            for seg in self._segments:
                seg_id = seg.get("id", len(items))
                start = seg.get("start", 0)
                stop = seg.get("stop", 0)
                items.append({
                    "id": str(seg_id),
                    "name": f"Segment {seg_id} (LEDs {start}-{stop - 1})",
                })

        return CommandResult(success=True, data={"lights": items})

    async def _get_scenes(self) -> CommandResult:
        """Get WLED effects as scenes."""
        if not self._effects and self._client:
            try:
                resp = await self._client.get(f"{self._base_url}/effects")
                resp.raise_for_status()
                self._effects = resp.json()
            except Exception:
                pass

        scenes = [
            {"id": str(idx), "name": name}
            for idx, name in enumerate(self._effects)
            if name and name != "Solid"
        ]
        return CommandResult(success=True, data={"scenes": scenes})

    async def _set_color(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set LED color."""
        color = parameters.get("color", "#ffffff")
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        rgb = self._hex_to_rgb(color)
        bri = int((brightness / 100) * 255)
        trans = transition_ms // 100

        payload = self._build_segment_payload(
            targets, col=[[rgb[0], rgb[1], rgb[2]]], fx=0
        )
        payload["on"] = True
        payload["bri"] = bri
        payload["transition"] = trans

        return await self._apply_state(payload)

    async def _set_brightness(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set LED brightness."""
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        bri = int((brightness / 100) * 255)
        trans = transition_ms // 100

        payload: dict[str, Any] = {
            "on": True,
            "bri": bri,
            "transition": trans,
        }
        return await self._apply_state(payload)

    async def _set_power(
        self,
        on: bool,
        parameters: dict[str, Any],
        targets: list[str] | None,
    ) -> CommandResult:
        """Turn LEDs on or off."""
        transition_ms = parameters.get("transition_ms", 400)
        trans = transition_ms // 100

        payload: dict[str, Any] = {"on": on, "transition": trans}
        return await self._apply_state(payload)

    async def _set_effect(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set LED effect."""
        effect = parameters.get("effect", "0")
        speed = parameters.get("speed", 128)
        intensity = parameters.get("intensity", 128)
        palette = parameters.get("palette")
        transition_ms = parameters.get("transition_ms", 400)

        # Resolve effect name to index
        fx_id = self._resolve_effect(effect)
        if fx_id is None:
            return CommandResult(
                success=False,
                message=f"Unknown effect: {effect}",
            )

        seg_data: dict[str, Any] = {"fx": fx_id, "sx": speed, "ix": intensity}

        if palette is not None:
            pal_id = self._resolve_palette(palette)
            if pal_id is not None:
                seg_data["pal"] = pal_id

        payload = self._build_segment_payload(targets, **seg_data)
        payload["on"] = True
        payload["transition"] = transition_ms // 100

        return await self._apply_state(payload)

    def _build_segment_payload(
        self, targets: list[str] | None, **seg_fields: Any
    ) -> dict[str, Any]:
        """Build a state payload, optionally targeting specific segments."""
        if targets and "all" not in targets:
            segs = []
            for t in targets:
                try:
                    seg: dict[str, Any] = {"id": int(t)}
                    seg.update(seg_fields)
                    segs.append(seg)
                except (ValueError, TypeError):
                    pass
            if segs:
                return {"seg": segs}

        # Apply to all: set fields on first segment
        if seg_fields:
            seg_all: dict[str, Any] = {"id": 0}
            seg_all.update(seg_fields)
            return {"seg": [seg_all]}

        return {}

    async def _apply_state(self, payload: dict[str, Any]) -> CommandResult:
        """POST state to WLED JSON API."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        try:
            resp = await self._client.post(f"{self._base_url}/state", json=payload)
            resp.raise_for_status()
            return CommandResult(success=True, message="State applied")
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    def _resolve_effect(self, effect: Any) -> int | None:
        """Resolve effect name or ID to numeric index."""
        # Try as integer
        try:
            idx = int(effect)
            if 0 <= idx < len(self._effects):
                return idx
        except (ValueError, TypeError):
            pass

        # Search by name (case-insensitive)
        if isinstance(effect, str):
            for idx, name in enumerate(self._effects):
                if name.lower() == effect.lower():
                    return idx

        return None

    def _resolve_palette(self, palette: Any) -> int | None:
        """Resolve palette name or ID to numeric index."""
        try:
            idx = int(palette)
            if 0 <= idx < len(self._palettes):
                return idx
        except (ValueError, TypeError):
            pass

        if isinstance(palette, str):
            for idx, name in enumerate(self._palettes):
                if name.lower() == palette.lower():
                    return idx

        return None

    @staticmethod
    def _hex_to_rgb(hex_color: str) -> list[int]:
        """Convert hex color string to [r, g, b] list."""
        hex_color = hex_color.lstrip("#")
        return [
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16),
        ]
