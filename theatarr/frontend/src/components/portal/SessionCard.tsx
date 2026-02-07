/**
 * Session card component for portal.
 */

import { Calendar, Check, X, Clock, Vote, Shuffle, Trophy, Sparkles, Film } from 'lucide-react';
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
  movieSelectionMode?: string | null;
  movieResolved?: boolean;
  linkedVoteSessionId?: string | null;
  linkedVoteIsOpen?: boolean | null;
}

export function SessionCard({
  id,
  name,
  movieTitle,
  moviePosterUrl,
  status,
  scheduledAt,
  invitationStatus,
  movieSelectionMode,
  movieResolved,
  linkedVoteSessionId,
  linkedVoteIsOpen,
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

  // Invitation status configuration
  const invitationConfig: Record<string, {
    borderColor: string;
    bgColor: string;
    textColor: string;
    icon: typeof Check;
    label: string;
  }> = {
    pending: {
      borderColor: 'border-l-yellow-500',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400',
      icon: Clock,
      label: 'En attente',
    },
    accepted: {
      borderColor: 'border-l-green-500',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400',
      icon: Check,
      label: 'Acceptee',
    },
    declined: {
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-500/20',
      textColor: 'text-red-400',
      icon: X,
      label: 'Refusee',
    },
  };

  const invitation = invitationConfig[invitationStatus] || invitationConfig.pending;
  const InvitationIcon = invitation.icon;

  // Only show vote link if invitation is accepted
  const canVote = invitationStatus === 'accepted';

  // Get movie display info based on selection mode
  const getMovieDisplayInfo = () => {
    const mode = movieSelectionMode || 'fixed';

    if (mode === 'vote') {
      if (movieResolved && movieTitle) {
        return {
          text: movieTitle,
          icon: <Trophy size={14} className="text-yellow-500" />,
          showVoteLink: false,
        };
      }
      return {
        text: 'En attente du vote',
        icon: <Vote size={14} className="text-blue-400" />,
        showVoteLink: canVote && linkedVoteSessionId && linkedVoteIsOpen,
      };
    }

    if (mode === 'mystery') {
      if (movieResolved && movieTitle) {
        return {
          text: movieTitle,
          icon: <Sparkles size={14} className="text-purple-400" />,
          showVoteLink: false,
        };
      }
      return {
        text: 'Film mystere',
        icon: <Shuffle size={14} className="text-purple-400 animate-pulse" />,
        showVoteLink: false,
      };
    }

    // Fixed mode
    return {
      text: movieTitle || 'Film non selectionne',
      icon: <Film size={14} className="text-dark-muted" />,
      showVoteLink: false,
    };
  };

  const movieInfo = getMovieDisplayInfo();

  return (
    <Link
      to={`/portal/sessions/${id}`}
      className={clsx(
        'block bg-dark-surface rounded-xl border border-dark-border overflow-hidden hover:border-theatarr-500/50 transition-colors',
        'border-l-4',
        invitation.borderColor
      )}
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-dark-text line-clamp-1">{name}</h3>
              {/* Invitation badge */}
              <span className={clsx(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                invitation.bgColor,
                invitation.textColor,
                invitationStatus === 'pending' && 'animate-blink'
              )}>
                <InvitationIcon size={12} />
                {invitation.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {movieInfo.icon}
              <p className="text-sm text-dark-muted line-clamp-1">{movieInfo.text}</p>
            </div>
            {movieInfo.showVoteLink && linkedVoteSessionId && (
              <Link
                to={`/portal/votes/${linkedVoteSessionId}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-theatarr-500/20 text-theatarr-400 border border-theatarr-500/30 hover:bg-theatarr-500/30 transition-colors"
              >
                <Vote size={10} />
                Voter maintenant
              </Link>
            )}
            {/* Message if vote requires acceptance first */}
            {!canVote && movieSelectionMode === 'vote' && !movieResolved && linkedVoteSessionId && linkedVoteIsOpen && (
              <p className="text-xs text-yellow-400 mt-1.5">
                Acceptez l'invitation pour voter
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full',
                statusColors[status] || statusColors.draft
              )}
            >
              {status}
            </span>

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
