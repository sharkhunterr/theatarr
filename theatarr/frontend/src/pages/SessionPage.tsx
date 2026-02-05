import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Settings, Clock } from 'lucide-react';
import { Button, Card, CardContent, CardHeader } from '../components/common';
import { SessionControls } from '../components/sessions/SessionControls';
import { useSession } from '../hooks/useSession';
import { useSessionStore } from '../stores/sessionStore';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { session, sessionState, fetchSession, play, pause, stop, skip, restart } = useSession({
    sessionId: id,
    autoSubscribe: true,
  });

  useEffect(() => {
    if (id) {
      fetchSession(id);
    }
  }, [id, fetchSession]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Loading session...</div>
      </div>
    );
  }

  const currentSequence = sessionState?.current_sequence || session.sequences?.[session.current_sequence_index];
  const progress = session.total_sequences
    ? ((session.current_sequence_index + 1) / session.total_sequences) * 100
    : 0;

  return (
    <div className="min-h-screen bg-dark-bg p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/sessions">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-dark-text">{session.name}</h1>
              {session.description && (
                <p className="text-dark-muted mt-1">{session.description}</p>
              )}
            </div>
          </div>
          <Link to={`/sessions/${id}/edit`}>
            <Button variant="secondary" size="sm">
              <Settings size={16} className="mr-1" />
              Edit
            </Button>
          </Link>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between">
            <SessionControls
              status={session.status}
              onPlay={play}
              onPause={pause}
              onStop={stop}
              onSkip={skip}
              onRestart={restart}
              size="lg"
            />

            <div className="text-right">
              <div className="text-sm text-dark-muted">Status</div>
              <div className="text-lg font-semibold text-dark-text capitalize">
                {session.status}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {session.status !== 'draft' && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-dark-text">Progress</h2>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm text-dark-muted mb-2">
                  <span>
                    Sequence {session.current_sequence_index + 1} of {session.total_sequences}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-dark-border rounded-full h-2">
                  <div
                    className="bg-theatarr-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {currentSequence && (
                <div className="p-4 bg-dark-bg rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-dark-muted">Current Sequence</div>
                      <div className="text-lg font-medium text-dark-text">
                        {currentSequence.name}
                      </div>
                    </div>
                    {currentSequence.duration_ms && (
                      <div className="flex items-center gap-1 text-dark-muted">
                        <Clock size={14} />
                        <span>{Math.round(currentSequence.duration_ms / 1000)}s</span>
                      </div>
                    )}
                  </div>

                  {sessionState?.current_sequence_elapsed_ms !== undefined && (
                    <div className="mt-3">
                      <div className="w-full bg-dark-border rounded-full h-1.5">
                        <div
                          className="bg-theatarr-400 h-1.5 rounded-full transition-all duration-200"
                          style={{
                            width: `${
                              currentSequence.duration_ms
                                ? (sessionState.current_sequence_elapsed_ms /
                                    currentSequence.duration_ms) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sequences List */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-text">Sequences</h2>
          </CardHeader>
          <CardContent className="p-0">
            {session.sequences && session.sequences.length > 0 ? (
              <div className="divide-y divide-dark-border">
                {session.sequences.map((sequence, index) => (
                  <div
                    key={sequence.id}
                    className={`p-4 flex items-center justify-between ${
                      index === session.current_sequence_index && session.status === 'running'
                        ? 'bg-theatarr-500/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          index < session.current_sequence_index
                            ? 'bg-green-500/20 text-green-400'
                            : index === session.current_sequence_index &&
                              session.status === 'running'
                            ? 'bg-theatarr-500 text-white'
                            : 'bg-dark-border text-dark-muted'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-dark-text">{sequence.name}</div>
                        <div className="text-sm text-dark-muted">
                          {sequence.duration_type === 'fixed' && sequence.duration_ms
                            ? `${Math.round(sequence.duration_ms / 1000)}s`
                            : sequence.duration_type}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-dark-muted">
                No sequences in this session.{' '}
                <Link to={`/sessions/${id}/edit`} className="text-theatarr-500 hover:underline">
                  Add some
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
