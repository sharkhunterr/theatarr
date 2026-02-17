import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Play,
  CheckCircle,
  PauseCircle,
  XCircle,
  Clock,
  Film,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Spinner } from '../components/common';
import { apiClient } from '../api/client';
import { EventTimeline } from '../components/history/EventTimeline';

interface SessionHistoryItem {
  id: string;
  name: string;
  status: string;
  movie_title: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  sequences_completed: number;
  total_sequences: number;
}

interface DailyStats {
  date: string;
  sessions_started: number;
  sessions_completed: number;
  total_duration_minutes: number;
}

interface SessionStats {
  total_sessions: number;
  sessions_today: number;
  sessions_this_week: number;
  sessions_this_month: number;
  avg_session_duration_minutes: number;
  total_playback_hours: number;
  most_played_movie: string | null;
  daily_stats: DailyStats[];
}

interface HistoryResponse {
  items: SessionHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface SessionEvent {
  id: string;
  session_id: string;
  session_name: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  timestamp: string;
}

function SessionRow({ session }: { session: SessionHistoryItem }) {
  const [expanded, setExpanded] = useState(false);

  const { data: events, isLoading: eventsLoading } = useQuery<SessionEvent[]>({
    queryKey: ['session-events', session.id],
    queryFn: async () => {
      return apiClient.get<SessionEvent[]>(`/logs/sessions/${session.id}/events`);
    },
    enabled: expanded,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-400" />;
      case 'running':
        return <Play size={16} className="text-blue-400" />;
      case 'paused':
        return <PauseCircle size={16} className="text-yellow-400" />;
      case 'stopped':
      case 'interrupted':
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <Clock size={16} className="text-dark-muted" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  const statusLabels: Record<string, string> = {
    completed: 'Termine',
    running: 'En cours',
    paused: 'En pause',
    stopped: 'Arrete',
    interrupted: 'Interrompu',
    draft: 'Brouillon',
    scheduled: 'Planifie',
  };

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="block w-full text-left p-4 hover:bg-dark-border/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-dark-muted">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {getStatusIcon(session.status)}
            <div>
              <div className="font-medium text-dark-text">{session.name}</div>
              {session.movie_title && (
                <div className="text-sm text-dark-muted">{session.movie_title}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-dark-muted">
            <div className="hidden md:block">
              <span className="text-dark-muted/60">Debut:</span>{' '}
              {formatDate(session.started_at)}
            </div>
            <div>
              <span className="text-dark-muted/60">Duree:</span>{' '}
              {formatDuration(session.duration_seconds)}
            </div>
            <div>
              <span className="text-dark-muted/60">Seq:</span>{' '}
              {session.sequences_completed}/{session.total_sequences}
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                session.status === 'completed'
                  ? 'bg-green-500/20 text-green-400'
                  : session.status === 'running'
                  ? 'bg-blue-500/20 text-blue-400'
                  : session.status === 'paused'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : session.status === 'interrupted'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-dark-border/20 text-dark-muted'
              }`}
            >
              {statusLabels[session.status] || session.status}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded event timeline */}
      {expanded && (
        <div className="border-t border-dark-border px-4 py-3">
          {/* Session summary header */}
          <div className="flex flex-wrap gap-4 text-xs text-dark-muted mb-3 pb-3 border-b border-dark-border/50">
            <div>
              <span className="text-dark-muted/60">ID:</span>{' '}
              <span className="font-mono">{session.id.slice(0, 8)}</span>
            </div>
            <div>
              <span className="text-dark-muted/60">Debut:</span> {formatDate(session.started_at)}
            </div>
            {session.completed_at && (
              <div>
                <span className="text-dark-muted/60">Fin:</span> {formatDate(session.completed_at)}
              </div>
            )}
            <div>
              <span className="text-dark-muted/60">Duree:</span> {formatDuration(session.duration_seconds)}
            </div>
            <div>
              <span className="text-dark-muted/60">Sequences:</span> {session.sequences_completed}/{session.total_sequences}
            </div>
          </div>

          {eventsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="sm" />
              <span className="ml-2 text-sm text-dark-muted">Chargement des evenements...</span>
            </div>
          ) : events && events.length > 0 ? (
            <EventTimeline events={events} sessionStartedAt={session.started_at} />
          ) : (
            <div className="text-center py-4 text-sm text-dark-muted">
              Aucun evenement enregistre (session executée avant l'activation du suivi)
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function SessionHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch history
  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ['session-history', page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: '20',
      });
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      return apiClient.get<HistoryResponse>(`/logs/sessions/history?${params}`);
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery<SessionStats>({
    queryKey: ['session-stats'],
    queryFn: async () => {
      return apiClient.get<SessionStats>('/logs/sessions/stats');
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Historique</h1>
          <p className="text-dark-muted text-sm mt-1">Historique des sessions et statistiques de lecture</p>
        </div>
      </div>

      {/* Stats Overview */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-theatarr-500/20 flex items-center justify-center">
                  <Film size={20} className="text-theatarr-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{statsData.total_sessions}</div>
                  <div className="text-sm text-dark-muted">Sessions totales</div>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Calendar size={20} className="text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{statsData.sessions_this_week}</div>
                  <div className="text-sm text-dark-muted">Cette semaine</div>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Clock size={20} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {statsData.avg_session_duration_minutes.toFixed(0)}m
                  </div>
                  <div className="text-sm text-dark-muted">Duree moyenne</div>
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <TrendingUp size={20} className="text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {statsData.total_playback_hours.toFixed(1)}h
                  </div>
                  <div className="text-sm text-dark-muted">Lecture totale</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Daily Chart */}
      {statsData && statsData.daily_stats.length > 0 && (
        <Card className="mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4 text-dark-text">7 derniers jours</h2>
            <div className="flex items-end gap-2 h-32">
              {statsData.daily_stats.map((day) => {
                const maxSessions = Math.max(...statsData.daily_stats.map((d) => d.sessions_started), 1);
                const height = (day.sessions_started / maxSessions) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center"
                  >
                    <div
                      className="w-full bg-theatarr-500/50 rounded-t"
                      style={{ height: `${height}%`, minHeight: day.sessions_started > 0 ? '8px' : '0' }}
                    />
                    <div className="text-xs text-dark-muted mt-2">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className="text-xs text-dark-muted">{day.sessions_started}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'completed', 'running', 'paused', 'interrupted'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
            }`}
          >
            {status === '' ? 'Tous' : status === 'completed' ? 'Termine' : status === 'running' ? 'En cours' : status === 'paused' ? 'En pause' : 'Interrompu'}
          </button>
        ))}
      </div>

      {/* History List */}
      {historyLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : historyData && historyData.items.length > 0 ? (
        <>
          <div className="space-y-3">
            {historyData.items.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>

          {/* Pagination */}
          {historyData.total_pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Precedent
              </Button>
              <span className="text-sm text-dark-muted">
                Page {page} sur {historyData.total_pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(historyData.total_pages, p + 1))}
                disabled={page === historyData.total_pages}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <History size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">Aucun historique trouve</p>
        </div>
      )}
    </div>
  );
}
