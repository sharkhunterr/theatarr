"""Home Assistant lighting adapter."""

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
class HomeAssistantAdapter(ServiceAdapter):
    """Adapter for Home Assistant lighting control."""

    adapter_type = "homeassistant"
    category = AdapterCategory.LIGHTING
    display_name = "Home Assistant"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get("base_url", "").rstrip("/")
        self.token = config.get("token", "")
        self._client: httpx.AsyncClient | None = None
        self._lights: dict[str, dict] = {}

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "base_url": {
                    "type": "string",
                    "description": "Home Assistant URL (e.g., http://homeassistant.local:8123)",
                },
                "token": {
                    "type": "string",
                    "description": "Long-lived access token",
                },
            },
            "required": ["base_url", "token"],
        }

    def _get_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def connect(self) -> None:
        """Establish connection to Home Assistant."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=10.0,
                headers=self._get_headers(),
            )

        try:
            # Get all light entities
            response = await self._client.get(f"{self.base_url}/api/states")
            response.raise_for_status()
            states = response.json()

            # Filter light entities
            self._lights = {
                state["entity_id"]: state
                for state in states
                if state["entity_id"].startswith("light.")
            }
            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Home Assistant: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Home Assistant."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to Home Assistant."""
        try:
            async with httpx.AsyncClient(
                timeout=5.0,
                headers=self._get_headers(),
            ) as client:
                response = await client.get(f"{self.base_url}/api/")

                if response.status_code == 401:
                    return ConnectionTestResult(
                        status=ConnectionStatus.ERROR,
                        message="Authentication failed - check access token",
                    )

                response.raise_for_status()
                data = response.json()

                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to Home Assistant",
                    details={
                        "message": data.get("message"),
                    },
                )
        except httpx.TimeoutException:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Connection timed out",
            )
        except httpx.ConnectError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Could not connect - verify URL",
            )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=str(e),
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Home Assistant capabilities."""
        return [
            Capability(
                name="set_color",
                parameters=["targets", "color", "brightness", "transition"],
                description="Set light color and brightness",
            ),
            Capability(
                name="set_brightness",
                parameters=["targets", "brightness", "transition"],
                description="Set light brightness",
            ),
            Capability(
                name="turn_on",
                parameters=["targets", "transition"],
                description="Turn lights on",
            ),
            Capability(
                name="turn_off",
                parameters=["targets", "transition"],
                description="Turn lights off",
            ),
            Capability(
                name="call_service",
                parameters=["domain", "service", "service_data"],
                description="Call any Home Assistant service",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Home Assistant."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "set_color":
                return await self._set_color(command.parameters, command.targets)
            elif command.action == "set_brightness":
                return await self._set_brightness(command.parameters, command.targets)
            elif command.action == "turn_on":
                return await self._turn_on(command.parameters, command.targets)
            elif command.action == "turn_off":
                return await self._turn_off(command.parameters, command.targets)
            elif command.action == "call_service":
                return await self._call_service(command.parameters)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _call_ha_service(
        self,
        domain: str,
        service: str,
        service_data: dict[str, Any],
    ) -> CommandResult:
        """Call a Home Assistant service."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        try:
            response = await self._client.post(
                f"{self.base_url}/api/services/{domain}/{service}",
                json=service_data,
            )
            response.raise_for_status()
            return CommandResult(success=True, message=f"Called {domain}.{service}")
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _set_color(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light color."""
        color = parameters.get("color", "#ffffff")
        brightness = parameters.get("brightness", 100)
        transition = parameters.get("transition", 0.4)

        # Convert hex to RGB
        rgb = self._hex_to_rgb(color)
        bri = int((brightness / 100) * 255)

        entity_ids = self._resolve_targets(targets)
        service_data = {
            "entity_id": entity_ids,
            "rgb_color": rgb,
            "brightness": bri,
            "transition": transition,
        }

        return await self._call_ha_service("light", "turn_on", service_data)

    async def _set_brightness(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light brightness."""
        brightness = parameters.get("brightness", 100)
        transition = parameters.get("transition", 0.4)

        bri = int((brightness / 100) * 255)
        entity_ids = self._resolve_targets(targets)

        service_data = {
            "entity_id": entity_ids,
            "brightness": bri,
            "transition": transition,
        }

        return await self._call_ha_service("light", "turn_on", service_data)

    async def _turn_on(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Turn lights on."""
        transition = parameters.get("transition", 0.4)
        entity_ids = self._resolve_targets(targets)

        service_data = {
            "entity_id": entity_ids,
            "transition": transition,
        }

        return await self._call_ha_service("light", "turn_on", service_data)

    async def _turn_off(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Turn lights off."""
        transition = parameters.get("transition", 0.4)
        entity_ids = self._resolve_targets(targets)

        service_data = {
            "entity_id": entity_ids,
            "transition": transition,
        }

        return await self._call_ha_service("light", "turn_off", service_data)

    async def _call_service(self, parameters: dict[str, Any]) -> CommandResult:
        """Call any Home Assistant service."""
        domain = parameters.get("domain", "")
        service = parameters.get("service", "")
        service_data = parameters.get("service_data", {})

        if not domain or not service:
            return CommandResult(
                success=False,
                message="domain and service are required",
            )

        return await self._call_ha_service(domain, service, service_data)

    def _resolve_targets(self, targets: list[str] | str | None) -> list[str]:
        """Resolve target names to entity IDs."""
        if targets is None:
            return list(self._lights.keys())
        if isinstance(targets, str):
            targets = [t.strip() for t in targets.split(",") if t.strip()]
        if not targets or targets == ["all"]:
            return list(self._lights.keys())

        entity_ids = []
        for target in targets:
            # If it's already an entity ID
            if target.startswith("light."):
                entity_ids.append(target)
            else:
                # Try to find by friendly name
                for entity_id, state in self._lights.items():
                    friendly_name = state.get("attributes", {}).get("friendly_name", "")
                    if friendly_name.lower() == target.lower():
                        entity_ids.append(entity_id)
                        break
                else:
                    # Assume it's an entity suffix
                    entity_ids.append(f"light.{target}")

        return entity_ids

    def _hex_to_rgb(self, hex_color: str) -> list[int]:
        """Convert hex color to RGB list."""
        hex_color = hex_color.lstrip("#")
        return [
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16),
        ]
