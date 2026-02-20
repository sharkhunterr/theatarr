/**
 * Vote session card component for portal.
 */

import { Vote, Check, Clock, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

interface MoviePreview {
  title?: string;
  poster_url?: string;
}

interface VoteCardProps {
  id: string;
  name: string;
  description?: string | null;
  movieOptionsPreview: MoviePreview[];
  hasVoted: boolean;
  closesAt?: string | null;
  status: string;
}

export function VoteCard({
  id,
  name,
  description,
  movieOptionsPreview,
  hasVoted,
  closesAt,
  status,
}: VoteCardProps) {
  const { t } = useTranslation(['portal', 'common']);
  const isOpen = status === 'open';

  const getStatusBadge = () => {
    if (!isOpen) {
      return { text: t('portal:voteCard.status.closed'), color: 'bg-dark-muted/20 text-dark-muted', icon: Lock, pulse: false };
    }
    if (!closesAt) {
      return { text: t('portal:voteCard.status.open'), color: 'bg-green-500/20 text-green-400', icon: Clock, pulse: false };
    }
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) {
      return { text: t('portal:voteCard.status.closed'), color: 'bg-dark-muted/20 text-dark-muted', icon: Lock, pulse: false };
    }
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days >= 2) {
      return { text: t('portal:voteCard.status.daysRemaining', { count: days }), color: 'bg-green-500/20 text-green-400', icon: Clock, pulse: false };
    }
    if (hours >= 6) {
      return { text: t('portal:voteCard.status.hoursRemaining', { count: hours }), color: 'bg-blue-500/20 text-blue-400', icon: Clock, pulse: false };
    }
    if (hours >= 1) {
      const m = minutes % 60;
      return { text: t('portal:voteCard.status.hoursMinutesRemaining', { hours, minutes: m > 0 ? m.toString().padStart(2, '0') : '' }), color: 'bg-orange-500/20 text-orange-400', icon: Clock, pulse: false };
    }
    return { text: t('portal:voteCard.status.minutesRemaining', { count: minutes }), color: 'bg-red-500/20 text-red-400', icon: Clock, pulse: true };
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;
  const showUrgent = isOpen && closesAt && new Date(closesAt).getTime() - Date.now() < 3600000;

  return (
    <Link
      to={`/portal/votes/${id}`}
      className={clsx(
        'block bg-dark-surface rounded-xl border overflow-hidden transition-colors',
        hasVoted
          ? 'border-dark-border'
          : showUrgent
            ? 'border-theatarr-500 ring-1 ring-theatarr-500/50'
            : 'border-dark-border hover:border-theatarr-500/50'
      )}
    >
      {/* Movie posters preview */}
      <div className="flex h-24 bg-dark-border">
        {movieOptionsPreview.slice(0, 3).map((movie, index) => (
          <div
            key={index}
            className={clsx(
              'flex-1 border-r border-dark-bg last:border-r-0',
              movieOptionsPreview.length === 1 && 'max-w-[33%]'
            )}
          >
            {movie.poster_url ? (
              <img
                src={movie.poster_url}
                alt={movie.title || `Option ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-dark-muted">
                <Vote size={20} />
              </div>
            )}
          </div>
        ))}
        {movieOptionsPreview.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-dark-muted">
            <Vote size={24} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-dark-text line-clamp-1">{name}</h3>
            {description && (
              <p className="text-sm text-dark-muted line-clamp-1">{description}</p>
            )}
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Unified status + countdown badge */}
            <span className={clsx(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-full',
              badge.color,
              badge.pulse && 'animate-pulse'
            )}>
              <StatusIcon size={12} />
              {badge.text}
            </span>

            {/* Vote status badge */}
            {hasVoted ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                <Check size={12} />
                {t('portal:voteCard.voted')}
              </span>
            ) : isOpen ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                {t('portal:voteCard.toVote')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                {t('portal:voteCard.notVoted')}
              </span>
            )}</div>
        </div>
      </div>
    </Link>
  );
}
