"""Sound manager service for Theatarr.

Handles audio extraction from YouTube, chapter splitting, playlist support,
and storage management.
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.config import settings
from theatarr.models.sound import Sound, SoundStatus

logger = logging.getLogger(__name__)


async def get_sound_info(url: str) -> dict[str, Any]:
    """Analyze a YouTube URL to get metadata, chapters, and playlist info.

    Args:
        url: YouTube URL (video or playlist)

    Returns:
        Dict with title, duration, is_playlist, chapters, entries
    """
    # First try as playlist
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--flat-playlist",
        "--no-warnings",
        url,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode()[:500] if stderr else "Failed to fetch info"
        raise ValueError(f"yt-dlp error: {error_msg}")

    lines = stdout.decode().strip().split("\n")
    results = [json.loads(line) for line in lines if line.strip()]

    if not results:
        raise ValueError("No results from yt-dlp")

    # Single video (not playlist)
    if len(results) == 1:
        info = results[0]

        # If flat-playlist returned a playlist entry, we need full info
        if info.get("_type") == "url" or not info.get("title"):
            return await _get_single_video_info(url)

        chapters = []
        for ch in info.get("chapters", []) or []:
            chapters.append({
                "title": ch.get("title", f"Chapter {len(chapters) + 1}"),
                "start_time": ch.get("start_time", 0),
                "end_time": ch.get("end_time", 0),
            })

        return {
            "title": info.get("title", "Unknown"),
            "duration": info.get("duration"),
            "is_playlist": False,
            "chapters": chapters,
            "entries": [],
        }

    # Playlist: multiple entries
    entries = []
    playlist_title = "Playlist"
    for idx, entry in enumerate(results):
        if idx == 0 and entry.get("_type") == "playlist":
            playlist_title = entry.get("title", "Playlist")
            continue

        entries.append({
            "index": idx,
            "id": entry.get("id", ""),
            "title": entry.get("title", f"Track {idx + 1}"),
            "duration": entry.get("duration"),
        })

    return {
        "title": playlist_title,
        "duration": None,
        "is_playlist": True,
        "chapters": [],
        "entries": entries,
    }


async def _get_single_video_info(url: str) -> dict[str, Any]:
    """Get full metadata for a single video (not flat-playlist mode)."""
    cmd = [
        "yt-dlp",
        "--dump-json",
        "--no-playlist",
        "--no-warnings",
        url,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode()[:500] if stderr else "Failed to fetch info"
        raise ValueError(f"yt-dlp error: {error_msg}")

    info = json.loads(stdout.decode())

    chapters = []
    for ch in info.get("chapters", []) or []:
        chapters.append({
            "title": ch.get("title", f"Chapter {len(chapters) + 1}"),
            "start_time": ch.get("start_time", 0),
            "end_time": ch.get("end_time", 0),
        })

    return {
        "title": info.get("title", "Unknown"),
        "duration": info.get("duration"),
        "is_playlist": False,
        "chapters": chapters,
        "entries": [],
    }


async def download_sound(
    db: AsyncSession,
    sound: Sound,
    output_dir: str | None = None,
) -> Sound:
    """Download audio from a YouTube URL using yt-dlp.

    Args:
        db: Database session
        sound: Sound object to download
        output_dir: Override output directory

    Returns:
        Updated Sound object
    """
    if not sound.source_url:
        sound.status = SoundStatus.ERROR
        sound.error_message = "No source URL provided"
        await db.commit()
        return sound

    base_dir = output_dir or str(settings.sound_path)
    out_path = Path(base_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in sound.name)
    output_template = out_path / f"{safe_name}_{sound.id}.%(ext)s"

    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", str(output_template),
        sound.source_url,
    ]

    try:
        sound.status = SoundStatus.DOWNLOADING
        await db.commit()

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            sound.status = SoundStatus.ERROR
            sound.error_message = stderr.decode()[:500] if stderr else "Download failed"
            await db.commit()
            return sound

        # Find the downloaded file
        file_path = out_path / f"{safe_name}_{sound.id}.mp3"
        if file_path.exists():
            sound.file_path = str(file_path)
            sound.file_size_bytes = file_path.stat().st_size
            sound.format = "mp3"

        # Get audio metadata
        duration = await _get_audio_duration(sound.file_path)
        if duration:
            sound.duration_seconds = duration

        bitrate = await _get_audio_bitrate(sound.file_path)
        if bitrate:
            sound.bitrate = bitrate

        sound.status = SoundStatus.READY
        sound.download_progress = 1.0
        sound.error_message = None

    except Exception as e:
        sound.status = SoundStatus.ERROR
        sound.error_message = str(e)[:500]

    await db.commit()
    return sound


async def download_sound_chapters(
    db: AsyncSession,
    url: str,
    name_prefix: str,
    chapters_info: list[dict[str, Any]],
    chapter_indices: list[int],
    tags: list[str] | None = None,
    output_dir: str | None = None,
) -> list[Sound]:
    """Download audio and split into selected chapters.

    Downloads the full audio, then uses ffmpeg to split selected chapters.

    Args:
        db: Database session
        url: YouTube URL
        name_prefix: Name prefix for chapter sounds
        chapters_info: Full chapter list from get_sound_info
        chapter_indices: Indices of chapters to extract
        tags: Optional tags
        output_dir: Override output directory

    Returns:
        List of created Sound objects
    """
    base_dir = output_dir or str(settings.sound_path)
    out_path = Path(base_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    # Download full audio first
    tmp_file = out_path / f"_tmp_chapters_{os.getpid()}.mp3"
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", str(tmp_file),
        url,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error_msg = stderr.decode()[:500] if stderr else "Download failed"
        raise ValueError(f"yt-dlp chapter download failed: {error_msg}")

    # Find the actual file (yt-dlp may add extension)
    actual_tmp = tmp_file
    if not actual_tmp.exists():
        # yt-dlp might have kept original extension
        for ext in ["mp3", "m4a", "opus", "webm"]:
            candidate = tmp_file.with_suffix(f".{ext}")
            if candidate.exists():
                actual_tmp = candidate
                break

    if not actual_tmp.exists():
        raise ValueError("Downloaded file not found")

    # Split chapters with ffmpeg
    sounds: list[Sound] = []
    try:
        for idx in chapter_indices:
            if idx < 0 or idx >= len(chapters_info):
                continue

            chapter = chapters_info[idx]
            chapter_title = chapter.get("title", f"Chapter {idx + 1}")
            safe_chapter = "".join(
                c if c.isalnum() or c in " -_" else "_" for c in chapter_title
            )

            sound = Sound(
                name=f"{name_prefix} — {chapter_title}",
                tags=tags,
                source_url=url,
                source_type="youtube",
                status=SoundStatus.PROCESSING,
                chapter_title=chapter_title,
                chapter_index=idx,
                parent_source_url=url,
            )
            db.add(sound)
            await db.flush()

            out_file = out_path / f"{safe_chapter}_{sound.id}.mp3"

            start = chapter.get("start_time", 0)
            end = chapter.get("end_time", 0)

            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-i", str(actual_tmp),
                "-ss", str(start),
                "-to", str(end),
                "-c", "copy",
                str(out_file),
            ]

            proc = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

            if proc.returncode == 0 and out_file.exists():
                sound.file_path = str(out_file)
                sound.file_size_bytes = out_file.stat().st_size
                sound.format = "mp3"
                sound.duration_seconds = await _get_audio_duration(str(out_file))
                sound.bitrate = await _get_audio_bitrate(str(out_file))
                sound.status = SoundStatus.READY
                sound.download_progress = 1.0
            else:
                sound.status = SoundStatus.ERROR
                sound.error_message = "ffmpeg chapter split failed"

            sounds.append(sound)

        await db.commit()
    finally:
        # Clean up temp file
        if actual_tmp.exists():
            actual_tmp.unlink()

    return sounds


async def download_playlist_entries(
    db: AsyncSession,
    url: str,
    entries_info: list[dict[str, Any]],
    selected_indices: list[int],
    tags: list[str] | None = None,
    output_dir: str | None = None,
) -> list[Sound]:
    """Download selected entries from a playlist.

    Args:
        db: Database session
        url: Original playlist URL
        entries_info: Full entry list from get_sound_info
        selected_indices: Indices of entries to download
        tags: Optional tags
        output_dir: Override output directory

    Returns:
        List of created Sound objects
    """
    sounds: list[Sound] = []

    for idx in selected_indices:
        if idx < 0 or idx >= len(entries_info):
            continue

        entry = entries_info[idx]
        entry_id = entry.get("id", "")
        entry_title = entry.get("title", f"Track {idx + 1}")
        entry_url = f"https://www.youtube.com/watch?v={entry_id}" if entry_id else url

        sound = Sound(
            name=entry_title,
            tags=tags,
            source_url=entry_url,
            source_type="youtube",
            status=SoundStatus.PENDING,
            parent_source_url=url,
        )
        db.add(sound)
        await db.flush()
        sounds.append(sound)

    await db.commit()

    # Download each entry sequentially
    for sound in sounds:
        await download_sound(db, sound, output_dir)

    return sounds


async def _get_audio_duration(file_path: str | None) -> int | None:
    """Get audio duration using ffprobe."""
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


async def _get_audio_bitrate(file_path: str | None) -> int | None:
    """Get audio bitrate in kbps using ffprobe."""
    if not file_path or not os.path.exists(file_path):
        return None

    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=bit_rate",
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
            bit_rate = int(stdout.decode().strip())
            return bit_rate // 1000  # Convert to kbps
    except Exception:
        pass

    return None


async def get_sound_storage_stats(db: AsyncSession) -> dict[str, Any]:
    """Get storage statistics for sounds."""
    # Total counts by status
    status_query = select(
        Sound.status, func.count(Sound.id)
    ).group_by(Sound.status)
    result = await db.execute(status_query)
    by_status = {str(row[0]): row[1] for row in result.all()}

    total = sum(by_status.values())
    ready = by_status.get(SoundStatus.READY.value, 0)

    # Total size
    size_query = select(func.sum(Sound.file_size_bytes)).where(
        Sound.status == SoundStatus.READY
    )
    size_result = await db.execute(size_query)
    total_size = size_result.scalar() or 0

    # Total duration
    dur_query = select(func.sum(Sound.duration_seconds)).where(
        Sound.status == SoundStatus.READY
    )
    dur_result = await db.execute(dur_query)
    total_duration = dur_result.scalar() or 0

    hours = total_duration // 3600
    minutes = (total_duration % 3600) // 60
    seconds = total_duration % 60
    duration_fmt = f"{hours}h {minutes}m {seconds}s" if hours else f"{minutes}m {seconds}s"

    return {
        "total_sounds": total,
        "ready_sounds": ready,
        "total_size_bytes": total_size,
        "total_size_gb": round(total_size / (1024 * 1024 * 1024), 2),
        "total_duration_seconds": total_duration,
        "total_duration_formatted": duration_fmt,
        "by_status": by_status,
    }
