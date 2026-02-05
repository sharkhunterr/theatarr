"""Palette extraction service for Theatarr."""

import colorsys
from io import BytesIO
from typing import Any

import httpx


class PaletteExtractionError(Exception):
    """Error during palette extraction."""

    pass


def _rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB values to hex color string."""
    return f"#{r:02x}{g:02x}{b:02x}"


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )


def _get_luminance(r: int, g: int, b: int) -> float:
    """Calculate relative luminance of a color."""
    r_lin = r / 255
    g_lin = g / 255
    b_lin = b / 255

    r_lin = r_lin / 12.92 if r_lin <= 0.03928 else ((r_lin + 0.055) / 1.055) ** 2.4
    g_lin = g_lin / 12.92 if g_lin <= 0.03928 else ((g_lin + 0.055) / 1.055) ** 2.4
    b_lin = b_lin / 12.92 if b_lin <= 0.03928 else ((b_lin + 0.055) / 1.055) ** 2.4

    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def _get_contrast_color(hex_color: str) -> str:
    """Get a contrasting text color (black or white)."""
    r, g, b = _hex_to_rgb(hex_color)
    luminance = _get_luminance(r, g, b)
    return "#ffffff" if luminance < 0.5 else "#000000"


def _adjust_brightness(hex_color: str, factor: float) -> str:
    """Adjust brightness of a color."""
    r, g, b = _hex_to_rgb(hex_color)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

    l = max(0, min(1, l * factor))
    r, g, b = colorsys.hls_to_rgb(h, l, s)

    return _rgb_to_hex(int(r * 255), int(g * 255), int(b * 255))


async def extract_palette_from_url(url: str) -> dict[str, Any]:
    """Extract color palette from an image URL.

    Uses k-means clustering to find dominant colors in the image.

    Args:
        url: URL of the image to extract colors from.

    Returns:
        Dictionary containing extracted colors and palette data.

    Raises:
        PaletteExtractionError: If extraction fails.
    """
    try:
        # Fetch image
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            image_data = response.content

        return await extract_palette_from_bytes(image_data)

    except httpx.HTTPError as e:
        raise PaletteExtractionError(f"Failed to fetch image: {e}")
    except Exception as e:
        raise PaletteExtractionError(f"Palette extraction failed: {e}")


async def extract_palette_from_bytes(image_data: bytes) -> dict[str, Any]:
    """Extract color palette from image bytes.

    Args:
        image_data: Raw image bytes.

    Returns:
        Dictionary containing extracted colors and palette data.
    """
    try:
        from PIL import Image
        import numpy as np
        from sklearn.cluster import KMeans
    except ImportError:
        # Fallback if dependencies not available
        return _get_default_palette()

    try:
        # Load and resize image for faster processing
        image = Image.open(BytesIO(image_data))
        image = image.convert("RGB")
        image.thumbnail((200, 200))

        # Convert to numpy array
        pixels = np.array(image)
        pixels = pixels.reshape(-1, 3)

        # Filter out near-black and near-white pixels
        mask = (
            (pixels.sum(axis=1) > 30)
            & (pixels.sum(axis=1) < 720)
        )
        filtered_pixels = pixels[mask]

        if len(filtered_pixels) < 10:
            filtered_pixels = pixels

        # K-means clustering to find dominant colors
        n_colors = 6
        kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
        kmeans.fit(filtered_pixels)

        # Get cluster centers (dominant colors)
        colors = kmeans.cluster_centers_.astype(int)
        labels = kmeans.labels_

        # Count occurrences to find most dominant
        counts = np.bincount(labels)
        sorted_indices = np.argsort(-counts)

        # Extract colors in order of dominance
        dominant_colors = [
            _rgb_to_hex(colors[i][0], colors[i][1], colors[i][2])
            for i in sorted_indices
        ]

        # Categorize colors
        palette = _categorize_colors(dominant_colors)

        return palette

    except Exception as e:
        raise PaletteExtractionError(f"Image processing failed: {e}")


def _categorize_colors(colors: list[str]) -> dict[str, Any]:
    """Categorize extracted colors into semantic roles.

    Args:
        colors: List of hex colors sorted by dominance.

    Returns:
        Dictionary with categorized colors.
    """
    if not colors:
        return _get_default_palette()

    # Analyze colors for vibrance and saturation
    analyzed = []
    for color in colors:
        r, g, b = _hex_to_rgb(color)
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        luminance = _get_luminance(r, g, b)
        analyzed.append({
            "hex": color,
            "hue": h,
            "lightness": l,
            "saturation": s,
            "luminance": luminance,
        })

    # Find vibrant color (high saturation)
    vibrant_candidates = sorted(analyzed, key=lambda x: x["saturation"], reverse=True)
    vibrant = vibrant_candidates[0]["hex"] if vibrant_candidates else colors[0]

    # Find light variant
    light_candidates = [c for c in analyzed if c["lightness"] > 0.6 and c["saturation"] > 0.3]
    vibrant_light = light_candidates[0]["hex"] if light_candidates else _adjust_brightness(vibrant, 1.3)

    # Find dark variant
    dark_candidates = [c for c in analyzed if c["lightness"] < 0.4 and c["saturation"] > 0.3]
    vibrant_dark = dark_candidates[0]["hex"] if dark_candidates else _adjust_brightness(vibrant, 0.7)

    # Find muted color (low saturation)
    muted_candidates = sorted(analyzed, key=lambda x: x["saturation"])
    muted = muted_candidates[0]["hex"] if muted_candidates else colors[-1]

    # Primary is most dominant saturated color
    primary_candidates = [c for c in analyzed if c["saturation"] > 0.2]
    primary = primary_candidates[0]["hex"] if primary_candidates else colors[0]

    # Secondary is second most dominant
    secondary = colors[1] if len(colors) > 1 else primary

    # Accent is the most vibrant color
    accent = vibrant

    # Background should be dark
    background = vibrant_dark if _get_luminance(*_hex_to_rgb(vibrant_dark)) < 0.3 else "#0a0a0f"

    # Text color based on background
    text = _get_contrast_color(background)

    return {
        "primary": primary,
        "secondary": secondary,
        "accent": accent,
        "background": background,
        "text": text,
        "muted": muted,
        "vibrant": vibrant,
        "vibrant_light": vibrant_light,
        "vibrant_dark": vibrant_dark,
        "muted_color": muted,
        "muted_light": _adjust_brightness(muted, 1.3),
        "muted_dark": _adjust_brightness(muted, 0.7),
        "raw_palette": colors,
    }


def _get_default_palette() -> dict[str, Any]:
    """Get default palette when extraction fails."""
    return {
        "primary": "#6366f1",
        "secondary": "#8b5cf6",
        "accent": "#f59e0b",
        "background": "#0a0a0f",
        "text": "#ffffff",
        "muted": "#6b7280",
        "vibrant": "#6366f1",
        "vibrant_light": "#818cf8",
        "vibrant_dark": "#4f46e5",
        "muted_color": "#6b7280",
        "muted_light": "#9ca3af",
        "muted_dark": "#4b5563",
        "raw_palette": ["#6366f1", "#8b5cf6", "#f59e0b", "#6b7280"],
    }


async def create_palette_for_movie(
    movie_id: str,
    poster_url: str | None = None,
    backdrop_url: str | None = None,
) -> dict[str, Any]:
    """Create color palette for a movie.

    Extracts palette from poster or backdrop image.

    Args:
        movie_id: ID of the movie.
        poster_url: URL of the movie poster.
        backdrop_url: URL of the movie backdrop.

    Returns:
        Dictionary containing palette data.
    """
    palette = None

    # Try poster first
    if poster_url:
        try:
            palette = await extract_palette_from_url(poster_url)
            palette["source_url"] = poster_url
            palette["source_type"] = "poster"
        except PaletteExtractionError:
            pass

    # Try backdrop if poster failed
    if not palette and backdrop_url:
        try:
            palette = await extract_palette_from_url(backdrop_url)
            palette["source_url"] = backdrop_url
            palette["source_type"] = "backdrop"
        except PaletteExtractionError:
            pass

    # Use default if all failed
    if not palette:
        palette = _get_default_palette()
        palette["source_url"] = None
        palette["source_type"] = "default"

    palette["movie_id"] = movie_id
    return palette
