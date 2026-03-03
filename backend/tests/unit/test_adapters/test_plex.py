"""Unit tests for Plex adapter (mocked)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from theatarr.adapters.media.plex import PlexAdapter
from theatarr.adapters.base import AdapterCapability


class TestPlexAdapter:
    """Tests for PlexAdapter class."""

    @pytest.fixture
    def adapter(self) -> PlexAdapter:
        """Create a Plex adapter instance."""
        return PlexAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        """Valid Plex server configuration."""
        return {
            "server_url": "http://192.168.1.50:32400",
            "token": "test-plex-token-123",
        }

    def test_adapter_name(self, adapter: PlexAdapter):
        """Test adapter has correct name."""
        assert adapter.name == "plex"

    def test_adapter_service_type(self, adapter: PlexAdapter):
        """Test adapter service type is media_source."""
        assert adapter.service_type == "media_source"

    def test_adapter_display_name(self, adapter: PlexAdapter):
        """Test adapter has user-friendly display name."""
        assert adapter.display_name == "Plex"

    def test_adapter_capabilities(self, adapter: PlexAdapter):
        """Test adapter declares correct capabilities."""
        assert AdapterCapability.MEDIA_BROWSE in adapter.capabilities
        assert AdapterCapability.MEDIA_SEARCH in adapter.capabilities
        assert AdapterCapability.MEDIA_METADATA in adapter.capabilities

    def test_config_schema_structure(self, adapter: PlexAdapter):
        """Test config schema has required structure."""
        schema = adapter.config_schema
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "server_url" in schema["properties"]
        assert "token" in schema["properties"]

    def test_config_schema_required_fields(self, adapter: PlexAdapter):
        """Test config schema specifies required fields."""
        schema = adapter.config_schema
        assert "required" in schema
        assert "server_url" in schema["required"]
        assert "token" in schema["required"]

    @pytest.mark.asyncio
    async def test_test_connection_missing_server_url(
        self, adapter: PlexAdapter
    ):
        """Test that missing server_url returns error."""
        result = await adapter.test_connection({"token": "test"})
        assert result["success"] is False
        assert "server_url" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_test_connection_missing_token(
        self, adapter: PlexAdapter
    ):
        """Test that missing token returns error."""
        result = await adapter.test_connection(
            {"server_url": "http://localhost:32400"}
        )
        assert result["success"] is False
        assert "token" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_test_connection_success_mocked(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test successful connection with mocked server."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='<MediaContainer friendlyName="My Plex Server"/>'
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is True
            assert "server_name" in result

    @pytest.mark.asyncio
    async def test_test_connection_unauthorized(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test connection failure with invalid token."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 401
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is False
            assert "unauthorized" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_get_capabilities_returns_libraries(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test that get_capabilities returns library information."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Directory key="1" title="Movies" type="movie"/>
                    <Directory key="2" title="TV Shows" type="show"/>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.get_capabilities(valid_config)

            assert "libraries" in result
            assert len(result["libraries"]) >= 1


class TestPlexLibraryBrowsing:
    """Tests for Plex library browsing functionality."""

    @pytest.fixture
    def adapter(self) -> PlexAdapter:
        return PlexAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {
            "server_url": "http://192.168.1.50:32400",
            "token": "test-plex-token",
        }

    @pytest.mark.asyncio
    async def test_browse_library(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test browsing a Plex library."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Video key="/library/metadata/100" title="Movie 1" year="2023"/>
                    <Video key="/library/metadata/101" title="Movie 2" year="2022"/>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="browse_library",
                parameters={"library_key": "1"},
                config=valid_config,
            )

            assert result["success"] is True
            assert "items" in result

    @pytest.mark.asyncio
    async def test_search_library(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test searching within a library."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Video key="/library/metadata/100" title="The Search Result"/>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="search",
                parameters={"query": "search term", "library_key": "1"},
                config=valid_config,
            )

            assert result["success"] is True
            assert "items" in result


class TestPlexMovieMetadata:
    """Tests for Plex movie metadata retrieval."""

    @pytest.fixture
    def adapter(self) -> PlexAdapter:
        return PlexAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {
            "server_url": "http://192.168.1.50:32400",
            "token": "test-plex-token",
        }

    @pytest.mark.asyncio
    async def test_get_movie_metadata(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test getting movie metadata."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Video
                        key="/library/metadata/100"
                        title="Test Movie"
                        year="2023"
                        duration="7200000"
                        summary="A great movie"
                        rating="8.5"
                        thumb="/library/metadata/100/thumb"
                        art="/library/metadata/100/art">
                        <Genre tag="Action"/>
                        <Genre tag="Sci-Fi"/>
                        <Director tag="John Director"/>
                        <Role tag="Actor One" role="Character"/>
                    </Video>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_metadata",
                parameters={"key": "/library/metadata/100"},
                config=valid_config,
            )

            assert result["success"] is True
            assert "metadata" in result
            metadata = result["metadata"]
            assert metadata["title"] == "Test Movie"
            assert metadata["year"] == "2023"

    @pytest.mark.asyncio
    async def test_get_poster_url(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test getting movie poster URL."""
        result = adapter.get_poster_url(
            "/library/metadata/100/thumb",
            valid_config,
        )

        assert valid_config["server_url"] in result
        assert "X-Plex-Token" in result or valid_config["token"] in result


class TestPlexPlayback:
    """Tests for Plex playback-related functionality."""

    @pytest.fixture
    def adapter(self) -> PlexAdapter:
        return PlexAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {
            "server_url": "http://192.168.1.50:32400",
            "token": "test-plex-token",
        }

    @pytest.mark.asyncio
    async def test_get_playback_url(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test getting playback URL for media."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Video key="/library/metadata/100">
                        <Media>
                            <Part key="/library/parts/200" file="/movies/test.mkv"/>
                        </Media>
                    </Video>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_playback_url",
                parameters={"key": "/library/metadata/100"},
                config=valid_config,
            )

            assert result["success"] is True
            assert "url" in result

    @pytest.mark.asyncio
    async def test_get_active_sessions(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test getting active playback sessions."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.text = AsyncMock(
                return_value='''
                <MediaContainer>
                    <Video
                        key="/library/metadata/100"
                        title="Currently Playing"
                        Player machineIdentifier="abc123"/>
                </MediaContainer>
                '''
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="get_sessions",
                parameters={},
                config=valid_config,
            )

            assert result["success"] is True
            assert "sessions" in result


class TestPlexErrorHandling:
    """Tests for Plex adapter error handling."""

    @pytest.fixture
    def adapter(self) -> PlexAdapter:
        return PlexAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {
            "server_url": "http://192.168.1.50:32400",
            "token": "test-plex-token",
        }

    @pytest.mark.asyncio
    async def test_connection_timeout(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test handling of connection timeout."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session.get = AsyncMock(
                side_effect=TimeoutError("Connection timeout")
            )
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)

            assert result["success"] is False
            assert "timeout" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_server_error(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test handling of server errors."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 500
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)

            assert result["success"] is False

    @pytest.mark.asyncio
    async def test_unknown_action_type(
        self, adapter: PlexAdapter, valid_config: dict
    ):
        """Test handling of unknown action type."""
        result = await adapter.execute_action(
            action_type="unknown_action",
            parameters={},
            config=valid_config,
        )

        assert result["success"] is False
        assert "unknown" in result["error"].lower()
