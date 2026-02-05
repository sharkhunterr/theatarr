import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, Search, RefreshCw, Filter, Star, Clock } from 'lucide-react';
import { Button, Card, Input, Spinner, Modal } from '../components/common';
import { apiClient } from '../api/client';

interface Movie {
  id: string;
  title: string;
  year: number | null;
  overview: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  rating: number | null;
  runtime_minutes: number | null;
  genres: string[] | null;
  source: string;
  source_id: string | null;
  has_trailer: boolean;
}

interface MoviesResponse {
  items: Movie[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function MoviesPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // Fetch movies
  const { data: moviesData, isLoading: moviesLoading } = useQuery<MoviesResponse>({
    queryKey: ['movies', page, searchQuery, selectedGenre],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (selectedGenre) {
        params.append('genre', selectedGenre);
      }
      const response = await apiClient.get(`/movies?${params}`);
      return response.data;
    },
  });

  // Fetch genres
  const { data: genres } = useQuery<string[]>({
    queryKey: ['genres'],
    queryFn: async () => {
      const response = await apiClient.get('/movies/genres/list');
      return response.data;
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Movies</h1>
          <p className="text-gray-500 mt-1">Browse movies from your media library</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {genres && genres.length > 0 && (
          <select
            value={selectedGenre}
            onChange={(e) => {
              setSelectedGenre(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Movies Grid */}
      {moviesLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : moviesData && moviesData.items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {moviesData.items.map((movie) => (
              <button
                key={movie.id}
                onClick={() => setSelectedMovie(movie)}
                className="text-left group"
              >
                <div className="aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden relative">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={48} className="text-gray-600" />
                    </div>
                  )}

                  {/* Rating badge */}
                  {movie.rating && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 rounded flex items-center gap-1">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-white">{movie.rating.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div>
                      {movie.genres && movie.genres.length > 0 && (
                        <div className="text-xs text-gray-300 mb-1">
                          {movie.genres.slice(0, 2).join(', ')}
                        </div>
                      )}
                      {movie.runtime_minutes && (
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatRuntime(movie.runtime_minutes)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="font-medium text-sm truncate">{movie.title}</div>
                  <div className="text-xs text-gray-500">{movie.year || 'Unknown year'}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {moviesData.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-400">
                Page {page} of {moviesData.total_pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(moviesData.total_pages, p + 1))}
                disabled={page === moviesData.total_pages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Film size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">No movies found</p>
          <p className="text-sm text-gray-600 mt-2">
            Connect a media service (Plex, Jellyfin) to see your library
          </p>
        </div>
      )}

      {/* Movie Detail Modal */}
      <Modal
        isOpen={!!selectedMovie}
        onClose={() => setSelectedMovie(null)}
        title={selectedMovie?.title || ''}
        size="lg"
      >
        {selectedMovie && (
          <div className="space-y-6">
            <div className="flex gap-6">
              {/* Poster */}
              <div className="w-48 flex-shrink-0">
                {selectedMovie.poster_url ? (
                  <img
                    src={selectedMovie.poster_url}
                    alt={selectedMovie.title}
                    className="w-full rounded-lg"
                  />
                ) : (
                  <div className="aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center">
                    <Film size={48} className="text-gray-600" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  {selectedMovie.year && (
                    <span className="text-gray-400">{selectedMovie.year}</span>
                  )}
                  {selectedMovie.runtime_minutes && (
                    <span className="text-gray-400 flex items-center gap-1">
                      <Clock size={14} />
                      {formatRuntime(selectedMovie.runtime_minutes)}
                    </span>
                  )}
                  {selectedMovie.rating && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star size={14} className="fill-yellow-400" />
                      {selectedMovie.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {selectedMovie.genres && selectedMovie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedMovie.genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {selectedMovie.overview && (
                  <p className="text-gray-400 text-sm leading-relaxed">{selectedMovie.overview}</p>
                )}

                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-xs text-gray-500">
                    Source: {selectedMovie.source}
                    {selectedMovie.source_id && ` (${selectedMovie.source_id})`}
                  </div>
                  {selectedMovie.has_trailer && (
                    <div className="text-xs text-green-400 mt-1">Trailer available</div>
                  )}
                </div>
              </div>
            </div>

            {/* Backdrop */}
            {selectedMovie.backdrop_url && (
              <div className="rounded-lg overflow-hidden">
                <img
                  src={selectedMovie.backdrop_url}
                  alt={`${selectedMovie.title} backdrop`}
                  className="w-full"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button variant="ghost" onClick={() => setSelectedMovie(null)}>
                Close
              </Button>
              <Button>Create Session</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
