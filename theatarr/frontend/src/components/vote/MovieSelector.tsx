import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, Check, Plus } from 'lucide-react';
import { Input, Spinner } from '../common';
import { apiClient } from '../../api/client';

interface Movie {
  id: string;
  title: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
}

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
  movie_id?: string;
}

interface MovieSelectorProps {
  selectedMovies: MovieOption[];
  onSelect: (movie: MovieOption) => void;
  onRemove: (index: number) => void;
  maxSelections?: number;
}

export function MovieSelector({
  selectedMovies,
  onSelect,
  onRemove,
  maxSelections = 10,
}: MovieSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search movies from media sources
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<Movie[]>({
    queryKey: ['movie-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await apiClient.get('/movies/search', {
        params: { q: searchQuery },
      });
      return response.data.items || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelectMovie = (movie: Movie) => {
    if (selectedMovies.length >= maxSelections) return;

    const movieOption: MovieOption = {
      title: movie.title,
      year: movie.year,
      poster_url: movie.poster_url,
      backdrop_url: movie.backdrop_url,
      overview: movie.overview,
      rating: movie.rating,
      genres: movie.genres,
      movie_id: movie.id,
    };

    onSelect(movieOption);
    setSearchQuery('');
  };

  const isSelected = (movieId: string) =>
    selectedMovies.some((m) => m.movie_id === movieId);

  return (
    <div className="space-y-4">
      {/* Selected Movies */}
      {selectedMovies.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Selected Movies ({selectedMovies.length}/{maxSelections})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedMovies.map((movie, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg"
              >
                {movie.poster_url && (
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="w-6 h-8 rounded object-cover"
                  />
                )}
                <span className="text-sm text-white">
                  {movie.title}
                  {movie.year && (
                    <span className="text-gray-400 ml-1">({movie.year})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="text-gray-400 hover:text-red-400 ml-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <Input
            placeholder="Search movies from your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.length >= 2 && (
          <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
            {isSearchLoading ? (
              <div className="p-4 text-center">
                <Spinner size="sm" />
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="py-2">
                {searchResults.map((movie) => {
                  const selected = isSelected(movie.id);

                  return (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => !selected && handleSelectMovie(movie)}
                      disabled={selected || selectedMovies.length >= maxSelections}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        selected
                          ? 'bg-indigo-500/20 cursor-default'
                          : selectedMovies.length >= maxSelections
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-gray-700'
                      }`}
                    >
                      {/* Poster */}
                      <div className="w-10 h-14 bg-gray-700 rounded flex-shrink-0 overflow-hidden">
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={16} className="text-gray-600" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {movie.title}
                        </div>
                        <div className="text-sm text-gray-400">
                          {movie.year}
                          {movie.rating && (
                            <span className="ml-2 text-yellow-500">
                              ★ {movie.rating.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selection indicator */}
                      {selected ? (
                        <Check size={18} className="text-indigo-400" />
                      ) : (
                        <Plus size={18} className="text-gray-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No movies found. Try a different search.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500">
        Search your Plex or Jellyfin library to add movies. You can also add movies
        manually in the form above.
      </p>
    </div>
  );
}
