"""Apple TV adapter for Theatarr player control."""

import asyncio
from typing import Any

from theatarr.adapters.base import ServiceAdapter, AdapterCapability


class AppleTVAdapter(ServiceAdapter):
    """Adapter for Apple TV media player control.

    Uses pyatv library for communication with Apple TV devices.
    Supports AirPlay and tvOS control protocols.
    """

    name = "appletv"
    service_type = "player"
    display_name = "Apple TV"
    description = "Control Apple TV devices for media playback"

    config_schema = {
        "type": "object",
        "properties": {
            "host": {
                "type": "string",
                "title": "Host",
                "description": "Apple TV IP address or hostname",
            },
            "identifier": {
                "type": "string",
                "title": "Device Identifier",
                "description": "Apple TV unique identifier (from pairing)",
            },
            "credentials": {
                "type": "string",
                "title": "Credentials",
                "description": "Pairing credentials (from pairing process)",
                "format": "password",
            },
            "protocol": {
                "type": "string",
                "title": "Protocol",
                "description": "Communication protocol",
                "enum": ["mrp", "airplay", "companion"],
                "default": "mrp",
            },
        },
        "required": ["host"],
    }

    capabilities = [
        AdapterCapability.PLAYER_PLAY,
        AdapterCapability.PLAYER_PAUSE,
        AdapterCapability.PLAYER_STOP,
        AdapterCapability.PLAYER_VOLUME,
        AdapterCapability.PLAYER_SEEK,
        AdapterCapability.PLAYER_NAVIGATION,
    ]

    def __init__(self):
        """Initialize the Apple TV adapter."""
        self._atv = None
        self._pyatv_available = False

        # Check if pyatv is available
        try:
            import pyatv
            self._pyatv_available = True
        except ImportError:
            pass

    async def _get_atv_instance(self, config: dict[str, Any]):
        """Get or create Apple TV connection."""
        if not self._pyatv_available:
            raise ImportError("pyatv library is required for Apple TV support")

        import pyatv

        host = config.get("host")
        identifier = config.get("identifier")
        credentials = config.get("credentials")

        # Scan for device
        atvs = await pyatv.scan(hosts=[host], timeout=5)

        if not atvs:
            raise ConnectionError(f"No Apple TV found at {host}")

        atv_config = atvs[0]

        # Set credentials if provided
        if credentials and identifier:
            protocol_str = config.get("protocol", "mrp")
            if protocol_str == "mrp":
                atv_config.set_credentials(pyatv.Protocol.MRP, credentials)
            elif protocol_str == "airplay":
                atv_config.set_credentials(pyatv.Protocol.AirPlay, credentials)
            elif protocol_str == "companion":
                atv_config.set_credentials(pyatv.Protocol.Companion, credentials)

        # Connect
        atv = await pyatv.connect(atv_config)
        return atv

    async def test_connection(self, config: dict[str, Any]) -> dict[str, Any]:
        """Test connection to Apple TV."""
        if not self._pyatv_available:
            return {
                "success": False,
                "error": "pyatv library not installed. Install with: pip install pyatv",
            }

        host = config.get("host")
        if not host:
            return {
                "success": False,
                "error": "Host is required",
            }

        try:
            import pyatv

            # Scan for device
            atvs = await pyatv.scan(hosts=[host], timeout=10)

            if not atvs:
                return {
                    "success": False,
                    "error": f"No Apple TV found at {host}",
                }

            atv_config = atvs[0]

            return {
                "success": True,
                "message": f"Found Apple TV: {atv_config.name}",
                "device_info": {
                    "name": atv_config.name,
                    "identifier": str(atv_config.identifier),
                    "address": str(atv_config.address),
                    "services": [str(s.protocol) for s in atv_config.services],
                },
            }

        except asyncio.TimeoutError:
            return {
                "success": False,
                "error": "Connection timeout",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection failed: {str(e)}",
            }

    async def get_capabilities(self, config: dict[str, Any]) -> dict[str, Any]:
        """Get Apple TV capabilities."""
        if not self._pyatv_available:
            return {
                "capabilities": [],
                "error": "pyatv library not installed",
            }

        try:
            import pyatv

            host = config.get("host")
            atvs = await pyatv.scan(hosts=[host], timeout=10)

            if not atvs:
                return {
                    "capabilities": [],
                    "error": f"No Apple TV found at {host}",
                }

            atv_config = atvs[0]
            services = [str(s.protocol) for s in atv_config.services]

            caps = []
            if "MRP" in services or "AirPlay" in services:
                caps.extend([
                    "play",
                    "pause",
                    "stop",
                    "skip_forward",
                    "skip_backward",
                    "volume_up",
                    "volume_down",
                    "set_volume",
                ])

            if "Companion" in services:
                caps.extend([
                    "navigate_up",
                    "navigate_down",
                    "navigate_left",
                    "navigate_right",
                    "select",
                    "menu",
                    "home",
                ])

            return {
                "capabilities": caps,
                "protocols": services,
                "device_name": atv_config.name,
            }

        except Exception as e:
            return {
                "capabilities": [],
                "error": str(e),
            }

    async def execute_action(
        self,
        action_type: str,
        parameters: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a player action on Apple TV."""
        if not self._pyatv_available:
            return {
                "success": False,
                "error": "pyatv library not installed",
            }

        atv = None
        try:
            atv = await self._get_atv_instance(config)
            remote = atv.remote_control

            if action_type == "play":
                await remote.play()
                return {"success": True, "message": "Playback started"}

            elif action_type == "pause":
                await remote.pause()
                return {"success": True, "message": "Playback paused"}

            elif action_type == "stop":
                await remote.stop()
                return {"success": True, "message": "Playback stopped"}

            elif action_type == "play_pause":
                await remote.play_pause()
                return {"success": True, "message": "Play/pause toggled"}

            elif action_type == "skip_forward":
                await remote.skip_forward()
                return {"success": True, "message": "Skipped forward"}

            elif action_type == "skip_backward":
                await remote.skip_backward()
                return {"success": True, "message": "Skipped backward"}

            elif action_type == "next":
                await remote.next()
                return {"success": True, "message": "Next track"}

            elif action_type == "previous":
                await remote.previous()
                return {"success": True, "message": "Previous track"}

            elif action_type == "volume_up":
                await remote.volume_up()
                return {"success": True, "message": "Volume increased"}

            elif action_type == "volume_down":
                await remote.volume_down()
                return {"success": True, "message": "Volume decreased"}

            elif action_type == "set_volume":
                volume = parameters.get("volume", 50)
                await remote.set_volume(volume / 100.0)
                return {"success": True, "message": f"Volume set to {volume}%"}

            elif action_type == "seek":
                position = parameters.get("position", 0)
                await remote.set_position(position)
                return {"success": True, "message": f"Seeked to {position}s"}

            elif action_type == "navigate_up":
                await remote.up()
                return {"success": True, "message": "Navigate up"}

            elif action_type == "navigate_down":
                await remote.down()
                return {"success": True, "message": "Navigate down"}

            elif action_type == "navigate_left":
                await remote.left()
                return {"success": True, "message": "Navigate left"}

            elif action_type == "navigate_right":
                await remote.right()
                return {"success": True, "message": "Navigate right"}

            elif action_type == "select":
                await remote.select()
                return {"success": True, "message": "Select pressed"}

            elif action_type == "menu":
                await remote.menu()
                return {"success": True, "message": "Menu pressed"}

            elif action_type == "home":
                await remote.home()
                return {"success": True, "message": "Home pressed"}

            elif action_type == "top_menu":
                await remote.top_menu()
                return {"success": True, "message": "Top menu pressed"}

            elif action_type == "launch_app":
                app_id = parameters.get("app_id")
                if not app_id:
                    return {"success": False, "error": "app_id is required"}

                apps = atv.apps
                if apps:
                    await apps.launch_app(app_id)
                    return {"success": True, "message": f"Launched app {app_id}"}
                else:
                    return {"success": False, "error": "App launching not supported"}

            elif action_type == "turn_on":
                power = atv.power
                if power:
                    await power.turn_on()
                    return {"success": True, "message": "Apple TV turned on"}
                else:
                    return {"success": False, "error": "Power control not supported"}

            elif action_type == "turn_off":
                power = atv.power
                if power:
                    await power.turn_off()
                    return {"success": True, "message": "Apple TV turned off"}
                else:
                    return {"success": False, "error": "Power control not supported"}

            else:
                return {"success": False, "error": f"Unknown action type: {action_type}"}

        except Exception as e:
            return {"success": False, "error": f"Action failed: {str(e)}"}
        finally:
            if atv:
                atv.close()

    async def get_state(self, config: dict[str, Any]) -> dict[str, Any]:
        """Get current playback state from Apple TV."""
        if not self._pyatv_available:
            return {
                "success": False,
                "error": "pyatv library not installed",
            }

        atv = None
        try:
            atv = await self._get_atv_instance(config)

            # Get playing status
            playing = await atv.metadata.playing()

            state_map = {
                0: "idle",
                1: "playing",
                2: "paused",
                3: "stopped",
                4: "loading",
                5: "seeking",
            }

            return {
                "success": True,
                "state": {
                    "device_state": state_map.get(playing.device_state, "unknown"),
                    "title": playing.title,
                    "artist": playing.artist,
                    "album": playing.album,
                    "media_type": str(playing.media_type) if playing.media_type else None,
                    "position": playing.position,
                    "total_time": playing.total_time,
                    "shuffle": str(playing.shuffle) if playing.shuffle else None,
                    "repeat": str(playing.repeat) if playing.repeat else None,
                },
            }

        except Exception as e:
            return {"success": False, "error": f"Failed to get state: {str(e)}"}
        finally:
            if atv:
                atv.close()

    async def pair(self, config: dict[str, Any], protocol: str = "mrp") -> dict[str, Any]:
        """Start pairing process with Apple TV.

        This is an interactive process that requires user input on the Apple TV.
        Returns a pairing session that the user must complete.
        """
        if not self._pyatv_available:
            return {
                "success": False,
                "error": "pyatv library not installed",
            }

        try:
            import pyatv
            from pyatv.const import Protocol

            host = config.get("host")
            atvs = await pyatv.scan(hosts=[host], timeout=10)

            if not atvs:
                return {
                    "success": False,
                    "error": f"No Apple TV found at {host}",
                }

            atv_config = atvs[0]

            # Select protocol
            protocol_map = {
                "mrp": Protocol.MRP,
                "airplay": Protocol.AirPlay,
                "companion": Protocol.Companion,
            }
            proto = protocol_map.get(protocol, Protocol.MRP)

            # Start pairing
            pairing = await pyatv.pair(atv_config, proto)
            await pairing.begin()

            # At this point, a PIN should appear on the Apple TV screen
            return {
                "success": True,
                "message": "Pairing started. Enter the PIN shown on your Apple TV.",
                "pairing_active": True,
                "protocol": protocol,
                "instructions": [
                    "1. Look at your Apple TV screen",
                    "2. A 4-digit PIN should be displayed",
                    "3. Call complete_pairing with the PIN",
                ],
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Pairing failed: {str(e)}",
            }

    async def get_apps(self, config: dict[str, Any]) -> dict[str, Any]:
        """Get list of installed apps on Apple TV."""
        if not self._pyatv_available:
            return {
                "success": False,
                "error": "pyatv library not installed",
            }

        atv = None
        try:
            atv = await self._get_atv_instance(config)
            apps = atv.apps

            if not apps:
                return {
                    "success": False,
                    "error": "App listing not supported",
                }

            app_list = await apps.app_list()
            return {
                "success": True,
                "apps": [
                    {
                        "id": app.identifier,
                        "name": app.name,
                    }
                    for app in app_list
                ],
            }

        except Exception as e:
            return {"success": False, "error": f"Failed to get apps: {str(e)}"}
        finally:
            if atv:
                atv.close()
