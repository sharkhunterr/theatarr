"""Zigbee2MQTT lighting adapter via MQTT."""

import asyncio
import json
import logging
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

logger = logging.getLogger(__name__)

DISCOVERY_TIMEOUT = 10  # seconds


@AdapterRegistry.register
class Zigbee2MQTTAdapter(ServiceAdapter):
    """Adapter for Zigbee2MQTT lighting devices via MQTT broker."""

    adapter_type = "zigbee2mqtt"
    category = AdapterCategory.LIGHTING
    display_name = "Zigbee2MQTT"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        # Strip protocol prefixes (mqtt://, tcp://) — user may paste full URL
        host = config.get("mqtt_host", "")
        for prefix in ("mqtt://", "mqtts://", "tcp://", "ssl://"):
            if host.startswith(prefix):
                host = host[len(prefix):]
                break
        self.mqtt_host = host.rstrip("/")
        self.mqtt_port = int(config.get("mqtt_port", 1883))
        self.mqtt_username = config.get("mqtt_username") or None
        self.mqtt_password = config.get("mqtt_password") or None
        self.base_topic = config.get("base_topic", "zigbee2mqtt")
        self._devices: dict[str, dict[str, Any]] = {}
        self._groups: dict[str, dict[str, Any]] = {}

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "mqtt_host": {
                    "type": "string",
                    "description": "MQTT broker host (IP or hostname)",
                },
                "mqtt_port": {
                    "type": "integer",
                    "description": "MQTT broker port",
                    "default": 1883,
                },
                "mqtt_username": {
                    "type": "string",
                    "description": "MQTT username (optional)",
                },
                "mqtt_password": {
                    "type": "string",
                    "description": "MQTT password (optional)",
                    "format": "password",
                },
                "base_topic": {
                    "type": "string",
                    "description": "Zigbee2MQTT base MQTT topic",
                    "default": "zigbee2mqtt",
                },
            },
            "required": ["mqtt_host"],
        }

    def _get_mqtt_client(self) -> "aiomqtt.Client":
        """Create an MQTT client configured from adapter settings."""
        import aiomqtt

        return aiomqtt.Client(
            hostname=self.mqtt_host,
            port=self.mqtt_port,
            username=self.mqtt_username,
            password=self.mqtt_password,
            timeout=DISCOVERY_TIMEOUT,
        )

    async def connect(self) -> None:
        """Connect and discover light devices."""
        try:
            await self._discover_devices()
            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Zigbee2MQTT: {e}")

    async def disconnect(self) -> None:
        """Disconnect and clear cached devices."""
        self._devices.clear()
        self._groups.clear()
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to MQTT broker and Zigbee2MQTT availability."""
        try:
            import aiomqtt

            async with self._get_mqtt_client() as client:
                # Subscribe to bridge state to verify Z2M is running
                await client.subscribe(f"{self.base_topic}/bridge/state")

                # Request bridge state
                state_payload: dict[str, Any] | None = None
                try:
                    message = await asyncio.wait_for(
                        self._collect_one(client), timeout=5.0
                    )
                    if message:
                        raw = message.payload
                        if isinstance(raw, bytes):
                            raw = raw.decode()
                        try:
                            state_payload = json.loads(raw)
                        except (json.JSONDecodeError, TypeError):
                            state_payload = {"state": raw}
                except asyncio.TimeoutError:
                    # No state message yet — Z2M might not have published recently
                    # But MQTT connection succeeded
                    pass

                # Also try to discover devices + groups for the details
                device_count = 0
                group_count = 0
                try:
                    devices = await asyncio.wait_for(
                        self._do_discover_all(client), timeout=DISCOVERY_TIMEOUT
                    )
                    device_count = len(devices)
                    group_count = len(self._groups)
                except asyncio.TimeoutError:
                    pass

                details: dict[str, Any] = {"light_count": device_count, "group_count": group_count}
                if state_payload and isinstance(state_payload, dict):
                    details["z2m_state"] = state_payload.get("state", "unknown")

                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message=f"Connected — {device_count} light(s), {group_count} group(s) found",
                    details=details,
                )

        except ImportError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="aiomqtt package is not installed",
            )
        except Exception as e:
            err_str = str(e)
            if "not authorized" in err_str.lower() or "bad user name" in err_str.lower():
                return ConnectionTestResult(
                    status=ConnectionStatus.ERROR,
                    message="MQTT authentication failed — verify username and password",
                )
            if "Connect" in type(e).__name__ or "refused" in err_str.lower():
                return ConnectionTestResult(
                    status=ConnectionStatus.ERROR,
                    message=f"Could not connect to MQTT broker — {err_str}",
                )
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=f"MQTT error: {err_str}",
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Zigbee2MQTT lighting capabilities."""
        return [
            Capability(
                name="get_lights",
                parameters=[],
                description="Discover Zigbee light devices",
            ),
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
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Zigbee2MQTT lights."""
        try:
            if command.action == "get_lights":
                return await self._get_lights()
            elif command.action == "set_color":
                return await self._set_color(command.parameters, command.targets)
            elif command.action == "set_brightness":
                return await self._set_brightness(command.parameters, command.targets)
            elif command.action == "turn_on":
                return await self._set_power("ON", command.parameters, command.targets)
            elif command.action == "turn_off":
                return await self._set_power("OFF", command.parameters, command.targets)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except ImportError:
            return CommandResult(
                success=False,
                message="aiomqtt package is not installed",
            )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    # ------------------------------------------------------------------
    # Device discovery
    # ------------------------------------------------------------------

    async def _discover_devices(self) -> list[dict[str, Any]]:
        """Discover light devices and groups from Zigbee2MQTT via MQTT."""
        async with self._get_mqtt_client() as client:
            result = await asyncio.wait_for(
                self._do_discover_all(client), timeout=DISCOVERY_TIMEOUT
            )
            return result

    async def _do_discover_all(self, client: "aiomqtt.Client") -> list[dict[str, Any]]:
        """Subscribe to devices + groups topics, request both, parse in a single loop."""
        devices_topic = f"{self.base_topic}/bridge/devices"
        groups_topic = f"{self.base_topic}/bridge/groups"

        await client.subscribe(devices_topic)
        await client.subscribe(groups_topic)
        await client.publish(
            f"{self.base_topic}/bridge/request/device/list", payload=""
        )
        await client.publish(
            f"{self.base_topic}/bridge/request/group/list", payload=""
        )

        got_devices = False
        got_groups = False
        lights: list[dict[str, Any]] = []

        async for message in client.messages:
            topic = str(message.topic)
            raw = message.payload
            if isinstance(raw, bytes):
                raw = raw.decode()

            if topic == devices_topic and not got_devices:
                all_devices = json.loads(raw)
                self._devices.clear()
                for dev in all_devices:
                    if self._is_light_device(dev):
                        info = self._parse_light_device(dev)
                        self._devices[info["id"]] = info
                        lights.append(info)
                logger.info(
                    "Zigbee2MQTT: discovered %d light(s) out of %d device(s)",
                    len(lights),
                    len(all_devices),
                )
                got_devices = True

            elif topic == groups_topic and not got_groups:
                all_groups = json.loads(raw)
                self._groups.clear()
                for grp in all_groups:
                    info = self._parse_group(grp)
                    if info["member_count"] > 0:
                        self._groups[info["id"]] = info
                logger.info(
                    "Zigbee2MQTT: discovered %d group(s)",
                    len(self._groups),
                )
                got_groups = True

            if got_devices and got_groups:
                return lights

        return lights

    @staticmethod
    def _parse_group(group: dict[str, Any]) -> dict[str, Any]:
        """Extract group info from a Z2M group."""
        friendly_name = group.get("friendly_name", "")
        group_id = group.get("id", 0)
        members = group.get("members", [])
        # Z2M members are {ieee_address: str, endpoint: int}
        member_addresses = [
            m.get("ieee_address", "") if isinstance(m, dict) else str(m)
            for m in members
        ]
        return {
            "id": friendly_name,
            "name": friendly_name,
            "group_id": group_id,
            "member_count": len(members),
            "members": member_addresses,
        }

    @staticmethod
    async def _collect_one(client: "aiomqtt.Client"):
        """Return the first message from the client."""
        async for message in client.messages:
            return message
        return None

    @staticmethod
    def _is_light_device(device: dict[str, Any]) -> bool:
        """Check if a Z2M device is a light."""
        definition = device.get("definition") or {}
        exposes = definition.get("exposes", [])
        for expose in exposes:
            if isinstance(expose, dict) and expose.get("type") == "light":
                return True
        return False

    @staticmethod
    def _parse_light_device(device: dict[str, Any]) -> dict[str, Any]:
        """Extract light info from a Z2M device."""
        friendly_name = device.get("friendly_name", device.get("ieee_address", ""))
        definition = device.get("definition") or {}
        model = definition.get("model", "")
        vendor = definition.get("vendor", "")
        description = definition.get("description", "")

        # Parse features from the light expose
        supports_color = False
        supports_brightness = False
        supports_color_temp = False
        exposes = definition.get("exposes", [])
        for expose in exposes:
            if isinstance(expose, dict) and expose.get("type") == "light":
                for feature in expose.get("features", []):
                    prop = feature.get("property", "")
                    if prop == "brightness":
                        supports_brightness = True
                    elif prop in ("color", "color_xy", "color_hs"):
                        supports_color = True
                    elif prop == "color_temp":
                        supports_color_temp = True

        display_name = friendly_name
        if vendor and model:
            display_name = f"{friendly_name} ({vendor} {model})"
        elif description:
            display_name = f"{friendly_name} — {description}"

        return {
            "id": friendly_name,
            "name": display_name,
            "supports_color": supports_color,
            "supports_brightness": supports_brightness,
            "supports_color_temp": supports_color_temp,
        }

    # ------------------------------------------------------------------
    # Light commands
    # ------------------------------------------------------------------

    async def _get_lights(self) -> CommandResult:
        """Get all light devices (re-discovers each call)."""
        try:
            await self._discover_devices()
        except asyncio.TimeoutError:
            if not self._devices:
                return CommandResult(
                    success=False,
                    message="Discovery timed out — is Zigbee2MQTT running?",
                )
        except Exception as e:
            if not self._devices:
                return CommandResult(success=False, message=str(e))

        return CommandResult(
            success=True,
            data={
                "lights": list(self._devices.values()),
                "groups": list(self._groups.values()),
            },
        )

    def _resolve_targets(self, targets: list[str] | str | None) -> list[str]:
        """Resolve target list to device/group friendly_names.

        Groups are valid Z2M targets — publishing to ``{base_topic}/{group}/set``
        controls all members at once.
        """
        if targets is None:
            return list(self._devices.keys())
        # Handle comma-separated string from frontend
        if isinstance(targets, str):
            targets = [t.strip() for t in targets.split(",") if t.strip()]
        if not targets or targets == ["all"]:
            return list(self._devices.keys())
        return targets

    async def _publish_to_devices(
        self, targets: list[str] | None, payload: dict[str, Any]
    ) -> CommandResult:
        """Publish a JSON payload to one or more Z2M devices."""
        device_names = self._resolve_targets(targets)
        if not device_names:
            return CommandResult(success=False, message="No target devices")

        payload_str = json.dumps(payload)
        errors: list[str] = []

        async with self._get_mqtt_client() as client:
            for name in device_names:
                topic = f"{self.base_topic}/{name}/set"
                try:
                    await client.publish(topic, payload=payload_str)
                except Exception as e:
                    errors.append(f"{name}: {e}")

        if errors:
            return CommandResult(
                success=False,
                message=f"Errors: {'; '.join(errors)}",
            )
        return CommandResult(
            success=True,
            message=f"Command sent to {len(device_names)} device(s)",
        )

    async def _set_color(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light color."""
        color = parameters.get("color", "#ffffff")
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        payload: dict[str, Any] = {
            "state": "ON",
            "color": {"hex": color},
            "brightness": int((brightness / 100) * 254),
            "transition": transition_ms / 1000,
        }
        return await self._publish_to_devices(targets, payload)

    async def _set_brightness(
        self, parameters: dict[str, Any], targets: list[str] | None
    ) -> CommandResult:
        """Set light brightness."""
        brightness = parameters.get("brightness", 100)
        transition_ms = parameters.get("transition_ms", 400)

        payload: dict[str, Any] = {
            "state": "ON",
            "brightness": int((brightness / 100) * 254),
            "transition": transition_ms / 1000,
        }
        return await self._publish_to_devices(targets, payload)

    async def _set_power(
        self,
        state: str,
        parameters: dict[str, Any],
        targets: list[str] | None,
    ) -> CommandResult:
        """Turn lights on or off."""
        transition_ms = parameters.get("transition_ms", 400)

        payload: dict[str, Any] = {
            "state": state,
            "transition": transition_ms / 1000,
        }
        return await self._publish_to_devices(targets, payload)
