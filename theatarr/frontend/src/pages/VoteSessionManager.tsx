import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Play,
  Square,
  Trash2,
  Copy,
  Users,
  Eye,
  Link2,
  BarChart2,
  Vote,
  Calendar,
  Film,
  Check,
} from 'lucide-react';
import { Button, Card, Modal, Spinner } from '../components/common';
import { VoteSessionForm } from '../components/vote/VoteSessionForm';
import { VoteResults } from '../components/vote/VoteResults';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

interface VoteSession {
  id: string;
  name: string;
  description?: string;
  status: string;
  movie_options: Array<{
    title: string;
    year?: number;
    poster_url?: string;
  }>;
  max_votes_per_user: number;
  allow_multiple_votes: boolean;
  require_token: boolean;
  show_results_during_voting: boolean;
  total_votes: number;
  is_open: boolean;
  opens_at?: string;
  closes_at?: string;
  winning_movie_index?: number;
  created_at: string;
}

interface VoteToken {
  id: string;
  token: string;
  label?: string;
  use_count: number;
  max_uses?: number;
  is_valid: boolean;
  vote_url?: string;
}

interface VoteSessionListResponse {
  items: VoteSession[];
  total: number;
}

export function VoteSessionManager() {
  const queryClient = useQueryClient();
  const { language } = useLayoutStore();
  const [selectedSession, setSelectedSession] = useState<VoteSession | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTokensOpen, setIsTokensOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [tokens, setTokens] = useState<VoteToken[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'draft'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const t = {
    title: language === 'fr' ? 'Sessions de vote' : 'Vote Sessions',
    subtitle: language === 'fr' ? 'Créez et gérez les sessions de vote pour vos films' : 'Create and manage movie voting sessions',
    createButton: language === 'fr' ? 'Nouvelle session' : 'New Session',
    all: language === 'fr' ? 'Toutes' : 'All',
    draft: language === 'fr' ? 'Brouillon' : 'Draft',
    open: language === 'fr' ? 'Ouvert' : 'Open',
    closed: language === 'fr' ? 'Fermé' : 'Closed',
    votes: language === 'fr' ? 'votes' : 'votes',
    movies: language === 'fr' ? 'films' : 'movies',
    openVoting: language === 'fr' ? 'Ouvrir' : 'Open',
    closeVoting: language === 'fr' ? 'Fermer' : 'Close',
    tokens: language === 'fr' ? 'Liens' : 'Links',
    results: language === 'fr' ? 'Résultats' : 'Results',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    noSessions: language === 'fr' ? 'Aucune session de vote' : 'No vote sessions',
    createFirst: language === 'fr' ? 'Créer votre première session' : 'Create Your First Session',
    generateTokens: language === 'fr' ? 'Générer 5 liens' : 'Generate 5 Links',
    noTokens: language === 'fr' ? 'Aucun lien généré. Cliquez sur "Générer" pour créer des liens de vote.' : 'No links generated yet. Click "Generate" to create vote links.',
    totalVotes: language === 'fr' ? 'Votes totaux' : 'Total Votes',
    closesAt: language === 'fr' ? 'Ferme le' : 'Closes',
    copied: language === 'fr' ? 'Copié !' : 'Copied!',
  };

  const { data, isLoading, error } = useQuery<VoteSessionListResponse>({
    queryKey: ['vote-sessions', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return await apiClient.get<VoteSessionListResponse>(`/vote-sessions${params}`);
    },
  });

  const openMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/vote-sessions/${sessionId}/open`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vote-sessions'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/vote-sessions/${sessionId}/close`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vote-sessions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(`/vote-sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vote-sessions'] });
    },
  });

  const createTokensMutation = useMutation({
    mutationFn: async ({ sessionId, count }: { sessionId: string; count: number }) => {
      return await apiClient.post<{ items: VoteToken[]; total: number }>(`/vote-sessions/${sessionId}/tokens`, {
        count,
      });
    },
    onSuccess: (data) => {
      setTokens(data.items);
    },
  });

  const fetchTokensMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return await apiClient.get<{ items: VoteToken[]; total: number }>(`/vote-sessions/${sessionId}/tokens`);
    },
    onSuccess: (data) => {
      setTokens(data.items);
    },
  });

  const handleViewTokens = async (session: VoteSession) => {
    setSelectedSession(session);
    await fetchTokensMutation.mutateAsync(session.id);
    setIsTokensOpen(true);
  };

  const handleViewResults = async (session: VoteSession) => {
    setSelectedSession(session);
    setIsResultsOpen(true);
  };

  const handleDelete = async (session: VoteSession) => {
    if (window.confirm(`${language === 'fr' ? 'Supprimer la session' : 'Delete session'} "${session.name}"?`)) {
      await deleteMutation.mutateAsync(session.id);
    }
  };

  const copyToClipboard = (text: string, tokenId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-dark-muted/20 text-dark-muted border-dark-muted/30',
      draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return styles[status as keyof typeof styles] || styles.draft;
  };

  const filteredSessions = data?.items;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {language === 'fr' ? 'Erreur lors du chargement des sessions' : 'Failed to load vote sessions'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{t.title}</h1>
          <p className="text-dark-muted text-sm mt-1">{t.subtitle}</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} className="mr-2" />
          {t.createButton}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {([
          { key: 'all', label: t.all },
          { key: 'draft', label: t.draft },
          { key: 'open', label: t.open },
          { key: 'closed', label: t.closed },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions List */}
      {filteredSessions && filteredSessions.length > 0 ? (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="overflow-hidden">
              <div className="p-4 sm:p-6">
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Movie Posters Preview */}
                  <div className="flex gap-1 flex-shrink-0">
                    {session.movie_options.slice(0, 3).map((movie, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-18 sm:w-14 sm:h-20 rounded bg-dark-border overflow-hidden flex-shrink-0"
                      >
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
                    ))}
                    {session.movie_options.length > 3 && (
                      <div className="w-12 h-18 sm:w-14 sm:h-20 rounded bg-dark-border flex items-center justify-center text-dark-muted text-sm font-medium flex-shrink-0">
                        +{session.movie_options.length - 3}
                      </div>
                    )}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-dark-text truncate">
                        {session.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                          session.status
                        )}`}
                      >
                        {session.status === 'draft' ? t.draft : session.status === 'open' ? t.open : t.closed}
                      </span>
                    </div>
                    {session.description && (
                      <p className="text-dark-muted text-sm mb-2 line-clamp-1">{session.description}</p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-dark-muted">
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {session.total_votes} {t.votes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Film size={14} />
                        {session.movie_options.length} {t.movies}
                      </span>
                      {session.closes_at && (
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {t.closesAt} {new Date(session.closes_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-dark-border">
                  {session.status === 'draft' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openMutation.mutate(session.id)}
                      disabled={openMutation.isPending}
                    >
                      <Play size={14} className="mr-1" />
                      {t.openVoting}
                    </Button>
                  )}

                  {session.status === 'open' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => closeMutation.mutate(session.id)}
                      disabled={closeMutation.isPending}
                    >
                      <Square size={14} className="mr-1" />
                      {t.closeVoting}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewTokens(session)}
                  >
                    <Link2 size={14} className="mr-1" />
                    {t.tokens}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewResults(session)}
                  >
                    <BarChart2 size={14} className="mr-1" />
                    {t.results}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(session)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Vote size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">{t.noSessions}</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} className="mr-2" />
            {t.createFirst}
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={language === 'fr' ? 'Nouvelle session de vote' : 'New Vote Session'}
        size="lg"
      >
        <VoteSessionForm
          onSave={() => {
            setIsCreateOpen(false);
            queryClient.invalidateQueries({ queryKey: ['vote-sessions'] });
          }}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* Tokens Modal */}
      <Modal
        isOpen={isTokensOpen}
        onClose={() => {
          setIsTokensOpen(false);
          setTokens([]);
        }}
        title={`${t.tokens} - ${selectedSession?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Generate tokens */}
          <div className="flex items-center gap-4 pb-4 border-b border-dark-border">
            <Button
              onClick={() => {
                if (selectedSession) {
                  createTokensMutation.mutate({
                    sessionId: selectedSession.id,
                    count: 5,
                  });
                }
              }}
              disabled={createTokensMutation.isPending}
            >
              <Plus size={14} className="mr-2" />
              {t.generateTokens}
            </Button>
          </div>

          {/* Token list */}
          {tokens.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 bg-dark-surface rounded-lg border border-dark-border"
                >
                  <div className="min-w-0 flex-1">
                    <code className="text-theatarr-500 font-mono text-sm">{token.token}</code>
                    {token.label && (
                      <span className="text-dark-muted text-sm ml-2">{token.label}</span>
                    )}
                    <div className="text-xs text-dark-muted mt-1">
                      {language === 'fr' ? 'Utilisé' : 'Used'}: {token.use_count}
                      {token.max_uses && ` / ${token.max_uses}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {token.vote_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.vote_url!, token.id)}
                        className={copiedToken === token.id ? 'text-green-400' : ''}
                      >
                        {copiedToken === token.id ? (
                          <>
                            <Check size={14} className="mr-1" />
                            {t.copied}
                          </>
                        ) : (
                          <Copy size={14} />
                        )}
                      </Button>
                    )}
                    <a
                      href={`/vote/${token.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-dark-border rounded transition-colors"
                    >
                      <Eye size={14} className="text-dark-muted" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-muted text-center py-8">
              {t.noTokens}
            </p>
          )}
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        title={`${t.results} - ${selectedSession?.name}`}
        size="lg"
      >
        {selectedSession && (
          <VoteResultsAdmin session={selectedSession} language={language} />
        )}
      </Modal>
    </div>
  );
}

// Admin results view with more details
function VoteResultsAdmin({ session, language }: { session: VoteSession; language: 'en' | 'fr' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vote-results', session.id],
    queryFn: async () => {
      return await apiClient.get<{ total_votes: number; vote_counts: Record<string, number>; winner_index?: number }>(`/vote-sessions/${session.id}/results`);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return <p className="text-dark-muted text-center py-8">{language === 'fr' ? 'Aucun résultat disponible' : 'No results available'}</p>;
  }

  return (
    <div>
      <div className="mb-6 text-center p-4 bg-dark-surface rounded-lg">
        <div className="text-4xl font-bold text-dark-text">{data.total_votes}</div>
        <div className="text-dark-muted">{language === 'fr' ? 'Votes totaux' : 'Total Votes'}</div>
      </div>

      <VoteResults
        movieOptions={session.movie_options}
        voteCounts={data.vote_counts}
        winnerIndex={data.winner_index}
      />
    </div>
  );
}
