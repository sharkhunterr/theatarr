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
  QrCode,
  BarChart2,
} from 'lucide-react';
import { Button, Card, Modal, Spinner } from '../components/common';
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
  const [selectedSession, setSelectedSession] = useState<VoteSession | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isTokensOpen, setIsTokensOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [tokens, setTokens] = useState<VoteToken[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'draft'>('all');

  const { data, isLoading, error } = useQuery<VoteSessionListResponse>({
    queryKey: ['vote-sessions', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      const response = await apiClient.get(`/vote-sessions${params}`);
      return response.data;
    },
  });

  const openMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/vote-sessions/${sessionId}/open`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vote-sessions'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.post(`/vote-sessions/${sessionId}/close`);
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
      const response = await apiClient.post(`/vote-sessions/${sessionId}/tokens`, {
        count,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTokens(data.items);
    },
  });

  const fetchTokensMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiClient.get(`/vote-sessions/${sessionId}/tokens`);
      return response.data;
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
    if (window.confirm(`Delete vote session "${session.name}"?`)) {
      await deleteMutation.mutateAsync(session.id);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-500';
      case 'closed':
        return 'bg-gray-500';
      case 'draft':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
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
      <div className="p-8">
        <div className="text-red-500">Failed to load vote sessions</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Vote Sessions</h1>
          <p className="text-gray-500 mt-1">Create and manage movie voting sessions</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          <span className="ml-2">Create Vote Session</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'draft', 'open', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSessions?.map((session) => (
          <Card key={session.id}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{session.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs text-white font-medium ${getStatusColor(
                        session.status
                      )}`}
                    >
                      {session.status}
                    </span>
                  </div>
                  {session.description && (
                    <p className="text-gray-400 text-sm mt-1">{session.description}</p>
                  )}
                </div>
              </div>

              {/* Movie options preview */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {session.movie_options.slice(0, 4).map((movie, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 w-12 h-16 rounded bg-gray-700 overflow-hidden"
                  >
                    {movie.poster_url && (
                      <img
                        src={movie.poster_url}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ))}
                {session.movie_options.length > 4 && (
                  <div className="flex-shrink-0 w-12 h-16 rounded bg-gray-700 flex items-center justify-center text-gray-400 text-sm">
                    +{session.movie_options.length - 4}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {session.total_votes} votes
                </span>
                <span>{session.movie_options.length} movies</span>
                {session.closes_at && (
                  <span>Closes: {new Date(session.closes_at).toLocaleDateString()}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                {session.status === 'draft' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMutation.mutate(session.id)}
                    disabled={openMutation.isPending}
                  >
                    <Play size={14} />
                    <span className="ml-1">Open Voting</span>
                  </Button>
                )}

                {session.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => closeMutation.mutate(session.id)}
                    disabled={closeMutation.isPending}
                  >
                    <Square size={14} />
                    <span className="ml-1">Close Voting</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewTokens(session)}
                >
                  <Link2 size={14} />
                  <span className="ml-1">Tokens</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewResults(session)}
                >
                  <BarChart2 size={14} />
                  <span className="ml-1">Results</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(session)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredSessions?.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">No vote sessions found</p>
          <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
            Create Your First Vote Session
          </Button>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Vote Session"
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
        title={`Vote Tokens - ${selectedSession?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Generate tokens */}
          <div className="flex items-center gap-4 mb-6">
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
              <Plus size={14} />
              <span className="ml-1">Generate 5 Tokens</span>
            </Button>
          </div>

          {/* Token list */}
          {tokens.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                >
                  <div>
                    <code className="text-indigo-400 font-mono">{token.token}</code>
                    {token.label && (
                      <span className="text-gray-500 text-sm ml-2">{token.label}</span>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Used: {token.use_count}
                      {token.max_uses && ` / ${token.max_uses}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {token.vote_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.vote_url!)}
                      >
                        <Copy size={14} />
                      </Button>
                    )}
                    <a
                      href={`/vote/${token.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-700 rounded"
                    >
                      <Eye size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No tokens generated yet. Click "Generate Tokens" to create vote links.
            </p>
          )}
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsOpen}
        onClose={() => setIsResultsOpen(false)}
        title={`Results - ${selectedSession?.name}`}
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
  const { data, isLoading } = useQuery({
    queryKey: ['vote-results', session.id],
    queryFn: async () => {
      const response = await apiClient.get(`/vote-sessions/${session.id}/results`);
      return response.data;
    },
  });

  if (isLoading) {
    return <Spinner />;
  }

  if (!data) {
    return <p className="text-gray-500">No results available</p>;
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="text-3xl font-bold text-white">{data.total_votes}</div>
        <div className="text-gray-500">Total Votes</div>
      </div>

      <VoteResults
        movieOptions={session.movie_options}
        voteCounts={data.vote_counts}
        winnerIndex={data.winner_index}
      />
    </div>
  );
}
