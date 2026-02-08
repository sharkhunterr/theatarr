"""Metadata provider adapters (TMDB, Fanart.tv, etc.)."""

from theatarr.adapters.metadata.tmdb import TMDBAdapter
from theatarr.adapters.metadata.fanart import FanartAdapter

__all__ = ["TMDBAdapter", "FanartAdapter"]
