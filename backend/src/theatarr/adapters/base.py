"""Base interface for service adapters."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AdapterCategory(str, Enum):
    """Categories of service adapters."""

    LIGHTING = "lighting"
    PLAYER = "player"
    MEDIA_SOURCE = "media_source"
    ACTUATOR = "actuator"
    METADATA = "metadata"


class ConnectionStatus(str, Enum):
    """Connection status for a service."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    UNKNOWN = "unknown"


@dataclass
class Capability:
    """A capability that an adapter supports."""

    name: str
    parameters: list[str] = field(default_factory=list)
    description: str | None = None


@dataclass
class Command:
    """A command to execute on a service."""

    action: str
    parameters: dict[str, Any] = field(default_factory=dict)
    targets: list[str] | None = None


@dataclass
class CommandResult:
    """Result of executing a command."""

    success: bool
    message: str | None = None
    data: dict[str, Any] | None = None
    duration_ms: int = 0


@dataclass
class ConnectionTestResult:
    """Result of testing a connection to a service."""

    status: ConnectionStatus
    message: str | None = None
    details: dict[str, Any] | None = None


class ServiceAdapter(ABC):
    """Base class for all service adapters.

    Adapters provide a standardized interface for interacting with
    external services (Hue, Plex, Android TV, etc.).
    """

    # Class attributes that subclasses must define
    adapter_type: str
    category: AdapterCategory
    display_name: str

    def __init__(self, config: dict[str, Any]):
        """Initialize adapter with configuration.

        Args:
            config: Adapter-specific configuration dictionary.
        """
        self.config = config
        self._is_connected = False

    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to the service."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the service."""
        pass

    @abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """Test the connection to the service.

        Returns:
            ConnectionTestResult with status and optional details.
        """
        pass

    @abstractmethod
    def get_capabilities(self) -> list[Capability]:
        """Get the list of capabilities this adapter supports.

        Returns:
            List of Capability objects.
        """
        pass

    @abstractmethod
    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on the service.

        Args:
            command: The command to execute.

        Returns:
            CommandResult with success status and optional data.
        """
        pass

    @property
    def is_connected(self) -> bool:
        """Check if adapter is currently connected."""
        return self._is_connected

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        """Get JSON schema for adapter configuration.

        Override in subclass to define required configuration fields.
        """
        return {
            "type": "object",
            "properties": {},
            "required": [],
        }

    def validate_config(self) -> list[str]:
        """Validate the configuration.

        Returns:
            List of validation error messages (empty if valid).
        """
        errors = []
        schema = self.get_config_schema()

        for field_name in schema.get("required", []):
            if field_name not in self.config:
                errors.append(f"Missing required field: {field_name}")

        return errors

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(type={self.adapter_type}, connected={self._is_connected})>"
