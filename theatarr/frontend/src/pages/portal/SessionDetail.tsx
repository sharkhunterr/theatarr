/**
 * Session detail page for portal.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, CalendarPlus, Check, X, Clock, MapPin, Film, QrCode, Vote, Shuffle, Sparkles, Eye, Trophy, Zap, Play, Timer, Star, MessageSquare, Send, Ticket } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { getMysteryRevealCountdown, getVoteRevealCountdown, getSessionStartCountdown } from '../../utils/countdown';
import { useCountdown } from '../../hooks/useCountdown';
import { useSetting } from '../../hooks/useSettings';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuthStore } from '../../stores/authStore';
import { MysteryPoster } from '../../components/common/MysteryPoster';
import { TicketModal } from '../../components/portal/TicketModal';
import { VotePoster } from '../../components/common/VotePoster';
import { VotePosterCollage } from '../../components/common/VotePosterCollage';
import {
  ACTION_TYPE_COLORS,
  ACTION_TYPE_ICONS,
  getBlockDuration,
  computeProportionalWidths,
  computeKnownManualMs,
  formatDuration,
} from '../../utils/timeline';

// ============================================================================
// Types
// ============================================================================

interface SequenceSummary {
  id: string;
  name: string;
  order_index: number;
  duration_type: string;
  duration_ms: number | null;
  duration_fallback_ms: number;
  actions_count: number;
  action_types: string[];
  expected_duration_ms: number | null;
}

interface SessionDetailData {
  id: string;
  name: string;
  description: string | null;
  movie_title: string | null;
  movie_poster_url: string | null;
  movie_source: string | null;
  color_palette: Record<string, string> | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  invitation_status: string;
  responded_at: string | null;
  movie_selection_mode: string | null;
  movie_resolved: boolean;
  mystery_reveal_at: string | null;
  vote_reveal_at: string | null;
  linked_vote_session_id: string | null;
  linked_vote_is_open: boolean | null;
  vote_movie_posters: string[] | null;
  qr_tickets_enabled: boolean;
  ticket_token: string | null;
  checked_in: boolean;
  sequences: SequenceSummary[];
  current_sequence_index: number;
  current_sequence_elapsed_ms: number;
  total_sequences: number;
  movie_runtime_minutes: number | null;
  feedback_available: boolean;
  has_submitted_feedback: boolean;
  feedback_count: number;
  feedback_average: number | null;
}

interface LiveState {
  session_id: string;
  status: string;
  current_sequence_index: number;
  current_sequence_elapsed_ms: number;
  total_sequences: number;
}

// ============================================================================
// Timeline Helpers
// ============================================================================

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================================
// PortalTimeline
// ============================================================================

function PortalTimeline({
  sequences,
  currentIndex,
  elapsedMs,
  status,
  movieRuntimeMs,
}: {
  sequences: SequenceSummary[];
  currentIndex: number;
  elapsedMs: number;
  status: string;
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

  if (sequences.length === 0) return null;

  const isActive = status === 'running' || status === 'paused';
  const isComplete = status === 'completed';
  const currentSeq = sequences[currentIndex];
  const currentDuration = currentSeq
    ? getBlockDuration(currentSeq, movieRuntimeMs, knownManualMs)
    : 0;
  const progress = currentDuration > 0 ? Math.min(elapsedMs / currentDuration, 1) : 0;

  return (
    <div className="space-y-2">
      <div className="relative h-8 flex rounded-lg overflow-hidden bg-dark-bg border border-dark-border">
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

              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none hidden sm:block">
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
// Main Component
// ============================================================================

function downloadIcs(session: SessionDetailData) {
  const start = new Date(session.scheduled_at!);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  // RFC 5545: escape special characters in text values
  const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  // RFC 5545: fold lines longer than 75 octets
  const foldLine = (line: string) => {
    const parts: string[] = [];
    let remaining = line;
    while (remaining.length > 75) {
      parts.push(remaining.slice(0, 75));
      remaining = ' ' + remaining.slice(75);
    }
    parts.push(remaining);
    return parts.join('\r\n');
  };

  const summary = session.movie_title
    ? `${session.name} - ${session.movie_title}`
    : session.name;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Theatarr//Cinema//FR',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escText(summary)}`,
    ...(session.description ? [`DESCRIPTION:${escText(session.description)}`] : []),
    `UID:${session.id}@theatarr`,
    `DTSTAMP:${fmt(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const ics = lines.map(foldLine).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theatarr-${session.name.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SessionDetail() {
  useCountdown();
  const posterDisplay = useSetting<string>('voting.poster_display', 'animation');
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showTicket, setShowTicket] = useState(false);
  const authUser = useAuthStore((s) => s.user);
  const userName = authUser?.first_name && authUser?.last_name
    ? `${authUser.first_name} ${authUser.last_name}`
    : authUser?.first_name || authUser?.username || null;

  const { data: session, isLoading } = useQuery({
    queryKey: ['portal', 'sessions', id],
    queryFn: () => apiClient.get<SessionDetailData>(`/portal/sessions/${id}`),
    enabled: !!id,
  });

  // WebSocket for live state updates
  const token = localStorage.getItem('theatarr_token');
  const [liveState, setLiveState] = useState<LiveState | null>(null);

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    token,
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'session_state' && message.payload) {
        const state = message.payload as unknown as LiveState;
        if (state.session_id === id) {
          setLiveState(state);
        }
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('session');
      return () => unsubscribe('session');
    }
  }, [isConnected, subscribe, unsubscribe]);

  const respondMutation = useMutation({
    mutationFn: (accept: boolean) =>
      apiClient.post(`/portal/sessions/${id}/respond`, { accept }),
    onSuccess: (_, accept) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'sessions'] });
      if (accept && session?.linked_vote_session_id && session?.linked_vote_is_open) {
        navigate(`/portal/votes/${session.linked_vote_session_id}`);
      }
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    scheduled: 'Planifie',
    running: 'En cours',
    paused: 'En pause',
    completed: 'Termine',
    interrupted: 'Interrompu',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-dark-muted/20 text-dark-muted',
    scheduled: 'bg-blue-500/20 text-blue-400',
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-dark-muted/20 text-dark-muted',
    interrupted: 'bg-red-500/20 text-red-400',
  };

  const invitationLabels: Record<string, string> = {
    pending: 'En attente de reponse',
    accepted: 'Accepte',
    declined: 'Decline',
  };

  // Compute timeline data from live state or session data
  const isLive = liveState !== null && liveState.session_id === id;
  const currentStatus = isLive ? liveState.status : session?.status;
  const currentIndex = isLive ? liveState.current_sequence_index : (session?.current_sequence_index ?? 0);
  const elapsedMs = isLive ? liveState.current_sequence_elapsed_ms : (session?.current_sequence_elapsed_ms ?? 0);
  const sequences = session?.sequences ?? [];
  const movieRuntimeMs = (session?.movie_runtime_minutes ?? 0) * 60000;
  const showTimeline = sequences.length > 0;

  // Compute total duration and expected end time
  const totalDurationMs = useMemo(() => {
    if (sequences.length === 0) return 0;
    const km = computeKnownManualMs(sequences);
    return sequences.reduce((sum, seq) => sum + getBlockDuration(seq, movieRuntimeMs, km), 0);
  }, [sequences, movieRuntimeMs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-dark-surface rounded animate-pulse" />
        <div className="h-64 bg-dark-surface rounded-xl animate-pulse" />
        <div className="h-32 bg-dark-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-muted">Session non trouvee</p>
        <Link to="/portal/sessions" className="text-theatarr-500 hover:underline mt-2 inline-block">
          Retour aux sessions
        </Link>
      </div>
    );
  }

  const bgColor = session.color_palette?.dominant || '#1a1a1a';
  const isMysteryHidden = session.movie_selection_mode === 'mystery' && !session.movie_resolved;
  const isMysteryRevealed = session.movie_selection_mode === 'mystery' && session.movie_resolved;
  const isVoteHidden = session.movie_selection_mode === 'vote' && !session.movie_resolved;
  const isVoteRevealed = session.movie_selection_mode === 'vote' && session.movie_resolved;

  // Compute expected end time from started_at + total duration
  const expectedEndTime = session.started_at && totalDurationMs > 0
    ? new Date(new Date(session.started_at).getTime() + totalDurationMs)
    : null;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/portal/sessions"
        className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Retour</span>
      </Link>

      {/* Hero */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ backgroundColor: isMysteryHidden ? '#1a0a2e' : isVoteHidden ? '#0a1628' : bgColor }}
      >
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

        <div className="relative p-4 flex gap-4">
          {/* Poster / Mystery poster / Vote poster */}
          {isMysteryHidden ? (
            <MysteryPoster className="w-24 h-36 flex-shrink-0 rounded-lg shadow-lg" />
          ) : isVoteHidden ? (
            posterDisplay === 'posters' && session.vote_movie_posters?.length ? (
              <VotePosterCollage posters={session.vote_movie_posters} className="w-24 h-36 flex-shrink-0 rounded-lg shadow-lg" />
            ) : (
              <VotePoster className="w-24 h-36 flex-shrink-0 rounded-lg shadow-lg" />
            )
          ) : (
            <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-dark-border shadow-lg">
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
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className={clsx(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                  statusColors[session.status] || statusColors.draft
                )}
              >
                {statusLabels[session.status] || session.status}
              </span>
              {/* Session start countdown */}
              {session.scheduled_at && (session.status === 'scheduled' || session.status === 'draft') && (() => {
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
              {/* Live indicator */}
              {isLive && (currentStatus === 'running' || currentStatus === 'paused') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Live
                </span>
              )}
              {/* Ticket badge */}
              {session.qr_tickets_enabled && session.invitation_status === 'accepted' && session.ticket_token && (
                <span className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  session.checked_in
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-theatarr-500/20 text-theatarr-400'
                )}>
                  <Ticket size={12} />
                  {session.checked_in ? 'Ticket valide' : 'Ticket'}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{session.name}</h1>
            {isMysteryHidden ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Shuffle size={14} className="text-purple-400" />
                  <span className="text-purple-300 font-medium">Film mystere</span>
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
                  <span className="text-blue-300 font-medium">
                    {session.linked_vote_is_open === false ? 'Vote clos' : 'En attente du vote'}
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
                <p className="text-white/80">{session.movie_title}</p>
              </div>
            ) : isVoteRevealed ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Trophy size={14} className="text-yellow-500" />
                <p className="text-white/80">{session.movie_title}</p>
              </div>
            ) : session.movie_title ? (
              <p className="text-white/80">{session.movie_title}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-4">
        {session.description && (
          <p className="text-dark-muted">{session.description}</p>
        )}

        {session.scheduled_at && (
          <div className="flex items-center gap-3 text-dark-text">
            <Calendar size={18} className="text-dark-muted" />
            <span>{formatDate(session.scheduled_at)}</span>
          </div>
        )}

        {session.movie_source && (
          <div className="flex items-center gap-3 text-dark-text">
            <MapPin size={18} className="text-dark-muted" />
            <span>Source: {session.movie_source}</span>
          </div>
        )}
      </div>

      {/* Invitation status */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h2 className="font-medium text-dark-text mb-3">Votre invitation</h2>

        <div className="flex items-center gap-3">
          {session.invitation_status === 'accepted' && (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="text-green-400" size={20} />
            </div>
          )}
          {session.invitation_status === 'declined' && (
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <X className="text-red-400" size={20} />
            </div>
          )}
          {session.invitation_status === 'pending' && (
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="text-yellow-400" size={20} />
            </div>
          )}
          <div className="flex-1">
            <p className="font-medium text-dark-text">
              {invitationLabels[session.invitation_status]}
            </p>
            {session.responded_at && (
              <p className="text-sm text-dark-muted">
                Repondu le {formatDate(session.responded_at)}
              </p>
            )}
          </div>
          {/* Check-in badge (inline with invitation status) */}
          {session.invitation_status === 'accepted' && session.qr_tickets_enabled && (
            <div className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0',
              session.checked_in
                ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                : 'bg-dark-bg text-dark-muted border border-dark-border'
            )}>
              {session.checked_in ? <Check size={12} /> : <Ticket size={12} />}
              {session.checked_in ? 'Check-in OK' : 'Non scanne'}
            </div>
          )}
        </div>

        {/* Response buttons */}
        {session.invitation_status === 'pending' && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => respondMutation.mutate(true)}
              disabled={respondMutation.isPending}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Accepter
            </button>
            <button
              onClick={() => respondMutation.mutate(false)}
              disabled={respondMutation.isPending}
              className="flex-1 py-3 bg-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-muted/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X size={18} />
              Decliner
            </button>
          </div>
        )}

        {/* Actions for accepted invitation */}
        {session.invitation_status === 'accepted' && (
          <div className="mt-4 space-y-2">
            {/* Primary action buttons: Ticket + Calendar */}
            <div className="flex gap-2">
              {session.qr_tickets_enabled && session.ticket_token && (
                <button
                  onClick={() => setShowTicket(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-theatarr-500 text-white rounded-lg text-sm font-semibold hover:bg-theatarr-600 transition-colors shadow-sm"
                >
                  <QrCode size={18} />
                  Mon Ticket
                </button>
              )}
              {session.scheduled_at && (
                <button
                  onClick={() => downloadIcs(session)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <CalendarPlus size={18} />
                  Calendrier
                </button>
              )}
            </div>
            {/* Secondary: decline option */}
            {session.status !== 'completed' && (
              <button
                onClick={() => respondMutation.mutate(false)}
                disabled={respondMutation.isPending}
                className="w-full py-1.5 text-xs text-dark-muted hover:text-red-400 transition-colors disabled:opacity-50"
              >
                Annuler ma participation
              </button>
            )}
          </div>
        )}

        {/* Change response for declined */}
        {session.invitation_status === 'declined' && session.status !== 'completed' && (
          <div className="mt-4">
            <button
              onClick={() => respondMutation.mutate(true)}
              disabled={respondMutation.isPending}
              className="w-full py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              Changer en Accepte
            </button>
          </div>
        )}
      </div>

      {/* Timeline + Time info — shown when session is running/paused/completed */}
      {showTimeline && (
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-4">
          <h2 className="font-medium text-dark-text mb-1">Deroulement de la seance</h2>

          <PortalTimeline
            sequences={sequences}
            currentIndex={currentIndex}
            elapsedMs={elapsedMs}
            status={currentStatus!}
            movieRuntimeMs={movieRuntimeMs}
          />

          {/* Time info row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-dark-muted">
            {session.started_at && (
              <div className="flex items-center gap-1.5">
                <Play size={14} />
                <span>Debut : <span className="text-dark-text">{formatTimeShort(session.started_at)}</span></span>
              </div>
            )}
            {totalDurationMs > 0 && (
              <div className="flex items-center gap-1.5">
                <Timer size={14} />
                <span>Duree : <span className="text-dark-text">{formatDuration(totalDurationMs)}</span></span>
              </div>
            )}
            {expectedEndTime && currentStatus !== 'completed' && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>Fin prevue : <span className="text-dark-text">{expectedEndTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></span>
              </div>
            )}
            {session.completed_at && (
              <div className="flex items-center gap-1.5">
                <Check size={14} />
                <span>Termine a <span className="text-dark-text">{formatTimeShort(session.completed_at)}</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback section */}
      {session.feedback_available && (
        <FeedbackSection sessionId={session.id} hasSubmitted={session.has_submitted_feedback} />
      )}

      {/* Vote section - show if there's a linked vote */}
      {session.movie_selection_mode === 'vote' && session.linked_vote_session_id && (
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <h2 className="font-medium text-dark-text mb-3">Vote pour le film</h2>

          {session.movie_resolved ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="text-green-400" size={20} />
              </div>
              <div>
                <p className="font-medium text-dark-text">Vote termine</p>
                <p className="text-sm text-dark-muted">
                  Le film a ete choisi: {session.movie_title}
                </p>
              </div>
            </div>
          ) : session.linked_vote_is_open ? (
            session.invitation_status === 'accepted' ? (
              <Link
                to={`/portal/votes/${session.linked_vote_session_id}`}
                className="flex items-center justify-between p-3 bg-theatarr-500/10 border border-theatarr-500/30 rounded-lg hover:bg-theatarr-500/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-theatarr-500/20 flex items-center justify-center">
                    <Vote className="text-theatarr-400" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-dark-text">Votez pour le film</p>
                    <p className="text-sm text-dark-muted">Le vote est ouvert</p>
                  </div>
                </div>
                <ArrowLeft size={18} className="text-dark-muted rotate-180" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="text-yellow-400" size={20} />
                </div>
                <div>
                  <p className="font-medium text-dark-text">Acceptez l'invitation pour voter</p>
                  <p className="text-sm text-dark-muted">Le vote est ouvert mais vous devez d'abord accepter</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-dark-border flex items-center justify-center">
                <Clock className="text-dark-muted" size={20} />
              </div>
              <div>
                <p className="font-medium text-dark-text">Vote en attente</p>
                <p className="text-sm text-dark-muted">Le vote n'est pas encore ouvert</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ticket Modal */}
      {session.qr_tickets_enabled && session.ticket_token && (
        <TicketModal
          isOpen={showTicket}
          onClose={() => setShowTicket(false)}
          session={session}
          userName={userName}
        />
      )}
    </div>
  );
}


// ============================================================================
// FeedbackSection
// ============================================================================

interface FeedbackCategory {
  slug: string;
  label_fr: string;
  label_en: string;
  icon: string;
}

interface FeedbackCategoriesResponse {
  session_id: string;
  categories: FeedbackCategory[];
  has_submitted: boolean;
  session_name: string;
  movie_title: string | null;
  movie_poster_url: string | null;
}

const ICON_MAP: Record<string, string> = {
  film: '🎬',
  lightbulb: '💡',
  'volume-2': '🔊',
  monitor: '🖥️',
  zap: '⚡',
  'clipboard-check': '📋',
};

function FeedbackSection({ sessionId, hasSubmitted: initialHasSubmitted }: { sessionId: string; hasSubmitted: boolean }) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [submitted, setSubmitted] = useState(initialHasSubmitted);

  const { data: categories } = useQuery({
    queryKey: ['feedback-categories', sessionId],
    queryFn: () => apiClient.get<FeedbackCategoriesResponse>(`/feedback/sessions/${sessionId}/categories`),
  });

  const { data: myFeedback } = useQuery({
    queryKey: ['my-feedback', sessionId],
    queryFn: () => apiClient.get<{ has_submitted: boolean; ratings?: Record<string, { rating: number; comment?: string }>; overall_rating?: number }>(`/feedback/sessions/${sessionId}/my-feedback`),
  });

  const submitMutation = useMutation({
    mutationFn: (data: { ratings: Record<string, { rating: number; comment: string | null }> }) =>
      apiClient.post(`/feedback/sessions/${sessionId}/submit`, data),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['feedback-categories', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['my-feedback', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['portal-session', sessionId] });
    },
  });

  const effectiveSubmitted = submitted || myFeedback?.has_submitted || categories?.has_submitted;

  // Initialize ratings from categories
  useEffect(() => {
    if (categories?.categories && Object.keys(ratings).length === 0 && !effectiveSubmitted) {
      const initial: Record<string, { rating: number; comment: string }> = {};
      for (const cat of categories.categories) {
        initial[cat.slug] = { rating: 7, comment: '' };
      }
      setRatings(initial);
    }
  }, [categories, ratings, effectiveSubmitted]);

  if (!categories) return null;

  const handleSubmit = () => {
    const payload: Record<string, { rating: number; comment: string | null }> = {};
    for (const [slug, data] of Object.entries(ratings)) {
      payload[slug] = { rating: data.rating, comment: data.comment || null };
    }
    submitMutation.mutate({ ratings: payload });
  };

  return (
    <div id="feedback" className="bg-dark-surface rounded-xl border border-dark-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Star size={18} className="text-amber-400" />
        <h2 className="font-medium text-dark-text">Donnez votre avis</h2>
      </div>

      {effectiveSubmitted ? (
        <div>
          <div className="flex items-center gap-3 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
              <Check className="text-teal-400" size={20} />
            </div>
            <div>
              <p className="font-medium text-dark-text">Merci pour votre avis !</p>
              {myFeedback?.overall_rating != null && (
                <p className="text-sm text-dark-muted">
                  Votre note globale : {myFeedback.overall_rating.toFixed(1)}/10
                </p>
              )}
            </div>
          </div>

          {/* Show submitted ratings */}
          {myFeedback?.ratings && (
            <div className="mt-3 space-y-2">
              {Object.entries(myFeedback.ratings).map(([slug, data]) => {
                const cat = categories.categories.find(c => c.slug === slug);
                return (
                  <div key={slug} className="flex items-center justify-between text-sm">
                    <span className="text-dark-muted flex items-center gap-1.5">
                      <span>{ICON_MAP[cat?.icon || ''] || '📌'}</span>
                      {cat?.label_fr || slug}
                    </span>
                    <span className="text-dark-text font-medium">{data.rating}/10</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {categories.categories.map((cat) => {
            const r = ratings[cat.slug];
            if (!r) return null;
            return (
              <div key={cat.slug} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-dark-text flex items-center gap-1.5">
                    <span>{ICON_MAP[cat.icon] || '📌'}</span>
                    {cat.label_fr}
                  </label>
                  <span className="text-sm font-medium text-dark-text tabular-nums">{r.rating}/10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={r.rating}
                  onChange={(e) =>
                    setRatings((prev) => ({
                      ...prev,
                      [cat.slug]: { ...prev[cat.slug], rating: parseInt(e.target.value) },
                    }))
                  }
                  className="w-full accent-amber-500"
                />
                <div className="relative">
                  <MessageSquare size={12} className="absolute left-2.5 top-2.5 text-dark-muted" />
                  <input
                    type="text"
                    value={r.comment}
                    onChange={(e) =>
                      setRatings((prev) => ({
                        ...prev,
                        [cat.slug]: { ...prev[cat.slug], comment: e.target.value },
                      }))
                    }
                    placeholder="Commentaire optionnel..."
                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-dark-text placeholder-dark-muted"
                  />
                </div>
              </div>
            );
          })}

          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Send size={16} />
            {submitMutation.isPending ? 'Envoi...' : 'Envoyer mon avis'}
          </button>

          {submitMutation.isError && (
            <p className="text-sm text-red-400 text-center">
              Erreur lors de l'envoi. Veuillez reessayer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
