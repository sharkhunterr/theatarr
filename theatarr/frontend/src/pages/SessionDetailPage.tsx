/**
 * Admin session detail page with real-time timeline.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Copy,
  Edit3,
  Eye,
  Film,
  Monitor,
  Pause,
  Play,
  ScreenShare,
  Shuffle,
  SkipForward,
  Sparkles,
  Square,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
  Star,
  ChevronDown,
  ChevronRight,
  Activity,
  Tag,
  Timer,
  Image,
  Globe,
} from 'lucide-react';

import { Button, Modal, Spinner, MysteryPoster, VotePoster, VotePosterCollage } from '../components/common';
import { TimelineDetailModal } from '../components/sessions/TimelineDetailModal';
import { EventTimeline } from '../components/history/EventTimeline';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCountdown } from '../hooks/useCountdown';
import { useSetting } from '../hooks/useSettings';
import { useLayoutStore } from '../stores/layoutStore';
import {
  type Session,
  type SessionState,
  type Sequence,
  type VoteSessionSummary,
} from '../stores/sessionStore';
import {
  getMysteryRevealCountdown,
  getVoteRevealCountdown,
  getSessionStartCountdown,
} from '../utils/countdown';
import {
  ACTION_TYPE_COLORS,
  ACTION_TYPE_ICONS,
  getBlockDuration,
  computeProportionalWidths,
  computeKnownManualMs,
  formatDuration,
} from '../utils/timeline';

// ============================================================================
// Types
// ============================================================================

interface Participant {
  id: string;
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  invitation_status: 'pending' | 'accepted' | 'declined';
  invited_at: string | null;
  responded_at: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string, language: string) {
  const labels: Record<string, { fr: string; en: string }> = {
    draft: { fr: 'Brouillon', en: 'Draft' },
    scheduled: { fr: 'Programmee', en: 'Scheduled' },
    running: { fr: 'En cours', en: 'Running' },
    paused: { fr: 'En pause', en: 'Paused' },
    completed: { fr: 'Terminee', en: 'Completed' },
    interrupted: { fr: 'Interrompue', en: 'Interrupted' },
  };
  const colors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    interrupted: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return {
    label: language === 'fr' ? labels[status]?.fr : labels[status]?.en || status,
    color: colors[status] || colors.draft,
  };
}

// ============================================================================
// Timeline Component (improved with proportional widths + multi-stripe)
// ============================================================================

function SessionTimeline({
  sequences,
  currentIndex,
  elapsedMs,
  status,
  language,
  movieRuntimeMs,
}: {
  sequences: Sequence[];
  currentIndex: number;
  elapsedMs: number;
  status: string;
  language: string;
  movieRuntimeMs: number;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const widths = useMemo(
    () => computeProportionalWidths(sequences, movieRuntimeMs),
    [sequences, movieRuntimeMs],
  );

  const knownManualMs = useMemo(
    () => computeKnownManualMs(sequences),
    [sequences],
  );

  if (sequences.length === 0) {
    return (
      <div className="text-sm text-dark-muted text-center py-4">
        {language === 'fr' ? 'Aucune sequence' : 'No sequences'}
      </div>
    );
  }

  const isActive = status === 'running' || status === 'paused';
  const isComplete = status === 'completed';
  const currentSeq = sequences[currentIndex];
  const currentDuration = currentSeq
    ? getBlockDuration(currentSeq, movieRuntimeMs, knownManualMs)
    : 0;
  const progress = currentDuration > 0 ? Math.min(elapsedMs / currentDuration, 1) : 0;

  return (
    <div className="space-y-2">
      <div className="relative h-8 sm:h-10 flex rounded-lg overflow-hidden bg-dark-bg border border-dark-border">
        {sequences.map((seq, index) => {
          const widthPercent = widths[index] || 0;
          const isCurrent = index === currentIndex;
          const isPast = isComplete ? true : index < currentIndex;
          const isHovered = hoveredIndex === index;
          const types = seq.action_types || [];
          const colors = types.length > 0
            ? types.map((t) => ACTION_TYPE_COLORS[t] || '#6b7280')
            : ['#6b7280'];

          return (
            <div
              key={seq.id}
              className="relative h-full cursor-default"
              style={{ width: `${widthPercent}%` }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Multi-stripe background */}
              <div className="absolute inset-0 flex flex-col">
                {colors.map((c, ci) => (
                  <div
                    key={ci}
                    className={clsx(
                      'flex-1 transition-opacity',
                      isCurrent && isActive && 'animate-pulse',
                    )}
                    style={{
                      backgroundColor: c,
                      opacity: isPast ? 0.6 : isCurrent ? 0.4 : 0.15,
                    }}
                  />
                ))}
              </div>

              {/* Progress fill for current sequence */}
              {isCurrent && isActive && (
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="h-full flex flex-col transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress * 100}%` }}
                  >
                    {colors.map((c, ci) => (
                      <div
                        key={ci}
                        className="flex-1"
                        style={{ backgroundColor: c, opacity: 0.7 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Separator */}
              {index < sequences.length - 1 && (
                <div className="absolute right-0 inset-y-0 w-px bg-dark-bg/50 z-10" />
              )}

              {/* Cursor */}
              {isCurrent && isActive && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] z-20 transition-[left] duration-1000 ease-linear"
                  style={{ left: `${progress * 100}%` }}
                />
              )}

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
                  <div className="bg-dark-surface border border-dark-border rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                    <div className="text-xs font-medium text-dark-text">{seq.name}</div>
                    <div className="text-[10px] text-dark-muted mt-0.5">
                      {formatDuration(getBlockDuration(seq, movieRuntimeMs, knownManualMs))}
                      {(seq.actions_count ?? 0) > 0 && (
                        <span className="ml-2">
                          {seq.actions_count} action{(seq.actions_count ?? 0) > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {types.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {types.map((type) => {
                          const Icon = ACTION_TYPE_ICONS[type] || Zap;
                          return (
                            <span
                              key={type}
                              className="inline-flex items-center gap-0.5 text-[10px]"
                              style={{ color: ACTION_TYPE_COLORS[type] || '#6b7280' }}
                            >
                              <Icon size={10} />
                              {type}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend + current sequence info */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-dark-muted">
        <div className="flex items-center gap-1">
          {currentSeq && (isActive || isComplete) && (
            <>
              <span>
                Seq {currentIndex + 1}/{sequences.length}
                {' — '}
                <span className="text-dark-text">{currentSeq.name}</span>
              </span>
              <span className="ml-2">
                {formatDuration(elapsedMs)} / {formatDuration(currentDuration)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(ACTION_TYPE_COLORS).map(([type, color]) => {
            const Icon = ACTION_TYPE_ICONS[type] || Zap;
            const hasType = sequences.some((s) => s.action_types?.includes(type));
            if (!hasType) return null;
            return (
              <span key={type} className="inline-flex items-center gap-0.5 text-[10px]" style={{ color }}>
                <Icon size={10} />
                {type}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Participants Component
// ============================================================================

function ParticipantsSection({
  participants,
  isLoading,
  language,
}: {
  participants: Participant[];
  isLoading: boolean;
  language: string;
}) {
  const t = {
    title: language === 'fr' ? 'Participants' : 'Participants',
    accepted: language === 'fr' ? 'acceptes' : 'accepted',
    invited: language === 'fr' ? 'invites' : 'invited',
    pending: language === 'fr' ? 'En attente' : 'Pending',
    acceptedLabel: language === 'fr' ? 'Accepte' : 'Accepted',
    declined: language === 'fr' ? 'Refuse' : 'Declined',
    noParticipants: language === 'fr' ? 'Aucun participant invite' : 'No participants invited',
  };

  if (isLoading) {
    return (
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <div className="h-6 w-32 bg-dark-border rounded animate-pulse mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 bg-dark-border rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const accepted = participants.filter((p) => p.invitation_status === 'accepted');
  const pending = participants.filter((p) => p.invitation_status === 'pending');
  const declined = participants.filter((p) => p.invitation_status === 'declined');

  if (participants.length === 0) {
    return (
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h3 className="text-sm font-medium text-dark-text mb-2">{t.title}</h3>
        <p className="text-sm text-dark-muted">{t.noParticipants}</p>
      </div>
    );
  }

  const getInitials = (p: Participant) => {
    if (p.first_name && p.last_name) return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
    return p.username.slice(0, 2).toUpperCase();
  };

  const getDisplayName = (p: Participant) => {
    if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
    return p.username;
  };

  const renderGroup = (
    items: Participant[],
    icon: typeof Check,
    iconColor: string,
    bgColor: string,
    label: string,
  ) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon size={12} className={iconColor} />
          <span className="text-xs text-dark-muted">{label} ({items.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((p) => (
            <div
              key={p.id}
              className={clsx(
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border',
                bgColor,
              )}
              title={p.email || p.username}
            >
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium',
                bgColor.includes('green') ? 'bg-green-500/30 text-green-300' :
                bgColor.includes('yellow') ? 'bg-yellow-500/30 text-yellow-300' :
                'bg-red-500/30 text-red-300',
              )}>
                {getInitials(p)}
              </div>
              <span className="text-xs text-dark-text">{getDisplayName(p)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-dark-text flex items-center gap-2">
          <Users size={14} className="text-dark-muted" />
          {t.title}
        </h3>
        <span className="text-xs text-dark-muted">
          {accepted.length} {t.accepted} / {participants.length} {t.invited}
        </span>
      </div>
      <div className="space-y-3">
        {renderGroup(accepted, Check, 'text-green-400', 'bg-green-500/10 border-green-500/20', t.acceptedLabel)}
        {renderGroup(pending, Clock, 'text-yellow-400', 'bg-yellow-500/10 border-yellow-500/20', t.pending)}
        {renderGroup(declined, X, 'text-red-400', 'bg-red-500/10 border-red-500/20', t.declined)}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function SessionDetailPage() {
  useCountdown();
  const posterDisplay = useSetting<string>('voting.poster_display', 'animation');
  const { id } = useParams<{ id: string }>();
  const { language } = useLayoutStore();

  // Fetch session
  const {
    data: session,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['session-detail', id],
    queryFn: () => apiClient.get<Session>(`/sessions/${id}`),
    enabled: !!id,
    refetchInterval: false,
  });

  // Auto-refresh when trailers are being prepared
  useEffect(() => {
    if (!(session?.preparing_trailers)) return;
    const interval = setInterval(() => refetchSession(), 5000);
    return () => clearInterval(interval);
  }, [session?.preparing_trailers, refetchSession]);

  // Fetch participants
  const { data: participantsData, isLoading: isParticipantsLoading } = useQuery({
    queryKey: ['session-participants', id],
    queryFn: () => apiClient.get<{ items: Participant[]; total: number }>(`/sessions/${id}/participants`),
    enabled: !!id,
  });

  // Real-time state via WebSocket
  const [liveState, setLiveState] = useState<SessionState | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const token = localStorage.getItem('theatarr_token');

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    token,
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'session_state' && message.payload?.session_id === id) {
        const newState = message.payload as unknown as SessionState;
        setLiveState(newState);
        // Refetch full session data when status changes (e.g. running → paused → completed)
        if (prevStatusRef.current && prevStatusRef.current !== newState.status) {
          refetchSession();
        }
        prevStatusRef.current = newState.status;
      }
    },
  });

  useEffect(() => {
    if (isConnected && id) {
      subscribe('session');
      return () => unsubscribe('session');
    }
  }, [isConnected, id, subscribe, unsubscribe]);

  // Session control
  const [controllingAction, setControllingAction] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showTimelineDetail, setShowTimelineDetail] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleControl = useCallback(
    async (action: 'play' | 'pause' | 'stop' | 'skip') => {
      if (!id) return;
      setControllingAction(action);
      setControlError(null);
      try {
        await apiClient.post(`/sessions/${id}/control`, { action });
        refetchSession();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setControlError(msg);
        setTimeout(() => setControlError(null), 5000);
      } finally {
        setControllingAction(null);
      }
    },
    [id, refetchSession]
  );

  // Computed values
  const currentStatus = liveState?.status || session?.status || 'draft';
  const currentIndex = liveState?.current_sequence_index ?? session?.current_sequence_index ?? 0;
  const elapsedMs = liveState?.current_sequence_elapsed_ms ?? session?.current_sequence_elapsed_ms ?? 0;
  const sequences = session?.sequences || [];
  const movieRuntimeMs = (session?.movie_runtime_minutes ?? 0) * 60 * 1000;

  // Feedback status query (must be after currentStatus is defined)
  const { data: feedbackStatus } = useQuery({
    queryKey: ['feedback-status', id],
    queryFn: () => apiClient.get<{ has_submitted: boolean; feedback_count: number; overall_average: number | null }>(`/feedback/sessions/${id}/status`),
    enabled: !!id && (currentStatus === 'completed' || currentStatus === 'running'),
  });

  const isMysteryHidden = session?.movie_selection_mode === 'mystery' && !session?.movie_resolved;
  const isVoteHidden = session?.movie_selection_mode === 'vote' && !session?.movie_resolved;
  const isVoteRevealed = session?.movie_selection_mode === 'vote' && session?.movie_resolved;
  const isMysteryRevealed = session?.movie_selection_mode === 'mystery' && session?.movie_resolved;
  const canPlay = currentStatus === 'draft' || currentStatus === 'scheduled' || currentStatus === 'interrupted' || currentStatus === 'paused';
  const canPause = currentStatus === 'running';
  const canStop = currentStatus === 'running' || currentStatus === 'paused';
  const canSkip = currentStatus === 'running';

  const statusBadge = getStatusBadge(currentStatus, language);
  const bgColor = session?.color_palette?.primary || '#1a1a1a';

  const t = {
    back: language === 'fr' ? 'Sessions' : 'Sessions',
    edit: language === 'fr' ? 'Modifier' : 'Edit',
    play: language === 'fr' ? 'Lancer' : 'Play',
    resume: language === 'fr' ? 'Reprendre' : 'Resume',
    pause: 'Pause',
    stop: language === 'fr' ? 'Arreter' : 'Stop',
    skip: language === 'fr' ? 'Suivant' : 'Skip',
    details: language === 'fr' ? 'Details' : 'Details',
    description: 'Description',
    created: language === 'fr' ? 'Creee le' : 'Created',
    started: language === 'fr' ? 'Demarree le' : 'Started',
    ended: language === 'fr' ? 'Terminee le' : 'Ended',
    scheduled: language === 'fr' ? 'Programmee le' : 'Scheduled',
    displayCode: language === 'fr' ? 'Code display' : 'Display code',
    sequences: language === 'fr' ? 'sequences' : 'sequences',
    actions: language === 'fr' ? 'actions' : 'actions',
    mysteryMovie: language === 'fr' ? 'Film mystere' : 'Mystery movie',
    voteOpen: language === 'fr' ? 'Vote en cours' : 'Vote in progress',
    voteClosed: language === 'fr' ? 'Vote clos' : 'Vote closed',
    votePending: language === 'fr' ? 'Vote en attente' : 'Vote pending',
    linked: language === 'fr' ? 'Vote lie' : 'Linked vote',
    display: 'Display',
    wallmount: 'Wallmount',
    notFound: language === 'fr' ? 'Session non trouvee' : 'Session not found',
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
  };

  // ---- Loading / Error states ----

  if (isSessionLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="h-8 w-32 bg-dark-surface rounded animate-pulse" />
        <div className="h-48 bg-dark-surface rounded-xl animate-pulse" />
        <div className="h-20 bg-dark-surface rounded-xl animate-pulse" />
        <div className="h-32 bg-dark-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          <span>{t.back}</span>
        </Link>
        <div className="text-center py-12">
          <p className="text-dark-muted">{t.notFound}</p>
        </div>
      </div>
    );
  }

  const participants = participantsData?.items || [];
  const voteSession = session.linked_vote_session;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Header: Back + Edit */}
      <div className="flex items-center justify-between">
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
        >
          <ArrowLeft size={18} />
          <span>{t.back}</span>
        </Link>
        <Link
          to={`/sessions/${id}/edit`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-surface border border-dark-border text-sm text-dark-text hover:border-theatarr-500/50 hover:text-theatarr-500 transition-colors"
        >
          <Edit3 size={14} />
          {t.edit}
        </Link>
      </div>

      {/* Hero */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          backgroundColor: isMysteryHidden ? '#1a0a2e' : isVoteHidden ? '#0a1628' : bgColor,
        }}
      >
        {/* Background */}
        {isMysteryHidden ? (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-purple-900/20" />
        ) : isVoteHidden ? (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-transparent to-blue-900/20" />
        ) : session.movie_poster_url && (
          <div className="absolute inset-0">
            <img
              src={session.movie_poster_url}
              alt={session.movie_title || session.name}
              className="w-full h-full object-cover opacity-30 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        )}

        <div className="relative p-4 sm:p-6 flex gap-4">
          {/* Poster */}
          {isMysteryHidden ? (
            <MysteryPoster className="w-24 h-36 sm:w-28 sm:h-42 flex-shrink-0 rounded-lg shadow-lg" />
          ) : isVoteHidden ? (
            posterDisplay === 'posters' && voteSession?.movie_options?.length ? (
              <VotePosterCollage
                posters={voteSession.movie_options.map((o) => o.poster_url).filter((u): u is string => !!u)}
                className="w-24 h-36 sm:w-28 sm:h-42 flex-shrink-0 rounded-lg shadow-lg"
              />
            ) : (
              <VotePoster className="w-24 h-36 sm:w-28 sm:h-42 flex-shrink-0 rounded-lg shadow-lg" />
            )
          ) : (
            <div className="w-24 h-36 sm:w-28 sm:h-42 flex-shrink-0 rounded-lg overflow-hidden bg-dark-border shadow-lg">
              {session.movie_poster_url ? (
                <img
                  src={session.movie_poster_url}
                  alt={session.movie_title || session.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dark-muted">
                  <Film size={32} />
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 flex flex-col justify-end min-w-0">
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium border', statusBadge.color)}>
                {statusBadge.label}
              </span>
              {currentStatus === 'running' && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
              {(session.preparing_trailers ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/25">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Préparation BA
                </span>
              )}
              {/* Session start countdown */}
              {session.scheduled_at && (currentStatus === 'scheduled' || currentStatus === 'draft') && (() => {
                const countdown = getSessionStartCountdown(session.scheduled_at);
                if (countdown.urgency === 'low') return null;
                return (
                  <span
                    className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', countdown.pulse && 'animate-pulse')}
                    style={{ backgroundColor: `${countdown.color}20`, color: countdown.color }}
                  >
                    {countdown.text}
                  </span>
                );
              })()}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{session.name}</h1>

            {/* Movie info */}
            {isMysteryHidden ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Shuffle size={14} className="text-purple-400" />
                  <span className="text-purple-300 font-medium text-sm">{t.mysteryMovie}</span>
                </div>
                {session.mystery_reveal_at && (() => {
                  const reveal = getMysteryRevealCountdown(session.mystery_reveal_at);
                  return (
                    <span
                      className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', reveal.pulse && 'animate-pulse')}
                      style={{ backgroundColor: `${reveal.color}20`, color: reveal.color }}
                    >
                      <Eye size={10} />
                      {reveal.text}
                    </span>
                  );
                })()}
              </div>
            ) : isVoteHidden ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Vote size={14} className="text-blue-400" />
                  <span className="text-blue-300 font-medium text-sm">
                    {voteSession?.is_open === false ? t.voteClosed : t.voteOpen}
                  </span>
                </div>
                {session.vote_reveal_at && (() => {
                  const reveal = getVoteRevealCountdown(session.vote_reveal_at);
                  return (
                    <span
                      className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', reveal.pulse && 'animate-pulse')}
                      style={{ backgroundColor: `${reveal.color}20`, color: reveal.color }}
                    >
                      <Eye size={10} />
                      {reveal.text}
                    </span>
                  );
                })()}
              </div>
            ) : isMysteryRevealed ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles size={14} className="text-purple-400" />
                <p className="text-white/80 text-sm">{session.movie_title}</p>
              </div>
            ) : isVoteRevealed ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Trophy size={14} className="text-yellow-500" />
                <p className="text-white/80 text-sm">{session.movie_title}</p>
              </div>
            ) : session.movie_title ? (
              <p className="text-white/80 mt-1 text-sm">{session.movie_title}</p>
            ) : null}

            {/* Quick meta */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/50">
              {session.scheduled_at && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDateShort(session.scheduled_at)}
                </span>
              )}
              {sequences.length > 0 && (
                <span className="flex items-center gap-1">
                  <Zap size={12} />
                  {sequences.length} {t.sequences}
                </span>
              )}
              {session.display_code && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(session.display_code!);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ScreenShare size={10} />
                  <span className="font-mono tracking-wider">{session.display_code}</span>
                  {copiedCode ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
                </button>
              )}
              {feedbackStatus && feedbackStatus.feedback_count > 0 && (
                <button
                  onClick={() => setShowFeedbackModal(true)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                >
                  <Star size={10} />
                  <span>{feedbackStatus.overall_average?.toFixed(1) || '—'}/10</span>
                  <span className="text-white/40">({feedbackStatus.feedback_count})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls + Timeline */}
      {sequences.length > 0 && (
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-3">
          {/* Control buttons */}
          <div className="flex items-center gap-2">
            {canPlay && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleControl(currentStatus === 'paused' ? 'play' : 'play')}
                disabled={controllingAction !== null}
                isLoading={controllingAction === 'play'}
              >
                <Play size={14} className="mr-1" />
                {currentStatus === 'paused' ? t.resume : t.play}
              </Button>
            )}
            {canPause && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleControl('pause')}
                disabled={controllingAction !== null}
                isLoading={controllingAction === 'pause'}
              >
                <Pause size={14} className="mr-1" />
                {t.pause}
              </Button>
            )}
            {canSkip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleControl('skip')}
                disabled={controllingAction !== null}
                isLoading={controllingAction === 'skip'}
              >
                <SkipForward size={14} className="mr-1" />
                {t.skip}
              </Button>
            )}
            {canStop && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleControl('stop')}
                disabled={controllingAction !== null}
                isLoading={controllingAction === 'stop'}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Square size={14} className="mr-1" />
                {t.stop}
              </Button>
            )}

            {/* Quick links */}
            <div className="flex-1" />
            <button
              onClick={() => setShowTimelineDetail(true)}
              title={language === 'fr' ? 'Detail timeline' : 'Timeline detail'}
              className="p-1.5 rounded-lg text-dark-muted hover:text-green-400 hover:bg-green-500/10 transition-colors"
            >
              <BarChart3 size={16} />
            </button>
            {session.display_code && (
              <a
                href={`/display/${session.display_code}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t.display}
                className="p-1.5 rounded-lg text-dark-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                <ScreenShare size={16} />
              </a>
            )}
            {(session.movie_id || session.movie_title || session.scheduled_at) && (
              <a
                href={`/wallmount/${session.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={t.wallmount}
                className="p-1.5 rounded-lg text-dark-muted hover:text-theatarr-500 hover:bg-theatarr-500/10 transition-colors"
              >
                <Monitor size={16} />
              </a>
            )}
          </div>

          {/* Error banner */}
          {controlError && (
            <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs">
              {controlError}
            </div>
          )}

          {/* Timeline */}
          <SessionTimeline
            sequences={sequences}
            currentIndex={currentIndex}
            elapsedMs={elapsedMs}
            status={currentStatus}
            language={language}
            movieRuntimeMs={movieRuntimeMs}
          />
        </div>
      )}

      {/* Timeline Detail Modal */}
      <TimelineDetailModal
        isOpen={showTimelineDetail}
        onClose={() => setShowTimelineDetail(false)}
        sessionId={id!}
        language={language}
        currentIndex={currentIndex}
        elapsedMs={elapsedMs}
        status={currentStatus}
      />

      {/* Feedback Modal */}
      {showFeedbackModal && id && (
        <FeedbackModal
          sessionId={id}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {/* Participants */}
      <ParticipantsSection
        participants={participants}
        isLoading={isParticipantsLoading}
        language={language}
      />

      {/* Details */}
      <SessionDetailsSection session={session} voteSession={voteSession} language={language} />

      {/* Activity / Events */}
      <SessionActivitySection sessionId={id!} startedAt={session.started_at} language={language} />
    </div>
  );
}


// ============================================================================
// Session Details Section
// ============================================================================

interface WorkflowAction {
  nodeType: string;
  action_type: string;
  command: string;
  parameters: Record<string, unknown>;
  label?: string;
  sequence_name?: string;
}

function extractActionsFromWorkflow(workflow: Record<string, unknown> | undefined): WorkflowAction[] {
  if (!workflow) return [];
  const nodes = (workflow.nodes as Array<{ id: string; data: WorkflowAction }>) || [];
  const actionNodes = nodes.filter(n => n.data?.nodeType === 'action');

  // Follow edges for execution order
  const edges = (workflow.edges as Array<{ source: string; target: string }>) || [];
  const edgeMap: Record<string, string> = {};
  for (const e of edges) edgeMap[e.source] = e.target;

  const nodeMap: Record<string, WorkflowAction> = {};
  for (const n of actionNodes) nodeMap[n.id] = n.data;

  const ordered: WorkflowAction[] = [];
  const visited = new Set<string>();
  let current = 'start';
  while (edgeMap[current] && !visited.has(current)) {
    visited.add(current);
    const target = edgeMap[current];
    if (nodeMap[target]) ordered.push(nodeMap[target]);
    current = target;
  }

  return ordered.length > 0 ? ordered : actionNodes.map(n => n.data);
}

function formatRuntimeMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

function SessionDetailsSection({
  session,
  voteSession,
  language,
}: {
  session: Session;
  voteSession: VoteSessionSummary | undefined;
  language: string;
}) {
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const md = session.movie_details;
  const actions = useMemo(() => extractActionsFromWorkflow(session.workflow), [session.workflow]);

  const t = {
    details: language === 'fr' ? 'Details' : 'Details',
    movieInfo: language === 'fr' ? 'Film' : 'Movie',
    sessionInfo: language === 'fr' ? 'Session' : 'Session',
    scheduled: language === 'fr' ? 'Programmee le' : 'Scheduled',
    started: language === 'fr' ? 'Demarree le' : 'Started',
    ended: language === 'fr' ? 'Terminee le' : 'Ended',
    created: language === 'fr' ? 'Creee le' : 'Created',
    linked: language === 'fr' ? 'Vote lie' : 'Linked vote',
    voteOpen: language === 'fr' ? 'Vote en cours' : 'Vote in progress',
    voteClosed: language === 'fr' ? 'Vote clos' : 'Vote closed',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    noActions: language === 'fr' ? 'Aucune action configuree' : 'No actions configured',
    enrichment: language === 'fr' ? 'Enrichissement' : 'Enrichment',
  };

  return (
    <div className="space-y-4">
      {/* Movie Details */}
      {md && (session.movie_title || md.genres?.length) && (
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-3">
          <h3 className="text-sm font-medium text-dark-text flex items-center gap-2">
            <Film size={14} className="text-theatarr-500" />
            {t.movieInfo}
          </h3>

          {session.description && (
            <p className="text-sm text-dark-muted">{session.description}</p>
          )}

          {/* Movie meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {md.year && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={13} className="text-dark-muted flex-shrink-0" />
                <span className="text-dark-text">{md.year}</span>
              </div>
            )}
            {md.runtime_minutes && (
              <div className="flex items-center gap-2 text-sm">
                <Timer size={13} className="text-dark-muted flex-shrink-0" />
                <span className="text-dark-text">{formatRuntimeMin(md.runtime_minutes)}</span>
              </div>
            )}
            {md.tmdb_id && (
              <div className="flex items-center gap-2 text-sm">
                <Globe size={13} className="text-dark-muted flex-shrink-0" />
                <span className="text-dark-muted">TMDB {md.tmdb_id}</span>
              </div>
            )}
            {md.enrichment_sources && md.enrichment_sources.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Image size={13} className="text-dark-muted flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  {md.enrichment_sources.map((src) => (
                    <span key={src} className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/15 text-green-400 border border-green-500/20">
                      {src.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Genres */}
          {md.genres && md.genres.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={12} className="text-dark-muted flex-shrink-0" />
              {md.genres.map((g) => (
                <span key={g} className="px-2 py-0.5 rounded-full text-xs bg-dark-border text-dark-text">
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {md.overview && (
            <div>
              <p className={clsx(
                'text-sm text-dark-muted leading-relaxed',
                !overviewExpanded && 'line-clamp-3',
              )}>
                {md.overview}
              </p>
              {md.overview.length > 200 && (
                <button
                  onClick={() => setOverviewExpanded(!overviewExpanded)}
                  className="text-xs text-theatarr-500 hover:text-theatarr-400 mt-1 transition-colors"
                >
                  {overviewExpanded
                    ? (language === 'fr' ? 'Voir moins' : 'See less')
                    : (language === 'fr' ? 'Voir plus' : 'See more')}
                </button>
              )}
            </div>
          )}

          {/* Color palette */}
          {session.color_palette && (
            <div className="flex items-center gap-1.5">
              {[
                session.color_palette.primary,
                session.color_palette.secondary,
                session.color_palette.accent,
                session.color_palette.vibrant,
                session.color_palette.vibrant_light,
                session.color_palette.vibrant_dark,
                session.color_palette.muted,
              ]
                .filter(Boolean)
                .map((color, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded border border-dark-border"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Session Info */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-3">
        <h3 className="text-sm font-medium text-dark-text flex items-center gap-2">
          <Clock size={14} className="text-dark-muted" />
          {t.sessionInfo}
        </h3>

        {!md && session.description && (
          <p className="text-sm text-dark-muted">{session.description}</p>
        )}

        {/* Vote session link */}
        {voteSession && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-bg border border-dark-border">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center',
              voteSession.is_open ? 'bg-green-500/20' : 'bg-blue-500/20',
            )}>
              {voteSession.is_open ? (
                <Vote size={16} className="text-green-400" />
              ) : (
                <Trophy size={16} className="text-blue-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-dark-text">{t.linked}: {voteSession.name}</p>
              <p className="text-xs text-dark-muted">
                {voteSession.total_votes} vote{voteSession.total_votes !== 1 ? 's' : ''}
                {voteSession.is_open ? ` — ${t.voteOpen}` : ` — ${t.voteClosed}`}
              </p>
            </div>
            <Link
              to="/votes"
              className="text-xs text-theatarr-500 hover:text-theatarr-400 transition-colors"
            >
              <Eye size={14} />
            </Link>
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {session.scheduled_at && (
            <div className="flex items-center gap-2 text-dark-muted">
              <Calendar size={14} className="text-purple-400 flex-shrink-0" />
              <div>
                <span className="text-dark-text">{t.scheduled}</span>
                <p className="text-xs">{formatDate(session.scheduled_at)}</p>
              </div>
            </div>
          )}
          {session.started_at && (
            <div className="flex items-center gap-2 text-dark-muted">
              <Play size={14} className="text-green-400 flex-shrink-0" />
              <div>
                <span className="text-dark-text">{t.started}</span>
                <p className="text-xs">{formatDate(session.started_at)}</p>
              </div>
            </div>
          )}
          {session.completed_at && (
            <div className="flex items-center gap-2 text-dark-muted">
              <Check size={14} className="text-blue-400 flex-shrink-0" />
              <div>
                <span className="text-dark-text">{t.ended}</span>
                <p className="text-xs">{formatDate(session.completed_at)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-dark-muted">
            <Clock size={14} className="text-dark-muted flex-shrink-0" />
            <div>
              <span className="text-dark-text">{t.created}</span>
              <p className="text-xs">{formatDate(session.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Actions list */}
        {actions.length > 0 && (
          <div>
            <button
              onClick={() => setActionsExpanded(!actionsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-dark-text hover:text-theatarr-500 transition-colors"
            >
              {actionsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Zap size={14} className="text-purple-400" />
              {t.actions} ({actions.length})
            </button>
            {actionsExpanded && (
              <div className="mt-2 space-y-1.5">
                {actions.map((action, idx) => {
                  const Icon = ACTION_TYPE_ICONS[action.action_type] || Zap;
                  const color = ACTION_TYPE_COLORS[action.action_type] || '#6b7280';
                  const params = action.parameters || {};
                  // Filter out internal/preview params
                  const displayParams = Object.entries(params).filter(
                    ([k]) => !k.startsWith('_')
                  );
                  return (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-dark-bg border border-dark-border/50">
                      <div className="mt-0.5 shrink-0">
                        <Icon size={14} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-dark-text">
                            {action.label || action.command}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-border text-dark-muted">
                            {action.action_type}:{action.command}
                          </span>
                          {action.sequence_name && (
                            <span className="text-[10px] text-dark-muted">
                              [{action.sequence_name}]
                            </span>
                          )}
                        </div>
                        {displayParams.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {displayParams.map(([k, v]) => (
                              <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-dark-border/50 text-dark-muted">
                                {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Session Activity Section (Events Timeline)
// ============================================================================

interface SessionEvent {
  id: string;
  session_id: string;
  session_name: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  timestamp: string;
}

function SessionActivitySection({
  sessionId,
  startedAt,
  language,
}: {
  sessionId: string;
  startedAt?: string | null;
  language: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: events, isLoading } = useQuery<SessionEvent[]>({
    queryKey: ['session-events', sessionId],
    queryFn: () => apiClient.get<SessionEvent[]>(`/logs/sessions/${sessionId}/events`),
    enabled: expanded,
  });

  const t = {
    title: language === 'fr' ? 'Activite' : 'Activity',
    noEvents: language === 'fr' ? 'Aucun evenement enregistre' : 'No events recorded',
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
  };

  return (
    <div className="bg-dark-surface rounded-xl border border-dark-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-dark-border/20 transition-colors rounded-xl"
      >
        {expanded ? <ChevronDown size={14} className="text-dark-muted" /> : <ChevronRight size={14} className="text-dark-muted" />}
        <Activity size={14} className="text-green-400" />
        <h3 className="text-sm font-medium text-dark-text">{t.title}</h3>
        {events && (
          <span className="text-xs text-dark-muted ml-1">({events.length})</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-dark-border px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="sm" />
              <span className="ml-2 text-sm text-dark-muted">{t.loading}</span>
            </div>
          ) : events && events.length > 0 ? (
            <EventTimeline events={events} sessionStartedAt={startedAt} />
          ) : (
            <div className="text-center py-4 text-sm text-dark-muted">
              {t.noEvents}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FeedbackModal
// ============================================================================

interface FeedbackSummary {
  session_id: string;
  total_submissions: number;
  overall_average: number;
  category_averages: Array<{
    slug: string;
    label_fr: string;
    label_en: string;
    average: number;
    count: number;
  }>;
  entries: Array<{
    id: string;
    user_id: string;
    username: string;
    ratings: Record<string, { rating: number; comment?: string | null }>;
    overall_rating: number;
    submitted_at: string;
  }>;
}

function FeedbackModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['feedback-summary', sessionId],
    queryFn: () => apiClient.get<FeedbackSummary>(`/feedback/sessions/${sessionId}/summary`),
  });

  return (
    <Modal isOpen onClose={onClose} title="Feedback" size="lg">
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-theatarr-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Overall stats */}
          <div className="text-center">
            <div className="text-4xl font-bold text-amber-400">
              {data.overall_average.toFixed(1)}<span className="text-lg text-white/40">/10</span>
            </div>
            <p className="text-sm text-dark-muted mt-1">
              {data.total_submissions} avis
            </p>
          </div>

          {/* Category averages */}
          {data.category_averages.length > 0 && (
            <div className="space-y-2">
              {data.category_averages.map((cat) => (
                <div key={cat.slug} className="flex items-center gap-3">
                  <span className="text-sm text-dark-muted w-36 truncate">{cat.label_fr}</span>
                  <div className="flex-1 h-2 bg-dark-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${(cat.average / 10) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-dark-text tabular-nums w-10 text-right">
                    {cat.average.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Individual entries */}
          {data.entries.length > 0 && (
            <div className="border-t border-dark-border pt-4 space-y-3">
              <h4 className="text-sm font-medium text-dark-text">Avis individuels</h4>
              {data.entries.map((entry) => (
                <div key={entry.id} className="bg-dark-bg rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-dark-text text-sm">{entry.username}</span>
                    <span className="text-amber-400 font-medium text-sm">
                      {entry.overall_rating.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(entry.ratings).map(([slug, r]) => (
                      <span key={slug} className="text-xs px-2 py-0.5 rounded bg-dark-border text-dark-muted">
                        {slug}: {r.rating}/10
                      </span>
                    ))}
                  </div>
                  {Object.entries(entry.ratings).some(([, r]) => r.comment) && (
                    <div className="space-y-1">
                      {Object.entries(entry.ratings)
                        .filter(([, r]) => r.comment)
                        .map(([slug, r]) => (
                          <p key={slug} className="text-xs text-dark-muted italic">
                            {slug}: &laquo;{r.comment}&raquo;
                          </p>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
