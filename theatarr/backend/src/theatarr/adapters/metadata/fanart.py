"""Fanart.tv adapter for Theatarr.

Provides high-quality movie artwork (logos, backdrops, posters, clearart)
from the Fanart.tv API.
"""

from typing import Any

import httpx

from theatarr.adapters.base import (
    AdapterCategory,
    Capability,
    Command,
    CommandResult,
    ConnectionStatus,
    ConnectionTestResult,
    ServiceAdapter,
)
from theatarr.adapters.registry import AdapterRegistry


@AdapterRegistry.register
class FanartAdapter(ServiceAdapter):
    """Adapter for Fanart.tv API.

    Provides:
    - HD movie logos
    - Movie backdrops
    - Movie posters
    - HD clearart
    """

    adapter_type = "fanart"
    display_name = "Fanart.tv"
    category = AdapterCategory.METADATA

    BASE_URL = "https://webservice.fanart.tv/v3"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.language = config.get("language", "fr")
        self._client: httpx.AsyncClient | None = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["api_key"],
            "properties": {
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Fanart.tv personal API key",
                },
                "language": {
                    "type": "string",
                    "title": "Language",
                    "description": "Preferred language code (e.g., fr, en)",
                    "default": "fr",
                },
            },
        }

    def get_capabilities(self) -> list[Capability]:
        return [
            Capability(name="get_movie_art", description="Get movie artwork by TMDB ID"),
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                timeout=30.0,
            )
        return self._client

    async def connect(self) -> None:
        try:
            client = await self._get_client()
            # Test with Fight Club (TMDB ID 550) as a known movie
            response = await client.get(
                "/movies/550",
                params={"api_key": self.api_key},
            )
            self._is_connected = response.status_code == 200
        except Exception:
            self._is_connected = False

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        try:
            client = await self._get_client()
            response = await client.get(
                "/movies/550",
                params={"api_key": self.api_key},
            )

            if response.status_code == 200:
                data = response.json()
                art_types = [k for k in data.keys() if k != "name" and k != "tmdb_id" and k != "imdb_id"]
                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to Fanart.tv API",
                    details={
                        "test_movie": data.get("name", "Fight Club"),
                        "available_art_types": art_types,
                    },
                )
            elif response.status_code == 401:
                return ConnectionTestResult(
                    status=ConnectionStatus.ERROR,
                    message="Invalid API key",
                )
            else:
                return ConnectionTestResult(
                    status=ConnectionStatus.ERROR,
                    message=f"Fanart.tv API error: {response.status_code}",
                )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=f"Connection failed: {str(e)}",
            )

    async def execute(self, command: Command) -> CommandResult:
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "get_movie_art":
                art = await self.get_movie_art(
                    tmdb_id=command.parameters.get("tmdb_id", ""),
                )
                if art:
                    return CommandResult(success=True, data=art)
                return CommandResult(success=False, message="No artwork found")
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def get_movie_art(self, tmdb_id: str) -> dict[str, Any] | None:
        """Get all artwork for a movie by TMDB ID.

        Returns a dict with keys: logos, backdrops, posters, clearart.
        Each is a list of URLs sorted by likes (most popular first),
        with preferred language items first.
        """
        client = await self._get_client()
        response = await client.get(
            f"/movies/{tmdb_id}",
            params={"api_key": self.api_key},
        )

        if response.status_code != 200:
            return None

        data = response.json()

        return {
            "logos": self._extract_art(data.get("hdmovielogo", []), "logos"),
            "backdrops": self._extract_art(data.get("moviebackground", []), "backdrops"),
            "posters": self._extract_art(data.get("movieposter", []), "posters"),
            "clearart": self._extract_art(data.get("hdmovieclearart", []), "clearart"),
        }

    def _extract_art(self, items: list[dict], art_type: str) -> list[str]:
        """Extract and sort artwork URLs.

        Sorts by:
        1. Preferred language first
        2. English as fallback
        3. By likes descending
        """
        if not items:
            return []

        # Sort: preferred language first, then english, then by likes
        def sort_key(item: dict) -> tuple:
            lang = item.get("lang", "")
            likes = int(item.get("likes", "0"))
            if lang == self.language:
                return (0, -likes)
            elif lang == "en":
                return (1, -likes)
            elif lang == "":
                return (2, -likes)
            else:
                return (3, -likes)

        sorted_items = sorted(items, key=sort_key)

        # Return URLs, limit to 10
        return [item["url"] for item in sorted_items[:10] if item.get("url")]
