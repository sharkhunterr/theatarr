"""Sounds API router for Theatarr."""

import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.sound import Sound, SoundStatus
from theatarr.schemas.sound import (
    SoundCreate,
    SoundDownloadRequest,
    SoundInfoResponse,
    SoundListResponse,
    SoundResponse,
    SoundUpdate,
)
from theatarr.services.sound_manager import (
    download_playlist_entries,
    download_sound,
    download_sound_chapters,
    get_sound_info,
    get_sound_storage_stats,
)

router = APIRouter(prefix="/sounds", tags=["Sounds"])


def _sound_to_response(sound: Sound) -> SoundResponse:
    """Convert Sound model to response schema."""
    return SoundResponse(
        id=sound.id,
        name=sound.name,
        tags=sound.tags,
        source_url=sound.source_url,
        source_type=sound.source_type,
        file_path=sound.file_path,
        file_size_bytes=sound.file_size_bytes,
        file_size_mb=sound.file_size_mb,
        format=sound.format,
        bitrate=sound.bitrate,
        duration_seconds=sound.duration_seconds,
        status=sound.status.value if hasattr(sound.status, "value") else sound.status,
        error_message=sound.error_message,
        download_progress=sound.download_progress,
        chapter_title=sound.chapter_title,
        chapter_index=sound.chapter_index,
        parent_source_url=sound.parent_source_url,
        play_count=sound.play_count,
        last_played_at=sound.last_played_at,
        is_ready=sound.is_ready,
        created_at=sound.created_at,
        updated_at=sound.updated_at,
    )


# ============================================================================
# Specific routes BEFORE catch-all /{sound_id}
# ============================================================================


@router.get(
    "",
    response_model=SoundListResponse,
    summary="List Sounds",
)
async def list_sounds(
    db: DbSession,
    user: AdminUser,
    status_filter: str | None = None,
    tag: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> SoundListResponse:
    """List all sounds with optional filters."""
    query = select(Sound)

    if status_filter:
        query = query.where(Sound.status == status_filter)
    if search:
        query = query.where(Sound.name.ilike(f"%{search}%"))

    # Total size
    size_query = select(func.sum(Sound.file_size_bytes)).where(
        Sound.status == SoundStatus.READY
    )
    size_result = await db.execute(size_query)
    total_size = size_result.scalar() or 0

    # Total count
    count_query = select(func.count(Sound.id))
    if status_filter:
        count_query = count_query.where(Sound.status == status_filter)
    if search:
        count_query = count_query.where(Sound.name.ilike(f"%{search}%"))
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginated results
    query = query.order_by(Sound.created_at.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    sounds = result.scalars().all()

    # Filter by tag in Python (JSON array not easily filtered in SQLite)
    if tag:
        sounds = [s for s in sounds if s.tags and tag in s.tags]
        total = len(sounds)

    return SoundListResponse(
        items=[_sound_to_response(s) for s in sounds],
        total=total,
        total_size_bytes=total_size,
        total_size_gb=round(total_size / (1024 * 1024 * 1024), 2),
    )


@router.post(
    "/info",
    response_model=SoundInfoResponse,
    summary="Analyze URL",
)
async def analyze_url(
    user: AdminUser,
    data: SoundDownloadRequest,
) -> SoundInfoResponse:
    """Analyze a YouTube URL to get chapters and playlist info."""
    try:
        info = await get_sound_info(data.source_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return SoundInfoResponse(
        title=info["title"],
        duration=info.get("duration"),
        is_playlist=info.get("is_playlist", False),
        chapters=[
            {"title": ch["title"], "start_time": ch["start_time"], "end_time": ch["end_time"]}
            for ch in info.get("chapters", [])
        ],
        entries=[
            {"index": e["index"], "id": e["id"], "title": e["title"], "duration": e.get("duration")}
            for e in info.get("entries", [])
        ],
    )


@router.post(
    "/download",
    response_model=list[SoundResponse],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Download Sound(s)",
)
async def download_sound_endpoint(
    db: DbSession,
    user: AdminUser,
    background_tasks: BackgroundTasks,
    data: SoundDownloadRequest,
) -> list[SoundResponse]:
    """Download sound(s) from a YouTube URL.

    Supports:
    - Single video: downloads full audio
    - Video with chapters: downloads and splits selected chapters
    - Playlist: downloads selected entries
    """
    # Get info first
    try:
        info = await get_sound_info(data.source_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    name = data.name or info["title"]

    # Case 1: Playlist with selected entries
    if info.get("is_playlist") and data.selected_entries is not None:
        sounds: list[Sound] = []
        for idx in data.selected_entries:
            if idx < 0 or idx >= len(info["entries"]):
                continue
            entry = info["entries"][idx]
            sound = Sound(
                name=entry.get("title", f"Track {idx + 1}"),
                source_url=f"https://www.youtube.com/watch?v={entry['id']}" if entry.get("id") else data.source_url,
                source_type="youtube",
                status=SoundStatus.PENDING,
                parent_source_url=data.source_url,
            )
            db.add(sound)
            sounds.append(sound)

        await db.commit()
        for s in sounds:
            await db.refresh(s)

        # Download in background
        for sound in sounds:
            background_tasks.add_task(download_sound, db, sound)

        return [_sound_to_response(s) for s in sounds]

    # Case 2: Video with chapters selected
    if data.selected_chapters is not None and info.get("chapters"):
        # Create sounds and download in background
        chapter_sounds: list[Sound] = []
        for idx in data.selected_chapters:
            if idx < 0 or idx >= len(info["chapters"]):
                continue
            ch = info["chapters"][idx]
            sound = Sound(
                name=f"{name} — {ch['title']}",
                source_url=data.source_url,
                source_type="youtube",
                status=SoundStatus.PENDING,
                chapter_title=ch["title"],
                chapter_index=idx,
                parent_source_url=data.source_url,
            )
            db.add(sound)
            chapter_sounds.append(sound)

        await db.commit()
        for s in chapter_sounds:
            await db.refresh(s)

        background_tasks.add_task(
            download_sound_chapters,
            db,
            data.source_url,
            name,
            info["chapters"],
            data.selected_chapters,
        )

        return [_sound_to_response(s) for s in chapter_sounds]

    # Case 3: Single video (full audio)
    sound = Sound(
        name=name,
        source_url=data.source_url,
        source_type="youtube",
        status=SoundStatus.PENDING,
    )
    db.add(sound)
    await db.commit()
    await db.refresh(sound)

    background_tasks.add_task(download_sound, db, sound)

    return [_sound_to_response(sound)]


@router.get(
    "/stats",
    summary="Get Sound Storage Stats",
)
async def get_storage_statistics(
    db: DbSession,
    user: AdminUser,
) -> dict:
    """Get storage statistics for sounds."""
    return await get_sound_storage_stats(db)


# ============================================================================
# Routes with path parameters
# ============================================================================


@router.get(
    "/{sound_id}/file",
    summary="Serve Sound File",
)
async def serve_sound_file(
    db: DbSession,
    sound_id: str,
) -> FileResponse:
    """Serve a sound file for playback.

    No auth required — the Display page needs direct access.
    """
    result = await db.execute(select(Sound).where(Sound.id == sound_id))
    sound = result.scalar_one_or_none()

    if not sound:
        raise NotFoundError("Sound", sound_id)

    if not sound.file_path or not os.path.exists(sound.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sound file not found on disk",
        )

    media_types = {
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "opus": "audio/opus",
        "ogg": "audio/ogg",
        "wav": "audio/wav",
    }
    media_type = media_types.get(sound.format, "audio/mpeg")

    return FileResponse(
        path=sound.file_path,
        media_type=media_type,
        filename=f"{sound.name}.{sound.format}",
    )


@router.get(
    "/{sound_id}",
    response_model=SoundResponse,
    summary="Get Sound",
)
async def get_sound(
    db: DbSession,
    user: AdminUser,
    sound_id: str,
) -> SoundResponse:
    """Get a sound by ID."""
    result = await db.execute(select(Sound).where(Sound.id == sound_id))
    sound = result.scalar_one_or_none()

    if not sound:
        raise NotFoundError("Sound", sound_id)

    return _sound_to_response(sound)


@router.patch(
    "/{sound_id}",
    response_model=SoundResponse,
    summary="Update Sound",
)
async def update_sound(
    db: DbSession,
    user: AdminUser,
    sound_id: str,
    data: SoundUpdate,
) -> SoundResponse:
    """Update sound metadata."""
    result = await db.execute(select(Sound).where(Sound.id == sound_id))
    sound = result.scalar_one_or_none()

    if not sound:
        raise NotFoundError("Sound", sound_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sound, field, value)

    await db.commit()
    await db.refresh(sound)

    return _sound_to_response(sound)


@router.delete(
    "/{sound_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Sound",
)
async def delete_sound(
    db: DbSession,
    user: AdminUser,
    sound_id: str,
) -> None:
    """Delete a sound and its file."""
    result = await db.execute(select(Sound).where(Sound.id == sound_id))
    sound = result.scalar_one_or_none()

    if not sound:
        raise NotFoundError("Sound", sound_id)

    # Delete file
    if sound.file_path and os.path.exists(sound.file_path):
        os.remove(sound.file_path)

    await db.delete(sound)
    await db.commit()
