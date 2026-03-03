"""Pydantic schemas for Service API."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema, IDTimestampSchema


class ServiceCategory(str, Enum):
    """Category of service."""

    LIGHTING = "lighting"
    PLAYER = "player"
    MEDIA_SOURCE = "media_source"
    ACTUATOR = "actuator"
    METADATA = "metadata"


class ConnectionStatus(str, Enum):
    """Connection status."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    UNKNOWN = "unknown"


# ============================================================================
# Capability Schema
# ============================================================================


class CapabilitySchema(BaseSchema):
    """A capability supported by a service."""

    name: str
    parameters: list[str] = []
    description: str | None = None


# ============================================================================
# Service Schemas
# ============================================================================


class ServiceBase(BaseSchema):
    """Base service fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    adapter_type: str = Field(..., min_length=1, max_length=100)
    category: ServiceCategory
    config: dict[str, Any] = Field(default_factory=dict)
    is_enabled: bool = True


class ServiceCreate(ServiceBase):
    """Schema for creating a service."""

    pass


class ServiceUpdate(BaseSchema):
    """Schema for updating a service."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    config: dict[str, Any] | None = None
    is_enabled: bool | None = None


class ServiceResponse(ServiceBase, IDTimestampSchema):
    """Service response."""

    connection_status: ConnectionStatus
    last_seen_at: datetime | None = None
    capabilities: list[CapabilitySchema] | None = None
    error_message: str | None = None


class ServiceListResponse(BaseSchema):
    """List of services response."""

    items: list[ServiceResponse]
    total: int


# ============================================================================
# Connection Test
# ============================================================================


class ConnectionTestRequest(BaseSchema):
    """Request to test a service connection."""

    timeout_ms: int = Field(default=5000, ge=1000, le=30000)


class ConnectionTestResponse(BaseSchema):
    """Response from connection test."""

    success: bool
    status: ConnectionStatus
    message: str | None = None
    latency_ms: int | None = None
    details: dict[str, Any] | None = None


# ============================================================================
# Capabilities Discovery
# ============================================================================


class CapabilitiesResponse(BaseSchema):
    """Response with discovered capabilities."""

    service_id: str
    adapter_type: str
    capabilities: list[CapabilitySchema]
    discovered_at: datetime


# ============================================================================
# Available Adapters
# ============================================================================


class AdapterInfo(BaseSchema):
    """Information about an available adapter."""

    type: str
    category: str
    display_name: str
    config_schema: dict[str, Any]


class AdapterListResponse(BaseSchema):
    """List of available adapters."""

    items: list[AdapterInfo]
