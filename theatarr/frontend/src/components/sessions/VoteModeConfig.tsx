import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, X, Plus, Vote, Link as LinkIcon } from 'lucide-react';
import { Spinner } from '../common';
import { apiClient } from '../../api/client';
import { useLayoutStore } from '../../stores/layoutStore';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  movie_id?: string;
  source?: string;
  source_id?: string;
}

interface VoteSessionConfig {
  name?: string;
  description?: string;
  movie_options: MovieOption[];
  max_votes_per_user: number;
  allow_multiple_votes: boolean;
  require_token: boolean;
  show_results_during_voting: boolean;
  anonymous_voting: boolean;
  opens_at?: string;
  closes_at?: string;
  open_immediately?: boolean;
}

interface VoteSessionSummary {
  id: string;
  name: string;
  status: string;
  total_votes: number;
  is_open: boolean;
  movie_options?: MovieOption[];
}

interface VoteModeConfigProps {
  sessionName: string;
  config: VoteSessionConfig;
  onChange: (config: VoteSessionConfig) => void;
  linkedVoteSessionId?: string;
  onLinkVoteSession?: (id: string | null) => void;
}

export function VoteModeConfig({
  sessionName: _sessionName,
  config,
  onChange,
  linkedVoteSessionId,
  onLinkVoteSession,
}: VoteModeConfigProps) {
  // sessionName is available for future use (e.g., auto-naming vote session)
  void _sessionName;
  const { language } = useLayoutStore();
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showLinkExisting, setShowLinkExisting] = useState(!!linkedVoteSessionId);

  const t = {
    title: language === 'fr' ? 'Configuration du vote' : 'Vote Configuration',
    addMovies: language === 'fr' ? 'Ajouter des films au vote' : 'Add movies to vote',
    searchPlaceholder: language === 'fr' ? 'Rechercher un film...' : 'Search for a movie...',
    noResults: language === 'fr' ? 'Aucun résultat' : 'No results',
    movieOptions: language === 'fr' ? 'Options de film' : 'Movie Options',
    minMovies: language === 'fr' ? 'Minimum 2 films requis' : 'Minimum 2 movies required',
    settings: language === 'fr' ? 'Paramètres' : 'Settings',
    maxVotes: language === 'fr' ? 'Votes max par personne' : 'Max votes per person',
    allowMultiple: language === 'fr' ? 'Autoriser plusieurs votes' : 'Allow multiple votes',
    requireToken: language === 'fr' ? 'Requiert un token' : 'Require token',
    showResults: language === 'fr' ? 'Montrer les résultats pendant le vote' : 'Show results during voting',
    anonymous: language === 'fr' ? 'Vote anonyme' : 'Anonymous voting',
    linkExisting: language === 'fr' ? 'Lier un vote existant' : 'Link existing vote',
    createNew: language === 'fr' ? 'Créer un nouveau vote' : 'Create new vote',
    selectVoteSession: language === 'fr' ? 'Sélectionner un vote' : 'Select a vote',
    noVoteSessions: language === 'fr' ? 'Aucun vote disponible' : 'No votes available',
    unlink: language === 'fr' ? 'Délier' : 'Unlink',
    linkedTo: language === 'fr' ? 'Lié à' : 'Linked to',
    openImmediately: language === 'fr' ? 'Ouvrir le vote immédiatement' : 'Open vote immediately',
  };

  // Movie search query
  const { data: movieSearchResults, isLoading: isSearchingMovies } = useQuery<Array<{
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }>>({
    queryKey: ['movie-search-vote', movieSearchQuery],
    queryFn: async () => {
      if (!movieSearchQuery.trim()) return [];
      return apiClient.get(`/movies/search?query=${encodeURIComponent(movieSearchQuery)}`);
    },
    enabled: movieSearchQuery.length >= 2,
  });

  // Fetch existing vote sessions
  const { data: voteSessions } = useQuery<{ items: VoteSessionSummary[] }>({
    queryKey: ['vote-sessions-list'],
    queryFn: () => apiClient.get('/vote-sessions?limit=50'),
    enabled: showLinkExisting,
  });

  const addMovie = (movie: {
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }) => {
    // Check if already added
    const exists = config.movie_options.some(
      m => (m.movie_id === movie.id) || (m.title === movie.title && m.year === movie.year)
    );
    if (exists) return;

    onChange({
      ...config,
      movie_options: [
        ...config.movie_options,
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

  const removeMovie = (index: number) => {
    onChange({
      ...config,
      movie_options: config.movie_options.filter((_, i) => i !== index),
    });
  };

  const handleLinkVoteSession = (vs: VoteSessionSummary) => {
    if (onLinkVoteSession) {
      onLinkVoteSession(vs.id);
      // Copy movie options from the linked vote session
      if (vs.movie_options) {
        onChange({
          ...config,
          movie_options: vs.movie_options,
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setShowLinkExisting(false);
            if (onLinkVoteSession) onLinkVoteSession(null);
          }}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-2 ${
            !showLinkExisting
              ? 'bg-theatarr-500 border-theatarr-500 text-white'
              : 'border-dark-border text-dark-muted hover:text-dark-text'
          }`}
        >
          <Plus size={14} />
          {t.createNew}
        </button>
        <button
          type="button"
          onClick={() => setShowLinkExisting(true)}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors flex items-center justify-center gap-2 ${
            showLinkExisting
              ? 'bg-theatarr-500 border-theatarr-500 text-white'
              : 'border-dark-border text-dark-muted hover:text-dark-text'
          }`}
        >
          <LinkIcon size={14} />
          {t.linkExisting}
        </button>
      </div>

      {showLinkExisting ? (
        /* Link Existing Vote Session */
        <div className="space-y-3">
          {linkedVoteSessionId ? (
            <div className="p-3 bg-theatarr-500/10 border border-theatarr-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vote size={16} className="text-theatarr-500" />
                  <span className="text-sm text-dark-text">{t.linkedTo}: {linkedVoteSessionId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onLinkVoteSession?.(null)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t.unlink}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm text-dark-muted">{t.selectVoteSession}</label>
              {voteSessions?.items && voteSessions.items.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {voteSessions.items
                    .filter(vs => vs.status === 'draft' || vs.status === 'open')
                    .map(vs => (
                      <button
                        key={vs.id}
                        type="button"
                        onClick={() => handleLinkVoteSession(vs)}
                        className="w-full p-3 bg-dark-bg hover:bg-dark-border/50 border border-dark-border rounded-lg text-left transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Vote size={14} className="text-theatarr-500" />
                          <span className="text-sm font-medium text-dark-text">{vs.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            vs.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {vs.status}
                          </span>
                        </div>
                        <div className="text-xs text-dark-muted mt-1">
                          {vs.movie_options?.length || 0} films - {vs.total_votes} votes
                        </div>
                      </button>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-dark-muted text-center py-4">
                  {t.noVoteSessions}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Create New Vote Session */
        <>
          {/* Movie Search */}
          <div className="space-y-2">
            <label className="text-sm text-dark-muted">{t.addMovies}</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
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
                          onClick={() => addMovie(movie)}
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
                    <div className="p-4 text-center text-dark-muted text-sm">{t.noResults}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Movie Options List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-dark-muted">{t.movieOptions}</label>
              {config.movie_options.length < 2 && (
                <span className="text-xs text-yellow-500">{t.minMovies}</span>
              )}
            </div>
            {config.movie_options.length > 0 ? (
              <div className="space-y-2">
                {config.movie_options.map((movie, index) => (
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
                      onClick={() => removeMovie(index)}
                      className="p-1 text-dark-muted hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-dark-muted text-center py-4 border border-dashed border-dark-border rounded-lg">
                {t.addMovies}
              </div>
            )}
          </div>

          {/* Vote Settings */}
          <div className="space-y-3 pt-2 border-t border-dark-border">
            <h4 className="text-sm font-medium text-dark-text">{t.settings}</h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark-muted">{t.maxVotes}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={config.max_votes_per_user}
                  onChange={(e) => onChange({ ...config, max_votes_per_user: parseInt(e.target.value) || 1 })}
                  className="w-full mt-1 bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-dark-text"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.require_token}
                  onChange={(e) => onChange({ ...config, require_token: e.target.checked })}
                  className="rounded border-dark-border"
                />
                <span className="text-sm text-dark-text">{t.requireToken}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.show_results_during_voting}
                  onChange={(e) => onChange({ ...config, show_results_during_voting: e.target.checked })}
                  className="rounded border-dark-border"
                />
                <span className="text-sm text-dark-text">{t.showResults}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.anonymous_voting}
                  onChange={(e) => onChange({ ...config, anonymous_voting: e.target.checked })}
                  className="rounded border-dark-border"
                />
                <span className="text-sm text-dark-text">{t.anonymous}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.open_immediately || false}
                  onChange={(e) => onChange({ ...config, open_immediately: e.target.checked })}
                  className="rounded border-dark-border"
                />
                <span className="text-sm text-dark-text">{t.openImmediately}</span>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
