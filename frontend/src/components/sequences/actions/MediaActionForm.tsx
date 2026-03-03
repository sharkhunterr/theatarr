import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, X, Check } from 'lucide-react';
import { Input, Spinner } from '../../common';
import { apiClient } from '../../../api/client';

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

interface MediaActionFormProps {
  command: string;
  parameters: Record<string, unknown>;
  onCommandChange: (command: string) => void;
  onParametersChange: (parameters: Record<string, unknown>) => void;
}

const mediaCommandKeys: { value: string; key: string }[] = [
  { value: 'play', key: 'sessions:mediaForm.playMedia' },
  { value: 'pause', key: 'sessions:mediaForm.pause' },
  { value: 'resume', key: 'sessions:mediaForm.resume' },
  { value: 'stop', key: 'sessions:mediaForm.stop' },
  { value: 'seek', key: 'sessions:mediaForm.seek' },
  { value: 'next', key: 'sessions:mediaForm.nextTrack' },
  { value: 'previous', key: 'sessions:mediaForm.previousTrack' },
];

export function MediaActionForm({
  command,
  parameters,
  onCommandChange,
  onParametersChange,
}: MediaActionFormProps) {
  const { t } = useTranslation(['sessions', 'common']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Search movies from media sources
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<Movie[]>({
    queryKey: ['movie-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await apiClient.get<Movie[]>(`/movies/search?query=${encodeURIComponent(searchQuery)}`);
      return response || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const handleSelectMovie = (movie: Movie) => {
    onParametersChange({
      ...parameters,
      media_id: movie.id,
      movie_title: movie.title,
      movie_year: movie.year,
      movie_poster: movie.poster_url,
    });
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleRemoveMovie = () => {
    const { media_id, movie_title, movie_year, movie_poster, ...rest } = parameters;
    onParametersChange(rest);
  };

  const selectedMovie = parameters.media_id ? {
    id: parameters.media_id as string,
    title: parameters.movie_title as string,
    year: parameters.movie_year as number | undefined,
    poster_url: parameters.movie_poster as string | undefined,
  } : null;

  return (
    <div className="space-y-4">
      {/* Command Select */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('sessions:mediaForm.command')}</label>
        <select
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {mediaCommandKeys.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>
              {t(cmd.key)}
            </option>
          ))}
        </select>
      </div>

      {/* Movie Selection (for play command) */}
      {command === 'play' && (
        <>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">{t('sessions:mediaForm.selectMovie')}</label>

            {/* Selected Movie Display */}
            {selectedMovie && !isSearchOpen ? (
              <div className="flex items-center gap-3 p-3 bg-dark-bg border border-dark-border rounded-lg">
                {/* Poster */}
                <div className="w-12 h-16 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                  {selectedMovie.poster_url ? (
                    <img
                      src={selectedMovie.poster_url}
                      alt={selectedMovie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={20} className="text-dark-muted" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-dark-text truncate">
                    {selectedMovie.title}
                  </div>
                  {selectedMovie.year && (
                    <div className="text-sm text-dark-muted">{selectedMovie.year}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="px-2 py-1 text-xs bg-dark-border hover:bg-dark-muted/30 text-dark-text rounded transition-colors"
                  >
                    {t('sessions:mediaForm.change')}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveMovie}
                    className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Search Input */}
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted"
                    />
                    <Input
                      placeholder={t('sessions:mediaForm.searchLibraryPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      className="pl-10"
                    />
                  </div>
                  {selectedMovie && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="px-3 py-2 text-sm bg-dark-border hover:bg-dark-muted/30 text-dark-text rounded-lg transition-colors"
                    >
                      {t('common:actions.cancel')}
                    </button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {isSearchOpen && searchQuery.length >= 2 && (
                  <div className="absolute z-30 w-full mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {isSearchLoading ? (
                      <div className="p-4 text-center">
                        <Spinner size="sm" />
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      <div className="py-2">
                        {searchResults.map((movie) => (
                          <button
                            key={movie.id}
                            type="button"
                            onClick={() => handleSelectMovie(movie)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-dark-border/50 transition-colors"
                          >
                            {/* Poster */}
                            <div className="w-8 h-12 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                              {movie.poster_url ? (
                                <img
                                  src={movie.poster_url}
                                  alt={movie.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Film size={14} className="text-dark-muted" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-dark-text text-sm truncate">
                                {movie.title}
                              </div>
                              <div className="text-xs text-dark-muted">
                                {movie.year}
                                {movie.rating && (
                                  <span className="ml-2 text-yellow-500">
                                    ★ {movie.rating.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <Check size={16} className="text-theatarr-500 opacity-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-dark-muted text-sm">
                        {t('sessions:mediaForm.noResults')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('sessions:mediaForm.startPosition')}</label>
              <input
                type="number"
                value={(parameters.position_ms as number) || 0}
                onChange={(e) =>
                  onParametersChange({
                    ...parameters,
                    position_ms: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                min="0"
                step="1000"
                placeholder="ms"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('sessions:mediaForm.playbackSpeed')}</label>
              <select
                value={(parameters.speed as number) || 1}
                onChange={(e) =>
                  onParametersChange({ ...parameters, speed: parseFloat(e.target.value) })
                }
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Seek Position */}
      {command === 'seek' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t('sessions:mediaForm.seekPosition')}</label>
          <input
            type="number"
            value={(parameters.position_ms as number) || 0}
            onChange={(e) =>
              onParametersChange({ ...parameters, position_ms: parseInt(e.target.value) || 0 })
            }
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="1000"
          />
        </div>
      )}

      {/* Target Player */}
      <Input
        label={t('sessions:mediaForm.targetPlayer')}
        value={(parameters.player as string) || ''}
        onChange={(e) => onParametersChange({ ...parameters, player: e.target.value })}
        placeholder={t('sessions:mediaForm.targetPlayerPlaceholder')}
      />

      {/* Subtitles (for play) */}
      {command === 'play' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="subtitles"
            checked={(parameters.subtitles as boolean) || false}
            onChange={(e) => onParametersChange({ ...parameters, subtitles: e.target.checked })}
            className="w-4 h-4 accent-theatarr-500"
          />
          <label htmlFor="subtitles" className="text-sm text-dark-text">
            {t('sessions:mediaForm.enableSubtitles')}
          </label>
        </div>
      )}
    </div>
  );
}
