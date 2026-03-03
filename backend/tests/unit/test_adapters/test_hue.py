"""Unit tests for Philips Hue adapter (mocked)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from theatarr.adapters.lighting.hue import PhilipsHueAdapter
from theatarr.adapters.base import AdapterCapability


class TestPhilipsHueAdapter:
    """Tests for PhilipsHueAdapter class."""

    @pytest.fixture
    def adapter(self) -> PhilipsHueAdapter:
        """Create a Hue adapter instance."""
        return PhilipsHueAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        """Valid Hue bridge configuration."""
        return {
            "bridge_ip": "192.168.1.100",
            "username": "test-username-123",
        }

    def test_adapter_name(self, adapter: PhilipsHueAdapter):
        """Test adapter has correct name."""
        assert adapter.name == "hue"

    def test_adapter_service_type(self, adapter: PhilipsHueAdapter):
        """Test adapter service type is lighting."""
        assert adapter.service_type == "lighting"

    def test_adapter_display_name(self, adapter: PhilipsHueAdapter):
        """Test adapter has user-friendly display name."""
        assert adapter.display_name == "Philips Hue"

    def test_adapter_capabilities(self, adapter: PhilipsHueAdapter):
        """Test adapter declares correct capabilities."""
        assert AdapterCapability.LIGHT_ON_OFF in adapter.capabilities
        assert AdapterCapability.LIGHT_BRIGHTNESS in adapter.capabilities
        assert AdapterCapability.LIGHT_COLOR in adapter.capabilities

    def test_config_schema_structure(self, adapter: PhilipsHueAdapter):
        """Test config schema has required structure."""
        schema = adapter.config_schema
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "bridge_ip" in schema["properties"]
        assert "username" in schema["properties"]

    def test_config_schema_required_fields(self, adapter: PhilipsHueAdapter):
        """Test config schema specifies required fields."""
        schema = adapter.config_schema
        assert "required" in schema
        assert "bridge_ip" in schema["required"]

    @pytest.mark.asyncio
    async def test_test_connection_missing_bridge_ip(
        self, adapter: PhilipsHueAdapter
    ):
        """Test that missing bridge_ip returns error."""
        result = await adapter.test_connection({})
        assert result["success"] is False
        assert "bridge_ip" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_test_connection_success_mocked(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test successful connection with mocked bridge."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={"lights": {"1": {"name": "Living Room"}}}
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_test_connection_bridge_not_found(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test connection failure when bridge not found."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_session.get = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.test_connection(valid_config)
            assert result["success"] is False

    @pytest.mark.asyncio
    async def test_get_capabilities_returns_lights(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test that get_capabilities returns light information."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "1": {
                        "name": "Living Room",
                        "type": "Extended color light",
                        "state": {"on": True, "bri": 254},
                    },
                    "2": {
                        "name": "Bedroom",
                        "type": "Color temperature light",
                        "state": {"on": False, "bri": 100},
                    },
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.get_capabilities(valid_config)

            assert "lights" in result
            assert len(result["lights"]) == 2

    @pytest.mark.asyncio
    async def test_execute_action_set_brightness(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test setting light brightness."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=[{"success": True}])
            mock_session.put = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="set_brightness",
                parameters={"brightness": 50, "light_id": "1"},
                config=valid_config,
            )

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_action_set_color(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test setting light color."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=[{"success": True}])
            mock_session.put = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="set_color",
                parameters={"color": "#FF0000", "light_id": "1"},
                config=valid_config,
            )

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_action_turn_on(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test turning light on."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=[{"success": True}])
            mock_session.put = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="turn_on",
                parameters={"light_id": "1"},
                config=valid_config,
            )

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_action_turn_off(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test turning light off."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=[{"success": True}])
            mock_session.put = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="turn_off",
                parameters={"light_id": "1"},
                config=valid_config,
            )

            assert result["success"] is True

    @pytest.mark.asyncio
    async def test_execute_action_unknown_type(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test that unknown action type returns error."""
        result = await adapter.execute_action(
            action_type="unknown_action",
            parameters={},
            config=valid_config,
        )

        assert result["success"] is False
        assert "unknown" in result["error"].lower()


class TestHueColorConversion:
    """Tests for Hue color conversion utilities."""

    @pytest.fixture
    def adapter(self) -> PhilipsHueAdapter:
        return PhilipsHueAdapter()

    def test_hex_to_hue_xy_red(self, adapter: PhilipsHueAdapter):
        """Test converting red hex to XY coordinates."""
        # Red should have high X value
        xy = adapter._hex_to_xy("#FF0000")
        assert len(xy) == 2
        assert 0 <= xy[0] <= 1
        assert 0 <= xy[1] <= 1

    def test_hex_to_hue_xy_green(self, adapter: PhilipsHueAdapter):
        """Test converting green hex to XY coordinates."""
        xy = adapter._hex_to_xy("#00FF00")
        assert len(xy) == 2
        assert 0 <= xy[0] <= 1
        assert 0 <= xy[1] <= 1

    def test_hex_to_hue_xy_blue(self, adapter: PhilipsHueAdapter):
        """Test converting blue hex to XY coordinates."""
        xy = adapter._hex_to_xy("#0000FF")
        assert len(xy) == 2
        assert 0 <= xy[0] <= 1
        assert 0 <= xy[1] <= 1

    def test_hex_to_hue_xy_white(self, adapter: PhilipsHueAdapter):
        """Test converting white hex to XY coordinates."""
        xy = adapter._hex_to_xy("#FFFFFF")
        assert len(xy) == 2
        # White should be near center
        assert 0.2 <= xy[0] <= 0.5
        assert 0.2 <= xy[1] <= 0.5


class TestHueGroups:
    """Tests for Hue group operations."""

    @pytest.fixture
    def adapter(self) -> PhilipsHueAdapter:
        return PhilipsHueAdapter()

    @pytest.fixture
    def valid_config(self) -> dict:
        return {
            "bridge_ip": "192.168.1.100",
            "username": "test-username",
        }

    @pytest.mark.asyncio
    async def test_get_groups(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test getting light groups."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(
                return_value={
                    "1": {
                        "name": "Living Room",
                        "lights": ["1", "2"],
                        "type": "Room",
                    },
                    "2": {
                        "name": "Kitchen",
                        "lights": ["3"],
                        "type": "Room",
                    },
                }
            )
            mock_session.get = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.get_groups(valid_config)

            assert "groups" in result
            assert len(result["groups"]) == 2

    @pytest.mark.asyncio
    async def test_set_group_brightness(
        self, adapter: PhilipsHueAdapter, valid_config: dict
    ):
        """Test setting group brightness."""
        with patch("aiohttp.ClientSession") as mock_session_cls:
            mock_session = AsyncMock()
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value=[{"success": True}])
            mock_session.put = AsyncMock(return_value=mock_response)
            mock_session.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session.__aexit__ = AsyncMock(return_value=None)
            mock_session_cls.return_value = mock_session

            result = await adapter.execute_action(
                action_type="set_group_brightness",
                parameters={"group_id": "1", "brightness": 75},
                config=valid_config,
            )

            assert result["success"] is True
