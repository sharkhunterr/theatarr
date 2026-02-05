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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, Spinner } from '../components/common';
import { apiClient } from '../api/client';

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
      const response = await apiClient.get(`/logs/sessions/history?${params}`);
      return response.data;
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery<SessionStats>({
    queryKey: ['session-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/logs/sessions/stats');
      return response.data;
    },
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
        return <XCircle size={16} className="text-red-400" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
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
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Session History</h1>
          <p className="text-gray-500 mt-1">View past sessions and playback statistics</p>
        </div>
      </div>

      {/* Stats Overview */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Film size={20} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{statsData.total_sessions}</div>
                  <div className="text-sm text-gray-500">Total Sessions</div>
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
                  <div className="text-sm text-gray-500">This Week</div>
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
                  <div className="text-sm text-gray-500">Avg Duration</div>
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
                  <div className="text-sm text-gray-500">Total Playback</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Daily Chart */}
      {statsData && statsData.daily_stats.length > 0 && (
        <Card className="mb-8">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Last 7 Days</h2>
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
                      className="w-full bg-indigo-500/50 rounded-t"
                      style={{ height: `${height}%`, minHeight: day.sessions_started > 0 ? '8px' : '0' }}
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className="text-xs text-gray-400">{day.sessions_started}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'completed', 'running', 'paused', 'stopped'].map((status) => (
          <button
            key={status}
            onClick={() => {
              setStatusFilter(status);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {status || 'All'}
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
              <Card key={session.id}>
                <Link to={`/sessions/${session.id}`} className="block p-4 hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(session.status)}
                      <div>
                        <div className="font-medium">{session.name}</div>
                        {session.movie_title && (
                          <div className="text-sm text-gray-500">{session.movie_title}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <div>
                        <span className="text-gray-500">Started:</span>{' '}
                        {formatDate(session.started_at)}
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>{' '}
                        {formatDuration(session.duration_seconds)}
                      </div>
                      <div>
                        <span className="text-gray-500">Sequences:</span>{' '}
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
                            : 'bg-gray-500/20 text-gray-400'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                  </div>
                </Link>
              </Card>
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
                Previous
              </Button>
              <span className="text-sm text-gray-400">
                Page {page} of {historyData.total_pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(historyData.total_pages, p + 1))}
                disabled={page === historyData.total_pages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <History size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">No session history found</p>
        </div>
      )}
    </div>
  );
}
