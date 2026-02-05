"""Android TV adapter using ADB."""

import asyncio
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
class AndroidTVAdapter(ServiceAdapter):
    """Adapter for Android TV devices using ADB."""

    adapter_type = "androidtv"
    category = AdapterCategory.PLAYER
    display_name = "Android TV"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.host = config.get("host", "")
        self.port = config.get("port", 5555)
        self.adb_key = config.get("adb_key")
        self._device_name: str | None = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "host": {
                    "type": "string",
                    "description": "IP address of the Android TV device",
                },
                "port": {
                    "type": "integer",
                    "description": "ADB port (default: 5555)",
                },
                "adb_key": {
                    "type": "string",
                    "description": "Path to ADB private key file (optional)",
                },
            },
            "required": ["host"],
        }

    async def _run_adb_command(self, *args: str) -> tuple[bool, str]:
        """Run an ADB command and return success status and output."""
        cmd = ["adb", "-s", f"{self.host}:{self.port}"] + list(args)

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)

            if process.returncode == 0:
                return True, stdout.decode().strip()
            else:
                return False, stderr.decode().strip()
        except asyncio.TimeoutError:
            return False, "Command timed out"
        except FileNotFoundError:
            return False, "ADB not found - ensure Android SDK tools are installed"
        except Exception as e:
            return False, str(e)

    async def connect(self) -> None:
        """Establish ADB connection to Android TV."""
        # First try to connect
        success, output = await self._run_adb_command("connect", f"{self.host}:{self.port}")

        if not success and "connected" not in output.lower():
            self._is_connected = False
            raise ConnectionError(f"Failed to connect: {output}")

        # Verify connection
        success, output = await self._run_adb_command("shell", "getprop", "ro.product.model")
        if success:
            self._device_name = output
            self._is_connected = True
        else:
            self._is_connected = False
            raise ConnectionError(f"Failed to verify connection: {output}")

    async def disconnect(self) -> None:
        """Disconnect ADB from Android TV."""
        await self._run_adb_command("disconnect", f"{self.host}:{self.port}")
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test ADB connection to Android TV."""
        # Try to connect
        success, output = await self._run_adb_command("connect", f"{self.host}:{self.port}")

        if not success and "connected" not in output.lower():
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=f"Connection failed: {output}",
            )

        # Get device info
        model_success, model = await self._run_adb_command("shell", "getprop", "ro.product.model")
        brand_success, brand = await self._run_adb_command("shell", "getprop", "ro.product.brand")
        version_success, version = await self._run_adb_command("shell", "getprop", "ro.build.version.release")

        if model_success:
            return ConnectionTestResult(
                status=ConnectionStatus.CONNECTED,
                message="Connected to Android TV",
                details={
                    "model": model if model_success else "Unknown",
                    "brand": brand if brand_success else "Unknown",
                    "android_version": version if version_success else "Unknown",
                },
            )
        else:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Connected but could not retrieve device info",
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Android TV capabilities."""
        return [
            Capability(
                name="launch_app",
                parameters=["package"],
                description="Launch an application",
            ),
            Capability(
                name="play",
                parameters=["url"],
                description="Play media URL",
            ),
            Capability(
                name="pause",
                parameters=[],
                description="Pause playback",
            ),
            Capability(
                name="resume",
                parameters=[],
                description="Resume playback",
            ),
            Capability(
                name="stop",
                parameters=[],
                description="Stop playback",
            ),
            Capability(
                name="key",
                parameters=["keycode"],
                description="Send key event",
            ),
            Capability(
                name="volume",
                parameters=["level"],
                description="Set volume level",
            ),
            Capability(
                name="home",
                parameters=[],
                description="Go to home screen",
            ),
            Capability(
                name="power",
                parameters=["on"],
                description="Power on/off",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Android TV."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "launch_app":
                return await self._launch_app(command.parameters)
            elif command.action == "play":
                return await self._play(command.parameters)
            elif command.action == "pause":
                return await self._send_key("KEYCODE_MEDIA_PAUSE")
            elif command.action == "resume":
                return await self._send_key("KEYCODE_MEDIA_PLAY")
            elif command.action == "stop":
                return await self._send_key("KEYCODE_MEDIA_STOP")
            elif command.action == "key":
                return await self._send_key(command.parameters.get("keycode", ""))
            elif command.action == "volume":
                return await self._set_volume(command.parameters)
            elif command.action == "home":
                return await self._send_key("KEYCODE_HOME")
            elif command.action == "power":
                return await self._power(command.parameters)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _launch_app(self, parameters: dict[str, Any]) -> CommandResult:
        """Launch an application by package name."""
        package = parameters.get("package", "")
        if not package:
            return CommandResult(success=False, message="package is required")

        success, output = await self._run_adb_command(
            "shell",
            "monkey",
            "-p",
            package,
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
        )

        if success:
            return CommandResult(success=True, message=f"Launched {package}")
        else:
            return CommandResult(success=False, message=output)

    async def _play(self, parameters: dict[str, Any]) -> CommandResult:
        """Play a media URL."""
        url = parameters.get("url", "")
        if not url:
            return CommandResult(success=False, message="url is required")

        success, output = await self._run_adb_command(
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            url,
        )

        if success:
            return CommandResult(success=True, message="Playing media")
        else:
            return CommandResult(success=False, message=output)

    async def _send_key(self, keycode: str) -> CommandResult:
        """Send a key event."""
        if not keycode:
            return CommandResult(success=False, message="keycode is required")

        # Add KEYCODE_ prefix if not present
        if not keycode.startswith("KEYCODE_"):
            keycode = f"KEYCODE_{keycode.upper()}"

        success, output = await self._run_adb_command("shell", "input", "keyevent", keycode)

        if success:
            return CommandResult(success=True, message=f"Sent key: {keycode}")
        else:
            return CommandResult(success=False, message=output)

    async def _set_volume(self, parameters: dict[str, Any]) -> CommandResult:
        """Set volume level."""
        level = parameters.get("level")
        if level is None:
            return CommandResult(success=False, message="level is required")

        # Android TV volume is typically 0-15
        success, output = await self._run_adb_command(
            "shell",
            "media",
            "volume",
            "--stream",
            "3",
            "--set",
            str(level),
        )

        if success:
            return CommandResult(success=True, message=f"Volume set to {level}")
        else:
            return CommandResult(success=False, message=output)

    async def _power(self, parameters: dict[str, Any]) -> CommandResult:
        """Power on or off."""
        on = parameters.get("on", True)

        # Get current power state
        success, state = await self._run_adb_command(
            "shell",
            "dumpsys",
            "power",
            "|",
            "grep",
            "mWakefulness=",
        )

        is_awake = "Awake" in state if success else True

        if on and not is_awake:
            # Wake up
            return await self._send_key("KEYCODE_WAKEUP")
        elif not on and is_awake:
            # Sleep
            return await self._send_key("KEYCODE_SLEEP")
        else:
            return CommandResult(
                success=True,
                message=f"Device is already {'on' if on else 'off'}",
            )

    # Common app packages
    APP_PACKAGES = {
        "plex": "com.plexapp.android",
        "netflix": "com.netflix.mediaclient",
        "youtube": "com.google.android.youtube.tv",
        "kodi": "org.xbmc.kodi",
        "vlc": "org.videolan.vlc",
        "jellyfin": "org.jellyfin.androidtv",
        "disney": "com.disney.disneyplus",
        "prime": "com.amazon.amazonvideo.livingroom",
        "spotify": "com.spotify.tv.android",
    }
