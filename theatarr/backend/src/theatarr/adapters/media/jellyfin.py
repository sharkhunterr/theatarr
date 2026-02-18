"""Jellyfin Media Server adapter."""

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
class JellyfinAdapter(ServiceAdapter):
    """Adapter for Jellyfin Media Server."""

    adapter_type = "jellyfin"
    category = AdapterCategory.MEDIA_SOURCE
    display_name = "Jellyfin"

    def __init__(self, config: dict[str, Any]):
        super().__init__(config)
        self.server_url = config.get("server_url", "").rstrip("/")
        self.api_key = config.get("api_key", "")
        self.user_id = config.get("user_id", "")
        self._client: httpx.AsyncClient | None = None
        self._server_info: dict | None = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "server_url": {
                    "type": "string",
                    "description": "Jellyfin server URL (e.g., http://192.168.1.100:8096)",
                },
                "api_key": {
                    "type": "string",
                    "description": "API key from Jellyfin Dashboard > API Keys",
                },
                "user_id": {
                    "type": "string",
                    "description": "User ID for media access (optional)",
                },
            },
            "required": ["server_url", "api_key"],
        }

    def _get_headers(self) -> dict[str, str]:
        return {
            "X-Emby-Token": self.api_key,
            "Content-Type": "application/json",
        }

    async def connect(self) -> None:
        """Establish connection to Jellyfin server."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=10.0,
                headers=self._get_headers(),
            )

        try:
            response = await self._client.get(f"{self.server_url}/System/Info")
            response.raise_for_status()
            self._server_info = response.json()
            self._is_connected = True
        except Exception as e:
            self._is_connected = False
            raise ConnectionError(f"Failed to connect to Jellyfin: {e}")

    async def disconnect(self) -> None:
        """Disconnect from Jellyfin server."""
        if self._client:
            await self._client.aclose()
            self._client = None
        self._is_connected = False

    async def test_connection(self) -> ConnectionTestResult:
        """Test connection to Jellyfin server."""
        try:
            async with httpx.AsyncClient(
                timeout=5.0,
                headers=self._get_headers(),
            ) as client:
                response = await client.get(f"{self.server_url}/System/Info")

                if response.status_code == 401:
                    return ConnectionTestResult(
                        status=ConnectionStatus.ERROR,
                        message="Authentication failed - check API key",
                    )

                response.raise_for_status()
                data = response.json()

                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to Jellyfin server",
                    details={
                        "name": data.get("ServerName"),
                        "version": data.get("Version"),
                        "id": data.get("Id"),
                        "os": data.get("OperatingSystem"),
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
        """Get Jellyfin capabilities."""
        return [
            Capability(
                name="list_libraries",
                parameters=[],
                description="List all media libraries",
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
                name="list_sessions",
                parameters=[],
                description="List active playback sessions",
            ),
            Capability(
                name="play_on_session",
                parameters=["session_id", "media_id"],
                description="Play media on an active session",
            ),
            Capability(
                name="get_chapters",
                parameters=["media_id"],
                description="Get chapter markers for a media item",
            ),
        ]

    async def execute(self, command: Command) -> CommandResult:
        """Execute a command on Jellyfin."""
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
            elif command.action == "list_sessions":
                return await self._list_sessions()
            elif command.action == "play_on_session":
                return await self._play_on_session(command.parameters)
            elif command.action == "get_chapters":
                return await self._get_chapters(command.parameters)
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def _list_libraries(self) -> CommandResult:
        """List all media libraries."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        user_id = self.user_id or await self._get_first_user_id()
        if not user_id:
            return CommandResult(success=False, message="No user ID available")

        response = await self._client.get(f"{self.server_url}/Users/{user_id}/Views")
        data = response.json()

        libraries = []
        for lib in data.get("Items", []):
            libraries.append({
                "id": lib.get("Id"),
                "name": lib.get("Name"),
                "type": lib.get("CollectionType"),
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
        user_id = self.user_id or await self._get_first_user_id()

        params = {
            "IncludeItemTypes": "Movie",
            "Recursive": "true",
            "Fields": "Overview,Genres,Studios",
            "SortBy": "SortName",
            "SortOrder": "Ascending",
        }

        if library_id:
            params["ParentId"] = library_id

        response = await self._client.get(
            f"{self.server_url}/Users/{user_id}/Items",
            params=params,
        )
        data = response.json()

        movies = []
        for movie in data.get("Items", []):
            item_id = movie.get("Id")
            movies.append({
                "id": item_id,
                "title": movie.get("Name"),
                "year": movie.get("ProductionYear"),
                "duration": (movie.get("RunTimeTicks") or 0) // 10000,  # ticks to ms
                "overview": movie.get("Overview"),
                "poster_url": f"{self.server_url}/Items/{item_id}/Images/Primary?api_key={self.api_key}" if item_id else None,
                "backdrop_url": f"{self.server_url}/Items/{item_id}/Images/Backdrop?api_key={self.api_key}" if item_id else None,
                "genres": movie.get("Genres", []),
                "rating": movie.get("CommunityRating"),
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

        user_id = self.user_id or await self._get_first_user_id()

        response = await self._client.get(
            f"{self.server_url}/Users/{user_id}/Items/{movie_id}"
        )
        movie = response.json()

        poster_url = f"{self.server_url}/Items/{movie_id}/Images/Primary?api_key={self.api_key}"
        backdrop_url = f"{self.server_url}/Items/{movie_id}/Images/Backdrop?api_key={self.api_key}"
        return CommandResult(
            success=True,
            data={
                "id": movie.get("Id"),
                "title": movie.get("Name"),
                "year": movie.get("ProductionYear"),
                "duration": (movie.get("RunTimeTicks") or 0) // 10000,  # ticks to ms
                "overview": movie.get("Overview"),
                "tagline": movie.get("Taglines", [None])[0] if movie.get("Taglines") else None,
                "genres": movie.get("Genres", []),
                "rating": movie.get("CommunityRating"),
                "poster_url": poster_url,
                "backdrop_url": backdrop_url,
                "directors": [p.get("Name") for p in movie.get("People", []) if p.get("Type") == "Director"],
                "actors": [p.get("Name") for p in movie.get("People", []) if p.get("Type") == "Actor"][:5],
                # Keep legacy names for backward compat
                "poster": poster_url,
                "backdrop": backdrop_url,
                "thumb": poster_url,
                "art": backdrop_url,
                "summary": movie.get("Overview"),
            },
        )

    async def _search(self, parameters: dict[str, Any]) -> CommandResult:
        """Search for media."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        query = parameters.get("query", "")
        media_type = parameters.get("type", "Movie")
        library_ids = parameters.get("library_ids")
        # Normalize type — Jellyfin is case-sensitive
        type_map = {"movie": "Movie", "show": "Series", "episode": "Episode"}
        jellyfin_type = type_map.get(media_type.lower(), media_type)

        user_id = self.user_id or await self._get_first_user_id()

        # Jellyfin ParentId in search results doesn't match library IDs,
        # so we must search per library when filtering is needed
        if library_ids:
            all_items: list[dict] = []
            seen_ids: set[str] = set()
            for lib_id in library_ids:
                response = await self._client.get(
                    f"{self.server_url}/Users/{user_id}/Items",
                    params={
                        "SearchTerm": query,
                        "IncludeItemTypes": jellyfin_type,
                        "Recursive": "true",
                        "Fields": "Overview,Genres,People",
                        "Limit": 20,
                        "ParentId": lib_id,
                    },
                )
                for item in response.json().get("Items", []):
                    if item.get("Id") not in seen_ids:
                        seen_ids.add(item.get("Id"))
                        all_items.append(item)
        else:
            response = await self._client.get(
                f"{self.server_url}/Users/{user_id}/Items",
                params={
                    "SearchTerm": query,
                    "IncludeItemTypes": jellyfin_type,
                    "Recursive": "true",
                    "Fields": "Overview,Genres,People",
                    "Limit": 20,
                },
            )
            all_items = response.json().get("Items", [])

        results = []
        for item in all_items:
            item_id = item.get("Id")

            # Build image URLs
            poster_url = f"{self.server_url}/Items/{item_id}/Images/Primary?api_key={self.api_key}" if item_id else None
            backdrop_url = f"{self.server_url}/Items/{item_id}/Images/Backdrop?api_key={self.api_key}" if item_id else None

            # Extract people
            people = item.get("People") or []
            directors = [p.get("Name") for p in people if p.get("Type") == "Director"]
            actors = [p.get("Name") for p in people if p.get("Type") == "Actor"][:5]

            results.append({
                "id": item_id,
                "title": item.get("Name"),
                "type": item.get("Type"),
                "year": item.get("ProductionYear"),
                "poster_url": poster_url,
                "backdrop_url": backdrop_url,
                "overview": item.get("Overview"),
                "rating": item.get("CommunityRating"),
                "duration": (item.get("RunTimeTicks") or 0) // 10000,  # ticks → ms
                "genres": item.get("Genres", []),
                "directors": directors,
                "cast": actors,
                "library_id": item.get("ParentId", ""),
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

        # Direct stream URL
        playback_url = f"{self.server_url}/Videos/{media_id}/stream?api_key={self.api_key}&static=true"

        return CommandResult(
            success=True,
            data={"playback_url": playback_url},
        )

    async def _list_sessions(self) -> CommandResult:
        """List active playback sessions."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        response = await self._client.get(f"{self.server_url}/Sessions")
        sessions = response.json()

        result = []
        for session in sessions:
            result.append({
                "id": session.get("Id"),
                "client": session.get("Client"),
                "device_name": session.get("DeviceName"),
                "user_name": session.get("UserName"),
                "now_playing": session.get("NowPlayingItem", {}).get("Name"),
            })

        return CommandResult(
            success=True,
            data={"sessions": result},
        )

    async def _play_on_session(self, parameters: dict[str, Any]) -> CommandResult:
        """Play media on an active session."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        session_id = parameters.get("session_id")
        media_id = parameters.get("media_id")

        if not session_id or not media_id:
            return CommandResult(
                success=False,
                message="session_id and media_id are required",
            )

        response = await self._client.post(
            f"{self.server_url}/Sessions/{session_id}/Playing",
            params={"ItemIds": media_id, "PlayCommand": "PlayNow"},
        )

        if response.status_code == 204:
            return CommandResult(success=True, message="Playback started")
        else:
            return CommandResult(
                success=False,
                message=f"Failed to start playback: {response.status_code}",
            )

    async def _get_chapters(self, parameters: dict[str, Any]) -> CommandResult:
        """Get chapter markers for a media item."""
        if not self._client:
            return CommandResult(success=False, message="Not connected")

        media_id = parameters.get("media_id")
        if not media_id:
            return CommandResult(success=False, message="media_id is required")

        user_id = self.user_id or await self._get_first_user_id()

        response = await self._client.get(
            f"{self.server_url}/Users/{user_id}/Items/{media_id}"
        )
        if response.status_code != 200:
            return CommandResult(success=False, message="Media not found")

        data = response.json()
        duration_ticks = data.get("RunTimeTicks", 0)
        duration_ms = duration_ticks // 10000

        raw_chapters = data.get("Chapters", [])
        chapters = []
        for i, ch in enumerate(raw_chapters):
            start_ticks = ch.get("StartPositionTicks", 0)
            start_ms = start_ticks // 10000
            # End = next chapter start, or movie duration for last chapter
            if i + 1 < len(raw_chapters):
                end_ms = raw_chapters[i + 1].get("StartPositionTicks", 0) // 10000
            else:
                end_ms = duration_ms

            chapters.append({
                "index": i,
                "title": ch.get("Name", f"Chapter {i + 1}"),
                "start_ms": start_ms,
                "end_ms": end_ms,
            })

        return CommandResult(
            success=True,
            data={
                "chapters": chapters,
                "duration_ms": duration_ms,
            },
        )

    async def _get_first_user_id(self) -> str | None:
        """Get the first available user ID."""
        if not self._client:
            return None

        try:
            response = await self._client.get(f"{self.server_url}/Users")
            users = response.json()
            if users:
                return users[0].get("Id")
        except Exception:
            pass
        return None
