import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Play,
  CheckCircle,
  PauseCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Spinner, PageHeader, ButtonGroup } from '../components/common';
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
    <div className="rounded-lg border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="block w-full text-left p-4 hover:bg-dark-border/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-dark-muted flex-shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          {getStatusIcon(session.status)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-dark-text truncate">{session.name}</div>
            {session.movie_title && (
              <div className="text-xs text-dark-muted truncate">{session.movie_title}</div>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-dark-muted flex-shrink-0">
            <div className="hidden md:block">
              <span className="text-dark-muted/60">Debut:</span>{' '}
              {formatDate(session.started_at)}
            </div>
            <div>
              <span className="hidden sm:inline text-dark-muted/60">Duree: </span>
              {formatDuration(session.duration_seconds)}
            </div>
            <div className="hidden sm:block">
              <span className="text-dark-muted/60">Seq:</span>{' '}
              {session.sequences_completed}/{session.total_sequences}
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
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
    </div>
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
      <PageHeader
        title="Historique"
        subtitle={statsData ? `${statsData.total_playback_hours.toFixed(1)}h de lecture totale` : undefined}
      />

      {/* Daily Chart */}
      {statsData && statsData.daily_stats.length > 0 && (
        <Card className="mb-6">
          <div className="p-4 sm:p-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-dark-muted mb-3">7 derniers jours</h2>
            <div className="flex items-end gap-2 h-24">
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
      <div className="mb-6">
        <ButtonGroup
          options={[
            { key: '', label: 'Tous' },
            { key: 'completed', label: 'Termine' },
            { key: 'running', label: 'En cours' },
            { key: 'paused', label: 'En pause' },
            { key: 'interrupted', label: 'Interrompu' },
          ]}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
        />
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
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-md border border-dark-border text-sm font-medium text-dark-text hover:bg-dark-border/50 transition-colors disabled:opacity-50"
              >
                Precedent
              </button>
              <span className="text-sm text-dark-muted tabular-nums">
                Page {page} sur {historyData.total_pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(historyData.total_pages, p + 1))}
                disabled={page === historyData.total_pages}
                className="h-9 px-3 rounded-md border border-dark-border text-sm font-medium text-dark-text hover:bg-dark-border/50 transition-colors disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <History size={32} className="mx-auto text-dark-muted mb-3" />
          <p className="text-sm text-dark-muted">Aucun historique trouve</p>
        </div>
      )}
    </div>
  );
}
