"""Templates API router for Theatarr."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.template import Template, TemplateType, BUILTIN_TEMPLATES
from theatarr.schemas.base import BaseSchema

router = APIRouter(prefix="/templates", tags=["Templates"])


class TemplateBase(BaseSchema):
    """Base template fields."""

    name: str
    description: str | None = None
    template_type: str = "custom"
    content: str | None = None
    styles: str | None = None
    script: str | None = None
    layout: dict | None = None
    config: dict | None = None


class TemplateCreate(TemplateBase):
    """Schema for creating a template."""

    pass


class TemplateUpdate(BaseSchema):
    """Schema for updating a template."""

    name: str | None = None
    description: str | None = None
    content: str | None = None
    styles: str | None = None
    script: str | None = None
    layout: dict | None = None
    config: dict | None = None
    is_active: bool | None = None


class TemplateResponse(TemplateBase):
    """Template response schema."""

    id: str
    is_builtin: bool
    is_active: bool
    preview_url: str | None = None
    created_at: str
    updated_at: str


class TemplateListResponse(BaseSchema):
    """List of templates response."""

    items: list[TemplateResponse]
    total: int


def _template_to_response(template: Template) -> TemplateResponse:
    """Convert Template model to response schema."""
    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        template_type=template.template_type.value if isinstance(template.template_type, TemplateType) else template.template_type,
        content=template.content,
        styles=template.styles,
        script=template.script,
        layout=template.layout,
        config=template.config,
        is_builtin=template.is_builtin,
        is_active=template.is_active,
        preview_url=template.preview_url,
        created_at=template.created_at.isoformat() if template.created_at else "",
        updated_at=template.updated_at.isoformat() if template.updated_at else "",
    )


@router.get(
    "",
    response_model=TemplateListResponse,
    summary="List Templates",
)
async def list_templates(
    db: DbSession,
    user: AdminUser,
    template_type: str | None = None,
    builtin_only: bool = False,
) -> TemplateListResponse:
    """List all available templates."""
    query = select(Template)

    if template_type:
        query = query.where(Template.template_type == template_type)
    if builtin_only:
        query = query.where(Template.is_builtin == True)

    query = query.order_by(Template.is_builtin.desc(), Template.name)
    result = await db.execute(query)
    templates = result.scalars().all()

    return TemplateListResponse(
        items=[_template_to_response(t) for t in templates],
        total=len(templates),
    )


@router.post(
    "",
    response_model=TemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Template",
)
async def create_template(
    db: DbSession,
    user: AdminUser,
    data: TemplateCreate,
) -> TemplateResponse:
    """Create a new custom template."""
    template = Template(
        name=data.name,
        description=data.description,
        template_type=TemplateType(data.template_type) if data.template_type in [t.value for t in TemplateType] else TemplateType.CUSTOM,
        content=data.content,
        styles=data.styles,
        script=data.script,
        layout=data.layout,
        config=data.config,
        is_builtin=False,
        is_active=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


@router.get(
    "/{template_id}",
    response_model=TemplateResponse,
    summary="Get Template",
)
async def get_template(
    db: DbSession,
    user: AdminUser,
    template_id: str,
) -> TemplateResponse:
    """Get a template by ID."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()

    if not template:
        raise NotFoundError("Template", template_id)

    return _template_to_response(template)


@router.patch(
    "/{template_id}",
    response_model=TemplateResponse,
    summary="Update Template",
)
async def update_template(
    db: DbSession,
    user: AdminUser,
    template_id: str,
    data: TemplateUpdate,
) -> TemplateResponse:
    """Update a template."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()

    if not template:
        raise NotFoundError("Template", template_id)

    if template.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify built-in templates",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Template",
)
async def delete_template(
    db: DbSession,
    user: AdminUser,
    template_id: str,
) -> None:
    """Delete a template."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()

    if not template:
        raise NotFoundError("Template", template_id)

    if template.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete built-in templates",
        )

    await db.delete(template)
    await db.commit()


@router.post(
    "/{template_id}/activate",
    response_model=TemplateResponse,
    summary="Activate Template",
)
async def activate_template(
    db: DbSession,
    user: AdminUser,
    template_id: str,
) -> TemplateResponse:
    """Set a template as the active wallmount template."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()

    if not template:
        raise NotFoundError("Template", template_id)

    # Deactivate all other templates
    await db.execute(
        select(Template).where(Template.is_active == True)
    )
    result = await db.execute(select(Template).where(Template.is_active == True))
    active_templates = result.scalars().all()
    for t in active_templates:
        t.is_active = False

    # Activate this template
    template.is_active = True

    await db.commit()
    await db.refresh(template)

    return _template_to_response(template)


@router.post(
    "/init-builtins",
    response_model=TemplateListResponse,
    summary="Initialize Built-in Templates",
)
async def init_builtin_templates(
    db: DbSession,
    user: AdminUser,
) -> TemplateListResponse:
    """Initialize or reset built-in templates."""
    created = []

    for key, config in BUILTIN_TEMPLATES.items():
        # Check if exists
        result = await db.execute(
            select(Template).where(
                Template.name == config["name"],
                Template.is_builtin == True,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            for field, value in config.items():
                if field != "template_type":
                    setattr(existing, field, value)
                else:
                    existing.template_type = TemplateType(value)
            created.append(existing)
        else:
            # Create new
            template = Template(
                name=config["name"],
                description=config.get("description"),
                template_type=config.get("template_type", TemplateType.CUSTOM),
                layout=config.get("layout"),
                config=config.get("config"),
                is_builtin=True,
                is_active=False,
            )
            db.add(template)
            created.append(template)

    await db.commit()

    # Refresh all
    for template in created:
        await db.refresh(template)

    return TemplateListResponse(
        items=[_template_to_response(t) for t in created],
        total=len(created),
    )
