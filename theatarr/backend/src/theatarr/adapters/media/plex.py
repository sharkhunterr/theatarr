"""Plex Media Server adapter."""

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
class PlexAdapter(ServiceAdapter):
    """Adapter for Plex Media Server."""

    adapter_type = "plex"
    category = AdapterCategory.MEDIA_SOURCE
    display_name = "Plex Media Server"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.server_url = config.get("server_url", "").rstrip("/")
        self.token = config.get("token", "")
        self._client: httpx.AsyncClient | None = None
        self._server_name: str | None = None
        self._machine_id: str | None = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "server_url": {
                    "type": "string",
                    "description": "Plex server URL (e.g., http://192.168.1.100:32400)",
                },
                "token": {
                    "type": "string",
                    "description": "Plex authentication token",
                },
            },
            "required": ["server_url", "token"],
        }

    def _get_headers(self) -> dict[str, str]:
        """Get common Plex API headers."""
        return {
            "X-Plex-Token": self.token,
            "Accept": "application/json",
            "X-Plex-Client-Identifier": "theatarr",
            "X-Plex-Product": "Theatarr",
            "X-Plex-Version": "1.0.0",
        }

    async def connect(self) -> None:
        """Establish connection to Plex server."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=10.0,
                headers=self._get_headers(),
            )

        try:
            response = await self._client.get(f"{self.server_url}/")
            response.raise_for_status()
            data = response.json()

            container = data.get("MediaContainer", {})
            self._server_name = container.get("friendlyName")
            self._machine_id = container.get("machineIdentifier")
            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Plex: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Plex server."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to Plex server."""
        try:
            async with httpx.AsyncClient(
                timeout=5.0,
                headers=self._get_headers(),
            ) as client:
                response = await client.get(f"{self.server_url}/")

                if response.status_code == 401:
                    return ConnectionTestResult(
                        status=ConnectionStatus.ERROR,
                        message="Authentication failed - check Plex token",
                    )

                response.raise_for_status()
                data = response.json()

                container = data.get("MediaContainer", {})
                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to Plex server",
                    details={
                        "name": container.get("friendlyName"),
                        "version": container.get("version"),
                        "platform": container.get("platform"),
                        "machine_id": container.get("machineIdentifier"),
                    },
                )
        except httpx.TimeoutException:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Connection timed out",
            )
        except httpx.ConnectError:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message="Could not connect to server - verify URL",
            )
        except Exception as e:
            return ConnectionTestResult(
                status=ConnectionStatus.ERROR,
                message=str(e),
            )

    def get_capabilities(self) -> list[Capability]:
        """Get Plex capabilities."""
        return [
            Capability(
                name="list_libraries",
                parameters=[],
                description="List all libraries",
            ),
            Capability(
                name="list_movies",
                parameters=["library_id"],
                description="List movies in a library",
            ),
            Capability(
                name="get_movie",
                parameters=["movie_id"],
                description="Get movie details",
            ),
            Capability(
                name="search",
                parameters=["query", "type"],
                description="Search for media",
            ),
            Capability(
                name="get_playback_url",
                parameters=["media_id"],
                description="Get URL for media playback",
            ),
            Capability(
                name="list_clients",
                parameters=[],
                description="List connected Plex clients",
            ),
            Capability(
                name="play_on_client",
                parameters=["media_id", "client_id"],
                description="Play media on a Plex client",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Plex."""
        if not self._is_connected:
            await self.connect()

        try:
            if command.action == "list_libraries":
                return await self._list_libraries()
            elif command.action == "list_movies":
                return await self._list_movies(command.parameters)
            elif command.action == "get_movie":
                return await self._get_movie(command.parameters)
            elif command.action == "search":
                return await self._search(command.parameters)
            elif command.action == "get_playback_url":
                return await self._get_playback_url(command.parameters)
            elif command.action == "list_clients":
                return await self._list_clients()
            elif command.action == "play_on_client":
                return await self._play_on_client(command.parameters)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _list_libraries(self) -> CommandResult:
        """List all Plex libraries."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        response = await self._client.get(f"{self.server_url}/library/sections")
        data = response.json()

        libraries = []
        for lib in data.get("MediaContainer", {}).get("Directory", []):
            libraries.append({
                "id": lib.get("key"),
                "title": lib.get("title"),
                "type": lib.get("type"),
                "count": lib.get("count", 0),
            })

        return CommandResult(
            success=True,
            data={"libraries": libraries},
        )

    async def _list_movies(self, parameters: dict[str, Any]) -> CommandResult:
        """List movies in a library."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        library_id = parameters.get("library_id")
        if not library_id:
            return CommandResult(success=False, message="library_id is required")

        response = await self._client.get(
            f"{self.server_url}/library/sections/{library_id}/all"
        )
        data = response.json()

        movies = []
        for movie in data.get("MediaContainer", {}).get("Metadata", []):
            movies.append({
                "id": movie.get("ratingKey"),
                "title": movie.get("title"),
                "year": movie.get("year"),
                "duration": movie.get("duration"),
                "summary": movie.get("summary"),
                "thumb": movie.get("thumb"),
                "art": movie.get("art"),
                "rating": movie.get("audienceRating"),
            })

        return CommandResult(
            success=True,
            data={"movies": movies, "total": len(movies)},
        )

    async def _get_movie(self, parameters: dict[str, Any]) -> CommandResult:
        """Get movie details."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        movie_id = parameters.get("movie_id")
        if not movie_id:
            return CommandResult(success=False, message="movie_id is required")

        response = await self._client.get(
            f"{self.server_url}/library/metadata/{movie_id}"
        )
        data = response.json()

        metadata = data.get("MediaContainer", {}).get("Metadata", [])
        if not metadata:
            return CommandResult(success=False, message="Movie not found")

        movie = metadata[0]
        return CommandResult(
            success=True,
            data={
                "id": movie.get("ratingKey"),
                "title": movie.get("title"),
                "year": movie.get("year"),
                "duration": movie.get("duration"),
                "summary": movie.get("summary"),
                "thumb": f"{self.server_url}{movie.get('thumb')}?X-Plex-Token={self.token}",
                "art": f"{self.server_url}{movie.get('art')}?X-Plex-Token={self.token}",
                "rating": movie.get("audienceRating"),
                "genres": [g.get("tag") for g in movie.get("Genre", [])],
                "directors": [d.get("tag") for d in movie.get("Director", [])],
                "actors": [a.get("tag") for a in movie.get("Role", [])[:5]],
            },
        )

    async def _search(self, parameters: dict[str, Any]) -> CommandResult:
        """Search for media."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        query = parameters.get("query", "")
        media_type = parameters.get("type", "movie")

        type_map = {"movie": 1, "show": 2, "episode": 4, "music": 10}
        type_code = type_map.get(media_type, 1)

        response = await self._client.get(
            f"{self.server_url}/search",
            params={"query": query, "type": type_code},
        )
        data = response.json()

        results = []
        for item in data.get("MediaContainer", {}).get("Metadata", []):
            results.append({
                "id": item.get("ratingKey"),
                "title": item.get("title"),
                "type": item.get("type"),
                "year": item.get("year"),
                "thumb": item.get("thumb"),
                "art": item.get("art"),
                "summary": item.get("summary"),
                "tagline": item.get("tagline"),
                "rating": item.get("audienceRating") or item.get("rating"),
                "duration": item.get("duration"),
                "Genre": item.get("Genre", []),
                "Director": item.get("Director", []),
                "Role": item.get("Role", []),
            })

        return CommandResult(
            success=True,
            data={"results": results},
        )

    async def _get_playback_url(self, parameters: dict[str, Any]) -> CommandResult:
        """Get playback URL for media."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        media_id = parameters.get("media_id")
        if not media_id:
            return CommandResult(success=False, message="media_id is required")

        # Get media info to find the part key
        response = await self._client.get(
            f"{self.server_url}/library/metadata/{media_id}"
        )
        data = response.json()

        metadata = data.get("MediaContainer", {}).get("Metadata", [])
        if not metadata:
            return CommandResult(success=False, message="Media not found")

        media = metadata[0].get("Media", [])
        if not media:
            return CommandResult(success=False, message="No media files found")

        part = media[0].get("Part", [])
        if not part:
            return CommandResult(success=False, message="No media parts found")

        part_key = part[0].get("key")
        playback_url = f"{self.server_url}{part_key}?X-Plex-Token={self.token}"

        return CommandResult(
            success=True,
            data={"playback_url": playback_url},
        )

    async def _list_clients(self) -> CommandResult:
        """List connected Plex clients."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        response = await self._client.get(f"{self.server_url}/clients")
        data = response.json()

        clients = []
        for client in data.get("MediaContainer", {}).get("Server", []):
            clients.append({
                "id": client.get("machineIdentifier"),
                "name": client.get("name"),
                "host": client.get("host"),
                "port": client.get("port"),
                "product": client.get("product"),
                "platform": client.get("platform"),
            })

        return CommandResult(
            success=True,
            data={"clients": clients},
        )

    async def _play_on_client(self, parameters: dict[str, Any]) -> CommandResult:
        """Play media on a Plex client."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        media_id = parameters.get("media_id")
        client_id = parameters.get("client_id")

        if not media_id:
            return CommandResult(success=False, message="media_id is required")
        if not client_id:
            return CommandResult(success=False, message="client_id is required")

        # Use the playMedia endpoint
        response = await self._client.get(
            f"{self.server_url}/player/playback/playMedia",
            params={
                "key": f"/library/metadata/{media_id}",
                "machineIdentifier": client_id,
            },
        )

        if response.status_code == 200:
            return CommandResult(
                success=True,
                message="Playback started",
            )
        else:
            return CommandResult(
                success=False,
                message=f"Failed to start playback: {response.status_code}",
            )
