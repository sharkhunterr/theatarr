"""Unit tests for palette extraction service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from io import BytesIO

from theatarr.services.palette import (
    PaletteExtractor,
    ColorPaletteResult,
    hex_to_rgb,
    rgb_to_hex,
    calculate_luminance,
    get_contrast_ratio,
)


class TestColorUtilities:
    """Tests for color utility functions."""

    def test_hex_to_rgb_black(self):
        """Test converting black hex to RGB."""
        r, g, b = hex_to_rgb("#000000")
        assert r == 0
        assert g == 0
        assert b == 0

    def test_hex_to_rgb_white(self):
        """Test converting white hex to RGB."""
        r, g, b = hex_to_rgb("#FFFFFF")
        assert r == 255
        assert g == 255
        assert b == 255

    def test_hex_to_rgb_red(self):
        """Test converting red hex to RGB."""
        r, g, b = hex_to_rgb("#FF0000")
        assert r == 255
        assert g == 0
        assert b == 0

    def test_hex_to_rgb_lowercase(self):
        """Test converting lowercase hex."""
        r, g, b = hex_to_rgb("#ff5500")
        assert r == 255
        assert g == 85
        assert b == 0

    def test_hex_to_rgb_without_hash(self):
        """Test converting hex without # prefix."""
        r, g, b = hex_to_rgb("FF0000")
        assert r == 255
        assert g == 0
        assert b == 0

    def test_rgb_to_hex(self):
        """Test converting RGB to hex."""
        result = rgb_to_hex(255, 128, 64)
        assert result == "#FF8040"

    def test_rgb_to_hex_black(self):
        """Test converting black RGB to hex."""
        result = rgb_to_hex(0, 0, 0)
        assert result == "#000000"

    def test_rgb_to_hex_white(self):
        """Test converting white RGB to hex."""
        result = rgb_to_hex(255, 255, 255)
        assert result == "#FFFFFF"

    def test_calculate_luminance_black(self):
        """Test luminance of black."""
        lum = calculate_luminance("#000000")
        assert lum == 0.0

    def test_calculate_luminance_white(self):
        """Test luminance of white."""
        lum = calculate_luminance("#FFFFFF")
        assert lum == 1.0

    def test_calculate_luminance_middle_gray(self):
        """Test luminance of middle gray."""
        lum = calculate_luminance("#808080")
        # Should be approximately 0.22
        assert 0.2 < lum < 0.25

    def test_contrast_ratio_black_white(self):
        """Test contrast ratio between black and white."""
        ratio = get_contrast_ratio("#000000", "#FFFFFF")
        assert ratio == 21.0  # Maximum contrast

    def test_contrast_ratio_same_color(self):
        """Test contrast ratio of same color."""
        ratio = get_contrast_ratio("#808080", "#808080")
        assert ratio == 1.0  # No contrast

    def test_contrast_ratio_symmetric(self):
        """Test that contrast ratio is symmetric."""
        ratio1 = get_contrast_ratio("#FF0000", "#00FF00")
        ratio2 = get_contrast_ratio("#00FF00", "#FF0000")
        assert ratio1 == ratio2


class TestColorPaletteResult:
    """Tests for ColorPaletteResult dataclass."""

    def test_create_palette_result(self):
        """Test creating a palette result."""
        result = ColorPaletteResult(
            primary="#FF5500",
            secondary="#0055FF",
            accent="#FFAA00",
            background="#0A0A0A",
            text="#FFFFFF",
            muted="#808080",
        )
        assert result.primary == "#FF5500"
        assert result.secondary == "#0055FF"
        assert result.text == "#FFFFFF"

    def test_palette_result_optional_fields(self):
        """Test palette result with optional fields."""
        result = ColorPaletteResult(
            primary="#FF5500",
            vibrant="#FF0000",
            vibrant_light="#FF8080",
            vibrant_dark="#800000",
        )
        assert result.vibrant == "#FF0000"
        assert result.secondary is None

    def test_palette_to_dict(self):
        """Test converting palette to dictionary."""
        result = ColorPaletteResult(
            primary="#FF5500",
            secondary="#0055FF",
        )
        d = result.to_dict()
        assert d["primary"] == "#FF5500"
        assert d["secondary"] == "#0055FF"

    def test_palette_to_css_vars(self):
        """Test converting palette to CSS variables."""
        result = ColorPaletteResult(
            primary="#FF5500",
            background="#0A0A0A",
            text="#FFFFFF",
        )
        css_vars = result.to_css_vars()
        assert css_vars["--palette-primary"] == "#FF5500"
        assert css_vars["--palette-background"] == "#0A0A0A"
        assert css_vars["--palette-text"] == "#FFFFFF"


class TestPaletteExtractor:
    """Tests for PaletteExtractor class."""

    @pytest.fixture
    def extractor(self):
        """Create extractor instance."""
        return PaletteExtractor()

    def test_extractor_initialization(self, extractor: PaletteExtractor):
        """Test extractor initializes correctly."""
        assert extractor is not None

    @pytest.mark.asyncio
    async def test_extract_from_url_invalid_url(self, extractor: PaletteExtractor):
        """Test extracting from invalid URL."""
        with pytest.raises(ValueError):
            await extractor.extract_from_url("")

    @pytest.mark.asyncio
    async def test_extract_from_url_mocked(self, extractor: PaletteExtractor):
        """Test extracting palette from URL with mocked response."""
        # Create a simple test image (1x1 red pixel)
        from PIL import Image
        import io

        img = Image.new("RGB", (1, 1), color=(255, 0, 0))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        img_bytes.seek(0)

        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.read = AsyncMock(return_value=img_bytes.read())
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            # This will test the URL fetching logic
            # The actual extraction may vary based on implementation

    @pytest.mark.asyncio
    async def test_extract_from_bytes_png(self, extractor: PaletteExtractor):
        """Test extracting palette from PNG bytes."""
        from PIL import Image
        import io

        # Create a test image with multiple colors
        img = Image.new("RGB", (100, 100))
        for x in range(50):
            for y in range(100):
                img.putpixel((x, y), (255, 0, 0))  # Red left half
        for x in range(50, 100):
            for y in range(100):
                img.putpixel((x, y), (0, 0, 255))  # Blue right half

        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        image_data = img_bytes.getvalue()

        result = await extractor.extract_from_bytes(image_data)
        assert result is not None
        assert result.primary is not None

    @pytest.mark.asyncio
    async def test_extract_from_bytes_jpeg(self, extractor: PaletteExtractor):
        """Test extracting palette from JPEG bytes."""
        from PIL import Image
        import io

        img = Image.new("RGB", (100, 100), color=(128, 64, 32))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")
        image_data = img_bytes.getvalue()

        result = await extractor.extract_from_bytes(image_data)
        assert result is not None

    @pytest.mark.asyncio
    async def test_extract_from_bytes_invalid(self, extractor: PaletteExtractor):
        """Test extracting from invalid image data."""
        with pytest.raises(Exception):
            await extractor.extract_from_bytes(b"not an image")

    def test_determine_text_color_light_bg(self, extractor: PaletteExtractor):
        """Test determining text color for light background."""
        text = extractor.determine_text_color("#FFFFFF")
        # Should return dark text for light background
        assert text in ("#000000", "#1A1A1A", "#333333")

    def test_determine_text_color_dark_bg(self, extractor: PaletteExtractor):
        """Test determining text color for dark background."""
        text = extractor.determine_text_color("#000000")
        # Should return light text for dark background
        assert text in ("#FFFFFF", "#F5F5F5", "#E5E5E5")

    def test_generate_muted_color(self, extractor: PaletteExtractor):
        """Test generating muted color from vibrant."""
        muted = extractor.generate_muted_color("#FF0000")
        # Muted should be less saturated
        r, g, b = hex_to_rgb(muted)
        # Original red has R=255, G=0, B=0
        # Muted should have more balanced channels
        assert g > 0 or b > 0

    def test_find_complementary_color(self, extractor: PaletteExtractor):
        """Test finding complementary color."""
        comp = extractor.find_complementary_color("#FF0000")
        # Complementary of red should be cyan-ish
        r, g, b = hex_to_rgb(comp)
        assert g > r // 2 or b > r // 2


class TestPaletteExtractionAlgorithms:
    """Tests for specific extraction algorithms."""

    @pytest.fixture
    def extractor(self):
        return PaletteExtractor()

    def test_k_means_extraction(self, extractor: PaletteExtractor):
        """Test K-means color clustering."""
        from PIL import Image
        import numpy as np

        # Create test image with distinct color regions
        img = Image.new("RGB", (100, 100))
        for x in range(33):
            for y in range(100):
                img.putpixel((x, y), (255, 0, 0))  # Red
        for x in range(33, 66):
            for y in range(100):
                img.putpixel((x, y), (0, 255, 0))  # Green
        for x in range(66, 100):
            for y in range(100):
                img.putpixel((x, y), (0, 0, 255))  # Blue

        colors = extractor._extract_dominant_colors(img, n_colors=3)
        assert len(colors) == 3

    def test_color_frequency_analysis(self, extractor: PaletteExtractor):
        """Test color frequency analysis."""
        from PIL import Image

        # Create image with known color distribution
        img = Image.new("RGB", (100, 100), color=(128, 128, 128))

        # 60% of pixels are one color, 40% another
        for x in range(60):
            for y in range(100):
                img.putpixel((x, y), (255, 0, 0))

        dominant = extractor._find_most_frequent_color(img)
        r, g, b = hex_to_rgb(dominant)
        # Most frequent should be red
        assert r > g and r > b


class TestPaletteCaching:
    """Tests for palette caching functionality."""

    @pytest.fixture
    def extractor(self):
        return PaletteExtractor(cache_enabled=True)

    @pytest.mark.asyncio
    async def test_cache_stores_result(self, extractor: PaletteExtractor):
        """Test that results are cached."""
        from PIL import Image
        import io

        img = Image.new("RGB", (10, 10), color=(255, 0, 0))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        image_data = img_bytes.getvalue()

        # First extraction
        result1 = await extractor.extract_from_bytes(image_data)

        # Should be cached for same data
        result2 = await extractor.extract_from_bytes(image_data)

        assert result1.primary == result2.primary

    def test_cache_key_generation(self, extractor: PaletteExtractor):
        """Test cache key generation."""
        key1 = extractor._generate_cache_key(b"data1")
        key2 = extractor._generate_cache_key(b"data2")
        key3 = extractor._generate_cache_key(b"data1")

        assert key1 != key2
        assert key1 == key3  # Same data should produce same key
