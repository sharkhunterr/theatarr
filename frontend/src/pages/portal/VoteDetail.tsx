/**
 * Vote detail page with voting interface.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Clock, Lock, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
}

interface VoteSessionDetail {
  id: string;
  name: string;
  description: string | null;
  movie_options: MovieOption[];
  has_voted: boolean;
  my_vote_index: number | null;
  show_results: boolean;
  results: Record<number, number> | null;
  closes_at: string | null;
  status: string;
  is_open: boolean;
}

export function VoteDetail() {
  const { t } = useTranslation(['portal', 'common']);
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: vote, isLoading } = useQuery({
    queryKey: ['portal', 'votes', id],
    queryFn: () => apiClient.get<VoteSessionDetail>(`/portal/votes/${id}`),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const castVoteMutation = useMutation({
    mutationFn: (movieIndex: number) =>
      apiClient.post(`/portal/votes/${id}/cast`, { movie_index: movieIndex }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'votes'] });
    },
  });

  const handleVote = async () => {
    if (selectedIndex === null) return;
    await castVoteMutation.mutateAsync(selectedIndex);
  };

  const getStatusBadge = () => {
    if (!vote?.is_open) {
      return { text: t('portal:voteDetail.status.closed'), color: 'bg-dark-muted/20 text-dark-muted', icon: Lock, pulse: false };
    }
    if (!vote?.closes_at) {
      return { text: t('portal:voteDetail.status.open'), color: 'bg-green-500/20 text-green-400', icon: Clock, pulse: false };
    }
    const diff = new Date(vote.closes_at).getTime() - Date.now();
    if (diff <= 0) {
      return { text: t('portal:voteDetail.status.closed'), color: 'bg-dark-muted/20 text-dark-muted', icon: Lock, pulse: false };
    }
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 2) {
      return { text: t('portal:voteDetail.status.daysRemaining', { count: days }), color: 'bg-green-500/20 text-green-400', icon: Clock, pulse: false };
    }
    if (hours >= 6) {
      return { text: t('portal:voteDetail.status.hoursRemaining', { count: hours }), color: 'bg-blue-500/20 text-blue-400', icon: Clock, pulse: false };
    }
    if (hours >= 1) {
      const m = minutes % 60;
      return { text: t('portal:voteDetail.status.hoursMinutesRemaining', { hours, minutes: m > 0 ? m.toString().padStart(2, '0') : '' }), color: 'bg-orange-500/20 text-orange-400', icon: Clock, pulse: false };
    }
    return { text: t('portal:voteDetail.status.minutesRemaining', { count: minutes }), color: 'bg-red-500/20 text-red-400', icon: Clock, pulse: true };
  };

  const getTotalVotes = () => {
    if (!vote?.results) return 0;
    return Object.values(vote.results).reduce((sum, count) => sum + count, 0);
  };

  const getVotePercentage = (index: number) => {
    if (!vote?.results) return 0;
    const total = getTotalVotes();
    if (total === 0) return 0;
    return Math.round(((vote.results[index] || 0) / total) * 100);
  };

  const getWinnerIndex = () => {
    if (!vote?.results) return null;
    let maxVotes = 0;
    let winner = null;
    for (const [idx, count] of Object.entries(vote.results)) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = parseInt(idx);
      }
    }
    return winner;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-dark-surface rounded animate-pulse" />
        <div className="h-48 bg-dark-surface rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-dark-surface rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!vote) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-muted">{t('portal:voteDetail.notFound')}</p>
        <Link to="/portal/votes" className="text-theatarr-500 hover:underline mt-2 inline-block">
          {t('portal:voteDetail.backToVotes')}
        </Link>
      </div>
    );
  }

  const winnerIndex = getWinnerIndex();

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/portal/votes"
        className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
      >
        <ArrowLeft size={18} />
        <span>{t('portal:voteDetail.back')}</span>
      </Link>

      {/* Header */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h1 className="text-xl font-bold text-dark-text">{vote.name}</h1>
        {vote.description && (
          <p className="text-dark-muted mt-1">{vote.description}</p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(() => {
            const badge = getStatusBadge();
            const BadgeIcon = badge.icon;
            return (
              <span className={clsx(
                'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full',
                badge.color,
                badge.pulse && 'animate-pulse'
              )}>
                <BadgeIcon size={12} />
                {badge.text}
              </span>
            );
          })()}
          {vote.has_voted ? (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400">
              <Check size={12} />
              {t('portal:voteDetail.voted')}
            </span>
          ) : vote.is_open ? (
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
              {t('portal:voteDetail.toVote')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Voting interface or Results */}
      <div className="grid grid-cols-2 gap-3">
        {vote.movie_options.map((movie, index) => {
          const isSelected = selectedIndex === index;
          const isMyVote = vote.my_vote_index === index;
          const isWinner = winnerIndex === index && !vote.is_open;
          const percentage = getVotePercentage(index);

          return (
            <button
              key={index}
              onClick={() => {
                if (!vote.has_voted && vote.is_open) {
                  setSelectedIndex(index);
                }
              }}
              disabled={vote.has_voted || !vote.is_open}
              className={clsx(
                'relative bg-dark-surface rounded-xl border overflow-hidden text-left transition-all',
                isSelected && 'ring-2 ring-theatarr-500 border-theatarr-500',
                isMyVote && 'border-green-500',
                isWinner && 'border-yellow-500',
                !vote.has_voted && vote.is_open && !isSelected && 'border-dark-border hover:border-theatarr-500/50',
                (vote.has_voted || !vote.is_open) && 'border-dark-border cursor-default'
              )}
            >
              {/* Poster */}
              <div className="aspect-[2/3] bg-dark-border">
                {movie.poster_url ? (
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-dark-muted text-xs p-2 text-center">
                    {movie.title}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <h3 className="font-medium text-dark-text text-sm line-clamp-1">
                  {movie.title}
                </h3>
                {movie.year && (
                  <p className="text-xs text-dark-muted">{movie.year}</p>
                )}

                {/* Results bar */}
                {vote.show_results && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-dark-muted">{vote.results?.[index] || 0} {t('portal:voteDetail.votes')}</span>
                      <span className="text-dark-text font-medium">{percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          isWinner ? 'bg-yellow-500' : isMyVote ? 'bg-green-500' : 'bg-theatarr-500'
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Badges */}
              {isMyVote && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              )}
              {isWinner && (
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                  <Trophy size={14} className="text-white" />
                </div>
              )}
              {isSelected && !vote.has_voted && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-theatarr-500 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Vote button */}
      {!vote.has_voted && vote.is_open && (
        <button
          onClick={handleVote}
          disabled={selectedIndex === null || castVoteMutation.isPending}
          className={clsx(
            'w-full py-4 rounded-xl font-medium text-lg transition-all',
            selectedIndex !== null
              ? 'bg-theatarr-500 text-white hover:bg-theatarr-600'
              : 'bg-dark-surface text-dark-muted border border-dark-border cursor-not-allowed'
          )}
        >
          {castVoteMutation.isPending
            ? t('portal:voteDetail.votingInProgress')
            : selectedIndex !== null
              ? t('portal:voteDetail.voteFor', { title: vote.movie_options[selectedIndex].title })
              : t('portal:voteDetail.selectMovie')}
        </button>
      )}

      {/* Total votes */}
      {vote.show_results && (
        <p className="text-center text-sm text-dark-muted">
          {getTotalVotes() !== 1
            ? t('portal:voteDetail.totalVotesPlural', { count: getTotalVotes() })
            : t('portal:voteDetail.totalVotes', { count: getTotalVotes() })}
        </p>
      )}
    </div>
  );
}
