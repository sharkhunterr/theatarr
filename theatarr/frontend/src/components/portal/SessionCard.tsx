/**
 * Session card component for portal.
 */

import { Calendar, Check, X, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface SessionCardProps {
  id: string;
  name: string;
  movieTitle?: string | null;
  moviePosterUrl?: string | null;
  status: string;
  scheduledAt?: string | null;
  invitationStatus: string;
}

export function SessionCard({
  id,
  name,
  movieTitle,
  moviePosterUrl,
  status,
  scheduledAt,
  invitationStatus,
}: SessionCardProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-dark-muted/20 text-dark-muted',
    scheduled: 'bg-blue-500/20 text-blue-400',
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-dark-muted/20 text-dark-muted',
    interrupted: 'bg-red-500/20 text-red-400',
  };

  const invitationColors: Record<string, string> = {
    pending: 'text-yellow-400',
    accepted: 'text-green-400',
    declined: 'text-red-400',
  };

  const invitationIcons: Record<string, typeof Check> = {
    pending: Clock,
    accepted: Check,
    declined: X,
  };

  const InvitationIcon = invitationIcons[invitationStatus] || Clock;

  return (
    <Link
      to={`/portal/sessions/${id}`}
      className="block bg-dark-surface rounded-xl border border-dark-border overflow-hidden hover:border-theatarr-500/50 transition-colors"
    >
      <div className="flex">
        {/* Poster */}
        <div className="w-20 h-28 flex-shrink-0 bg-dark-border">
          {moviePosterUrl ? (
            <img
              src={moviePosterUrl}
              alt={movieTitle || name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-dark-muted">
              <Calendar size={24} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <h3 className="font-medium text-dark-text line-clamp-1">{name}</h3>
            {movieTitle && (
              <p className="text-sm text-dark-muted line-clamp-1">{movieTitle}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'text-xs px-2 py-0.5 rounded-full',
                  statusColors[status] || statusColors.draft
                )}
              >
                {status}
              </span>
              <span className={clsx('flex items-center gap-1', invitationColors[invitationStatus])}>
                <InvitationIcon size={14} />
              </span>
            </div>

            {scheduledAt && (
              <span className="text-xs text-dark-muted">
                {formatDate(scheduledAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
