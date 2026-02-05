import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Film, Lightbulb, Vote, Video, Settings, History, Palette, Clock } from 'lucide-react';
import { Button, Card, CardContent, CardHeader } from '../components/common';
import { SessionList } from '../components/sessions/SessionList';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../api/client';

interface DashboardStats {
  totalSessions: number;
  activeSessions: number;
  totalServices: number;
  connectedServices: number;
  totalTrailers: number;
  readyTrailers: number;
}

export function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    activeSessions: 0,
    totalServices: 0,
    connectedServices: 0,
    totalTrailers: 0,
    readyTrailers: 0,
  });

  useEffect(() => {
    // Fetch dashboard stats
    const fetchStats = async () => {
      try {
        const [sessions, services, trailerStats] = await Promise.all([
          apiClient.get<{ items: any[]; total: number }>('/api/v1/sessions'),
          apiClient.get<{ items: any[]; total: number }>('/api/v1/services'),
          apiClient.get<{ total_trailers: number; ready_trailers: number }>('/api/v1/trailers/stats').catch(() => ({ total_trailers: 0, ready_trailers: 0 })),
        ]);

        const activeSessions = sessions.items.filter(
          (s) => s.status === 'running' || s.status === 'paused'
        ).length;

        const connectedServices = services.items.filter(
          (s) => s.connection_status === 'connected' && s.is_enabled
        ).length;

        setStats({
          totalSessions: sessions.total,
          activeSessions,
          totalServices: services.total,
          connectedServices,
          totalTrailers: trailerStats.total_trailers,
          readyTrailers: trailerStats.ready_trailers,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="bg-dark-surface border-b border-dark-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="text-theatarr-500" size={32} />
            <h1 className="text-2xl font-bold text-dark-text">Theatarr</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-dark-muted">Welcome, {user?.username}</span>
            <Link to="/settings">
              <Button variant="ghost" size="sm">
                <Settings size={18} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-theatarr-500/20">
                  <Play className="text-theatarr-500" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-dark-text">{stats.activeSessions}</div>
                  <div className="text-sm text-dark-muted">Active Sessions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Film className="text-blue-500" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-dark-text">{stats.totalSessions}</div>
                  <div className="text-sm text-dark-muted">Total Sessions</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Lightbulb className="text-green-500" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-dark-text">
                    {stats.connectedServices}/{stats.totalServices}
                  </div>
                  <div className="text-sm text-dark-muted">Services</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link to="/trailers">
            <Card variant="interactive">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Video className="text-purple-500" size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-dark-text">
                      {stats.readyTrailers}/{stats.totalTrailers}
                    </div>
                    <div className="text-sm text-dark-muted">Trailers Ready</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Link to="/sessions/new">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Play className="text-theatarr-500 mb-3" size={32} />
                <h3 className="font-semibold text-dark-text mb-1">New Session</h3>
                <p className="text-sm text-dark-muted">Create a new cinema session</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/votes">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Vote className="text-blue-500 mb-3" size={32} />
                <h3 className="font-semibold text-dark-text mb-1">Vote Session</h3>
                <p className="text-sm text-dark-muted">Let your audience choose</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/templates">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Palette className="text-purple-500 mb-3" size={32} />
                <h3 className="font-semibold text-dark-text mb-1">Templates</h3>
                <p className="text-sm text-dark-muted">Customize wallmount display</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/services">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Lightbulb className="text-green-500 mb-3" size={32} />
                <h3 className="font-semibold text-dark-text mb-1">Services</h3>
                <p className="text-sm text-dark-muted">Connect lights, players & more</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Secondary Navigation */}
        <div className="flex gap-4 mb-8">
          <Link to="/movies" className="flex-1">
            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-3">
                <Film className="text-indigo-400" size={20} />
                <span className="font-medium text-dark-text">Browse Movies</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/history" className="flex-1">
            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-3">
                <History className="text-yellow-400" size={20} />
                <span className="font-medium text-dark-text">Session History</span>
              </CardContent>
            </Card>
          </Link>
          <Link to="/wallmount" target="_blank" className="flex-1">
            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="text-cyan-400" size={20} />
                <span className="font-medium text-dark-text">Open Wallmount</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Sessions */}
        <SessionList />
      </main>
    </div>
  );
}
