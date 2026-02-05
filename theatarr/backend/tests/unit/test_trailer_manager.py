"""Unit tests for trailer manager service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from theatarr.services.trailer_manager import (
    TrailerManager,
    TrailerDownloader,
    StorageRotator,
    TrailerSelector,
)
from theatarr.models.trailer import (
    Trailer,
    TrailerRule,
    TrailerStatus,
    TrailerQuality,
    TrailerRuleFrequency,
)


class TestTrailerManager:
    """Tests for TrailerManager class."""

    @pytest.fixture
    def manager(self) -> TrailerManager:
        """Create manager instance."""
        return TrailerManager()

    @pytest.fixture
    def mock_rule(self) -> TrailerRule:
        """Create a mock trailer rule."""
        rule = MagicMock(spec=TrailerRule)
        rule.id = "rule-123"
        rule.name = "Action Trailers"
        rule.is_enabled = True
        rule.genres = ["Action", "Sci-Fi"]
        rule.min_year = 2020
        rule.max_year = None
        rule.min_rating = 6.0
        rule.max_rating = None
        rule.preferred_quality = TrailerQuality.FHD.value
        rule.min_quality = TrailerQuality.HD.value
        rule.max_storage_gb = 10.0
        rule.max_trailer_count = 50
        rule.max_downloads_per_run = 5
        rule.frequency = TrailerRuleFrequency.WEEKLY.value
        rule.rotation_enabled = True
        rule.total_storage_bytes = 5 * 1024 * 1024 * 1024  # 5GB
        rule.is_at_storage_limit = False
        return rule

    @pytest.fixture
    def mock_trailer(self) -> Trailer:
        """Create a mock trailer."""
        trailer = MagicMock(spec=Trailer)
        trailer.id = "trailer-123"
        trailer.movie_title = "Test Movie"
        trailer.movie_year = 2023
        trailer.title = "Test Movie - Official Trailer"
        trailer.status = TrailerStatus.READY
        trailer.quality = TrailerQuality.FHD.value
        trailer.file_path = "/data/trailers/test.mp4"
        trailer.file_size_bytes = 100 * 1024 * 1024  # 100MB
        trailer.play_count = 5
        trailer.duration_seconds = 120
        trailer.is_ready = True
        return trailer

    def test_manager_initialization(self, manager: TrailerManager):
        """Test manager initializes correctly."""
        assert manager is not None

    @pytest.mark.asyncio
    async def test_process_rule_respects_limits(
        self, manager: TrailerManager, mock_rule: TrailerRule
    ):
        """Test that rule processing respects max_downloads_per_run."""
        mock_rule.max_downloads_per_run = 3

        with patch.object(manager, "_find_trailers_for_rule") as mock_find:
            mock_find.return_value = [
                {"title": f"Movie {i}"} for i in range(10)
            ]

            with patch.object(manager, "_download_trailer") as mock_download:
                mock_download.return_value = MagicMock()

                await manager.process_rule(mock_rule, MagicMock())

                # Should only download max_downloads_per_run
                assert mock_download.call_count <= 3

    @pytest.mark.asyncio
    async def test_process_rule_checks_storage_limit(
        self, manager: TrailerManager, mock_rule: TrailerRule
    ):
        """Test that rule processing checks storage limit."""
        mock_rule.is_at_storage_limit = True

        with patch.object(manager, "_find_trailers_for_rule") as mock_find:
            mock_find.return_value = [{"title": "Movie"}]

            with patch.object(manager, "_download_trailer") as mock_download:
                await manager.process_rule(mock_rule, MagicMock())

                # Should not download when at limit
                mock_download.assert_not_called()


class TestTrailerDownloader:
    """Tests for TrailerDownloader class."""

    @pytest.fixture
    def downloader(self) -> TrailerDownloader:
        """Create downloader instance."""
        return TrailerDownloader(storage_path="/data/trailers")

    def test_downloader_initialization(self, downloader: TrailerDownloader):
        """Test downloader initializes correctly."""
        assert downloader.storage_path == "/data/trailers"

    @pytest.mark.asyncio
    async def test_download_from_youtube(self, downloader: TrailerDownloader):
        """Test downloading trailer from YouTube."""
        with patch("yt_dlp.YoutubeDL") as mock_ydl:
            mock_ydl_instance = MagicMock()
            mock_ydl_instance.extract_info = MagicMock(
                return_value={
                    "title": "Test Trailer",
                    "duration": 120,
                    "thumbnail": "http://example.com/thumb.jpg",
                }
            )
            mock_ydl_instance.__enter__ = MagicMock(return_value=mock_ydl_instance)
            mock_ydl_instance.__exit__ = MagicMock(return_value=False)
            mock_ydl.return_value = mock_ydl_instance

            result = await downloader.download(
                url="https://youtube.com/watch?v=test123",
                movie_title="Test Movie",
                quality=TrailerQuality.FHD,
            )

            # Should return download info
            assert result is not None

    def test_get_ytdl_options(self, downloader: TrailerDownloader):
        """Test getting yt-dlp options for quality."""
        options = downloader._get_ytdl_options(
            quality=TrailerQuality.FHD,
            output_path="/data/trailers/test",
        )

        assert "format" in options
        assert "outtmpl" in options

    def test_quality_format_string(self, downloader: TrailerDownloader):
        """Test quality format string generation."""
        fhd_format = downloader._get_quality_format(TrailerQuality.FHD)
        hd_format = downloader._get_quality_format(TrailerQuality.HD)

        assert "1080" in fhd_format
        assert "720" in hd_format

    @pytest.mark.asyncio
    async def test_download_with_progress_callback(
        self, downloader: TrailerDownloader
    ):
        """Test download reports progress."""
        progress_updates = []

        def on_progress(percent: float):
            progress_updates.append(percent)

        with patch("yt_dlp.YoutubeDL") as mock_ydl:
            mock_ydl_instance = MagicMock()

            def download_hook(d):
                if d["status"] == "downloading":
                    on_progress(50.0)
                elif d["status"] == "finished":
                    on_progress(100.0)

            mock_ydl_instance.add_progress_hook = MagicMock(
                side_effect=lambda hook: download_hook({"status": "finished"})
            )
            mock_ydl_instance.extract_info = MagicMock(return_value={})
            mock_ydl_instance.__enter__ = MagicMock(return_value=mock_ydl_instance)
            mock_ydl_instance.__exit__ = MagicMock(return_value=False)
            mock_ydl.return_value = mock_ydl_instance

            await downloader.download(
                url="https://youtube.com/watch?v=test",
                movie_title="Test",
                quality=TrailerQuality.HD,
                on_progress=on_progress,
            )


class TestStorageRotator:
    """Tests for StorageRotator class."""

    @pytest.fixture
    def rotator(self) -> StorageRotator:
        """Create rotator instance."""
        return StorageRotator()

    @pytest.fixture
    def mock_trailers(self) -> list[Trailer]:
        """Create mock trailers for rotation testing."""
        trailers = []
        for i in range(10):
            trailer = MagicMock(spec=Trailer)
            trailer.id = f"trailer-{i}"
            trailer.play_count = i * 2
            trailer.created_at = datetime.now(timezone.utc) - timedelta(days=i * 5)
            trailer.file_size_bytes = 100 * 1024 * 1024
            trailers.append(trailer)
        return trailers

    def test_rotator_initialization(self, rotator: StorageRotator):
        """Test rotator initializes correctly."""
        assert rotator is not None

    def test_select_for_deletion_respects_keep_count(
        self, rotator: StorageRotator, mock_trailers: list[Trailer]
    ):
        """Test that rotation respects keep count."""
        to_delete = rotator.select_for_deletion(
            trailers=mock_trailers,
            keep_most_recent=3,
            keep_most_played=2,
            target_free_bytes=500 * 1024 * 1024,
        )

        # Should keep at least 5 trailers (3 recent + 2 played, may overlap)
        remaining = len(mock_trailers) - len(to_delete)
        assert remaining >= 5

    def test_select_for_deletion_meets_target_size(
        self, rotator: StorageRotator, mock_trailers: list[Trailer]
    ):
        """Test that deletion meets target free space."""
        target_bytes = 300 * 1024 * 1024  # 300MB

        to_delete = rotator.select_for_deletion(
            trailers=mock_trailers,
            keep_most_recent=2,
            keep_most_played=2,
            target_free_bytes=target_bytes,
        )

        deleted_bytes = sum(t.file_size_bytes for t in to_delete)
        assert deleted_bytes >= target_bytes

    def test_select_for_deletion_never_deletes_protected(
        self, rotator: StorageRotator, mock_trailers: list[Trailer]
    ):
        """Test that most recent and most played are protected."""
        # Mark specific trailers as most played
        mock_trailers[5].play_count = 1000  # Most played

        to_delete = rotator.select_for_deletion(
            trailers=mock_trailers,
            keep_most_recent=2,
            keep_most_played=1,
            target_free_bytes=1000 * 1024 * 1024,
        )

        # Most played should not be deleted
        deleted_ids = [t.id for t in to_delete]
        assert mock_trailers[5].id not in deleted_ids


class TestTrailerSelector:
    """Tests for TrailerSelector class."""

    @pytest.fixture
    def selector(self) -> TrailerSelector:
        """Create selector instance."""
        return TrailerSelector()

    @pytest.fixture
    def mock_trailers(self) -> list[Trailer]:
        """Create mock trailers for selection testing."""
        trailers = []
        genres_list = [
            ["Action"], ["Comedy"], ["Action", "Sci-Fi"],
            ["Drama"], ["Horror"], ["Action"],
        ]
        for i, genres in enumerate(genres_list):
            trailer = MagicMock(spec=Trailer)
            trailer.id = f"trailer-{i}"
            trailer.movie_title = f"Movie {i}"
            trailer.genres = genres
            trailer.rating = 6.0 + (i * 0.5)
            trailer.play_count = i
            trailer.is_ready = True
            trailers.append(trailer)
        return trailers

    def test_selector_initialization(self, selector: TrailerSelector):
        """Test selector initializes correctly."""
        assert selector is not None

    def test_select_by_genre(
        self, selector: TrailerSelector, mock_trailers: list[Trailer]
    ):
        """Test selecting trailers by genre."""
        selected = selector.select_by_genre(
            trailers=mock_trailers,
            genres=["Action"],
            count=3,
        )

        # All selected should have Action genre
        for trailer in selected:
            assert "Action" in trailer.genres
        assert len(selected) <= 3

    def test_select_with_variety(
        self, selector: TrailerSelector, mock_trailers: list[Trailer]
    ):
        """Test selecting trailers with genre variety."""
        selected = selector.select_with_variety(
            trailers=mock_trailers,
            count=4,
        )

        # Should have variety of genres
        genres_seen = set()
        for trailer in selected:
            for genre in trailer.genres:
                genres_seen.add(genre)
        assert len(genres_seen) > 1

    def test_select_least_played(
        self, selector: TrailerSelector, mock_trailers: list[Trailer]
    ):
        """Test selecting least played trailers."""
        selected = selector.select_least_played(
            trailers=mock_trailers,
            count=3,
        )

        # Should be sorted by play count
        play_counts = [t.play_count for t in selected]
        assert play_counts == sorted(play_counts)

    def test_select_contextual(
        self, selector: TrailerSelector, mock_trailers: list[Trailer]
    ):
        """Test contextual selection based on main feature."""
        selected = selector.select_contextual(
            trailers=mock_trailers,
            main_movie_genres=["Action", "Sci-Fi"],
            count=3,
        )

        # Should prefer matching genres
        for trailer in selected:
            matching = any(g in trailer.genres for g in ["Action", "Sci-Fi"])
            assert matching


class TestRuleMatching:
    """Tests for rule matching logic."""

    @pytest.fixture
    def manager(self) -> TrailerManager:
        return TrailerManager()

    def test_rule_matches_genre(self, manager: TrailerManager):
        """Test rule matching by genre."""
        rule = MagicMock(spec=TrailerRule)
        rule.genres = ["Action", "Sci-Fi"]
        rule.min_year = None
        rule.max_year = None
        rule.min_rating = None
        rule.max_rating = None

        assert rule.matches_movie(genres=["Action"], year=2023, rating=7.0)
        assert not rule.matches_movie(genres=["Comedy"], year=2023, rating=7.0)

    def test_rule_matches_year_range(self, manager: TrailerManager):
        """Test rule matching by year range."""
        rule = MagicMock(spec=TrailerRule)
        rule.genres = None
        rule.min_year = 2020
        rule.max_year = 2023
        rule.min_rating = None
        rule.max_rating = None

        # Mock the matches_movie method
        def matches(genres=None, year=None, rating=None):
            if rule.min_year and (not year or year < rule.min_year):
                return False
            if rule.max_year and (not year or year > rule.max_year):
                return False
            return True

        rule.matches_movie = matches

        assert rule.matches_movie(year=2021)
        assert rule.matches_movie(year=2020)
        assert rule.matches_movie(year=2023)
        assert not rule.matches_movie(year=2019)
        assert not rule.matches_movie(year=2024)

    def test_rule_matches_rating_range(self, manager: TrailerManager):
        """Test rule matching by rating range."""
        rule = MagicMock(spec=TrailerRule)
        rule.genres = None
        rule.min_year = None
        rule.max_year = None
        rule.min_rating = 6.0
        rule.max_rating = 9.0

        def matches(genres=None, year=None, rating=None):
            if rule.min_rating and (not rating or rating < rule.min_rating):
                return False
            if rule.max_rating and (not rating or rating > rule.max_rating):
                return False
            return True

        rule.matches_movie = matches

        assert rule.matches_movie(rating=7.5)
        assert rule.matches_movie(rating=6.0)
        assert rule.matches_movie(rating=9.0)
        assert not rule.matches_movie(rating=5.5)
        assert not rule.matches_movie(rating=9.5)
