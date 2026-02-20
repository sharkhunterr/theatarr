import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  QrCode,
} from 'lucide-react';
import clsx from 'clsx';
import { getMysteryRevealCountdown, getVoteRevealCountdown } from '../utils/countdown';
import { useCountdown } from '../hooks/useCountdown';
import { useSetting } from '../hooks/useSettings';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { MysteryPoster } from '../components/common/MysteryPoster';
import { VotePoster } from '../components/common/VotePoster';
import { VotePosterCollage } from '../components/common/VotePosterCollage';
import { Button, Card, Spinner, Modal, PageHeader, ButtonGroup } from '../components/common';
import { useSessionStore, Session, SessionState, VoteSessionSummary } from '../stores/sessionStore';
import { useSession } from '../hooks/useSession';
import { useWebSocket } from '../hooks/useWebSocket';
import { apiClient } from '../api/client';
import { QrScannerModal } from '../components/sessions/QrScannerModal';

export function SessionsPage() {
  useCountdown();
  const posterDisplay = useSetting<string>('voting.poster_display', 'animation');
  const navigate = useNavigate();
  const { t } = useTranslation(['sessions', 'common']);
  const { formatDate } = useLocaleFormat();
  const { sessions, isLoading } = useSessionStore();
  const { fetchSessions } = useSession();
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [voteResultsSession, setVoteResultsSession] = useState<VoteSessionSummary | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showScanner, setShowScanner] = useState(false);

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
      setControlError(error?.message || t('sessions:list.controlError'));
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
      setControlError(error?.message || t('sessions:list.stopError'));
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
      setDeleteError(error?.message || t('sessions:list.deleteError'));
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
      setControlError(error?.message || t('sessions:list.duplicationError'));
      setTimeout(() => setControlError(null), 4000);
    } finally {
      setDuplicatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: t('sessions:list.draft') },
      scheduled: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: t('sessions:list.scheduled') },
      running: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: t('sessions:list.running') },
      paused: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: t('sessions:list.paused') },
      completed: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: t('sessions:list.completed') },
      interrupted: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: t('sessions:list.interrupted') },
    };
    return config[status] || config.draft;
  };

  const getVoteStatusBadge = (voteSession: VoteSessionSummary) => {
    if (voteSession.status === 'open') {
      return { color: 'bg-green-500/20 text-green-400', label: t('sessions:list.voteOpen'), icon: Vote };
    } else if (voteSession.status === 'closed') {
      return { color: 'bg-blue-500/20 text-blue-400', label: t('sessions:list.voteClosed'), icon: Trophy };
    }
    return { color: 'bg-gray-500/20 text-gray-400', label: t('sessions:list.voteDraft'), icon: Vote };
  };

  const formatSessionDate = (dateStr: string) => {
    return formatDate(dateStr, {
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
        title: t('sessions:list.waitingForVote'),
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
        title: t('sessions:list.mystery'),
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
      title: t('sessions:list.noMovie'),
      icon: Film,
      iconColor: 'text-dark-muted',
      type: 'none',
    };
  };

  const STATUS_ORDER = ['running', 'paused', 'scheduled', 'draft', 'completed', 'interrupted'];

  const statusFilters = [
    { key: 'all', label: t('sessions:list.all') },
    { key: 'running', label: t('sessions:list.running') },
    { key: 'paused', label: t('sessions:list.paused') },
    { key: 'scheduled', label: t('sessions:list.scheduled') },
    { key: 'draft', label: t('sessions:list.draft') },
    { key: 'completed', label: t('sessions:list.completed') },
    { key: 'interrupted', label: t('sessions:list.interrupted') },
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
    <div className="flex gap-0">
      {/* Movie Poster / Placeholder - always visible */}
      <div className="w-[72px] sm:w-24 flex-shrink-0 relative">
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
            <MovieIcon size={24} className={movieDisplay.iconColor} />
          </div>
        )}
        {/* Status overlay on poster */}
        {session.status === 'running' && (
          <div className="absolute top-1.5 left-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse block" />
          </div>
        )}
      </div>

      {/* Content + Actions */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 p-3 sm:p-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              to={`/sessions/${session.id}`}
              className="text-sm font-medium text-dark-text hover:text-theatarr-500 transition-colors line-clamp-1"
            >
              {session.name}
            </Link>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex-shrink-0 ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>

          {/* Movie info */}
          <div className="flex items-center gap-1.5 text-xs text-dark-muted mb-2">
            <MovieIcon size={12} className={clsx(movieDisplay.iconColor, 'flex-shrink-0')} />
            <span className="truncate">{movieDisplay.title}</span>
            {(session.preparing_trailers ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-400 flex-shrink-0">
                <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('sessions:list.preparingTrailers')}
              </span>
            )}
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
                        <span className="hidden sm:inline">{t('sessions:list.seeResults')}</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-muted">
            {session.scheduled_at && (
              <span className="flex items-center gap-1 text-purple-400">
                <Calendar size={11} />
                <span className="hidden sm:inline">{formatSessionDate(session.scheduled_at)}</span>
                <span className="sm:hidden">{formatDate(session.scheduled_at, { day: 'numeric', month: 'short' })}</span>
              </span>
            )}
            {(session.participants_total ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Users size={11} />
                {session.participants_accepted ?? 0}/{session.participants_total}
              </span>
            )}
            {(session.actions_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Zap size={11} />
                {session.actions_count}
              </span>
            )}
            {session.display_code && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(session.display_code!);
                  setCopiedCode(session.id);
                  setTimeout(() => setCopiedCode(null), 2000);
                }}
                title={copiedCode === session.id ? t('sessions:list.codeCopied') : t('sessions:list.copyCode')}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dark-border/80 hover:bg-dark-muted/50 transition-colors"
              >
                <ScreenShare size={10} className="text-theatarr-500" />
                <span className="font-mono text-[10px] tracking-wider">{session.display_code}</span>
                {copiedCode === session.id ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
              </button>
            )}
            {(session.feedback_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                <Star size={10} />
                {session.feedback_average?.toFixed(1) || '—'}/10
                <span className="text-amber-400/50">({session.feedback_count})</span>
              </span>
            )}
          </div>
        </div>

        {/* Actions bar at bottom */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-dark-border/50 bg-dark-bg/30">
          {/* Session controls */}
          {(session.status === 'draft' || session.status === 'scheduled' || session.status === 'interrupted' || session.status === 'paused') && (
            <button
              onClick={() => handlePlayPause(session)}
              title={session.status === 'paused' ? t('sessions:list.resume') : t('sessions:list.play')}
              disabled={controllingId === session.id || (session.actions_count ?? 0) === 0}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-dark-border/50 transition-colors disabled:opacity-50"
            >
              <Play className={clsx('h-3.5 w-3.5', session.status === 'paused' ? 'text-yellow-400' : 'text-green-400')} />
            </button>
          )}
          {session.status === 'running' && (
            <button
              onClick={() => handlePlayPause(session)}
              title={t('sessions:list.pause')}
              disabled={controllingId === session.id}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-dark-border/50 transition-colors disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5 text-yellow-400" />
            </button>
          )}
          {(session.status === 'running' || session.status === 'paused') && (
            <button
              onClick={() => handleStop(session)}
              title={t('sessions:list.stop')}
              disabled={controllingId === session.id}
              className="h-8 w-8 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Separator */}
          {(session.status === 'running' || session.status === 'paused' || session.status === 'draft' || session.status === 'scheduled' || session.status === 'interrupted') && (
            <div className="w-px h-4 bg-dark-border/50 mx-0.5" />
          )}

          {/* Links */}
          {session.display_code && (
            <a
              href={`/display/${session.display_code}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('sessions:list.display')}
              className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <ScreenShare className="h-3.5 w-3.5" />
            </a>
          )}
          {(session.movie_id || session.movie_title || session.scheduled_at) && (
            <a
              href={`/wallmount/${session.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t('sessions:list.wallmount')}
              className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-theatarr-500 hover:bg-theatarr-500/10 transition-colors"
            >
              <Monitor className="h-3.5 w-3.5" />
            </a>
          )}
          {session.qr_tickets_enabled && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowScanner(true); }}
              title={t('sessions:list.scanTicket')}
              className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-green-400 hover:bg-green-500/10 transition-colors"
            >
              <QrCode className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Management actions */}
          <button
            onClick={() => navigate(`/sessions/${session.id}`)}
            title={t('sessions:list.edit')}
            className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-dark-text hover:bg-dark-border/50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDuplicate(session)}
            title={t('sessions:list.duplicate')}
            disabled={duplicatingId === session.id}
            className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-dark-text hover:bg-dark-border/50 transition-colors disabled:opacity-50"
          >
            <CopyPlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDeleteSession(session)}
            title={t('sessions:list.delete')}
            className="h-8 w-8 flex items-center justify-center rounded-md text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
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
      <PageHeader
        title={t('sessions:list.title')}
        subtitle={t('sessions:list.subtitle')}
      />

      {/* Control Error Banner */}
      {controlError && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {controlError}
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex items-center justify-between mb-6">
        {sessions.length > 0 ? (
          <ButtonGroup
            options={statusFilters
              .filter((f) => f.key === 'all' || (statusCounts[f.key] || 0) > 0)
              .map((f) => ({
                key: f.key,
                label: f.label,
                count: f.key === 'all' ? sessions.length : (statusCounts[f.key] || 0),
              }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        ) : <div />}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => fetchSessions()} className="h-9 w-9 !p-0 flex items-center justify-center">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => navigate('/sessions/new')} className="h-9">
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">{t('sessions:list.addSession')}</span>
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card className="p-6 text-center">
          <Play size={32} className="mx-auto text-dark-muted mb-3" />
          <p className="text-sm text-dark-muted mb-4">{t('sessions:list.noSessions')}</p>
          <Button onClick={() => navigate('/sessions/new')} className="h-10">
            <Plus className="h-4 w-4 mr-2" />
            {t('sessions:list.createFirst')}
          </Button>
        </Card>
      ) : filteredSessions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-dark-muted">{t('sessions:list.noSessionsWithStatus')}</p>
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
                      className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-dark-muted/50 transition-colors shadow-sm"
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
                className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-dark-muted/50 transition-colors shadow-sm"
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
        title={t('sessions:list.deleteConfirm')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-dark-text">{t('sessions:list.deleteWarning')}</p>
          <p className="text-sm text-dark-muted font-medium">"{deleteSession?.name}"</p>
          {deleteError && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {deleteError}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDeleteSession(null); setDeleteError(null); }}>
              {t('sessions:list.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '...' : t('sessions:list.delete')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vote Results Modal */}
      <Modal
        isOpen={!!voteResultsSession}
        onClose={() => setVoteResultsSession(null)}
        title={t('sessions:list.voteResults')}
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
                      <div className="text-xs text-dark-muted">{t('sessions:list.votes')}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Modal>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
      />
    </div>
  );
}
