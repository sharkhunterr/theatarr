import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, Film, X, Shuffle, Filter, ListOrdered, Calendar } from 'lucide-react';
import { Spinner } from '../common';
import { apiClient } from '../../api/client';
import type { MysteryConfig, MysteryFilters, MysterySource } from '../../stores/sessionStore';

interface MysteryModeConfigProps {
  config: MysteryConfig;
  onChange: (config: MysteryConfig) => void;
  revealAt?: string;
  onRevealAtChange?: (revealAt: string | null) => void;
}

const FALLBACK_GENRES = [
  'Action', 'Aventure', 'Animation', 'Comédie', 'Crime', 'Documentaire',
  'Drame', 'Familial', 'Fantastique', 'Histoire', 'Horreur', 'Musique',
  'Mystère', 'Romance', 'Science-Fiction', 'Thriller', 'Guerre', 'Western'
];

export function MysteryModeConfig({
  config,
  onChange,
  revealAt,
  onRevealAtChange,
}: MysteryModeConfigProps) {
  const { t } = useTranslation('sessions');
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Fetch genres dynamically from media service (language-independent)
  const { data: serviceGenres } = useQuery<string[]>({
    queryKey: ['genres-list'],
    queryFn: () => apiClient.get<string[]>('/movies/genres/list'),
    staleTime: 5 * 60 * 1000,
  });
  const GENRES = serviceGenres && serviceGenres.length > 0 ? serviceGenres : FALLBACK_GENRES;

  // Movie search query
  const { data: movieSearchResults, isLoading: isSearchingMovies } = useQuery<Array<{
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }>>({
    queryKey: ['movie-search-mystery', movieSearchQuery],
    queryFn: async () => {
      if (!movieSearchQuery.trim()) return [];
      return apiClient.get(`/movies/search?query=${encodeURIComponent(movieSearchQuery)}`);
    },
    enabled: movieSearchQuery.length >= 2,
  });

  const setSource = (source: MysterySource) => {
    onChange({ ...config, source });
  };

  const updateFilters = (updates: Partial<MysteryFilters>) => {
    onChange({
      ...config,
      filters: { ...config.filters, ...updates },
    });
  };

  const toggleGenre = (genre: string) => {
    const currentGenres = config.filters?.genres || [];
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];
    updateFilters({ genres: newGenres.length > 0 ? newGenres : undefined });
  };

  const addCuratedMovie = (movie: {
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }) => {
    const currentMovies = config.curated_movies || [];
    // Check if already added
    const exists = currentMovies.some(
      m => (m.movie_id === movie.id) || (m.title === movie.title && m.year === movie.year)
    );
    if (exists) return;

    onChange({
      ...config,
      curated_movies: [
        ...currentMovies,
        {
          title: movie.title,
          year: movie.year,
          poster_url: movie.poster_url,
          movie_id: movie.id,
          source: movie.source,
          source_id: movie.source_id || movie.id,
        },
      ],
    });
    setMovieSearchQuery('');
    setIsSearchOpen(false);
  };

  const removeCuratedMovie = (index: number) => {
    const currentMovies = config.curated_movies || [];
    onChange({
      ...config,
      curated_movies: currentMovies.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      {/* Reveal Time */}
      {onRevealAtChange && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-dark-muted">
            <Calendar size={14} />
            {t('sessions:mysteryMode.revealAt')}
          </label>
          <input
            type="datetime-local"
            value={revealAt ? revealAt.slice(0, 16) : ''}
            onChange={(e) => onRevealAtChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm"
            title={t('sessions:mysteryMode.revealAtHelp')}
          />
        </div>
      )}

      {/* Source Selection */}
      <div className="space-y-2">
        <label className="text-sm text-dark-muted">{t('sessions:mysteryMode.source')}</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSource('random')}
            className={`p-3 rounded-lg border text-center transition-colors ${
              config.source === 'random'
                ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
            }`}
          >
            <Shuffle size={20} className="mx-auto mb-1" />
            <div className="text-xs font-medium">{t('sessions:mysteryMode.random')}</div>
          </button>
          <button
            type="button"
            onClick={() => setSource('filtered')}
            className={`p-3 rounded-lg border text-center transition-colors ${
              config.source === 'filtered'
                ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
            }`}
          >
            <Filter size={20} className="mx-auto mb-1" />
            <div className="text-xs font-medium">{t('sessions:mysteryMode.filtered')}</div>
          </button>
          <button
            type="button"
            onClick={() => setSource('curated')}
            className={`p-3 rounded-lg border text-center transition-colors ${
              config.source === 'curated'
                ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
            }`}
          >
            <ListOrdered size={20} className="mx-auto mb-1" />
            <div className="text-xs font-medium">{t('sessions:mysteryMode.curated')}</div>
          </button>
        </div>
      </div>

      {/* Filtered Source Config */}
      {config.source === 'filtered' && (
        <div className="space-y-4 p-3 bg-dark-bg rounded-lg">
          <h4 className="text-sm font-medium text-dark-text">{t('sessions:mysteryMode.filters')}</h4>

          {/* Genre Selection */}
          <div className="space-y-2">
            <label className="text-xs text-dark-muted">{t('sessions:mysteryMode.genres')}</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map(genre => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    config.filters?.genres?.includes(genre)
                      ? 'bg-theatarr-500 text-white'
                      : 'bg-dark-surface text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Year Range */}
          <div className="space-y-2">
            <label className="text-xs text-dark-muted">{t('sessions:mysteryMode.yearRange')}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={config.filters?.year_min || ''}
                onChange={(e) => updateFilters({ year_min: e.target.value ? parseInt(e.target.value) : undefined })}
                className="flex-1 bg-dark-surface border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
                min={1900}
                max={2030}
              />
              <span className="text-dark-muted">-</span>
              <input
                type="number"
                placeholder="Max"
                value={config.filters?.year_max || ''}
                onChange={(e) => updateFilters({ year_max: e.target.value ? parseInt(e.target.value) : undefined })}
                className="flex-1 bg-dark-surface border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
                min={1900}
                max={2030}
              />
            </div>
          </div>

          {/* Minimum Rating */}
          <div className="space-y-2">
            <label className="text-xs text-dark-muted">{t('sessions:mysteryMode.minRating')}</label>
            <input
              type="number"
              step={0.5}
              min={0}
              max={10}
              value={config.filters?.rating_min || ''}
              onChange={(e) => updateFilters({ rating_min: e.target.value ? parseFloat(e.target.value) : undefined })}
              className="w-24 bg-dark-surface border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
              placeholder="0-10"
            />
          </div>
        </div>
      )}

      {/* Curated Source Config */}
      {config.source === 'curated' && (
        <div className="space-y-3">
          {/* Movie Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
            <input
              type="text"
              placeholder={t('sessions:mysteryMode.searchPlaceholder')}
              value={movieSearchQuery}
              onChange={(e) => { setMovieSearchQuery(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-3 py-2 text-dark-text text-sm"
            />

            {isSearchOpen && movieSearchQuery.length >= 2 && (
              <div className="absolute z-30 w-full mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {isSearchingMovies ? (
                  <div className="p-4 text-center"><Spinner size="sm" /></div>
                ) : movieSearchResults && movieSearchResults.length > 0 ? (
                  <div className="py-1">
                    {movieSearchResults.map((movie) => (
                      <button
                        key={`${movie.source}-${movie.id}`}
                        type="button"
                        onClick={() => addCuratedMovie(movie)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-dark-border/50"
                      >
                        <div className="w-8 h-12 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                          {movie.poster_url ? (
                            <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-dark-muted" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-dark-text text-sm truncate">{movie.title}</div>
                          <div className="text-xs text-dark-muted">{movie.year} - {movie.source}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-dark-muted text-sm">{t('sessions:mysteryMode.noResults')}</div>
                )}
              </div>
            )}
          </div>

          {/* Curated Movies List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-dark-muted">{t('sessions:mysteryMode.curatedMovies')}</label>
              {(config.curated_movies?.length || 0) < 1 && (
                <span className="text-xs text-yellow-500">{t('sessions:mysteryMode.minMovies')}</span>
              )}
            </div>
            {config.curated_movies && config.curated_movies.length > 0 ? (
              <div className="space-y-2">
                {config.curated_movies.map((movie, index) => (
                  <div
                    key={`${movie.movie_id || movie.title}-${index}`}
                    className="flex items-center gap-3 p-2 bg-dark-bg rounded-lg"
                  >
                    <div className="w-8 h-12 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                      {movie.poster_url ? (
                        <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-dark-muted" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-dark-text text-sm truncate">{movie.title}</div>
                      <div className="text-xs text-dark-muted">{movie.year}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCuratedMovie(index)}
                      className="p-1 text-dark-muted hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-dark-muted text-center py-4 border border-dashed border-dark-border rounded-lg">
                {t('sessions:mysteryMode.addMovie')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
