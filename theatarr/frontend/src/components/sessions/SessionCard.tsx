import { Link } from 'react-router-dom';
import { Play, Pause, Clock, Film, Vote, Shuffle, Trophy, Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../common';
import { Session, SessionStatus } from '../../stores/sessionStore';
import { formatDistanceToNow } from 'date-fns';

interface SessionCardProps {
  session: Session;
  onPlay?: () => void;
}

const statusColors: Record<SessionStatus, string> = {
  draft: 'bg-gray-500',
  scheduled: 'bg-blue-500',
  running: 'bg-green-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-purple-500',
  interrupted: 'bg-red-500',
};

const statusLabels: Record<SessionStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  interrupted: 'Interrupted',
};

function getMovieDisplayInfo(session: Session): {
  text: string;
  icon: React.ReactNode;
  className: string;
} {
  const mode = session.movie_selection_mode || 'fixed';

  if (mode === 'fixed') {
    if (session.movie_title) {
      return {
        text: session.movie_title,
        icon: <Film size={14} />,
        className: 'text-dark-text',
      };
    }
    return {
      text: 'No movie selected',
      icon: <Film size={14} />,
      className: 'text-dark-muted',
    };
  }

  if (mode === 'vote') {
    if (session.movie_resolved && session.movie_title) {
      return {
        text: session.movie_title,
        icon: <Trophy size={14} className="text-yellow-500" />,
        className: 'text-dark-text',
      };
    }
    return {
      text: 'Awaiting vote results',
      icon: <Vote size={14} className="text-blue-400" />,
      className: 'text-blue-400',
    };
  }

  if (mode === 'mystery') {
    if (session.movie_resolved && session.movie_title) {
      return {
        text: session.movie_title,
        icon: <Sparkles size={14} className="text-purple-400" />,
        className: 'text-dark-text',
      };
    }
    return {
      text: 'Mystery movie',
      icon: <Shuffle size={14} className="text-purple-400 animate-pulse" />,
      className: 'text-purple-400',
    };
  }

  return {
    text: 'Unknown',
    icon: <Film size={14} />,
    className: 'text-dark-muted',
  };
}

export function SessionCard({ session, onPlay }: SessionCardProps) {
  const canPlay = session.status === 'draft' || session.status === 'paused';
  const isRunning = session.status === 'running';
  const movieInfo = getMovieDisplayInfo(session);

  return (
    <Card variant="interactive" className="group">
      <CardContent className="p-0">
        <Link to={`/sessions/${session.id}`} className="block p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-dark-text truncate">
                {session.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-dark-muted">
                <Film size={14} />
                <span>{session.total_sequences} sequences</span>
              </div>
              {/* Movie display based on selection mode */}
              <div className={`flex items-center gap-2 mt-1 text-sm ${movieInfo.className}`}>
                {movieInfo.icon}
                <span className="truncate">{movieInfo.text}</span>
              </div>
              {/* Vote session link badge */}
              {session.linked_vote_session_id && (
                <Link
                  to={`/votes`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                >
                  <Vote size={12} />
                  {session.movie_resolved ? 'Vote terminé' : 'Voter'}
                  <ExternalLink size={10} />
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${statusColors[session.status]}`}
              >
                {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                {statusLabels[session.status]}
              </span>
            </div>
          </div>

          {session.scheduled_at && session.status === 'scheduled' && (
            <div className="flex items-center gap-1 mt-2 text-sm text-dark-muted">
              <Clock size={14} />
              <span>
                Scheduled {formatDistanceToNow(new Date(session.scheduled_at), { addSuffix: true })}
              </span>
            </div>
          )}

          {isRunning && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm text-dark-muted mb-1">
                <span>
                  Sequence {session.current_sequence_index + 1} of {session.total_sequences}
                </span>
              </div>
              <div className="w-full bg-dark-border rounded-full h-1.5">
                <div
                  className="bg-theatarr-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${((session.current_sequence_index + 1) / session.total_sequences) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </Link>

        {(canPlay || isRunning) && (
          <div className="px-4 pb-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                onPlay?.();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-theatarr-600 text-white hover:bg-theatarr-700 transition-colors"
            >
              {isRunning ? (
                <>
                  <Pause size={18} />
                  Pause
                </>
              ) : (
                <>
                  <Play size={18} />
                  {session.status === 'paused' ? 'Resume' : 'Start'}
                </>
              )}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
