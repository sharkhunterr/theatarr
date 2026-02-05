import { Link } from 'react-router-dom';
import { Play, Pause, Clock, Film } from 'lucide-react';
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

export function SessionCard({ session, onPlay }: SessionCardProps) {
  const canPlay = session.status === 'draft' || session.status === 'paused';
  const isRunning = session.status === 'running';

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
