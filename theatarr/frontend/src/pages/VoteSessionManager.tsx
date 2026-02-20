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
import { useTranslation } from 'react-i18next';
import { Button, Card, Modal, Spinner, ButtonGroup } from '../components/common';
import { VoteSessionForm } from '../components/vote/VoteSessionForm';
import { VoteResults } from '../components/vote/VoteResults';
import { apiClient } from '../api/client';

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
  linked_session_id?: string;
  linked_session_name?: string;
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

interface VoteSessionManagerProps {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

export function VoteSessionManager({ createOpen, onCreateOpenChange }: VoteSessionManagerProps = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['votes', 'common']);
  const [selectedSession, setSelectedSession] = useState<VoteSession | null>(null);
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const isCreateOpen = createOpen ?? internalCreateOpen;
  const setIsCreateOpen = onCreateOpenChange ?? setInternalCreateOpen;
  const [isTokensOpen, setIsTokensOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [tokens, setTokens] = useState<VoteToken[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'draft'>('all');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<VoteSessionListResponse>({
    queryKey: ['vote-sessions', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return await apiClient.get<VoteSessionListResponse>(`/vote-sessions${params}`);
    },
    refetchInterval: 15000,
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
    if (window.confirm(`${t('votes:voteManager.deleteConfirm')} "${session.name}"?`)) {
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
          {t('votes:voteManager.loadError')}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'all' as const, label: t('votes:voteManager.all') },
            { key: 'draft' as const, label: t('votes:voteManager.draft') },
            { key: 'open' as const, label: t('votes:voteManager.open') },
            { key: 'closed' as const, label: t('votes:voteManager.closed') },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Sessions List */}
      {filteredSessions && filteredSessions.length > 0 ? (
        <div className="space-y-2">
          {filteredSessions.map((session) => (
            <Card key={session.id} className="overflow-hidden">
              <div className="p-3">
                {/* Header Row */}
                <div className="flex items-start gap-3">
                  {/* Movie Posters Preview */}
                  <div className="flex gap-0.5 flex-shrink-0">
                    {session.movie_options.slice(0, 3).map((movie, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-14 rounded bg-dark-border overflow-hidden flex-shrink-0"
                      >
                        {movie.poster_url ? (
                          <img
                            src={movie.poster_url}
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={12} className="text-dark-muted" />
                          </div>
                        )}
                      </div>
                    ))}
                    {session.movie_options.length > 3 && (
                      <div className="w-10 h-14 rounded bg-dark-border flex items-center justify-center text-dark-muted text-xs font-medium flex-shrink-0">
                        +{session.movie_options.length - 3}
                      </div>
                    )}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-semibold text-dark-text truncate">
                        {session.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                          session.status
                        )}`}
                      >
                        {session.status === 'draft' ? t('votes:voteManager.draft') : session.status === 'open' ? t('votes:voteManager.open') : t('votes:voteManager.closed')}
                      </span>
                      {session.linked_session_id && (
                        <a
                          href={`/sessions/${session.linked_session_id}`}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-theatarr-500/20 text-theatarr-400 border border-theatarr-500/30 hover:bg-theatarr-500/30 transition-colors"
                          title={session.linked_session_name || t('votes:voteManager.linkedToSession')}
                        >
                          <Link2 size={10} />
                          {session.linked_session_name || t('votes:voteManager.linkedToSession')}
                        </a>
                      )}
                    </div>
                    {session.description && (
                      <p className="text-dark-muted text-sm mb-2 line-clamp-1">{session.description}</p>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-dark-muted">
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {session.total_votes} {t('votes:voteManager.votes')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Film size={14} />
                        {session.movie_options.length} {t('votes:voteManager.movies')}
                      </span>
                      {session.closes_at && (
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {(() => {
                            const diff = new Date(session.closes_at).getTime() - Date.now();
                            if (diff <= 0 || session.status !== 'open') {
                              return `${t('votes:voteManager.closesAt')} ${new Date(session.closes_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`;
                            }
                            const h = Math.floor(diff / 3600000);
                            const m = Math.floor((diff % 3600000) / 60000);
                            if (h > 24) {
                              const d = Math.floor(h / 24);
                              return t('votes:voteManager.closesInDays', { days: d });
                            }
                            return h > 0 ? t('votes:voteManager.closesInHours', { hours: h, minutes: m }) : t('votes:voteManager.closesInMinutes', { minutes: m });
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dark-border">
                  {session.status === 'draft' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openMutation.mutate(session.id)}
                      disabled={openMutation.isPending}
                    >
                      <Play size={14} className="mr-1" />
                      {t('votes:voteManager.openVoting')}
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
                      {t('votes:voteManager.closeVoting')}
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewTokens(session)}
                  >
                    <Link2 size={14} className="mr-1" />
                    {t('votes:voteManager.tokens')}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewResults(session)}
                  >
                    <BarChart2 size={14} className="mr-1" />
                    {t('votes:voteManager.results')}
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
        <Card className="p-8 text-center">
          <Vote size={32} className="mx-auto text-dark-muted mb-3" />
          <p className="text-sm text-dark-muted mb-3">{t('votes:voteManager.noSessions')}</p>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} className="mr-1" />
            {t('votes:voteManager.createFirst')}
          </Button>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('votes:voteManager.newVoteTitle')}
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
        title={`${t('votes:voteManager.tokens')} - ${selectedSession?.name}`}
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
              {t('votes:voteManager.generateTokens')}
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
                      {t('votes:voteManager.used')}: {token.use_count}
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
                            {t('votes:voteManager.copied')}
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
              {t('votes:voteManager.noTokens')}
            </p>
          )}
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        title={`${t('votes:voteManager.results')} - ${selectedSession?.name}`}
        size="lg"
      >
        {selectedSession && (
          <VoteResultsAdmin session={selectedSession} />
        )}
      </Modal>
    </div>
  );
}

// Admin results view with more details
function VoteResultsAdmin({ session }: { session: VoteSession }) {
  const { t } = useTranslation(['votes']);
  const { data, isLoading } = useQuery({
    queryKey: ['vote-results', session.id],
    queryFn: async () => {
      return await apiClient.get<{ total_votes: number; vote_counts: Record<string, number>; winner_index?: number }>(`/vote-sessions/${session.id}/results`);
    },
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!data) {
    return <p className="text-dark-muted text-center py-8">{t('votes:voteManager.noResultsAvailable')}</p>;
  }

  return (
    <div>
      <div className="mb-6 text-center p-4 bg-dark-surface rounded-lg">
        <div className="text-4xl font-bold text-dark-text">{data.total_votes}</div>
        <div className="text-dark-muted">{t('votes:voteManager.totalVotes')}</div>
      </div>

      <VoteResults
        movieOptions={session.movie_options}
        voteCounts={data.vote_counts}
        winnerIndex={data.winner_index}
      />
    </div>
  );
}
