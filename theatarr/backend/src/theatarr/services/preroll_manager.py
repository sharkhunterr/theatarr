"""Pre-roll manager service for Theatarr.

Handles pre-roll video downloading from YouTube and file management.
"""

import asyncio
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.config import settings
from theatarr.models.preroll import PreRoll, PreRollStatus


async def download_preroll(
    db: AsyncSession,
    preroll: PreRoll,
    download_dir: str | None = None,
) -> PreRoll:
    """Download a pre-roll video using yt-dlp.

    Args:
        db: Database session
        preroll: PreRoll object to download
        download_dir: Override download directory

    Returns:
        Updated PreRoll object
    """
    if not preroll.source_url:
        preroll.status = PreRollStatus.ERROR
        preroll.error_message = "No source URL provided"
        await db.commit()
        return preroll

    base_dir = download_dir or str(settings.preroll_path)
    output_dir = Path(base_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in preroll.name)
    output_template = output_dir / f"{safe_name}_{preroll.id}.%(ext)s"

    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "--format=bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format=mp4",
        "--write-thumbnail",
        "--convert-thumbnails=jpg",
        "-o", str(output_template),
        preroll.source_url,
    ]

    try:
        preroll.status = PreRollStatus.DOWNLOADING
        await db.commit()

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            preroll.status = PreRollStatus.ERROR
            preroll.error_message = stderr.decode()[:500] if stderr else "Download failed"
            await db.commit()
            return preroll

        # Find the downloaded file
        for ext in ["mp4", "mkv", "webm"]:
            file_path = output_dir / f"{safe_name}_{preroll.id}.{ext}"
            if file_path.exists():
                preroll.file_path = str(file_path)
                preroll.file_size_bytes = file_path.stat().st_size
                preroll.format = ext
                break

        # Find thumbnail
        thumbnail_path = output_dir / f"{safe_name}_{preroll.id}.jpg"
        if thumbnail_path.exists():
            preroll.thumbnail_path = str(thumbnail_path)

        # Get duration using ffprobe
        duration = await _get_video_duration(preroll.file_path)
        if duration:
            preroll.duration_seconds = duration

        preroll.status = PreRollStatus.READY
        preroll.download_progress = 1.0
        preroll.error_message = None

    except Exception as e:
        preroll.status = PreRollStatus.ERROR
        preroll.error_message = str(e)[:500]

    await db.commit()
    return preroll


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
