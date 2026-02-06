import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  Clock,
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Film,
  Lightbulb,
  Volume2,
  Monitor,
  Zap,
  GitBranch,
  Calendar,
} from 'lucide-react';
import { Button, Spinner } from '../components/common';
import { useSession } from '../hooks/useSession';
import { useLayoutStore } from '../stores/layoutStore';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLayoutStore();
  const { session, sessionState, fetchSession, play, pause, stop, skip, restart } = useSession({
    sessionId: id,
    autoSubscribe: true,
  });

  const t = {
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
    notFound: language === 'fr' ? 'Session introuvable' : 'Session not found',
    edit: language === 'fr' ? 'Modifier' : 'Edit',
    controls: language === 'fr' ? 'Contrôles' : 'Controls',
    status: language === 'fr' ? 'Statut' : 'Status',
    progress: language === 'fr' ? 'Progression' : 'Progress',
    workflow: language === 'fr' ? 'Workflow' : 'Workflow',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    noWorkflow: language === 'fr' ? 'Aucune action définie.' : 'No actions defined.',
    addSome: language === 'fr' ? 'En ajouter' : 'Add some',
    draft: language === 'fr' ? 'Brouillon' : 'Draft',
    scheduled: language === 'fr' ? 'Programmé' : 'Scheduled',
    running: language === 'fr' ? 'En cours' : 'Running',
    paused: language === 'fr' ? 'En pause' : 'Paused',
    completed: language === 'fr' ? 'Terminé' : 'Completed',
    interrupted: language === 'fr' ? 'Interrompu' : 'Interrupted',
    start: language === 'fr' ? 'Lancer' : 'Start',
    resume: language === 'fr' ? 'Reprendre' : 'Resume',
    restart: language === 'fr' ? 'Relancer' : 'Restart',
    scheduledFor: language === 'fr' ? 'Programmée pour' : 'Scheduled for',
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: t.draft },
    scheduled: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: t.scheduled },
    running: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: t.running },
    paused: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: t.paused },
    completed: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: t.completed },
    interrupted: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: t.interrupted },
  };

  const actionTypeConfig: Record<string, { icon: typeof Lightbulb; color: string }> = {
    lighting: { icon: Lightbulb, color: 'text-yellow-400 bg-yellow-500/20' },
    audio: { icon: Volume2, color: 'text-blue-400 bg-blue-500/20' },
    media: { icon: Play, color: 'text-green-400 bg-green-500/20' },
    display: { icon: Monitor, color: 'text-purple-400 bg-purple-500/20' },
    actuator: { icon: Zap, color: 'text-orange-400 bg-orange-500/20' },
  };

  useEffect(() => {
    if (id) {
      fetchSession(id);
    }
  }, [id, fetchSession]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Get workflow actions from session
  const workflow = session.workflow as { nodes?: Array<{ id: string; data: { nodeType: string; actionType?: string; command?: string } }> } | undefined;
  const workflowActions = workflow?.nodes?.filter(
    (n) => n.data.nodeType === 'action'
  ) || [];
  const totalActions = workflowActions.length;

  const statusInfo = statusConfig[session.status] || statusConfig.draft;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Link to="/sessions">
            <Button variant="ghost" size="sm" className="mt-1">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div className="flex items-start gap-4">
            {/* Movie Poster or default icon */}
            {session.movie_poster_url ? (
              <div className="hidden sm:block w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-dark-border">
                <img
                  src={session.movie_poster_url}
                  alt={session.movie_title || session.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="hidden sm:flex w-14 h-14 rounded-xl bg-theatarr-500/20 items-center justify-center flex-shrink-0">
                <Film size={28} className="text-theatarr-500" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-dark-text">{session.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              {/* Movie title if different from session name */}
              {session.movie_title && session.movie_title !== session.name && (
                <p className="text-sm text-theatarr-400 mb-1 flex items-center gap-1">
                  <Film size={12} />
                  {session.movie_title}
                  {session.movie_source && <span className="text-dark-muted">via {session.movie_source}</span>}
                </p>
              )}
              {session.description && (
                <p className="text-sm text-dark-muted">{session.description}</p>
              )}
              {session.scheduled_at && (
                <div className="flex items-center gap-1.5 mt-1 text-sm text-purple-400">
                  <Calendar size={14} />
                  <span>{t.scheduledFor} {new Date(session.scheduled_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Link to={`/sessions/${id}/edit`}>
          <Button variant="secondary">
            <Settings size={16} className="mr-2" />
            {t.edit}
          </Button>
        </Link>
      </div>

      {/* Controls Card */}
      <div className="bg-dark-surface border border-dark-border rounded-xl p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {session.status === 'running' ? (
              <>
                <Button variant="secondary" onClick={pause}>
                  <Pause size={18} className="mr-2" />
                  Pause
                </Button>
                <Button variant="secondary" onClick={stop}>
                  <Square size={18} />
                </Button>
                <Button variant="secondary" onClick={skip}>
                  <SkipForward size={18} />
                </Button>
              </>
            ) : session.status === 'paused' ? (
              <>
                <Button onClick={play}>
                  <Play size={18} className="mr-2" />
                  {t.resume}
                </Button>
                <Button variant="secondary" onClick={stop}>
                  <Square size={18} />
                </Button>
              </>
            ) : (
              <>
                <Button onClick={play} disabled={totalActions === 0}>
                  <Play size={18} className="mr-2" />
                  {t.start}
                </Button>
                {session.status === 'completed' && (
                  <Button variant="secondary" onClick={restart}>
                    <RotateCcw size={18} className="mr-2" />
                    {t.restart}
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-dark-muted">
              <GitBranch size={16} />
              <span>{totalActions} {t.actions}</span>
            </div>
            {session.status === 'running' && sessionState && (
              <div className="flex items-center gap-2 text-dark-muted">
                <Clock size={16} />
                <span>{Math.round((sessionState.current_sequence_elapsed_ms || 0) / 1000)}s</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Preview */}
      <div className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-text flex items-center gap-2">
            <GitBranch size={18} />
            {t.workflow}
          </h2>
          <span className="text-sm text-dark-muted">{totalActions} {t.actions}</span>
        </div>

        {workflowActions.length > 0 ? (
          <div className="p-4">
            <div className="space-y-3">
              {workflowActions.map((node, index) => {
                const actionType = node.data.actionType || 'actuator';
                const config = actionTypeConfig[actionType] || actionTypeConfig.actuator;
                const Icon = config.icon;

                return (
                  <div
                    key={node.id}
                    className="flex items-center gap-4 p-4 bg-dark-bg rounded-lg border border-dark-border"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-dark-border text-dark-muted text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className={`p-2.5 rounded-lg ${config.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-dark-text">
                        {node.data.command || actionType}
                      </div>
                      <div className="text-xs text-dark-muted capitalize">
                        {actionType}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <GitBranch size={48} className="mx-auto text-dark-muted mb-4" />
            <p className="text-dark-muted mb-4">{t.noWorkflow}</p>
            <Link to={`/sessions/${id}/edit`}>
              <Button variant="secondary">
                <Settings size={16} className="mr-2" />
                {t.addSome}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
