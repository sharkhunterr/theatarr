"""Pre-rolls API router for Theatarr."""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.config import settings
from theatarr.database import DbSession
from theatarr.models.preroll import PreRoll, PreRollStatus
from theatarr.schemas.preroll import (
    PreRollDownloadRequest,
    PreRollListResponse,
    PreRollResponse,
    PreRollUpdate,
)
from theatarr.services.preroll_manager import _get_video_duration, download_preroll

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/prerolls", tags=["PreRolls"])

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".m4v"}


def _preroll_to_response(preroll: PreRoll) -> PreRollResponse:
    """Convert PreRoll model to response schema."""
    return PreRollResponse(
        id=preroll.id,
        name=preroll.name,
        tags=preroll.tags,
        source_type=preroll.source_type,
        source_url=preroll.source_url,
        file_path=preroll.file_path,
        file_size_bytes=preroll.file_size_bytes,
        file_size_mb=preroll.file_size_mb,
        format=preroll.format,
        duration_seconds=preroll.duration_seconds,
        thumbnail_path=preroll.thumbnail_path,
        status=preroll.status.value if hasattr(preroll.status, "value") else preroll.status,
        error_message=preroll.error_message,
        download_progress=preroll.download_progress,
        play_count=preroll.play_count,
        last_played_at=preroll.last_played_at,
        is_ready=preroll.is_ready,
        created_at=preroll.created_at,
        updated_at=preroll.updated_at,
    )


# ============================================================================
# Specific routes BEFORE catch-all /{preroll_id}
# ============================================================================


@router.get(
    "",
    response_model=PreRollListResponse,
    summary="List Pre-Rolls",
)
async def list_prerolls(
    db: DbSession,
    user: AdminUser,
    status_filter: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> PreRollListResponse:
    """List all pre-rolls with optional filters."""
    query = select(PreRoll)

    if status_filter:
        query = query.where(PreRoll.status == status_filter)
    if search:
        query = query.where(PreRoll.name.ilike(f"%{search}%"))

    # Total size
    size_result = await db.execute(
        select(func.sum(PreRoll.file_size_bytes)).where(PreRoll.status == PreRollStatus.READY)
    )
    total_size = size_result.scalar() or 0

    # Total count
    count_query = select(func.count(PreRoll.id))
    if status_filter:
        count_query = count_query.where(PreRoll.status == status_filter)
    if search:
        count_query = count_query.where(PreRoll.name.ilike(f"%{search}%"))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginated results
    query = query.order_by(PreRoll.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    prerolls = result.scalars().all()

    return PreRollListResponse(
        items=[_preroll_to_response(p) for p in prerolls],
        total=total,
        total_size_bytes=total_size,
        total_size_gb=round(total_size / (1024 * 1024 * 1024), 2),
    )


@router.post(
    "/upload",
    response_model=PreRollResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Pre-Roll",
)
async def upload_preroll(
    db: DbSession,
    user: AdminUser,
    file: UploadFile,
    name: str = Form(...),
    tags: str = Form(default=""),
) -> PreRollResponse:
    """Upload a video file as a pre-roll."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Format non supporté: {ext}. Formats acceptés: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}",
        )

    # Save file
    output_dir = Path(str(settings.preroll_path))
    output_dir.mkdir(parents=True, exist_ok=True)

    preroll = PreRoll(
        name=name,
        tags=[t.strip() for t in tags.split(",") if t.strip()] if tags else None,
        source_type="upload",
        format=ext.lstrip("."),
        status=PreRollStatus.PROCESSING,
    )
    db.add(preroll)
    await db.flush()

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in name)
    file_path = output_dir / f"{safe_name}_{preroll.id}{ext}"

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        preroll.file_path = str(file_path)
        preroll.file_size_bytes = file_path.stat().st_size

        # Get duration
        duration = await _get_video_duration(str(file_path))
        if duration:
            preroll.duration_seconds = duration

        preroll.status = PreRollStatus.READY
        preroll.download_progress = 1.0

    except Exception as e:
        preroll.status = PreRollStatus.ERROR
        preroll.error_message = str(e)[:500]

    await db.commit()
    await db.refresh(preroll)

    return _preroll_to_response(preroll)


@router.post(
    "/download",
    response_model=PreRollResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Download Pre-Roll from YouTube",
)
async def download_preroll_endpoint(
    db: DbSession,
    user: AdminUser,
    background_tasks: BackgroundTasks,
    data: PreRollDownloadRequest,
) -> PreRollResponse:
    """Download a pre-roll video from a YouTube URL."""
    preroll = PreRoll(
        name=data.name or "Pre Roll",
        source_type="youtube",
        source_url=data.source_url,
        status=PreRollStatus.PENDING,
    )
    db.add(preroll)
    await db.commit()
    await db.refresh(preroll)

    background_tasks.add_task(download_preroll, db, preroll)

    return _preroll_to_response(preroll)


@router.get(
    "/stats",
    summary="Get Pre-Roll Storage Stats",
)
async def get_preroll_stats(
    db: DbSession,
    user: AdminUser,
) -> dict:
    """Get storage statistics for pre-rolls."""
    result = await db.execute(
        select(
            PreRoll.status,
            func.count(PreRoll.id),
            func.sum(PreRoll.file_size_bytes),
            func.sum(PreRoll.duration_seconds),
        ).group_by(PreRoll.status)
    )
    status_stats = result.all()

    by_status: dict[str, int] = {}
    total_size = 0
    total_duration = 0
    total_count = 0
    ready_count = 0

    for s, count, size, duration in status_stats:
        status_val = s.value if hasattr(s, "value") else str(s)
        by_status[status_val] = count
        total_count += count
        total_size += size or 0
        total_duration += duration or 0
        if status_val == PreRollStatus.READY.value:
            ready_count = count

    hours = total_duration // 3600
    minutes = (total_duration % 3600) // 60
    duration_fmt = f"{hours}h {minutes}m" if hours else f"{minutes}m"

    return {
        "total_prerolls": total_count,
        "ready_prerolls": ready_count,
        "total_size_bytes": total_size,
        "total_size_gb": round(total_size / (1024 * 1024 * 1024), 2),
        "total_duration_seconds": total_duration,
        "total_duration_formatted": duration_fmt,
        "by_status": by_status,
    }


# ============================================================================
# Routes with path parameters
# ============================================================================


@router.get(
    "/{preroll_id}/file",
    summary="Serve Pre-Roll File",
)
async def serve_preroll_file(
    db: DbSession,
    preroll_id: str,
) -> FileResponse:
    """Serve a pre-roll file for playback. No auth required for display access."""
    result = await db.execute(select(PreRoll).where(PreRoll.id == preroll_id))
    preroll = result.scalar_one_or_none()

    if not preroll:
        raise NotFoundError("PreRoll", preroll_id)

    if not preroll.file_path or not os.path.exists(preroll.file_path):
        raise HTTPException(status_code=404, detail="Pre-roll file not found on disk")

    media_types = {
        "mp4": "video/mp4", "mkv": "video/x-matroska", "webm": "video/webm",
        "avi": "video/x-msvideo", "mov": "video/quicktime", "m4v": "video/mp4",
    }
    media_type = media_types.get(preroll.format, "video/mp4")

    return FileResponse(
        path=preroll.file_path, media_type=media_type,
        filename=f"{preroll.name}.{preroll.format}",
    )


@router.get(
    "/{preroll_id}",
    response_model=PreRollResponse,
    summary="Get Pre-Roll",
)
async def get_preroll(
    db: DbSession,
    user: AdminUser,
    preroll_id: str,
) -> PreRollResponse:
    """Get a pre-roll by ID."""
    result = await db.execute(select(PreRoll).where(PreRoll.id == preroll_id))
    preroll = result.scalar_one_or_none()

    if not preroll:
        raise NotFoundError("PreRoll", preroll_id)

    return _preroll_to_response(preroll)


@router.patch(
    "/{preroll_id}",
    response_model=PreRollResponse,
    summary="Update Pre-Roll",
)
async def update_preroll(
    db: DbSession,
    user: AdminUser,
    preroll_id: str,
    data: PreRollUpdate,
) -> PreRollResponse:
    """Update pre-roll metadata."""
    result = await db.execute(select(PreRoll).where(PreRoll.id == preroll_id))
    preroll = result.scalar_one_or_none()

    if not preroll:
        raise NotFoundError("PreRoll", preroll_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preroll, field, value)

    await db.commit()
    await db.refresh(preroll)

    return _preroll_to_response(preroll)


@router.delete(
    "/{preroll_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Pre-Roll",
)
async def delete_preroll(
    db: DbSession,
    user: AdminUser,
    preroll_id: str,
) -> None:
    """Delete a pre-roll and its file."""
    result = await db.execute(select(PreRoll).where(PreRoll.id == preroll_id))
    preroll = result.scalar_one_or_none()

    if not preroll:
        raise NotFoundError("PreRoll", preroll_id)

    # Delete files
    if preroll.file_path and os.path.exists(preroll.file_path):
        os.remove(preroll.file_path)
    if preroll.thumbnail_path and os.path.exists(preroll.thumbnail_path):
        os.remove(preroll.thumbnail_path)

    await db.delete(preroll)
    await db.commit()
