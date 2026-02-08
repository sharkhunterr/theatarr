"""TMDB (The Movie Database) adapter for Theatarr.

Provides movie metadata and trailer information from TMDB API.
"""

from typing import Any

import httpx

from theatarr.adapters.base import AdapterCapability, ServiceAdapter, ServiceCategory


class TMDBAdapter(ServiceAdapter):
    """Adapter for The Movie Database (TMDB) API.

    Provides:
    - Movie search and metadata
    - Trailer URLs
    - Poster and backdrop images
    - Genre information
    """

    name = "tmdb"
    display_name = "TMDB (The Movie Database)"
    category = ServiceCategory.METADATA
    capabilities = [
        AdapterCapability.SEARCH,
        AdapterCapability.METADATA,
    ]

    # TMDB API endpoints
    BASE_URL = "https://api.themoviedb.org/3"
    IMAGE_BASE_URL = "https://image.tmdb.org/t/p"

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize TMDB adapter.

        Args:
            config: Configuration with api_key
        """
        super().__init__(config)
        self.api_key = config.get("api_key", "")
        self.language = config.get("language", "en-US")
        self.include_adult = config.get("include_adult", False)
        self._client: httpx.AsyncClient | None = None

    @classmethod
    def get_config_schema(cls) -> dict[str, Any]:
        """Get configuration schema for TMDB."""
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
                    "default": "en-US",
                },
                "include_adult": {
                    "type": "boolean",
                    "title": "Include Adult Content",
                    "description": "Include adult content in search results",
                    "default": False,
                },
            },
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                params={"api_key": self.api_key},
                timeout=30.0,
            )
        return self._client

    async def connect(self) -> bool:
        """Test connection to TMDB API."""
        try:
            client = await self._get_client()
            response = await client.get("/configuration")
            return response.status_code == 200
        except Exception:
            return False

    async def disconnect(self) -> None:
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    async def test_connection(self) -> dict[str, Any]:
        """Test connection and return API status."""
        try:
            client = await self._get_client()
            response = await client.get("/configuration")

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message": "Connected to TMDB API",
                    "details": {
                        "image_base_url": data.get("images", {}).get("secure_base_url"),
                        "poster_sizes": data.get("images", {}).get("poster_sizes", []),
                        "backdrop_sizes": data.get("images", {}).get("backdrop_sizes", []),
                    },
                }
            elif response.status_code == 401:
                return {
                    "success": False,
                    "message": "Invalid API key",
                }
            else:
                return {
                    "success": False,
                    "message": f"TMDB API error: {response.status_code}",
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
            }

    async def search_movies(
        self,
        query: str,
        year: int | None = None,
        page: int = 1,
    ) -> list[dict[str, Any]]:
        """Search for movies by title.

        Args:
            query: Search query
            year: Optional release year filter
            page: Results page number

        Returns:
            List of movie results
        """
        client = await self._get_client()

        params = {
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
        results = []

        for movie in data.get("results", []):
            results.append(self._format_movie(movie))

        return results

    async def get_movie(self, tmdb_id: str) -> dict[str, Any] | None:
        """Get detailed movie information.

        Args:
            tmdb_id: TMDB movie ID

        Returns:
            Movie details or None
        """
        client = await self._get_client()
        response = await client.get(
            f"/movie/{tmdb_id}",
            params={
                "language": self.language,
                "append_to_response": "credits,videos,images",
                "include_image_language": f"{self.language[:2]},en,null",
            },
        )

        if response.status_code != 200:
            return None

        return self._format_movie_details(response.json())

    async def get_trailers(self, tmdb_id: str) -> list[dict[str, Any]]:
        """Get trailers for a movie.

        Args:
            tmdb_id: TMDB movie ID

        Returns:
            List of trailer information
        """
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

        # Sort by quality (size) descending, then by official
        trailers.sort(key=lambda x: (x.get("official", False), x.get("size", 0)), reverse=True)

        return trailers

    async def get_popular_movies(
        self,
        page: int = 1,
        genre_ids: list[int] | None = None,
    ) -> list[dict[str, Any]]:
        """Get popular movies, optionally filtered by genre.

        Args:
            page: Page number
            genre_ids: Optional genre ID filter

        Returns:
            List of popular movies
        """
        client = await self._get_client()

        params = {
            "language": self.language,
            "page": page,
        }
        if genre_ids:
            params["with_genres"] = ",".join(str(g) for g in genre_ids)

        response = await client.get("/discover/movie", params=params)

        if response.status_code != 200:
            return []

        data = response.json()
        return [self._format_movie(m) for m in data.get("results", [])]

    async def get_upcoming_movies(self, page: int = 1) -> list[dict[str, Any]]:
        """Get upcoming movie releases.

        Args:
            page: Page number

        Returns:
            List of upcoming movies
        """
        client = await self._get_client()
        response = await client.get(
            "/movie/upcoming",
            params={
                "language": self.language,
                "page": page,
            },
        )

        if response.status_code != 200:
            return []

        data = response.json()
        return [self._format_movie(m) for m in data.get("results", [])]

    async def get_genres(self) -> list[dict[str, Any]]:
        """Get list of movie genres.

        Returns:
            List of genres with id and name
        """
        client = await self._get_client()
        response = await client.get(
            "/genre/movie/list",
            params={"language": self.language},
        )

        if response.status_code != 200:
            return []

        data = response.json()
        return data.get("genres", [])

    def _format_movie(self, movie: dict[str, Any]) -> dict[str, Any]:
        """Format basic movie data from TMDB response."""
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
        """Format detailed movie data from TMDB response."""
        # Extract genres
        genres = [g.get("name") for g in movie.get("genres", [])]

        # Extract cast (top 10)
        cast = []
        credits = movie.get("credits", {})
        for actor in credits.get("cast", [])[:10]:
            cast.append(actor.get("name"))

        # Extract directors
        directors = []
        for crew in credits.get("crew", []):
            if crew.get("job") == "Director":
                directors.append(crew.get("name"))

        # Extract trailers
        trailers = []
        for video in movie.get("videos", {}).get("results", []):
            if video.get("site") == "YouTube" and video.get("type") in ["Trailer", "Teaser"]:
                trailers.append({
                    "key": video.get("key"),
                    "name": video.get("name"),
                    "type": video.get("type"),
                    "youtube_url": f"https://www.youtube.com/watch?v={video.get('key')}",
                })

        # Extract alternative images (already returned by append_to_response=images)
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
            "budget": movie.get("budget"),
            "revenue": movie.get("revenue"),
            "production_companies": [c.get("name") for c in movie.get("production_companies", [])],
        }

    def _get_image_url(self, path: str | None, size: str = "w500") -> str | None:
        """Build full image URL from path."""
        if not path:
            return None
        return f"{self.IMAGE_BASE_URL}/{size}{path}"
