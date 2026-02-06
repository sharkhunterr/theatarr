import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, Check, Plus, X } from 'lucide-react';
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

export interface MovieOption {
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

  // Search movies from media sources
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<Movie[]>({
    queryKey: ['movie-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      // API returns a list directly, not wrapped in { items: [...] }
      const response = await apiClient.get<Movie[]>(`/movies/search?query=${encodeURIComponent(searchQuery)}`);
      return response || [];
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
      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted"
          />
          <Input
            placeholder="Rechercher un film dans votre bibliothèque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.length >= 2 && (
          <div className="absolute z-20 w-full mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-80 overflow-y-auto">
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
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'bg-theatarr-500/20 cursor-default'
                          : selectedMovies.length >= maxSelections
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-dark-border/50'
                      }`}
                    >
                      {/* Poster */}
                      <div className="w-10 h-14 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={16} className="text-dark-muted" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-dark-text truncate">
                          {movie.title}
                        </div>
                        <div className="text-sm text-dark-muted">
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
                        <Check size={18} className="text-theatarr-500" />
                      ) : (
                        <Plus size={18} className="text-dark-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-dark-muted">
                Aucun film trouvé. Essayez une autre recherche.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Movies Grid */}
      {selectedMovies.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-dark-muted mb-3">
            Films sélectionnés ({selectedMovies.length}/{maxSelections})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {selectedMovies.map((movie, index) => (
              <div
                key={index}
                className="relative group bg-dark-surface border border-dark-border rounded-lg overflow-hidden"
              >
                <div className="aspect-[2/3]">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-dark-border">
                      <Film size={32} className="text-dark-muted" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs font-medium text-white truncate">{movie.title}</p>
                  {movie.year && (
                    <p className="text-xs text-dark-muted">{movie.year}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hint */}
      {selectedMovies.length === 0 && (
        <p className="text-sm text-dark-muted text-center py-4">
          Recherchez et ajoutez au moins 2 films depuis votre bibliothèque Plex ou Jellyfin.
        </p>
      )}
    </div>
  );
}
