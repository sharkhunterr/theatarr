"""ESPHome adapter for Theatarr lighting control."""

import asyncio
from typing import Any

import aiohttp

from theatarr.adapters.base import ServiceAdapter, AdapterCapability


class ESPHomeAdapter(ServiceAdapter):
    """Adapter for ESPHome-based lighting devices.

    ESPHome exposes a REST API and native API for controlling devices.
    This adapter uses the REST API for compatibility.
    """

    name = "esphome"
    service_type = "lighting"
    display_name = "ESPHome"
    description = "Control ESPHome-based lighting devices"

    config_schema = {
        "type": "object",
        "properties": {
            "host": {
                "type": "string",
                "title": "Host",
                "description": "ESPHome device IP or hostname",
            },
            "port": {
                "type": "integer",
                "title": "Port",
                "description": "ESPHome web server port",
                "default": 80,
            },
            "password": {
                "type": "string",
                "title": "Password",
                "description": "ESPHome web server password (if configured)",
                "format": "password",
            },
            "use_https": {
                "type": "boolean",
                "title": "Use HTTPS",
                "description": "Use HTTPS for API calls",
                "default": False,
            },
        },
        "required": ["host"],
    }

    capabilities = [
        AdapterCapability.LIGHT_ON_OFF,
        AdapterCapability.LIGHT_BRIGHTNESS,
        AdapterCapability.LIGHT_COLOR,
        AdapterCapability.LIGHT_TEMPERATURE,
    ]

    async def test_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        """Test connection to ESPHome device."""
        host = config.get("host")
        port = config.get("port", 80)
        password = config.get("password")
        use_https = config.get("use_https", False)

        if not host:
            return {
                "success": False,
                "error": "Host is required",
            }

        protocol = "https" if use_https else "http"
        base_url = f"{protocol}://{host}:{port}"

        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if password:
                    headers["Authorization"] = f"Basic {password}"

                # Get device info
                async with session.get(
                    f"{base_url}/",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status == 401:
                        return {
                            "success": False,
                            "error": "Authentication required",
                        }

                    if response.status != 200:
                        return {
                            "success": False,
                            "error": f"HTTP {response.status}",
                        }

                    # Try to get device name from response
                    text = await response.text()

                    return {
                        "success": True,
                        "message": "Connected to ESPHome device",
                        "device_info": {
                            "host": host,
                            "port": port,
                        },
                    }

        except asyncio.TimeoutError:
            return {
                "success": False,
                "error": "Connection timeout",
            }
        except aiohttp.ClientError as e:
            return {
                "success": False,
                "error": f"Connection failed: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
            }

    async def get_capabilities(self, config: dict[str, Any]) -> dict[str, Any]:
        """Discover available lights from ESPHome device."""
        host = config.get("host")
        port = config.get("port", 80)
        password = config.get("password")
        use_https = config.get("use_https", False)

        protocol = "https" if use_https else "http"
        base_url = f"{protocol}://{host}:{port}"

        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if password:
                    headers["Authorization"] = f"Basic {password}"

                # Get available entities
                async with session.get(
                    f"{base_url}/light",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status != 200:
                        return {
                            "lights": [],
                            "error": f"Failed to get lights: HTTP {response.status}",
                        }

                    data = await response.json()

                    # ESPHome returns a list of light entities
                    lights = []
                    if isinstance(data, list):
                        for light in data:
                            lights.append({
                                "id": light.get("id", light.get("unique_id", "")),
                                "name": light.get("name", "Unknown Light"),
                                "state": light.get("state", "OFF"),
                                "brightness": light.get("brightness"),
                                "color_mode": light.get("color_mode"),
                                "supports_brightness": light.get("supports_brightness", True),
                                "supports_rgb": light.get("supports_rgb", False),
                                "supports_color_temp": light.get("supports_color_temperature", False),
                            })

                    return {
                        "lights": lights,
                        "capabilities": [cap.value for cap in self.capabilities],
                    }

        except Exception as e:
            return {
                "lights": [],
                "error": str(e),
            }

    async def execute_action(
        self,
        action_type: str,
        parameters: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a lighting action on ESPHome device."""
        host = config.get("host")
        port = config.get("port", 80)
        password = config.get("password")
        use_https = config.get("use_https", False)

        protocol = "https" if use_https else "http"
        base_url = f"{protocol}://{host}:{port}"

        light_id = parameters.get("light_id")
        if not light_id:
            return {
                "success": False,
                "error": "light_id is required",
            }

        try:
            async with aiohttp.ClientSession() as session:
                headers = {"Content-Type": "application/json"}
                if password:
                    headers["Authorization"] = f"Basic {password}"

                if action_type == "light_on":
                    # Turn light on with optional parameters
                    payload: dict[str, Any] = {"state": "ON"}

                    if "brightness" in parameters:
                        # ESPHome uses 0-255 for brightness
                        brightness_pct = parameters["brightness"]
                        payload["brightness"] = int(brightness_pct * 255 / 100)

                    if "color" in parameters:
                        color = parameters["color"]
                        if isinstance(color, dict):
                            payload["r"] = color.get("r", 255)
                            payload["g"] = color.get("g", 255)
                            payload["b"] = color.get("b", 255)
                        elif isinstance(color, str) and color.startswith("#"):
                            # Hex color
                            hex_color = color.lstrip("#")
                            payload["r"] = int(hex_color[0:2], 16)
                            payload["g"] = int(hex_color[2:4], 16)
                            payload["b"] = int(hex_color[4:6], 16)

                    if "color_temp" in parameters:
                        # ESPHome uses mireds
                        payload["color_temp"] = parameters["color_temp"]

                    if "transition" in parameters:
                        # Transition in seconds
                        payload["transition"] = parameters["transition"]

                    async with session.post(
                        f"{base_url}/light/{light_id}/turn_on",
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Light {light_id} turned on",
                        }

                elif action_type == "light_off":
                    payload = {"state": "OFF"}

                    if "transition" in parameters:
                        payload["transition"] = parameters["transition"]

                    async with session.post(
                        f"{base_url}/light/{light_id}/turn_off",
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Light {light_id} turned off",
                        }

                elif action_type == "light_toggle":
                    async with session.post(
                        f"{base_url}/light/{light_id}/toggle",
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Light {light_id} toggled",
                        }

                elif action_type == "set_brightness":
                    brightness = parameters.get("brightness", 100)
                    payload = {
                        "state": "ON",
                        "brightness": int(brightness * 255 / 100),
                    }

                    if "transition" in parameters:
                        payload["transition"] = parameters["transition"]

                    async with session.post(
                        f"{base_url}/light/{light_id}/turn_on",
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Light {light_id} brightness set to {brightness}%",
                        }

                elif action_type == "set_color":
                    color = parameters.get("color", {"r": 255, "g": 255, "b": 255})
                    payload: dict[str, Any] = {"state": "ON"}

                    if isinstance(color, dict):
                        payload["r"] = color.get("r", 255)
                        payload["g"] = color.get("g", 255)
                        payload["b"] = color.get("b", 255)
                    elif isinstance(color, str) and color.startswith("#"):
                        hex_color = color.lstrip("#")
                        payload["r"] = int(hex_color[0:2], 16)
                        payload["g"] = int(hex_color[2:4], 16)
                        payload["b"] = int(hex_color[4:6], 16)

                    if "transition" in parameters:
                        payload["transition"] = parameters["transition"]

                    async with session.post(
                        f"{base_url}/light/{light_id}/turn_on",
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Light {light_id} color set",
                        }

                elif action_type == "set_scene":
                    scene_name = parameters.get("scene")
                    if not scene_name:
                        return {
                            "success": False,
                            "error": "scene name is required",
                        }

                    # ESPHome scenes are triggered differently
                    async with session.post(
                        f"{base_url}/button/{scene_name}/press",
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as response:
                        if response.status != 200:
                            return {
                                "success": False,
                                "error": f"HTTP {response.status}",
                            }

                        return {
                            "success": True,
                            "message": f"Scene {scene_name} activated",
                        }

                else:
                    return {
                        "success": False,
                        "error": f"Unknown action type: {action_type}",
                    }

        except asyncio.TimeoutError:
            return {
                "success": False,
                "error": "Request timeout",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Action failed: {str(e)}",
            }

    async def get_state(self, config: dict[str, Any]) -> dict[str, Any]:
        """Get current state of all lights from ESPHome device."""
        host = config.get("host")
        port = config.get("port", 80)
        password = config.get("password")
        use_https = config.get("use_https", False)

        protocol = "https" if use_https else "http"
        base_url = f"{protocol}://{host}:{port}"

        try:
            async with aiohttp.ClientSession() as session:
                headers = {}
                if password:
                    headers["Authorization"] = f"Basic {password}"

                async with session.get(
                    f"{base_url}/light",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status != 200:
                        return {
                            "success": False,
                            "error": f"HTTP {response.status}",
                        }

                    data = await response.json()

                    lights = {}
                    if isinstance(data, list):
                        for light in data:
                            light_id = light.get("id", light.get("unique_id", ""))
                            lights[light_id] = {
                                "on": light.get("state", "OFF") == "ON",
                                "brightness": light.get("brightness"),
                                "color": {
                                    "r": light.get("r"),
                                    "g": light.get("g"),
                                    "b": light.get("b"),
                                } if light.get("r") is not None else None,
                                "color_temp": light.get("color_temp"),
                            }

                    return {
                        "success": True,
                        "lights": lights,
                    }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
