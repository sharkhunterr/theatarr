import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common';
import { SessionCard } from './SessionCard';
import { useSessionStore } from '../../stores/sessionStore';
import { useSession } from '../../hooks/useSession';

export function SessionList() {
  const { sessions } = useSessionStore();
  const { fetchSessions, play, pause } = useSession();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handlePlayPause = async (sessionId: string, currentStatus: string) => {
    // Set the session as current before controlling
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      useSessionStore.getState().setCurrentSession(session);
      if (currentStatus === 'running') {
        await pause();
      } else {
        await play();
      }
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-dark-muted mb-4">No sessions yet</div>
        <Link to="/sessions/new">
          <Button>
            <Plus size={18} className="mr-2" />
            Create Session
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-dark-text">Sessions</h2>
        <Link to="/sessions/new">
          <Button size="sm">
            <Plus size={16} className="mr-1" />
            New
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onPlay={() => handlePlayPause(session.id, session.status)}
          />
        ))}
      </div>
    </div>
  );
}
