"""Services API router for Theatarr."""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from theatarr.adapters.registry import AdapterRegistry
from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.service import ConnectionStatus, Service
from theatarr.schemas.service import (
    AdapterInfo,
    AdapterListResponse,
    CapabilitiesResponse,
    CapabilitySchema,
    ConnectionTestRequest,
    ConnectionTestResponse,
    ServiceCreate,
    ServiceListResponse,
    ServiceResponse,
    ServiceUpdate,
)

router = APIRouter(prefix="/services", tags=["Services"])


def _service_to_response(service: Service) -> ServiceResponse:
    """Convert Service model to response schema."""
    capabilities = None
    if service.capabilities:
        capabilities = [
            CapabilitySchema(
                name=cap.get("name", ""),
                parameters=cap.get("parameters", []),
                description=cap.get("description"),
            )
            for cap in service.capabilities
        ]

    return ServiceResponse(
        id=service.id,
        name=service.name,
        description=service.description,
        adapter_type=service.adapter_type,
        category=service.category,
        config=_mask_sensitive_config(service.config),
        is_enabled=service.is_enabled,
        connection_status=service.connection_status,
        last_seen_at=service.last_seen_at,
        capabilities=capabilities,
        error_message=service.error_message,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


def _mask_sensitive_config(config: dict) -> dict:
    """Mask sensitive values in config."""
    sensitive_keys = {"api_key", "token", "password", "secret", "key"}
    masked = {}
    for key, value in config.items():
        if any(s in key.lower() for s in sensitive_keys):
            masked[key] = "********" if value else None
        else:
            masked[key] = value
    return masked


@router.get(
    "/adapters",
    response_model=AdapterListResponse,
    summary="List Available Adapters",
)
async def list_adapters(user: AdminUser) -> AdapterListResponse:
    """List all available service adapters."""
    adapters = AdapterRegistry.list_adapters()
    return AdapterListResponse(
        items=[
            AdapterInfo(
                type=a["type"],
                category=a["category"],
                display_name=a["display_name"],
                config_schema=a["config_schema"],
            )
            for a in adapters
        ]
    )


@router.get(
    "",
    response_model=ServiceListResponse,
    summary="List Services",
)
async def list_services(
    db: DbSession,
    user: AdminUser,
    category: str | None = None,
    enabled_only: bool = False,
) -> ServiceListResponse:
    """List all configured services."""
    query = select(Service)

    if category:
        query = query.where(Service.category == category)
    if enabled_only:
        query = query.where(Service.is_enabled == True)

    query = query.order_by(Service.name)
    result = await db.execute(query)
    services = result.scalars().all()

    return ServiceListResponse(
        items=[_service_to_response(s) for s in services],
        total=len(services),
    )


@router.post(
    "",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Service",
)
async def create_service(
    db: DbSession,
    user: AdminUser,
    data: ServiceCreate,
) -> ServiceResponse:
    """Create a new service configuration."""
    # Verify adapter type exists
    adapter_class = AdapterRegistry.get_adapter_class(data.adapter_type)
    if not adapter_class:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown adapter type: {data.adapter_type}",
        )

    service = Service(
        name=data.name,
        description=data.description,
        adapter_type=data.adapter_type,
        category=data.category,
        config=data.config,
        is_enabled=data.is_enabled,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)

    return _service_to_response(service)


@router.get(
    "/{service_id}",
    response_model=ServiceResponse,
    summary="Get Service",
)
async def get_service(
    db: DbSession,
    user: AdminUser,
    service_id: str,
) -> ServiceResponse:
    """Get a service by ID."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    return _service_to_response(service)


@router.patch(
    "/{service_id}",
    response_model=ServiceResponse,
    summary="Update Service",
)
async def update_service(
    db: DbSession,
    user: AdminUser,
    service_id: str,
    data: ServiceUpdate,
) -> ServiceResponse:
    """Update a service configuration."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    # Update fields
    update_data = data.model_dump(exclude_unset=True)

    # Merge config if provided
    if "config" in update_data and update_data["config"]:
        merged_config = {**service.config, **update_data["config"]}
        update_data["config"] = merged_config

    for field, value in update_data.items():
        setattr(service, field, value)

    await db.commit()
    await db.refresh(service)

    return _service_to_response(service)


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Service",
)
async def delete_service(
    db: DbSession,
    user: AdminUser,
    service_id: str,
) -> None:
    """Delete a service."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    # Remove adapter instance if exists
    AdapterRegistry.remove_instance(service_id)

    await db.delete(service)
    await db.commit()


@router.post(
    "/{service_id}/test",
    response_model=ConnectionTestResponse,
    summary="Test Service Connection",
)
async def test_service_connection(
    db: DbSession,
    user: AdminUser,
    service_id: str,
    data: ConnectionTestRequest | None = None,
) -> ConnectionTestResponse:
    """Test connection to a service."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    # Create adapter instance
    try:
        adapter = AdapterRegistry.create_adapter(
            service.adapter_type,
            service.config,
            instance_id=service_id,
        )
    except ValueError as e:
        return ConnectionTestResponse(
            success=False,
            status=ConnectionStatus.ERROR,
            message=str(e),
        )

    # Test connection
    start_time = time.time()
    try:
        test_result = await adapter.test_connection()
        latency_ms = int((time.time() - start_time) * 1000)

        # Update service status
        service.connection_status = test_result.status
        service.last_seen_at = datetime.now(timezone.utc)
        service.error_message = test_result.message if not test_result.status == ConnectionStatus.CONNECTED else None
        await db.commit()

        return ConnectionTestResponse(
            success=test_result.status == ConnectionStatus.CONNECTED,
            status=test_result.status,
            message=test_result.message,
            latency_ms=latency_ms,
            details=test_result.details,
        )

    except Exception as e:
        service.connection_status = ConnectionStatus.ERROR
        service.error_message = str(e)
        await db.commit()

        return ConnectionTestResponse(
            success=False,
            status=ConnectionStatus.ERROR,
            message=str(e),
        )


@router.get(
    "/{service_id}/capabilities",
    response_model=CapabilitiesResponse,
    summary="Discover Service Capabilities",
)
async def discover_capabilities(
    db: DbSession,
    user: AdminUser,
    service_id: str,
) -> CapabilitiesResponse:
    """Discover and cache service capabilities."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    # Get or create adapter instance
    adapter = AdapterRegistry.get_instance(service_id)
    if not adapter:
        try:
            adapter = AdapterRegistry.create_adapter(
                service.adapter_type,
                service.config,
                instance_id=service_id,
            )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

    # Get capabilities
    capabilities = adapter.get_capabilities()

    # Cache capabilities
    service.capabilities = [
        {
            "name": cap.name,
            "parameters": cap.parameters,
            "description": cap.description,
        }
        for cap in capabilities
    ]
    await db.commit()

    return CapabilitiesResponse(
        service_id=service_id,
        adapter_type=service.adapter_type,
        capabilities=[
            CapabilitySchema(
                name=cap.name,
                parameters=cap.parameters,
                description=cap.description,
            )
            for cap in capabilities
        ],
        discovered_at=datetime.now(timezone.utc),
    )


@router.post(
    "/{service_id}/enable",
    response_model=ServiceResponse,
    summary="Enable Service",
)
async def enable_service(
    db: DbSession,
    user: AdminUser,
    service_id: str,
) -> ServiceResponse:
    """Enable a service."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    service.is_enabled = True
    await db.commit()
    await db.refresh(service)

    return _service_to_response(service)


@router.post(
    "/{service_id}/disable",
    response_model=ServiceResponse,
    summary="Disable Service",
)
async def disable_service(
    db: DbSession,
    user: AdminUser,
    service_id: str,
) -> ServiceResponse:
    """Disable a service."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise NotFoundError("Service", service_id)

    service.is_enabled = False
    # Disconnect adapter if exists
    AdapterRegistry.remove_instance(service_id)
    await db.commit()
    await db.refresh(service)

    return _service_to_response(service)
