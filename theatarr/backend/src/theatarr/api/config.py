"""Configuration import/export API router for Theatarr."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.database import get_db
from theatarr.api.deps import get_current_user
from theatarr.models import User, Settings
from theatarr.services.config_manager import ConfigManager


router = APIRouter(prefix="/config", tags=["configuration"])


# ============================================================================
# Schemas
# ============================================================================


class ExportOptions(BaseModel):
    """Options for configuration export."""

    include_sessions: bool = True
    include_services: bool = True
    include_templates: bool = True
    include_trailer_rules: bool = True
    include_settings: bool = True
    encrypt_secrets: bool = True
    encryption_password: str | None = Field(None, min_length=8)


class ImportOptions(BaseModel):
    """Options for configuration import."""

    encryption_password: str | None = None
    conflict_resolutions: dict[str, str] = Field(default_factory=dict)


class ConflictSchema(BaseModel):
    """Conflict information."""

    entity_type: str
    entity_id: str
    entity_name: str
    conflict_type: str
    details: str
    existing_data: dict | None = None
    incoming_data: dict | None = None


class ImportPreviewResponse(BaseModel):
    """Response for import preview."""

    sessions: dict[str, int]
    services: dict[str, int]
    templates: dict[str, int]
    trailer_rules: dict[str, int]
    settings: bool
    conflicts: list[ConflictSchema]
    has_conflicts: bool


class ImportResultResponse(BaseModel):
    """Response for import result."""

    sessions_created: int
    sessions_updated: int
    sessions_skipped: int
    services_created: int
    services_updated: int
    services_skipped: int
    templates_created: int
    templates_updated: int
    templates_skipped: int
    trailer_rules_created: int
    trailer_rules_updated: int
    trailer_rules_skipped: int
    settings_updated: int
    errors: list[str]


class SettingSchema(BaseModel):
    """Setting key-value pair."""

    key: str
    value: Any


class SettingUpdate(BaseModel):
    """Update a setting value."""

    value: Any


class SettingsResponse(BaseModel):
    """All settings response."""

    settings: dict[str, Any]


# ============================================================================
# Export Endpoints
# ============================================================================


@router.post("/export")
async def export_config(
    options: ExportOptions,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Export configuration to JSON.

    Requires authentication. Exports sessions, services, templates,
    trailer rules, and settings based on options.

    Sensitive data (API keys, passwords) can be encrypted with a password.
    """
    if options.encrypt_secrets and not options.encryption_password:
        raise HTTPException(
            status_code=400,
            detail="Encryption password required when encrypt_secrets is True",
        )

    manager = ConfigManager(db)
    export_data = await manager.export_config(
        include_sessions=options.include_sessions,
        include_services=options.include_services,
        include_templates=options.include_templates,
        include_trailer_rules=options.include_trailer_rules,
        include_settings=options.include_settings,
        encrypt_secrets=options.encrypt_secrets,
        encryption_password=options.encryption_password,
    )

    return export_data


@router.post("/export/download")
async def export_config_download(
    options: ExportOptions,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Export configuration as a downloadable JSON file."""
    if options.encrypt_secrets and not options.encryption_password:
        raise HTTPException(
            status_code=400,
            detail="Encryption password required when encrypt_secrets is True",
        )

    manager = ConfigManager(db)
    export_data = await manager.export_config(
        include_sessions=options.include_sessions,
        include_services=options.include_services,
        include_templates=options.include_templates,
        include_trailer_rules=options.include_trailer_rules,
        include_settings=options.include_settings,
        encrypt_secrets=options.encrypt_secrets,
        encryption_password=options.encryption_password,
    )

    import json
    content = json.dumps(export_data, indent=2)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"theatarr_config_{timestamp}.json"

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================================
# Import Endpoints
# ============================================================================


@router.post("/import/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportPreviewResponse:
    """Preview configuration import without making changes.

    Shows what would be created, updated, and any conflicts.
    """
    import json

    try:
        content = await file.read()
        config_data = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    manager = ConfigManager(db)
    preview = await manager.preview_import(config_data)

    return ImportPreviewResponse(**preview.to_dict())


@router.post("/import", response_model=ImportResultResponse)
async def import_config(
    file: UploadFile = File(...),
    encryption_password: str | None = None,
    conflict_resolutions: str | None = None,  # JSON string of resolutions
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportResultResponse:
    """Import configuration from JSON file.

    Conflict resolutions is a JSON object mapping "entity_type:entity_id"
    to resolution strategy: "skip", "overwrite", "rename", or "merge".
    """
    import json

    try:
        content = await file.read()
        config_data = json.loads(content)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")

    resolutions = {}
    if conflict_resolutions:
        try:
            resolutions = json.loads(conflict_resolutions)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid conflict_resolutions JSON")

    manager = ConfigManager(db)
    results = await manager.import_config(
        config_data=config_data,
        conflict_resolutions=resolutions,
        encryption_password=encryption_password,
    )

    return ImportResultResponse(**results)


@router.post("/import/json", response_model=ImportResultResponse)
async def import_config_json(
    config_data: dict[str, Any],
    options: ImportOptions,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportResultResponse:
    """Import configuration from JSON body (alternative to file upload)."""
    manager = ConfigManager(db)
    results = await manager.import_config(
        config_data=config_data,
        conflict_resolutions=options.conflict_resolutions,
        encryption_password=options.encryption_password,
    )

    return ImportResultResponse(**results)


# ============================================================================
# Settings Endpoints
# ============================================================================


@router.get("/settings", response_model=SettingsResponse)
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    """Get all application settings."""
    result = await db.execute(select(Settings))
    settings = {s.key: s.value for s in result.scalars().all()}
    return SettingsResponse(settings=settings)


@router.get("/settings/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingSchema:
    """Get a specific setting by key."""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()

    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    return SettingSchema(key=setting.key, value=setting.value)


@router.put("/settings/{key}")
async def update_setting(
    key: str,
    update: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingSchema:
    """Update or create a setting."""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()

    if setting:
        setting.value = update.value
    else:
        setting = Settings(key=key, value=update.value)
        db.add(setting)

    await db.commit()
    await db.refresh(setting)

    return SettingSchema(key=setting.key, value=setting.value)


@router.delete("/settings/{key}")
async def delete_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a setting."""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()

    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")

    await db.delete(setting)
    await db.commit()

    return {"message": f"Setting '{key}' deleted"}


@router.post("/settings/batch")
async def update_settings_batch(
    settings: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    """Update multiple settings at once."""
    for key, value in settings.items():
        result = await db.execute(select(Settings).where(Settings.key == key))
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = value
        else:
            setting = Settings(key=key, value=value)
            db.add(setting)

    await db.commit()

    # Return all settings
    result = await db.execute(select(Settings))
    all_settings = {s.key: s.value for s in result.scalars().all()}
    return SettingsResponse(settings=all_settings)
