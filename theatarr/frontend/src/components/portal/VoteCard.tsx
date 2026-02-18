/**
 * Vote session card component for portal.
 */

import { Vote, Check, Clock, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

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
  const formatTimeRemaining = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return 'Closed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}j restants`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m restants`;
    }
    return `${minutes}m restants`;
  };

  const isOpen = status === 'open';
  const showUrgent = isOpen && closesAt && new Date(closesAt).getTime() - Date.now() < 3600000; // < 1 hour

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
            {/* Session status badge */}
            {isOpen ? (
              <span className={clsx(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-full',
                showUrgent
                  ? 'bg-theatarr-500/20 text-theatarr-400 animate-pulse'
                  : 'bg-blue-500/20 text-blue-400'
              )}>
                <Clock size={12} />
                Ouvert
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-dark-muted/20 text-dark-muted">
                <Lock size={12} />
                Cloture
              </span>
            )}

            {/* Vote status badge */}
            {hasVoted ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                <Check size={12} />
                Vote
              </span>
            ) : isOpen ? (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                A voter
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                Non vote
              </span>
            )}</div>
        </div>

        {/* Time remaining */}
        {isOpen && closesAt && (
          <p className={clsx(
            'text-xs mt-2',
            showUrgent ? 'text-theatarr-400' : 'text-dark-muted'
          )}>
            {formatTimeRemaining(closesAt)}
          </p>
        )}
      </div>
    </Link>
  );
}
