"""Chromecast adapter using pychromecast."""

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
class ChromecastAdapter(ServiceAdapter):
    """Adapter for Chromecast devices."""

    adapter_type = "chromecast"
    category = AdapterCategory.PLAYER
    display_name = "Chromecast"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.device_name = config.get("device_name", "")
        self.device_ip = config.get("device_ip", "")
        self._cast = None
        self._mc = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "device_name": {
                    "type": "string",
                    "description": "Friendly name of the Chromecast device",
                },
                "device_ip": {
                    "type": "string",
                    "description": "IP address of the Chromecast (optional, for direct connection)",
                },
            },
            "required": ["device_name"],
        }

    async def connect(self) -> None:
        """Establish connection to Chromecast."""
        try:
            import pychromecast

            if self.device_ip:
                # Direct connection by IP
                chromecasts, browser = pychromecast.get_listed_chromecasts(
                    friendly_names=[self.device_name]
                )
                if chromecasts:
                    self._cast = chromecasts[0]
                else:
                    raise ConnectionError(f"Chromecast '{self.device_name}' not found")
            else:
                # Discovery by name
                chromecasts, browser = pychromecast.get_listed_chromecasts(
                    friendly_names=[self.device_name]
                )
                pychromecast.discovery.stop_discovery(browser)

                if not chromecasts:
                    raise ConnectionError(f"Chromecast '{self.device_name}' not found")

                self._cast = chromecasts[0]

            self._cast.wait()
            self._mc = self._cast.media_controller
            self._is_connected = True
        except ImportError:
            raise ConnectionError("pychromecast is not installed")
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Chromecast: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Chromecast."""
        if self._cast:
            self._cast.disconnect()
        self._cast = None
        self._mc = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to Chromecast."""
        try:
            import pychromecast

            chromecasts, browser = pychromecast.get_listed_chromecasts(
                friendly_names=[self.device_name]
            )
            pychromecast.discovery.stop_discovery(browser)

            if not chromecasts:
                return ConnectionTestResult(
                    status=ConnectionStatus.ERROR,
                    message=f"Chromecast '{self.device_name}' not found",
                )

            cast = chromecasts[0]
            cast.wait(timeout=5)

            return ConnectionTestResult(
                status=ConnectionStatus.CONNECTED,
                message="Connected to Chromecast",
                details={
                    "name": cast.name,
                    "model": cast.model_name,
                    "uuid": str(cast.uuid),
                    "cast_type": cast.cast_type,
                },
            )
        except ImportError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="pychromecast is not installed",
            )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=str(e),
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Chromecast capabilities."""
        return [
            Capability(
                name="play",
                parameters=["url", "content_type", "title"],
                description="Play media from URL",
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
                name="seek",
                parameters=["position"],
                description="Seek to position (seconds)",
            ),
            Capability(
                name="volume",
                parameters=["level"],
                description="Set volume (0-100)",
            ),
            Capability(
                name="mute",
                parameters=["muted"],
                description="Mute or unmute",
            ),
            Capability(
                name="status",
                parameters=[],
                description="Get current playback status",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Chromecast."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "play":
                return await self._play(command.parameters)
            elif command.action == "pause":
                return await self._pause()
            elif command.action == "resume":
                return await self._resume()
            elif command.action == "stop":
                return await self._stop()
            elif command.action == "seek":
                return await self._seek(command.parameters)
            elif command.action == "volume":
                return await self._set_volume(command.parameters)
            elif command.action == "mute":
                return await self._mute(command.parameters)
            elif command.action == "status":
                return await self._get_status()
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _play(self, parameters: dict[str, Any]) -> CommandResult:
        """Play media from URL."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        url = parameters.get("url", "")
        content_type = parameters.get("content_type", "video/mp4")
        title = parameters.get("title", "Media")

        if not url:
            return CommandResult(success=False, message="url is required")

        # Run in thread pool as pychromecast is synchronous
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self._mc.play_media(url, content_type, title=title),
        )
        await loop.run_in_executor(None, lambda: self._mc.block_until_active())

        return CommandResult(success=True, message="Playback started")

    async def _pause(self) -> CommandResult:
        """Pause playback."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._mc.pause)

        return CommandResult(success=True, message="Paused")

    async def _resume(self) -> CommandResult:
        """Resume playback."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._mc.play)

        return CommandResult(success=True, message="Resumed")

    async def _stop(self) -> CommandResult:
        """Stop playback."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._mc.stop)

        return CommandResult(success=True, message="Stopped")

    async def _seek(self, parameters: dict[str, Any]) -> CommandResult:
        """Seek to position."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        position = parameters.get("position", 0)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._mc.seek(position))

        return CommandResult(success=True, message=f"Seeked to {position}s")

    async def _set_volume(self, parameters: dict[str, Any]) -> CommandResult:
        """Set volume level."""
        if not self._cast:
            return CommandResult(success=False, message="Not connected")

        level = parameters.get("level", 50)
        volume = level / 100.0  # Chromecast uses 0-1

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._cast.set_volume(volume))

        return CommandResult(success=True, message=f"Volume set to {level}%")

    async def _mute(self, parameters: dict[str, Any]) -> CommandResult:
        """Mute or unmute."""
        if not self._cast:
            return CommandResult(success=False, message="Not connected")

        muted = parameters.get("muted", True)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self._cast.set_volume_muted(muted))

        return CommandResult(
            success=True,
            message="Muted" if muted else "Unmuted",
        )

    async def _get_status(self) -> CommandResult:
        """Get current playback status."""
        if not self._mc:
            return CommandResult(success=False, message="Not connected")

        status = self._mc.status

        if status:
            return CommandResult(
                success=True,
                data={
                    "state": status.player_state,
                    "title": status.title,
                    "duration": status.duration,
                    "current_time": status.current_time,
                    "volume": self._cast.status.volume_level * 100 if self._cast else None,
                    "muted": self._cast.status.volume_muted if self._cast else None,
                },
            )
        else:
            return CommandResult(
                success=True,
                data={"state": "IDLE"},
            )
