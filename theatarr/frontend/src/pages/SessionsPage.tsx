import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Pause,
  Square,
  Edit,
  Trash2,
  Clock,
  Layers,
  RefreshCw,
  Film,
} from 'lucide-react';
import { Button, Card, Spinner, Modal } from '../components/common';
import { useSessionStore, Session } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { useLayoutStore } from '../stores/layoutStore';
import { apiClient } from '../api/client';

export function SessionsPage() {
  const navigate = useNavigate();
  const { language } = useLayoutStore();
  const { sessions, isLoading } = useSessionStore();
  const { fetchSessions, play, pause, stop } = useSession();
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = {
    title: language === 'fr' ? 'Sessions' : 'Sessions',
    subtitle: language === 'fr' ? 'Gérez vos sessions de cinéma maison' : 'Manage your home cinema sessions',
    addSession: language === 'fr' ? 'Nouvelle session' : 'New Session',
    refresh: language === 'fr' ? 'Actualiser' : 'Refresh',
    noSessions: language === 'fr' ? 'Aucune session' : 'No sessions',
    createFirst: language === 'fr' ? 'Créer votre première session' : 'Create your first session',
    sequences: language === 'fr' ? 'séquences' : 'sequences',
    play: language === 'fr' ? 'Lancer' : 'Play',
    pause: language === 'fr' ? 'Pause' : 'Pause',
    stop: language === 'fr' ? 'Arrêter' : 'Stop',
    edit: language === 'fr' ? 'Modifier' : 'Edit',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    deleteConfirm: language === 'fr' ? 'Supprimer la session' : 'Delete Session',
    deleteWarning: language === 'fr' ? 'Êtes-vous sûr de vouloir supprimer cette session ? Cette action est irréversible.' : 'Are you sure you want to delete this session? This action cannot be undone.',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    draft: language === 'fr' ? 'Brouillon' : 'Draft',
    scheduled: language === 'fr' ? 'Programmé' : 'Scheduled',
    running: language === 'fr' ? 'En cours' : 'Running',
    paused: language === 'fr' ? 'En pause' : 'Paused',
    completed: language === 'fr' ? 'Terminé' : 'Completed',
    interrupted: language === 'fr' ? 'Interrompu' : 'Interrupted',
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handlePlayPause = async (session: Session) => {
    useSessionStore.getState().setCurrentSession(session);
    if (session.status === 'running') {
      await pause();
    } else {
      await play();
    }
    fetchSessions();
  };

  const handleStop = async (session: Session) => {
    useSessionStore.getState().setCurrentSession(session);
    await stop();
    fetchSessions();
  };

  const handleDelete = async () => {
    if (!deleteSession) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/sessions/${deleteSession.id}`);
      fetchSessions();
      setDeleteSession(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: t.draft },
      scheduled: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: t.scheduled },
      running: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: t.running },
      paused: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: t.paused },
      completed: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: t.completed },
      interrupted: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: t.interrupted },
    };
    return config[status] || config.draft;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{t.title}</h1>
          <p className="text-dark-muted text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => fetchSessions()} className="flex-shrink-0">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={() => navigate('/sessions/new')}>
            <Plus size={16} className="mr-1" />
            <span className="hidden sm:inline">{t.addSession}</span>
            <span className="sm:hidden">Ajouter</span>
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Play size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted mb-4">{t.noSessions}</p>
          <Button onClick={() => navigate('/sessions/new')}>
            <Plus size={16} className="mr-2" />
            {t.createFirst}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const statusBadge = getStatusBadge(session.status);
            const totalDuration = session.sequences?.reduce(
              (sum, seq) => sum + (seq.duration_ms || 0),
              0
            );

            return (
              <div
                key={session.id}
                className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-dark-muted/50 transition-colors"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Movie Poster or Icon */}
                    {session.movie_poster_url ? (
                      <div className="w-16 h-24 sm:w-14 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 bg-dark-border">
                        <img
                          src={session.movie_poster_url}
                          alt={session.movie_title || session.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="hidden sm:flex w-14 h-20 rounded-lg bg-theatarr-500/20 items-center justify-center flex-shrink-0">
                        <Film size={24} className="text-theatarr-500" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Link
                          to={`/sessions/${session.id}`}
                          className="text-lg font-semibold text-dark-text hover:text-theatarr-500 transition-colors"
                        >
                          {session.name}
                        </Link>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.color}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Movie title if different from session name */}
                      {session.movie_title && session.movie_title !== session.name && (
                        <p className="text-sm text-theatarr-400 mb-1 flex items-center gap-1">
                          <Film size={12} />
                          {session.movie_title}
                        </p>
                      )}

                      {session.description && (
                        <p className="text-sm text-dark-muted mb-2 line-clamp-1">
                          {session.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dark-muted">
                        {session.movie_source && (
                          <span className="text-xs bg-dark-bg px-2 py-0.5 rounded">
                            {session.movie_source}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Layers size={14} />
                          {session.sequences?.length || 0} {t.sequences}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {formatDuration(totalDuration)}
                        </span>
                        {/* Color palette preview */}
                        {session.color_palette && (
                          <div className="flex items-center gap-0.5">
                            {[session.color_palette.primary, session.color_palette.accent, session.color_palette.vibrant]
                              .filter(Boolean)
                              .slice(0, 3)
                              .map((color, i) => (
                                <div
                                  key={i}
                                  className="w-3 h-3 rounded-sm border border-dark-border"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-dark-border mt-2 sm:mt-0">
                      {session.status === 'running' ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePlayPause(session)}
                            title={t.pause}
                          >
                            <Pause size={16} />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStop(session)}
                            title={t.stop}
                          >
                            <Square size={16} />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePlayPause(session)}
                          title={t.play}
                        >
                          <Play size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/sessions/${session.id}/edit`)}
                        title={t.edit}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteSession(session)}
                        title={t.delete}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteSession}
        onClose={() => setDeleteSession(null)}
        title={t.deleteConfirm}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-dark-text">
            {t.deleteWarning}
          </p>
          <p className="text-sm text-dark-muted font-medium">
            "{deleteSession?.name}"
          </p>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteSession(null)}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '...' : t.delete}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
