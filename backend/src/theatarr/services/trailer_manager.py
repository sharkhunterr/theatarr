"""Trailer manager service for Theatarr.

Handles trailer downloading, storage management, and contextual selection.
"""

import asyncio
import os
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.config import settings
from theatarr.models.trailer import (
    Trailer,
    TrailerQuality,
    TrailerRule,
    TrailerRuleFrequency,
    TrailerStatus,
)


# Quality to resolution mapping
QUALITY_RESOLUTIONS = {
    TrailerQuality.UHD.value: 2160,
    TrailerQuality.FHD.value: 1080,
    TrailerQuality.HD.value: 720,
    TrailerQuality.SD.value: 480,
}


async def download_trailer(
    db: AsyncSession,
    trailer: Trailer,
    download_dir: str | None = None,
) -> Trailer:
    """Download a trailer using yt-dlp.

    Args:
        db: Database session
        trailer: Trailer object to download
        download_dir: Override download directory

    Returns:
        Updated Trailer object
    """
    if not trailer.source_url:
        trailer.status = TrailerStatus.ERROR
        trailer.error_message = "No source URL provided"
        await db.commit()
        return trailer

    # Set download directory
    base_dir = download_dir or str(settings.trailer_path)
    output_dir = Path(base_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate output filename
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in trailer.movie_title)
    output_template = output_dir / f"{safe_title}_{trailer.id}.%(ext)s"

    # Determine quality format
    quality = trailer.quality or TrailerQuality.HD.value
    resolution = QUALITY_RESOLUTIONS.get(quality, 720)

    # Build yt-dlp command
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        f"--format=bestvideo[height<={resolution}]+bestaudio/best[height<={resolution}]",
        "--merge-output-format=mp4",
        "--write-thumbnail",
        "--convert-thumbnails=jpg",
        "-o", str(output_template),
        trailer.source_url,
    ]

    try:
        trailer.status = TrailerStatus.DOWNLOADING
        await db.commit()

        # Run yt-dlp
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            trailer.status = TrailerStatus.ERROR
            trailer.error_message = stderr.decode()[:500] if stderr else "Download failed"
            await db.commit()
            return trailer

        # Find the downloaded file
        for ext in ["mp4", "mkv", "webm"]:
            file_path = output_dir / f"{safe_title}_{trailer.id}.{ext}"
            if file_path.exists():
                trailer.file_path = str(file_path)
                trailer.file_size_bytes = file_path.stat().st_size
                trailer.format = ext
                break

        # Find thumbnail
        thumbnail_path = output_dir / f"{safe_title}_{trailer.id}.jpg"
        if thumbnail_path.exists():
            trailer.thumbnail_path = str(thumbnail_path)

        # Get duration using ffprobe
        duration = await _get_video_duration(trailer.file_path)
        if duration:
            trailer.duration_seconds = duration

        trailer.status = TrailerStatus.READY
        trailer.download_progress = 1.0
        trailer.error_message = None

    except Exception as e:
        trailer.status = TrailerStatus.ERROR
        trailer.error_message = str(e)[:500]

    await db.commit()
    return trailer


async def _get_video_duration(file_path: str | None) -> int | None:
    """Get video duration using ffprobe."""
    if not file_path or not os.path.exists(file_path):
        return None

    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, _ = await process.communicate()

        if process.returncode == 0 and stdout:
            duration = float(stdout.decode().strip())
            return int(duration)
    except Exception:
        pass

    return None


async def apply_rotation(
    db: AsyncSession,
    rule: TrailerRule,
) -> list[str]:
    """Apply rotation policy to remove old trailers.

    Args:
        db: Database session
        rule: Trailer rule with rotation settings

    Returns:
        List of deleted trailer IDs
    """
    if not rule.rotation_enabled:
        return []

    deleted_ids: list[str] = []

    # Get all ready trailers for this rule
    result = await db.execute(
        select(Trailer)
        .where(Trailer.rule_id == rule.id)
        .where(Trailer.status == TrailerStatus.READY)
        .order_by(Trailer.created_at.desc())
    )
    trailers = result.scalars().all()

    if len(trailers) <= (rule.rotation_keep_most_recent + rule.rotation_keep_most_played):
        return []

    # Identify trailers to keep
    keep_ids: set[str] = set()

    # Keep most recent
    for t in trailers[: rule.rotation_keep_most_recent]:
        keep_ids.add(t.id)

    # Keep most played (sort by play_count)
    by_plays = sorted(trailers, key=lambda x: x.play_count, reverse=True)
    for t in by_plays[: rule.rotation_keep_most_played]:
        keep_ids.add(t.id)

    # Check storage limit
    current_storage = rule.total_storage_bytes
    max_storage = int(rule.max_storage_gb * 1024 * 1024 * 1024)

    # Delete trailers not in keep set, oldest first
    for trailer in reversed(trailers):
        if trailer.id in keep_ids:
            continue

        # Also delete if over storage limit
        if current_storage > max_storage or len(trailers) - len(deleted_ids) > (rule.max_trailer_count or float("inf")):
            # Delete file
            if trailer.file_path and os.path.exists(trailer.file_path):
                try:
                    os.remove(trailer.file_path)
                    if trailer.thumbnail_path and os.path.exists(trailer.thumbnail_path):
                        os.remove(trailer.thumbnail_path)
                except Exception:
                    pass

            # Update storage tracking
            if trailer.file_size_bytes:
                current_storage -= trailer.file_size_bytes
                rule.total_storage_bytes -= trailer.file_size_bytes

            trailer.status = TrailerStatus.DELETED
            deleted_ids.append(trailer.id)

    await db.commit()
    return deleted_ids


async def select_contextual_trailers(
    db: AsyncSession,
    genres: list[str] | None = None,
    count: int = 3,
    exclude_ids: list[str] | None = None,
    prefer_unplayed: bool = True,
) -> list[Trailer]:
    """Select trailers contextually based on genres.

    Prioritizes:
    1. Matching genres
    2. Recently added
    3. Less played

    Args:
        db: Database session
        genres: Preferred genres (from main feature movie)
        count: Number of trailers to select
        exclude_ids: Trailer IDs to exclude
        prefer_unplayed: Prefer trailers that haven't been played recently

    Returns:
        List of selected trailers
    """
    exclude_ids = exclude_ids or []

    # Build query for ready trailers
    query = (
        select(Trailer)
        .where(Trailer.status == TrailerStatus.READY)
        .where(Trailer.id.notin_(exclude_ids) if exclude_ids else True)
    )

    result = await db.execute(query)
    all_trailers = result.scalars().all()

    if not all_trailers:
        return []

    # Score each trailer
    scored: list[tuple[Trailer, float]] = []

    for trailer in all_trailers:
        score = 0.0

        # Genre matching (highest priority)
        if genres and trailer.genres:
            matching_genres = len(set(genres) & set(trailer.genres))
            score += matching_genres * 10

        # Recency bonus (newer = higher score)
        if trailer.created_at:
            days_old = (datetime.now(timezone.utc) - trailer.created_at).days
            score += max(0, 30 - days_old) * 0.5

        # Unplayed bonus
        if prefer_unplayed:
            if trailer.play_count == 0:
                score += 5
            elif trailer.last_played_at:
                days_since_played = (datetime.now(timezone.utc) - trailer.last_played_at).days
                score += min(days_since_played, 30) * 0.3

        # Rating bonus
        if trailer.rating:
            score += trailer.rating * 0.5

        # Add some randomness
        score += random.uniform(0, 3)

        scored.append((trailer, score))

    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)

    # Return top N
    return [t for t, _ in scored[:count]]


async def run_trailer_rule(
    db: AsyncSession,
    rule: TrailerRule,
    tmdb_adapter: Any,
) -> dict[str, Any]:
    """Execute a trailer rule to download new trailers.

    Args:
        db: Database session
        rule: The rule to execute
        tmdb_adapter: TMDB adapter instance for searching

    Returns:
        Execution result summary
    """
    if not rule.is_enabled:
        return {"status": "skipped", "reason": "Rule is disabled"}

    if rule.is_at_storage_limit:
        # Apply rotation first
        await apply_rotation(db, rule)
        if rule.is_at_storage_limit:
            return {"status": "skipped", "reason": "Storage limit reached"}

    downloaded = 0
    errors = 0
    skipped = 0

    # Get movies to find trailers for
    movies = await tmdb_adapter.get_popular_movies(page=1)

    for movie in movies:
        if downloaded >= rule.max_downloads_per_run:
            break

        # Check if movie matches rule criteria
        if not rule.matches_movie(
            genres=movie.get("genres", []),
            year=movie.get("year"),
            rating=movie.get("rating"),
        ):
            skipped += 1
            continue

        # Check if we already have a trailer for this movie
        tmdb_id = movie.get("tmdb_id")
        result = await db.execute(
            select(Trailer).where(Trailer.movie_tmdb_id == tmdb_id)
        )
        if result.scalar_one_or_none():
            skipped += 1
            continue

        # Get trailers from TMDB
        trailers = await tmdb_adapter.get_trailers(tmdb_id)
        if not trailers:
            skipped += 1
            continue

        # Find best quality trailer
        best_trailer = None
        preferred_res = QUALITY_RESOLUTIONS.get(rule.preferred_quality, 1080)
        min_res = QUALITY_RESOLUTIONS.get(rule.min_quality, 720)

        for t in trailers:
            size = t.get("size", 1080)
            if min_res <= size <= preferred_res:
                best_trailer = t
                break

        if not best_trailer and trailers:
            best_trailer = trailers[0]

        if not best_trailer:
            continue

        # Check if we already have this exact YouTube video (prevent duplicates)
        video_key = best_trailer.get("key")
        if video_key:
            dup_result = await db.execute(
                select(Trailer).where(Trailer.source_id == video_key)
            )
            if dup_result.scalar_one_or_none():
                skipped += 1
                continue

        # Create trailer entry
        trailer = Trailer(
            movie_title=movie.get("title", "Unknown"),
            movie_year=movie.get("year"),
            movie_tmdb_id=tmdb_id,
            title=best_trailer.get("name", "Trailer"),
            source_type="youtube",
            source_url=best_trailer.get("youtube_url"),
            source_id=best_trailer.get("key"),
            thumbnail_url=f"https://img.youtube.com/vi/{best_trailer.get('key')}/maxresdefault.jpg",
            quality=rule.preferred_quality,
            genres=movie.get("genres", []),
            rating=movie.get("rating"),
            rule_id=rule.id,
        )
        db.add(trailer)
        await db.commit()
        await db.refresh(trailer)

        # Download the trailer
        try:
            await download_trailer(db, trailer)
            if trailer.status == TrailerStatus.READY:
                downloaded += 1
                rule.total_downloads += 1
                if trailer.file_size_bytes:
                    rule.total_storage_bytes += trailer.file_size_bytes
            else:
                errors += 1
        except Exception:
            errors += 1

    # Update rule timing
    rule.last_run_at = datetime.now(timezone.utc)
    rule.next_run_at = _calculate_next_run(rule.frequency)
    await db.commit()

    return {
        "status": "completed",
        "downloaded": downloaded,
        "errors": errors,
        "skipped": skipped,
    }


def _calculate_next_run(frequency: str) -> datetime:
    """Calculate next run time based on frequency."""
    now = datetime.now(timezone.utc)

    if frequency == TrailerRuleFrequency.DAILY.value:
        return now + timedelta(days=1)
    elif frequency == TrailerRuleFrequency.WEEKLY.value:
        return now + timedelta(weeks=1)
    elif frequency == TrailerRuleFrequency.MONTHLY.value:
        return now + timedelta(days=30)
    else:
        return now + timedelta(days=365)  # Manual - far future


async def get_storage_stats(db: AsyncSession) -> dict[str, Any]:
    """Get storage statistics for all trailers.

    Args:
        db: Database session

    Returns:
        Storage statistics
    """
    # Total counts by status
    result = await db.execute(
        select(
            Trailer.status,
            func.count(Trailer.id),
            func.sum(Trailer.file_size_bytes),
            func.sum(Trailer.duration_seconds),
        ).group_by(Trailer.status)
    )
    status_stats = result.all()

    by_status: dict[str, int] = {}
    total_size = 0
    total_duration = 0
    total_count = 0
    ready_count = 0
    pending_count = 0
    error_count = 0

    for status, count, size, duration in status_stats:
        status_val = status.value if hasattr(status, "value") else str(status)
        by_status[status_val] = count
        total_count += count
        total_size += size or 0
        total_duration += duration or 0

        if status_val == TrailerStatus.READY.value:
            ready_count = count
        elif status_val == TrailerStatus.PENDING.value:
            pending_count = count
        elif status_val == TrailerStatus.ERROR.value:
            error_count = count

    # By quality
    result = await db.execute(
        select(Trailer.quality, func.count(Trailer.id))
        .where(Trailer.status == TrailerStatus.READY)
        .group_by(Trailer.quality)
    )
    by_quality = {q: c for q, c in result.all()}

    # Format duration
    hours = total_duration // 3600
    minutes = (total_duration % 3600) // 60
    duration_formatted = f"{hours}h {minutes}m" if hours else f"{minutes}m"

    return {
        "total_trailers": total_count,
        "ready_trailers": ready_count,
        "pending_trailers": pending_count,
        "error_trailers": error_count,
        "total_size_bytes": total_size,
        "total_size_gb": round(total_size / (1024 * 1024 * 1024), 2),
        "total_duration_seconds": total_duration,
        "total_duration_formatted": duration_formatted,
        "by_quality": by_quality,
        "by_status": by_status,
        "by_genre": {},  # Would need aggregation on array field
    }
