import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Film } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MovieVoteCard } from '../components/vote/MovieVoteCard';
import { VoteResults } from '../components/vote/VoteResults';
import { useWebSocket } from '../hooks/useWebSocket';
import { Spinner } from '../components/common';
import { API_BASE } from '../api/client';

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

interface VoteSessionPublic {
  id: string;
  name: string;
  description?: string;
  movie_options: MovieOption[];
  is_open: boolean;
  show_results_during_voting: boolean;
  allow_multiple_votes: boolean;
  max_votes_per_user: number;
  closes_at?: string;
  results?: Record<number, number>;
}

export function VotePage() {
  const { t } = useTranslation(['votes', 'common']);
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedIndices, setVotedIndices] = useState<number[]>([]);
  const [localResults, setLocalResults] = useState<Record<number, number>>({});

  // Fetch vote session
  const { data: session, isLoading, error } = useQuery<VoteSessionPublic>({
    queryKey: ['vote-session', token],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/vote/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to load vote session');
      }
      return response.json();
    },
    enabled: !!token,
  });

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket({
    autoConnect: !!session?.show_results_during_voting,
    onMessage: (message) => {
      if (message.type === 'vote_cast' && message.payload?.vote_session_id === session?.id) {
        setLocalResults(message.payload.results?.vote_counts || {});
      } else if (message.type === 'vote_closed' && message.payload?.vote_session_id === session?.id) {
        queryClient.invalidateQueries({ queryKey: ['vote-session', token] });
      }
    },
  });

  // Subscribe to vote channel when session loads
  useEffect(() => {
    if (session?.show_results_during_voting && session?.results) {
      setLocalResults(session.results);
    }
  }, [session]);

  // Cast vote mutation
  const voteMutation = useMutation({
    mutationFn: async (movieIndex: number) => {
      const response = await fetch(`${API_BASE}/api/v1/vote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movie_index: movieIndex }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to cast vote');
      }
      return response.json();
    },
    onSuccess: (_, movieIndex) => {
      setHasVoted(true);
      setVotedIndices((prev) => [...prev, movieIndex]);
      setSelectedIndex(null);

      // Optimistically update local results
      setLocalResults((prev) => ({
        ...prev,
        [movieIndex]: (prev[movieIndex] || 0) + 1,
      }));
    },
  });

  const handleVote = () => {
    if (selectedIndex !== null) {
      voteMutation.mutate(selectedIndex);
    }
  };

  const canVoteMore =
    session?.allow_multiple_votes && votedIndices.length < session.max_votes_per_user;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <Film size={48} className="mx-auto text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{t('votes:votePage.invalidLink')}</h1>
          <p className="text-gray-400">
            {error instanceof Error ? error.message : t('votes:votePage.invalidLinkMessage')}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const results = session.show_results_during_voting ? localResults : undefined;
  const totalVotes = results
    ? Object.values(results).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(to bottom, #1a1a2e 0%, #0f0f1a 100%)',
      }}
    >
      {/* Header */}
      <header className="p-6 text-center border-b border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">{session.name}</h1>
        {session.description && (
          <p className="text-gray-400 max-w-2xl mx-auto">{session.description}</p>
        )}

        {/* Status */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {session.is_open ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400 text-sm">{t('votes:votePage.votingOpen')}</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-400 text-sm">{t('votes:votePage.votingClosed')}</span>
            </>
          )}

          {session.closes_at && session.is_open && (
            <span className="text-gray-500 text-sm ml-4 flex items-center gap-1">
              <Clock size={14} />
              {t('votes:votePage.closes')} {new Date(session.closes_at).toLocaleString()}
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Voted confirmation */}
        {hasVoted && !canVoteMore && (
          <div className="mb-8 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
            <Check size={24} className="mx-auto text-green-500 mb-2" />
            <p className="text-green-400 font-medium">{t('votes:votePage.voteRecorded')}</p>
            {session.show_results_during_voting && (
              <p className="text-gray-400 text-sm mt-1">
                {t('votes:votePage.watchResults')}
              </p>
            )}
          </div>
        )}

        {/* Vote more message */}
        {hasVoted && canVoteMore && (
          <div className="mb-8 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-center">
            <p className="text-indigo-400 font-medium">
              {t('votes:votePage.voteRecordedMore', { remaining: session.max_votes_per_user - votedIndices.length })}
            </p>
          </div>
        )}

        {/* Movie Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {session.movie_options.map((movie, index) => (
            <MovieVoteCard
              key={index}
              movie={movie}
              index={index}
              isSelected={selectedIndex === index}
              hasVoted={votedIndices.includes(index)}
              voteCount={results?.[index]}
              totalVotes={totalVotes}
              showResults={!!results}
              disabled={!session.is_open || (hasVoted && !canVoteMore)}
              onClick={() => {
                if (session.is_open && (!hasVoted || canVoteMore)) {
                  setSelectedIndex(selectedIndex === index ? null : index);
                }
              }}
            />
          ))}
        </div>

        {/* Vote Button */}
        {session.is_open && (!hasVoted || canVoteMore) && (
          <div className="text-center">
            <button
              onClick={handleVote}
              disabled={selectedIndex === null || voteMutation.isPending}
              className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all ${
                selectedIndex !== null
                  ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {voteMutation.isPending
                ? t('votes:votePage.submitting')
                : selectedIndex !== null
                ? t('votes:votePage.voteFor', { title: session.movie_options[selectedIndex].title })
                : t('votes:votePage.selectMovie')}
            </button>

            {voteMutation.error && (
              <p className="mt-4 text-red-400">
                {voteMutation.error instanceof Error
                  ? voteMutation.error.message
                  : t('votes:votePage.voteError')}
              </p>
            )}
          </div>
        )}

        {/* Results Section */}
        {results && Object.keys(results).length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">
              {t('votes:votePage.currentResults')}
            </h2>
            <VoteResults
              movieOptions={session.movie_options}
              voteCounts={results}
              winnerIndex={!session.is_open ? Object.entries(results).reduce(
                (max, [idx, count]) => (count > (results[max] || 0) ? parseInt(idx) : max),
                0
              ) : undefined}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-gray-600 text-sm">
        {t('votes:votePage.poweredBy')}
      </footer>
    </div>
  );
}
