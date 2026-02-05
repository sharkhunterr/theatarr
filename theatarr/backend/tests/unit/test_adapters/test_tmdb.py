"""Unit tests for TMDB adapter (mocked)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from theatarr.adapters.metadata.tmdb import TMDBAdapter
from theatarr.adapters.base import AdapterCapability


class TestTMDBAdapter:
    """Tests for TMDBAdapter class."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        """Create a TMDB adapter instance."""
        return TMDBAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        """Valid TMDB API configuration."""
        return {
            "api_key": "test-tmdb-api-key-123",
        }

    def test_adapter_name(self, adapter: TMDBAdapter):
        """Test adapter has correct name."""
        assert adapter.name == "tmdb"

    def test_adapter_service_type(self, adapter: TMDBAdapter):
        """Test adapter service type is metadata."""
        assert adapter.service_type == "metadata"

    def test_adapter_display_name(self, adapter: TMDBAdapter):
        """Test adapter has user-friendly display name."""
        assert adapter.display_name == "TMDB"

    def test_adapter_capabilities(self, adapter: TMDBAdapter):
        """Test adapter declares correct capabilities."""
        assert AdapterCapability.MEDIA_SEARCH in adapter.capabilities
        assert AdapterCapability.MEDIA_METADATA in adapter.capabilities

    def test_config_schema_structure(self, adapter: TMDBAdapter):
        """Test config schema has required structure."""
        schema = adapter.config_schema
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "api_key" in schema["properties"]

    def test_config_schema_required_fields(self, adapter: TMDBAdapter):
        """Test config schema specifies required fields."""
        schema = adapter.config_schema
        assert "required" in schema
        assert "api_key" in schema["required"]

    @pytest.mark.asyncio
    async def test_test_connection_missing_api_key(self, adapter: TMDBAdapter):
        """Test that missing api_key returns error."""
        result = await adapter.test_connection({})
        assert result["success"] is False
        assert "api_key" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_test_connection_success_mocked(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test successful connection with mocked API."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={"status_code": 1, "status_message": "Success."}
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_test_connection_invalid_api_key(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test connection failure with invalid API key."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 401
            mock_response.json = AsyncMock(
                return_value={
                    "status_code": 7,
                    "status_message": "Invalid API key.",
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is False
            assert "invalid" in result["error"].lower()


class TestTMDBMovieSearch:
    """Tests for TMDB movie search functionality."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        return TMDBAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {"api_key": "test-key"}

    @pytest.mark.asyncio
    async def test_search_movie(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test searching for movies."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "page": 1,
                    "results": [
                        {
                            "id": 123,
                            "title": "Test Movie",
                            "release_date": "2023-01-15",
                            "overview": "A test movie",
                            "poster_path": "/poster.jpg",
                            "vote_average": 7.5,
                        }
                    ],
                    "total_results": 1,
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="search_movie",
                parameters={"query": "Test"},
                config=valid_config,
            )

            assert result["success"] is True
            assert "results" in result
            assert len(result["results"]) == 1
            assert result["results"][0]["title"] == "Test Movie"

    @pytest.mark.asyncio
    async def test_search_movie_with_year(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test searching for movies with year filter."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={"page": 1, "results": [], "total_results": 0}
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="search_movie",
                parameters={"query": "Test", "year": 2023},
                config=valid_config,
            )

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_search_movie_empty_query(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test searching with empty query."""
        result = await adapter.execute_action(
            action_type="search_movie",
            parameters={"query": ""},
            config=valid_config,
        )

        assert result["success"] is False
        assert "query" in result["error"].lower()


class TestTMDBMovieDetails:
    """Tests for TMDB movie details retrieval."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        return TMDBAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {"api_key": "test-key"}

    @pytest.mark.asyncio
    async def test_get_movie_details(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test getting movie details."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "id": 123,
                    "title": "Test Movie",
                    "original_title": "Test Movie Original",
                    "release_date": "2023-01-15",
                    "overview": "A great test movie",
                    "runtime": 120,
                    "vote_average": 7.5,
                    "vote_count": 1000,
                    "poster_path": "/poster.jpg",
                    "backdrop_path": "/backdrop.jpg",
                    "genres": [{"id": 28, "name": "Action"}],
                    "tagline": "The ultimate test",
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_movie",
                parameters={"movie_id": 123},
                config=valid_config,
            )

            assert result["success"] is True
            assert "movie" in result
            assert result["movie"]["title"] == "Test Movie"
            assert result["movie"]["runtime"] == 120

    @pytest.mark.asyncio
    async def test_get_movie_not_found(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test getting non-existent movie."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 404
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_movie",
                parameters={"movie_id": 99999999},
                config=valid_config,
            )

            assert result["success"] is False
            assert "not found" in result["error"].lower()


class TestTMDBTrailerRetrieval:
    """Tests for TMDB trailer/video retrieval."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        return TMDBAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {"api_key": "test-key"}

    @pytest.mark.asyncio
    async def test_get_movie_videos(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test getting movie trailers."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "id": 123,
                    "results": [
                        {
                            "id": "video1",
                            "key": "abc123",
                            "name": "Official Trailer",
                            "site": "YouTube",
                            "type": "Trailer",
                            "official": True,
                            "size": 1080,
                        },
                        {
                            "id": "video2",
                            "key": "def456",
                            "name": "Teaser",
                            "site": "YouTube",
                            "type": "Teaser",
                            "official": True,
                            "size": 720,
                        },
                    ],
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_videos",
                parameters={"movie_id": 123},
                config=valid_config,
            )

            assert result["success"] is True
            assert "videos" in result
            assert len(result["videos"]) == 2

    @pytest.mark.asyncio
    async def test_get_movie_trailers_only(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test filtering for trailers only."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "id": 123,
                    "results": [
                        {
                            "id": "v1",
                            "key": "abc",
                            "name": "Trailer",
                            "site": "YouTube",
                            "type": "Trailer",
                        },
                        {
                            "id": "v2",
                            "key": "def",
                            "name": "Behind the Scenes",
                            "site": "YouTube",
                            "type": "Behind the Scenes",
                        },
                    ],
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_trailers",
                parameters={"movie_id": 123},
                config=valid_config,
            )

            assert result["success"] is True
            # Should only return trailers, not behind the scenes
            for video in result.get("trailers", []):
                assert video["type"] == "Trailer"


class TestTMDBImageURLs:
    """Tests for TMDB image URL generation."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        return TMDBAdapter()

    def test_get_poster_url(self, adapter: TMDBAdapter):
        """Test generating poster URL."""
        url = adapter.get_image_url("/poster.jpg", size="w500")
        assert "image.tmdb.org" in url
        assert "w500" in url
        assert "poster.jpg" in url

    def test_get_backdrop_url(self, adapter: TMDBAdapter):
        """Test generating backdrop URL."""
        url = adapter.get_image_url("/backdrop.jpg", size="original")
        assert "image.tmdb.org" in url
        assert "original" in url

    def test_get_image_url_with_none(self, adapter: TMDBAdapter):
        """Test getting image URL with None path."""
        url = adapter.get_image_url(None)
        assert url is None or url == ""


class TestTMDBErrorHandling:
    """Tests for TMDB adapter error handling."""

    @pytest.fixture
    def adapter(self) -> TMDBAdapter:
        return TMDBAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {"api_key": "test-key"}

    @pytest.mark.asyncio
    async def test_rate_limit_handling(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test handling of rate limit errors."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 429
            mock_response.headers = {"Retry-After": "1"}
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="search_movie",
                parameters={"query": "Test"},
                config=valid_config,
            )

            assert result["success"] is False
            assert "rate" in result["error"].lower() or "limit" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_connection_error_handling(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test handling of connection errors."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session.get = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="search_movie",
                parameters={"query": "Test"},
                config=valid_config,
            )

            assert result["success"] is False

    @pytest.mark.asyncio
    async def test_unknown_action_type(
        self, adapter: TMDBAdapter, valid_config: dict
    ):
        """Test handling of unknown action type."""
        result = await adapter.execute_action(
            action_type="unknown_action",
            parameters={},
            config=valid_config,
        )

        assert result["success"] is False
        assert "unknown" in result["error"].lower()
