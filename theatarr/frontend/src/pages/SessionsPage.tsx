import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Pause,
  Square,
  Trash2,
  RefreshCw,
  Film,
  Calendar,
  Users,
  Vote,
  Shuffle,
  Zap,
  Trophy,
  Eye,
  Monitor,
  ScreenShare,
  Copy,
  Check,
  CopyPlus,
  Star,
  Pencil,
} from 'lucide-react';
import clsx from 'clsx';
import { getMysteryRevealCountdown, getVoteRevealCountdown } from '../utils/countdown';
import { useCountdown } from '../hooks/useCountdown';
import { useSetting } from '../hooks/useSettings';
import { MysteryPoster } from '../components/common/MysteryPoster';
import { VotePoster } from '../components/common/VotePoster';
import { VotePosterCollage } from '../components/common/VotePosterCollage';
import { Button, Card, Spinner, Modal } from '../components/common';
import { useSessionStore, Session, SessionState, VoteSessionSummary } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLayoutStore } from '../stores/layoutStore';
import { apiClient } from '../api/client';

export function SessionsPage() {
  useCountdown();
  const posterDisplay = useSetting<string>('voting.poster_display', 'animation');
  const navigate = useNavigate();
  const { language } = useLayoutStore();
  const { sessions, isLoading } = useSessionStore();
  const { fetchSessions } = useSession();
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [voteResultsSession, setVoteResultsSession] = useState<VoteSessionSummary | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const t = {
    title: language === 'fr' ? 'Sessions' : 'Sessions',
    subtitle: language === 'fr' ? 'Gérez vos sessions de cinéma maison' : 'Manage your home cinema sessions',
    addSession: language === 'fr' ? 'Nouvelle session' : 'New Session',
    noSessions: language === 'fr' ? 'Aucune session' : 'No sessions',
    createFirst: language === 'fr' ? 'Créer votre première session' : 'Create your first session',
    play: language === 'fr' ? 'Lancer' : 'Play',
    resume: language === 'fr' ? 'Reprendre' : 'Resume',
    pause: language === 'fr' ? 'Pause' : 'Pause',
    stop: language === 'fr' ? 'Arrêter' : 'Stop',
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
    participants: language === 'fr' ? 'participants' : 'participants',
    actions: language === 'fr' ? 'actions' : 'actions',
    voteOpen: language === 'fr' ? 'Vote ouvert' : 'Vote open',
    voteClosed: language === 'fr' ? 'Vote fermé' : 'Vote closed',
    voteDraft: language === 'fr' ? 'Vote en attente' : 'Vote pending',
    mystery: language === 'fr' ? 'Film mystère' : 'Mystery movie',
    noMovie: language === 'fr' ? 'Aucun film' : 'No movie',
    seeResults: language === 'fr' ? 'Voir résultats' : 'See results',
    voteResults: language === 'fr' ? 'Résultats du vote' : 'Vote Results',
    votes: language === 'fr' ? 'votes' : 'votes',
    winner: language === 'fr' ? 'Gagnant' : 'Winner',
    wallmount: language === 'fr' ? 'Wallmount' : 'Wallmount',
    display: language === 'fr' ? 'Display' : 'Display',
    copyCode: language === 'fr' ? 'Copier le code' : 'Copy code',
    codeCopied: language === 'fr' ? 'Copié !' : 'Copied!',
    all: language === 'fr' ? 'Toutes' : 'All',
    duplicate: language === 'fr' ? 'Dupliquer' : 'Duplicate',
  };

  // WebSocket for real-time session state updates
  const token = localStorage.getItem('theatarr_token');
  const { updateSessionState } = useSessionStore();
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    token,
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'session_state' && message.payload) {
        updateSessionState(message.payload as SessionState);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('session');
      return () => unsubscribe('session');
    }
  }, [isConnected, subscribe, unsubscribe]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh when sessions have trailers being prepared
  const hasPreparingTrailers = sessions.some(s => (s.preparing_trailers ?? 0) > 0);
  useEffect(() => {
    if (!hasPreparingTrailers) return;
    const interval = setInterval(() => fetchSessions(), 5000);
    return () => clearInterval(interval);
  }, [hasPreparingTrailers, fetchSessions]);

  const [controllingId, setControllingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const handlePlayPause = async (session: Session) => {
    setControlError(null);
    setControllingId(session.id);
    try {
      const action = session.status === 'running' ? 'pause' : 'play';
      await apiClient.post(`/sessions/${session.id}/control`, { action });
    } catch (error: any) {
      console.error('Session control failed:', error);
      setControlError(error?.message || (language === 'fr' ? 'Erreur de contrôle' : 'Control error'));
      setTimeout(() => setControlError(null), 4000);
    } finally {
      setControllingId(null);
    }
    fetchSessions();
  };

  const handleStop = async (session: Session) => {
    setControlError(null);
    setControllingId(session.id);
    try {
      await apiClient.post(`/sessions/${session.id}/control`, { action: 'stop' });
    } catch (error: any) {
      console.error('Session stop failed:', error);
      setControlError(error?.message || (language === 'fr' ? 'Erreur lors de l\'arrêt' : 'Stop error'));
      setTimeout(() => setControlError(null), 4000);
    } finally {
      setControllingId(null);
    }
    fetchSessions();
  };

  const handleDelete = async () => {
    if (!deleteSession) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/sessions/${deleteSession.id}`);
      fetchSessions();
      setDeleteSession(null);
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      setDeleteError(error?.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicate = async (session: Session) => {
    setDuplicatingId(session.id);
    try {
      await apiClient.post(`/sessions/${session.id}/duplicate`, {});
      fetchSessions();
    } catch (error: any) {
      console.error('Failed to duplicate session:', error);
      setControlError(error?.message || (language === 'fr' ? 'Erreur lors de la duplication' : 'Duplication error'));
      setTimeout(() => setControlError(null), 4000);
    } finally {
      setDuplicatingId(null);
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

  const getVoteStatusBadge = (voteSession: VoteSessionSummary) => {
    if (voteSession.status === 'open') {
      return { color: 'bg-green-500/20 text-green-400', label: t.voteOpen, icon: Vote };
    } else if (voteSession.status === 'closed') {
      return { color: 'bg-blue-500/20 text-blue-400', label: t.voteClosed, icon: Trophy };
    }
    return { color: 'bg-gray-500/20 text-gray-400', label: t.voteDraft, icon: Vote };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovieDisplay = (session: Session) => {
    const mode = session.movie_selection_mode || 'fixed';

    if (mode === 'vote') {
      if (session.movie_resolved && session.movie_title) {
        return {
          poster: session.movie_poster_url,
          title: session.movie_title,
          icon: Trophy,
          iconColor: 'text-yellow-500',
          type: 'winner',
        };
      }
      return {
        poster: null,
        title: language === 'fr' ? 'En attente du vote' : 'Waiting for vote',
        icon: Vote,
        iconColor: 'text-blue-400',
        type: 'vote',
      };
    }

    if (mode === 'mystery') {
      if (session.movie_resolved && session.movie_title) {
        return {
          poster: session.movie_poster_url,
          title: session.movie_title,
          icon: Shuffle,
          iconColor: 'text-purple-400',
          type: 'revealed',
        };
      }
      return {
        poster: null,
        title: t.mystery,
        icon: Shuffle,
        iconColor: 'text-purple-400 animate-pulse',
        type: 'mystery',
      };
    }

    // Fixed mode
    if (session.movie_title) {
      return {
        poster: session.movie_poster_url,
        title: session.movie_title,
        icon: Film,
        iconColor: 'text-theatarr-500',
        type: 'fixed',
      };
    }

    return {
      poster: null,
      title: t.noMovie,
      icon: Film,
      iconColor: 'text-dark-muted',
      type: 'none',
    };
  };

  const STATUS_ORDER = ['running', 'paused', 'scheduled', 'draft', 'completed', 'interrupted'];

  const statusFilters = [
    { key: 'all', label: t.all },
    { key: 'running', label: t.running },
    { key: 'paused', label: t.paused },
    { key: 'scheduled', label: t.scheduled },
    { key: 'draft', label: t.draft },
    { key: 'completed', label: t.completed },
    { key: 'interrupted', label: t.interrupted },
  ];

  // Filter sessions
  const filteredSessions = statusFilter === 'all'
    ? sessions
    : sessions.filter((s) => s.status === statusFilter);

  // Group sessions by status (for "all" view)
  const groupedSessions = statusFilter === 'all'
    ? STATUS_ORDER
        .map((status) => ({
          status,
          label: getStatusBadge(status).label,
          sessions: filteredSessions.filter((s) => s.status === status),
        }))
        .filter((g) => g.sessions.length > 0)
    : null;

  // Count per status for filter badges
  const statusCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const renderSessionCard = (
    session: Session,
    statusBadge: { color: string; label: string },
    movieDisplay: ReturnType<typeof getMovieDisplay>,
    MovieIcon: typeof Film,
    voteSession: VoteSessionSummary | undefined,
  ) => (
    <div className="flex">
      {/* Movie Poster / Placeholder */}
      <div className="w-20 sm:w-24 flex-shrink-0">
        {movieDisplay.type === 'mystery' ? (
          <MysteryPoster className="w-full h-full" particles={6} questionMarkSize="text-2xl" />
        ) : movieDisplay.type === 'vote' ? (
          posterDisplay === 'posters' && voteSession?.movie_options?.length ? (
            <VotePosterCollage
              posters={voteSession.movie_options
                .map((opt) => opt.poster_url)
                .filter((url): url is string => !!url)}
              className="w-full h-full"
            />
          ) : (
            <VotePoster className="w-full h-full" particles={6} iconSize="text-2xl" />
          )
        ) : movieDisplay.poster ? (
          <img
            src={movieDisplay.poster}
            alt={movieDisplay.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-dark-border">
            <MovieIcon size={32} className={movieDisplay.iconColor} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between min-w-0">
        {/* Top row: Title + Status */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Link
              to={`/sessions/${session.id}`}
              className="text-base sm:text-lg font-semibold text-dark-text hover:text-theatarr-500 transition-colors truncate"
            >
              {session.name}
            </Link>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            {(session.preparing_trailers ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/25">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {language === 'fr' ? 'Préparation BA' : 'Preparing trailers'}
              </span>
            )}
          </div>

          {/* Movie info */}
          <div className="flex items-center gap-1.5 text-sm text-dark-muted mb-2">
            <MovieIcon size={14} className={movieDisplay.iconColor} />
            <span className="truncate">{movieDisplay.title}</span>
            {/* Mystery reveal countdown */}
            {session.movie_selection_mode === 'mystery' && !session.movie_resolved && session.mystery_reveal_at && (() => {
              const reveal = getMysteryRevealCountdown(session.mystery_reveal_at);
              return (
                <span
                  className={clsx('flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium', reveal.pulse && 'animate-pulse')}
                  style={{ backgroundColor: `${reveal.color}20`, color: reveal.color }}
                >
                  <Eye size={10} />
                  {reveal.text}
                </span>
              );
            })()}
            {/* Vote reveal countdown */}
            {session.movie_selection_mode === 'vote' && !session.movie_resolved && session.vote_reveal_at && (() => {
              const reveal = getVoteRevealCountdown(session.vote_reveal_at);
              return (
                <span
                  className={clsx('flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium', reveal.pulse && 'animate-pulse')}
                  style={{ backgroundColor: `${reveal.color}20`, color: reveal.color }}
                >
                  <Eye size={10} />
                  {reveal.text}
                </span>
              );
            })()}
          </div>

          {/* Vote badge */}
          {voteSession && (
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const voteBadge = getVoteStatusBadge(voteSession);
                const VoteIcon = voteBadge.icon;
                return (
                  <>
                    <Link
                      to="/votes"
                      className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        voteBadge.color
                      )}
                    >
                      <VoteIcon size={12} />
                      {voteBadge.label}
                      {voteSession.total_votes > 0 && (
                        <span className="ml-1">({voteSession.total_votes})</span>
                      )}
                    </Link>
                    {voteSession.status === 'closed' && voteSession.movie_options && (
                      <button
                        onClick={() => setVoteResultsSession(voteSession)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-dark-border text-dark-text hover:bg-dark-muted/50 transition-colors"
                      >
                        <Eye size={12} />
                        {t.seeResults}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Bottom row: Meta info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-muted">
          {/* Scheduled date */}
          {session.scheduled_at && (
            <span className="flex items-center gap-1 text-purple-400">
              <Calendar size={12} />
              {formatDate(session.scheduled_at)}
            </span>
          )}

          {/* Participants */}
          {(session.participants_total ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {session.participants_accepted ?? 0}/{session.participants_total} {t.participants}
            </span>
          )}

          {/* Actions count */}
          {(session.actions_count ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Zap size={12} />
              {session.actions_count} {t.actions}
            </span>
          )}

          {/* Display code */}
          {session.display_code && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(session.display_code!);
                setCopiedCode(session.id);
                setTimeout(() => setCopiedCode(null), 2000);
              }}
              title={copiedCode === session.id ? t.codeCopied : t.copyCode}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-border hover:bg-dark-muted/50 transition-colors"
            >
              <ScreenShare size={10} className="text-theatarr-500" />
              <span className="font-mono text-[10px] text-dark-text tracking-wider">{session.display_code}</span>
              {copiedCode === session.id ? (
                <Check size={10} className="text-green-400" />
              ) : (
                <Copy size={10} className="text-dark-muted" />
              )}
            </button>
          )}

          {/* Feedback badge */}
          {(session.feedback_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              <Star size={10} />
              <span>{session.feedback_average?.toFixed(1) || '—'}/10</span>
              <span className="text-amber-400/50">({session.feedback_count})</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-l border-dark-border">
        {/* Session controls + links */}
        <div className="flex flex-col justify-center gap-1 p-1.5 border-r border-dark-border/50">
          {/* Play/Resume button */}
          {(session.status === 'draft' || session.status === 'scheduled' || session.status === 'interrupted' || session.status === 'paused') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePlayPause(session)}
              title={session.status === 'paused' ? t.resume : t.play}
              disabled={controllingId === session.id || (session.actions_count ?? 0) === 0}
            >
              <Play size={15} className={session.status === 'paused' ? 'text-yellow-400' : ''} />
            </Button>
          )}
          {/* Pause button */}
          {session.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePlayPause(session)}
              title={t.pause}
              disabled={controllingId === session.id}
            >
              <Pause size={15} />
            </Button>
          )}
          {/* Stop button */}
          {(session.status === 'running' || session.status === 'paused') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStop(session)}
              title={t.stop}
              disabled={controllingId === session.id}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Square size={15} />
            </Button>
          )}
          {/* Display button */}
          {session.display_code && (
            <a
              href={`/display/${session.display_code}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`${t.display} (${session.display_code})`}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-dark-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <ScreenShare size={15} />
            </a>
          )}
          {/* Wallmount button */}
          {(session.movie_id || session.movie_title || session.scheduled_at) && (
            <a
              href={`/wallmount/${session.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t.wallmount}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-dark-muted hover:text-theatarr-500 hover:bg-theatarr-500/10 transition-colors"
            >
              <Monitor size={15} />
            </a>
          )}
        </div>
        {/* Management actions (edit, duplicate, delete) */}
        <div className="flex flex-col justify-center gap-1 p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/sessions/${session.id}`)}
            title={language === 'fr' ? 'Modifier' : 'Edit'}
          >
            <Pencil size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDuplicate(session)}
            title={t.duplicate}
            disabled={duplicatingId === session.id}
          >
            <CopyPlus size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteSession(session)}
            title={t.delete}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
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

      {/* Control Error Banner */}
      {controlError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {controlError}
        </div>
      )}

      {/* Status Filters */}
      {sessions.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {statusFilters.map((f) => {
            const count = f.key === 'all' ? sessions.length : (statusCounts[f.key] || 0);
            if (f.key !== 'all' && count === 0) return null;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === f.key
                    ? 'bg-theatarr-500 text-white'
                    : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
                }`}
              >
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  statusFilter === f.key
                    ? 'bg-white/20 text-white'
                    : 'bg-dark-border text-dark-muted'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
      ) : filteredSessions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-dark-muted">{language === 'fr' ? 'Aucune session avec ce statut' : 'No sessions with this status'}</p>
        </Card>
      ) : groupedSessions ? (
        /* Grouped "All" view */
        <div className="space-y-6">
          {groupedSessions.map((group, groupIndex) => (
            <div key={group.status}>
              {/* Group separator */}
              {groupIndex > 0 && (
                <div className="mb-4 border-t border-dark-border/50" />
              )}
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(group.status).color}`}>
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-dark-border/30" />
                <span className="text-xs text-dark-muted">{group.sessions.length}</span>
              </div>
              {/* Group sessions */}
              <div className="space-y-3">
                {group.sessions.map((session) => {
                  const statusBadge = getStatusBadge(session.status);
                  const movieDisplay = getMovieDisplay(session);
                  const MovieIcon = movieDisplay.icon;
                  const voteSession = session.linked_vote_session;
                  return (
                    <div
                      key={session.id}
                      className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-dark-muted/50 transition-colors"
                    >
                      {renderSessionCard(session, statusBadge, movieDisplay, MovieIcon, voteSession)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Filtered view (single status) */
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const statusBadge = getStatusBadge(session.status);
            const movieDisplay = getMovieDisplay(session);
            const MovieIcon = movieDisplay.icon;
            const voteSession = session.linked_vote_session;
            return (
              <div
                key={session.id}
                className="bg-dark-surface border border-dark-border rounded-xl overflow-hidden hover:border-dark-muted/50 transition-colors"
              >
                {renderSessionCard(session, statusBadge, movieDisplay, MovieIcon, voteSession)}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteSession}
        onClose={() => { setDeleteSession(null); setDeleteError(null); }}
        title={t.deleteConfirm}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-dark-text">{t.deleteWarning}</p>
          <p className="text-sm text-dark-muted font-medium">"{deleteSession?.name}"</p>
          {deleteError && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDeleteSession(null); setDeleteError(null); }}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '...' : t.delete}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vote Results Modal */}
      <Modal
        isOpen={!!voteResultsSession}
        onClose={() => setVoteResultsSession(null)}
        title={t.voteResults}
        size="md"
      >
        {voteResultsSession && voteResultsSession.movie_options && (
          <div className="space-y-3">
            {voteResultsSession.movie_options
              .map((movie, index) => ({ ...movie, index }))
              .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
              .map((movie, displayIndex) => {
                const isWinner = movie.index === voteResultsSession.winning_movie_index;
                return (
                  <div
                    key={movie.index}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      isWinner
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-dark-bg border-dark-border'
                    )}
                  >
                    {/* Rank */}
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      isWinner ? 'bg-yellow-500 text-black' : 'bg-dark-border text-dark-muted'
                    )}>
                      {displayIndex + 1}
                    </div>

                    {/* Poster */}
                    <div className="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-dark-border">
                      {movie.poster_url ? (
                        <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film size={16} className="text-dark-muted" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dark-text truncate">{movie.title}</span>
                        {isWinner && <Trophy size={14} className="text-yellow-500 flex-shrink-0" />}
                      </div>
                      {movie.year && (
                        <span className="text-xs text-dark-muted">{movie.year}</span>
                      )}
                    </div>

                    {/* Vote count */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-dark-text">{movie.vote_count || 0}</div>
                      <div className="text-xs text-dark-muted">{t.votes}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Modal>
    </div>
  );
}
