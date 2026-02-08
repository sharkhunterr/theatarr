"""TMDB (The Movie Database) adapter for Theatarr.

Provides movie metadata and trailer information from TMDB API.
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
class TMDBAdapter(ServiceAdapter):
    """Adapter for The Movie Database (TMDB) API.

    Provides:
    - Movie search and metadata
    - Trailer URLs
    - Poster and backdrop images
    - Genre information
    """

    adapter_type = "tmdb"
    display_name = "TMDB (The Movie Database)"
    category = AdapterCategory.METADATA

    # TMDB API endpoints
    BASE_URL = "https://api.themoviedb.org/3"
    IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.language = config.get("language", "fr-FR")
        self.include_adult = config.get("include_adult", False)
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
                    "description": "TMDB API key (v3 auth)",
                },
                "language": {
                    "type": "string",
                    "title": "Language",
                    "description": "Preferred language for results",
                    "default": "fr-FR",
                },
                "include_adult": {
                    "type": "boolean",
                    "title": "Include Adult Content",
                    "description": "Include adult content in search results",
                    "default": False,
                },
            },
        }

    def get_capabilities(self) -> list[Capability]:
        return [
            Capability(name="search_movies", description="Search movies by title"),
            Capability(name="get_movie", description="Get detailed movie info by TMDB ID"),
            Capability(name="get_trailers", description="Get movie trailers"),
        ]

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                params={"api_key": self.api_key},
                timeout=30.0,
            )
        return self._client

    async def connect(self) -> None:
        try:
            client = await self._get_client()
            response = await client.get("/configuration")
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
            response = await client.get("/configuration")

            if response.status_code == 200:
                data = response.json()
                return ConnectionTestResult(
                    status=ConnectionStatus.CONNECTED,
                    message="Connected to TMDB API",
                    details={
                        "image_base_url": data.get("images", {}).get("secure_base_url"),
                        "poster_sizes": data.get("images", {}).get("poster_sizes", []),
                        "backdrop_sizes": data.get("images", {}).get("backdrop_sizes", []),
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
                    message=f"TMDB API error: {response.status_code}",
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
            if command.action == "search_movies":
                results = await self.search_movies(
                    query=command.parameters.get("query", ""),
                    year=command.parameters.get("year"),
                )
                return CommandResult(success=True, data={"results": results})
            elif command.action == "get_movie":
                movie = await self.get_movie(
                    tmdb_id=command.parameters.get("movie_id", ""),
                )
                if movie:
                    return CommandResult(success=True, data=movie)
                return CommandResult(success=False, message="Movie not found")
            elif command.action == "get_trailers":
                trailers = await self.get_trailers(
                    tmdb_id=command.parameters.get("movie_id", ""),
                )
                return CommandResult(success=True, data={"trailers": trailers})
            else:
                return CommandResult(
                    success=False,
                    message=f"Unknown command: {command.action}",
                )
        except Exception as e:
            return CommandResult(success=False, message=str(e))

    async def search_movies(
        self,
        query: str,
        year: int | None = None,
        page: int = 1,
    ) -> list[dict[str, Any]]:
        client = await self._get_client()

        params: dict[str, Any] = {
            "query": query,
            "language": self.language,
            "include_adult": self.include_adult,
            "page": page,
        }
        if year:
            params["year"] = year

        response = await client.get("/search/movie", params=params)

        if response.status_code != 200:
            return []

        data = response.json()
        return [self._format_movie(m) for m in data.get("results", [])]

    async def get_movie(self, tmdb_id: str) -> dict[str, Any] | None:
        client = await self._get_client()
        response = await client.get(
            f"/movie/{tmdb_id}",
            params={
                "language": self.language,
                "append_to_response": "credits,videos,images,keywords",
                "include_image_language": f"{self.language[:2]},en,null",
            },
        )

        if response.status_code != 200:
            return None

        return self._format_movie_details(response.json())

    async def get_trailers(self, tmdb_id: str) -> list[dict[str, Any]]:
        client = await self._get_client()
        response = await client.get(
            f"/movie/{tmdb_id}/videos",
            params={"language": self.language},
        )

        if response.status_code != 200:
            return []

        data = response.json()
        trailers = []

        for video in data.get("results", []):
            if video.get("site") == "YouTube" and video.get("type") in ["Trailer", "Teaser"]:
                trailers.append({
                    "key": video.get("key"),
                    "name": video.get("name"),
                    "type": video.get("type"),
                    "site": video.get("site"),
                    "size": video.get("size", 1080),
                    "official": video.get("official", False),
                    "published_at": video.get("published_at"),
                    "youtube_url": f"https://www.youtube.com/watch?v={video.get('key')}",
                })

        trailers.sort(key=lambda x: (x.get("official", False), x.get("size", 0)), reverse=True)
        return trailers

    def _format_movie(self, movie: dict[str, Any]) -> dict[str, Any]:
        return {
            "tmdb_id": str(movie.get("id")),
            "title": movie.get("title"),
            "original_title": movie.get("original_title"),
            "year": int(movie.get("release_date", "0000")[:4]) if movie.get("release_date") else None,
            "overview": movie.get("overview"),
            "rating": movie.get("vote_average"),
            "vote_count": movie.get("vote_count"),
            "popularity": movie.get("popularity"),
            "poster_url": self._get_image_url(movie.get("poster_path"), "w500"),
            "backdrop_url": self._get_image_url(movie.get("backdrop_path"), "original"),
            "genre_ids": movie.get("genre_ids", []),
        }

    def _format_movie_details(self, movie: dict[str, Any]) -> dict[str, Any]:
        genres = [g.get("name") for g in movie.get("genres", [])]

        cast = []
        credits = movie.get("credits", {})
        for actor in credits.get("cast", [])[:10]:
            cast.append(actor.get("name"))

        directors = []
        for crew in credits.get("crew", []):
            if crew.get("job") == "Director":
                directors.append(crew.get("name"))

        trailers = []
        for video in movie.get("videos", {}).get("results", []):
            if video.get("site") == "YouTube" and video.get("type") in ["Trailer", "Teaser"]:
                trailers.append({
                    "key": video.get("key"),
                    "name": video.get("name"),
                    "type": video.get("type"),
                    "youtube_url": f"https://www.youtube.com/watch?v={video.get('key')}",
                })

        images = movie.get("images", {})
        extra_backdrops = [
            self._get_image_url(img.get("file_path"), "original")
            for img in sorted(
                images.get("backdrops", []),
                key=lambda x: x.get("vote_average", 0),
                reverse=True,
            )[:10]
            if img.get("file_path") != movie.get("backdrop_path")
        ]
        extra_posters = [
            self._get_image_url(img.get("file_path"), "w780")
            for img in sorted(
                images.get("posters", []),
                key=lambda x: x.get("vote_average", 0),
                reverse=True,
            )[:10]
            if img.get("file_path") != movie.get("poster_path")
        ]
        logos = [
            self._get_image_url(img.get("file_path"), "w500")
            for img in images.get("logos", [])[:5]
        ]

        keywords = [kw.get("name") for kw in movie.get("keywords", {}).get("keywords", [])]

        return {
            "tmdb_id": str(movie.get("id")),
            "imdb_id": movie.get("imdb_id"),
            "title": movie.get("title"),
            "original_title": movie.get("original_title"),
            "tagline": movie.get("tagline"),
            "year": int(movie.get("release_date", "0000")[:4]) if movie.get("release_date") else None,
            "release_date": movie.get("release_date"),
            "runtime_minutes": movie.get("runtime"),
            "overview": movie.get("overview"),
            "rating": movie.get("vote_average"),
            "vote_count": movie.get("vote_count"),
            "popularity": movie.get("popularity"),
            "poster_url": self._get_image_url(movie.get("poster_path"), "w500"),
            "backdrop_url": self._get_image_url(movie.get("backdrop_path"), "original"),
            "extra_backdrops": extra_backdrops,
            "extra_posters": extra_posters,
            "logos": logos,
            "genres": genres,
            "cast": cast,
            "directors": directors,
            "trailers": trailers,
            "keywords": keywords,
            "budget": movie.get("budget"),
            "revenue": movie.get("revenue"),
            "studios": [c.get("name") for c in movie.get("production_companies", [])],
        }

    def _get_image_url(self, path: str | None, size: str = "w500") -> str | None:
        if not path:
            return None
        return f"{self.IMAGE_BASE_URL}/{size}{path}"
