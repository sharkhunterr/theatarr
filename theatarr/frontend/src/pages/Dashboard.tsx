/**
 * Admin dashboard with real-time session monitoring.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Activity,
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Film,
  Lightbulb,
  Monitor,
  Pause,
  Play,
  Plus,
  ScreenShare,
  SkipForward,
  Square,
  Users,
  Video,
  Vote,
  X,
  Zap,
} from 'lucide-react';
import { Button, Card, CardContent } from '../components/common';
import { apiClient } from '../api/client';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCountdown } from '../hooks/useCountdown';
import { useLayoutStore } from '../stores/layoutStore';
import type { Session, SessionState, Sequence } from '../stores/sessionStore';
import { getSessionStartCountdown } from '../utils/countdown';
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

interface ActionLogEntry {
  action_id: string;
  sequence_id: string;
  sequence_name: string;
  action_type: string;
  command: string;
  success: boolean;
  message: string | null;
  duration_ms: number;
  error: string | null;
  executed_at: string;
}

interface SessionStatsResponse {
  total_sessions: number;
  sessions_today: number;
  sessions_this_week: number;
  sessions_this_month: number;
}

interface ActivityEvent {
  id: string;
  session_id: string;
  session_name: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  timestamp: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(dateStr: string, language: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return language === 'fr' ? "A l'instant" : 'Just now';
  if (minutes < 60) return language === 'fr' ? `Il y a ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === 'fr' ? `Il y a ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return language === 'fr' ? `Il y a ${days}j` : `${days}d ago`;
}

function eventLabel(eventType: string, language: string): string {
  const labels: Record<string, { fr: string; en: string }> = {
    session_running: { fr: 'Session lancee', en: 'Session started' },
    session_completed: { fr: 'Session terminee', en: 'Session completed' },
    session_paused: { fr: 'Session en pause', en: 'Session paused' },
    session_updated: { fr: 'Session modifiee', en: 'Session updated' },
  };
  const entry = labels[eventType];
  if (entry) return language === 'fr' ? entry.fr : entry.en;
  return eventType;
}

// ============================================================================
// DashboardTimeline
// ============================================================================

function DashboardTimeline({
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

  // Stable widths — computed from sequence definitions + movie runtime, NOT elapsed time
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
  // Current block's expected duration for cursor progress
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
          // Use multiple horizontal color stripes if block has multiple action types
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
              {/* Multi-stripe background showing all action types */}
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

      {/* Legend for small blocks + current sequence info */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-dark-muted">
        <div className="flex items-center gap-1">
          {currentSeq && (isActive || isComplete) && (
            <>
              <span>
                {language === 'fr' ? 'Seq' : 'Seq'} {currentIndex + 1}/{sequences.length}
                {' — '}
                <span className="text-dark-text">{currentSeq.name}</span>
              </span>
              <span className="ml-2">
                {formatDuration(elapsedMs)} / {formatDuration(currentDuration)}
              </span>
            </>
          )}
        </div>
        {/* Color legend */}
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
// ActionLogPanel
// ============================================================================

function ActionLogPanel({
  entries,
  language,
}: {
  entries: ActionLogEntry[];
  language: string;
}) {
  if (entries.length === 0) return null;

  const recent = [...entries].reverse().slice(0, 10);

  return (
    <div className="mt-3 border-t border-dark-border pt-3">
      <h4 className="text-xs font-medium text-dark-muted mb-2">
        {language === 'fr' ? 'Journal des actions' : 'Action Log'}
      </h4>
      <div className="space-y-1 max-h-32 sm:max-h-40 overflow-y-auto">
        {recent.map((entry, i) => {
          const Icon = ACTION_TYPE_ICONS[entry.action_type] || Zap;
          const color = ACTION_TYPE_COLORS[entry.action_type] || '#6b7280';
          return (
            <div key={`${entry.action_id}-${i}`} className="flex items-center gap-1.5 sm:gap-2 text-xs">
              {entry.success ? (
                <Check size={12} className="text-green-400 flex-shrink-0" />
              ) : (
                <X size={12} className="text-red-400 flex-shrink-0" />
              )}
              <Icon size={12} style={{ color }} className="flex-shrink-0" />
              <span className="text-dark-text truncate">
                {entry.action_type}:{entry.command}
              </span>
              {entry.sequence_name && (
                <span className="text-dark-muted truncate hidden sm:inline">
                  ({entry.sequence_name})
                </span>
              )}
              <span className="text-dark-muted ml-auto flex-shrink-0">
                {entry.duration_ms}ms
              </span>
              {!entry.success && entry.error && (
                <span className="text-red-400 truncate max-w-[100px] sm:max-w-[200px]" title={entry.error}>
                  {entry.error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// NowPlayingHero
// ============================================================================

function NowPlayingHero({
  session,
  detail,
  liveState,
  actionLog,
  language,
  onControl,
  controllingAction,
  controlError,
}: {
  session: Session;
  detail: Session | null;
  liveState: SessionState | null;
  actionLog: ActionLogEntry[];
  language: string;
  onControl: (action: 'play' | 'pause' | 'stop' | 'skip') => Promise<void>;
  controllingAction: string | null;
  controlError: string | null;
}) {
  const [copiedCode, setCopiedCode] = useState(false);

  const currentStatus = liveState?.status || session.status;
  const currentIndex = liveState?.current_sequence_index ?? session.current_sequence_index ?? 0;
  const elapsedMs = liveState?.current_sequence_elapsed_ms ?? session.current_sequence_elapsed_ms ?? 0;
  const sequences = detail?.sequences || session.sequences || [];

  const canPause = currentStatus === 'running';
  const canResume = currentStatus === 'paused';
  const canStop = currentStatus === 'running' || currentStatus === 'paused';
  const canSkip = currentStatus === 'running';

  const bgColor = session.color_palette?.primary || '#1a1a2e';

  const t = {
    nowPlaying: language === 'fr' ? 'En cours' : 'Now Playing',
    pause: 'Pause',
    resume: language === 'fr' ? 'Reprendre' : 'Resume',
    stop: language === 'fr' ? 'Arreter' : 'Stop',
    skip: language === 'fr' ? 'Suivant' : 'Skip',
    display: 'Display',
    wallmount: 'Wallmount',
    running: language === 'fr' ? 'En cours' : 'Running',
    paused: language === 'fr' ? 'En pause' : 'Paused',
    participants: language === 'fr' ? 'participants' : 'participants',
  };

  const statusLabel = currentStatus === 'running' ? t.running : t.paused;
  const statusColor = currentStatus === 'running'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

  return (
    <div className="relative rounded-xl overflow-hidden border border-dark-border" style={{ backgroundColor: bgColor }}>
      {/* Background blur */}
      {session.movie_poster_url && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <img
            src={session.movie_poster_url}
            alt=""
            className="w-full h-full object-cover opacity-20 blur-md"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40" />
        </div>
      )}

      <div className="relative p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        {/* Header: poster + info */}
        <div className="flex gap-3 sm:gap-4">
          {/* Poster - hidden on small mobile */}
          {session.movie_poster_url && (
            <div className="hidden sm:block w-20 h-30 sm:w-24 sm:h-36 flex-shrink-0 rounded-lg overflow-hidden bg-dark-border shadow-lg">
              <img
                src={session.movie_poster_url}
                alt={session.movie_title || session.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium border', statusColor)}>
                {statusLabel}
              </span>
              {currentStatus === 'running' && (
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>

            {/* Session name + movie */}
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">{session.name}</h2>
            {session.movie_title && (
              <p className="text-sm text-white/70 truncate">{session.movie_title}</p>
            )}

            {/* Meta: participants + code */}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-white/50">
              {(session.participants_total ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {session.participants_accepted ?? 0}/{session.participants_total} {t.participants}
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
            </div>
          </div>
        </div>

        {/* Timeline */}
        {sequences.length > 0 && (
          <DashboardTimeline
            sequences={sequences}
            currentIndex={currentIndex}
            elapsedMs={elapsedMs}
            status={currentStatus}
            language={language}
            movieRuntimeMs={(detail?.movie_runtime_minutes ?? 0) * 60 * 1000}
          />
        )}

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {canResume && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onControl('play')}
              disabled={controllingAction !== null}
              isLoading={controllingAction === 'play'}
            >
              <Play size={14} className="mr-1" />
              {t.resume}
            </Button>
          )}
          {canPause && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onControl('pause')}
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
              onClick={() => onControl('skip')}
              disabled={controllingAction !== null}
              isLoading={controllingAction === 'skip'}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <SkipForward size={14} className="mr-1" />
              {t.skip}
            </Button>
          )}
          {canStop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onControl('stop')}
              disabled={controllingAction !== null}
              isLoading={controllingAction === 'stop'}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Square size={14} className="mr-1" />
              {t.stop}
            </Button>
          )}

          <div className="flex-1" />

          {session.display_code && (
            <a
              href={`/display/${session.display_code}`}
              target="_blank"
              rel="noopener noreferrer"
              title={t.display}
              className="p-1.5 rounded-lg text-white/50 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <ScreenShare size={16} />
            </a>
          )}
          <Link
            to={`/sessions/${session.id}`}
            title={language === 'fr' ? 'Details' : 'Details'}
            className="p-1.5 rounded-lg text-white/50 hover:text-theatarr-500 hover:bg-theatarr-500/10 transition-colors"
          >
            <Monitor size={16} />
          </Link>
        </div>

        {/* Error banner */}
        {controlError && (
          <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-xs">
            {controlError}
          </div>
        )}

        {/* Action Log */}
        <ActionLogPanel entries={actionLog} language={language} />
      </div>
    </div>
  );
}

// ============================================================================
// StatsRow
// ============================================================================

function StatsRow({
  connectedServices,
  totalServices,
  sessionsToday,
  totalSessions,
  readyTrailers,
  totalTrailers,
  language,
}: {
  connectedServices: number;
  totalServices: number;
  sessionsToday: number;
  totalSessions: number;
  readyTrailers: number;
  totalTrailers: number;
  language: string;
}) {
  const cards = [
    {
      icon: Lightbulb,
      color: 'bg-green-500/20',
      iconColor: 'text-green-500',
      value: `${connectedServices}/${totalServices}`,
      label: language === 'fr' ? 'Services connectes' : 'Connected Services',
      path: '/services',
    },
    {
      icon: Play,
      color: 'bg-theatarr-500/20',
      iconColor: 'text-theatarr-500',
      value: `${sessionsToday}`,
      label: language === 'fr' ? "Sessions aujourd'hui" : 'Sessions Today',
      sublabel: `${totalSessions} total`,
      path: '/sessions',
    },
    {
      icon: Video,
      color: 'bg-purple-500/20',
      iconColor: 'text-purple-500',
      value: `${readyTrailers}/${totalTrailers}`,
      label: language === 'fr' ? 'Bandes-annonces' : 'Trailers',
      path: '/media',
    },
    {
      icon: Film,
      color: 'bg-blue-500/20',
      iconColor: 'text-blue-500',
      value: `${totalSessions}`,
      label: language === 'fr' ? 'Total sessions' : 'Total Sessions',
      path: '/history',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.label} to={card.path}>
            <Card variant="interactive">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={clsx('p-1.5 sm:p-2 rounded-lg', card.color)}>
                    <Icon className={card.iconColor} size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-2xl font-bold text-dark-text">{card.value}</div>
                    <div className="text-[10px] sm:text-xs text-dark-muted truncate">{card.label}</div>
                    {card.sublabel && (
                      <div className="text-[10px] text-dark-muted">{card.sublabel}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================================
// UpcomingSessions
// ============================================================================

function UpcomingSessions({
  sessions,
  language,
}: {
  sessions: Session[];
  language: string;
}) {
  if (sessions.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-dark-text flex items-center gap-2">
            <Calendar size={14} className="text-purple-400" />
            {language === 'fr' ? 'Prochaines seances' : 'Upcoming Sessions'}
          </h3>
          <Link to="/sessions" className="text-xs text-theatarr-500 hover:text-theatarr-400 flex items-center gap-1">
            {language === 'fr' ? 'Voir tout' : 'View all'}
            <ArrowRight size={12} />
          </Link>
        </div>
        <div className="space-y-2">
          {sessions.map((session) => {
            const countdown = session.scheduled_at ? getSessionStartCountdown(session.scheduled_at) : null;
            return (
              <Link
                key={session.id}
                to={`/sessions/${session.id}`}
                className="flex items-center gap-3 p-2 sm:p-2.5 rounded-lg bg-dark-bg hover:bg-dark-bg/80 border border-dark-border transition-colors"
              >
                <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-dark-border">
                  {session.movie_poster_url ? (
                    <img src={session.movie_poster_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-dark-muted">
                      <Film size={14} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-text truncate">{session.name}</p>
                  <p className="text-xs text-dark-muted truncate">
                    {session.movie_title || (language === 'fr' ? 'Film non defini' : 'No movie set')}
                  </p>
                </div>
                {countdown && countdown.urgency !== 'low' && (
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0',
                      countdown.pulse && 'animate-pulse'
                    )}
                    style={{ backgroundColor: `${countdown.color}20`, color: countdown.color }}
                  >
                    {countdown.text}
                  </span>
                )}
                {countdown && countdown.urgency === 'low' && session.scheduled_at && (
                  <span className="text-[10px] sm:text-xs text-dark-muted flex-shrink-0">
                    {formatDateShort(session.scheduled_at)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// RecentActivity
// ============================================================================

function RecentActivity({
  events,
  language,
}: {
  events: ActivityEvent[];
  language: string;
}) {
  const eventIcons: Record<string, typeof Activity> = {
    session_running: Play,
    session_completed: Check,
    session_paused: Pause,
    session_updated: Activity,
  };

  const eventColors: Record<string, string> = {
    session_running: 'text-green-400',
    session_completed: 'text-blue-400',
    session_paused: 'text-yellow-400',
    session_updated: 'text-dark-muted',
  };

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <h3 className="text-sm font-medium text-dark-text flex items-center gap-2 mb-3">
          <Activity size={14} className="text-theatarr-500" />
          {language === 'fr' ? 'Activite recente' : 'Recent Activity'}
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-dark-muted py-4 text-center">
            {language === 'fr' ? 'Aucune activite recente' : 'No recent activity'}
          </p>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 8).map((event) => {
              const Icon = eventIcons[event.event_type] || Activity;
              const iconColor = eventColors[event.event_type] || 'text-dark-muted';
              return (
                <Link
                  key={event.id}
                  to={`/sessions/${event.session_id}`}
                  className="flex items-center gap-2 sm:gap-3 py-1.5 hover:bg-dark-bg/50 rounded px-1 -mx-1 transition-colors"
                >
                  <Icon size={14} className={clsx(iconColor, 'flex-shrink-0')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dark-text truncate">{event.session_name}</p>
                    <p className="text-[10px] text-dark-muted">{eventLabel(event.event_type, language)}</p>
                  </div>
                  <span className="text-[10px] text-dark-muted flex-shrink-0">
                    {relativeTime(event.timestamp, language)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QuickActions
// ============================================================================

function QuickActions({ language }: { language: string }) {
  const actions = [
    {
      icon: Plus,
      label: language === 'fr' ? 'Nouvelle session' : 'New Session',
      color: 'text-theatarr-500',
      bg: 'bg-theatarr-500/10 hover:bg-theatarr-500/20',
      path: '/sessions/new',
    },
    {
      icon: Vote,
      label: language === 'fr' ? 'Vote' : 'Vote',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 hover:bg-blue-500/20',
      path: '/votes',
    },
    {
      icon: ScreenShare,
      label: language === 'fr' ? 'Templates' : 'Templates',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 hover:bg-purple-500/20',
      path: '/templates',
    },
    {
      icon: Lightbulb,
      label: language === 'fr' ? 'Services' : 'Services',
      color: 'text-green-500',
      bg: 'bg-green-500/10 hover:bg-green-500/20',
      path: '/services',
    },
  ];

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <h3 className="text-sm font-medium text-dark-text mb-3">
          {language === 'fr' ? 'Actions rapides' : 'Quick Actions'}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className={clsx(
                  'flex items-center gap-2 p-2.5 rounded-lg border border-dark-border transition-colors',
                  action.bg,
                )}
              >
                <Icon size={16} className={action.color} />
                <span className="text-xs font-medium text-dark-text truncate">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

export function Dashboard() {
  useCountdown(1000);
  const { language } = useLayoutStore();
  const token = localStorage.getItem('theatarr_token');

  // Real-time state via WebSocket
  const [liveState, setLiveState] = useState<SessionState | null>(null);

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    token,
    autoConnect: true,
    onMessage: (message) => {
      if (message.type === 'session_state' && message.payload) {
        setLiveState(message.payload as unknown as SessionState);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('session');
      return () => unsubscribe('session');
    }
  }, [isConnected, subscribe, unsubscribe]);

  // Data queries
  const { data: sessionsData } = useQuery({
    queryKey: ['dashboard-sessions'],
    queryFn: () => apiClient.get<{ items: Session[]; total: number }>('/sessions'),
    refetchInterval: 30000,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['dashboard-services'],
    queryFn: () => apiClient.get<{ items: any[]; total: number }>('/services'),
    refetchInterval: 60000,
  });

  const { data: sessionStats } = useQuery({
    queryKey: ['dashboard-session-stats'],
    queryFn: () => apiClient.get<SessionStatsResponse>('/logs/sessions/stats').catch(() => null),
    refetchInterval: 60000,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => apiClient.get<ActivityEvent[]>('/logs/activity/recent?limit=10').catch(() => []),
    refetchInterval: 30000,
  });

  const { data: trailerStats } = useQuery({
    queryKey: ['dashboard-trailers'],
    queryFn: () => apiClient.get<{ total_trailers: number; ready_trailers: number }>('/trailers/stats').catch(() => ({ total_trailers: 0, ready_trailers: 0 })),
    refetchInterval: 60000,
  });

  // Derive active session
  const sessions = sessionsData?.items || [];

  const activeSession = useMemo(() => {
    return sessions.find((s) => {
      const status = liveState?.session_id === s.id ? liveState.status : s.status;
      return status === 'running' || status === 'paused';
    }) || null;
  }, [sessions, liveState]);

  // Fetch full detail for active session (to get sequences)
  const { data: activeSessionDetail } = useQuery({
    queryKey: ['active-session-detail', activeSession?.id],
    queryFn: () => apiClient.get<Session>(`/sessions/${activeSession!.id}`),
    enabled: !!activeSession,
  });

  // Fetch action log for active session
  const { data: actionLog } = useQuery({
    queryKey: ['active-action-log', activeSession?.id],
    queryFn: () => apiClient.get<ActionLogEntry[]>(`/sessions/${activeSession!.id}/action-log`),
    enabled: !!activeSession,
    refetchInterval: 5000,
  });

  // Upcoming sessions
  const upcomingSessions = useMemo(() => {
    return sessions
      .filter((s) => s.status === 'scheduled' && s.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
      .slice(0, 5);
  }, [sessions]);

  // Session controls
  const [controllingAction, setControllingAction] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const handleControl = useCallback(
    async (action: 'play' | 'pause' | 'stop' | 'skip') => {
      if (!activeSession) return;
      setControllingAction(action);
      setControlError(null);
      try {
        await apiClient.post(`/sessions/${activeSession.id}/control`, { action });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setControlError(msg);
        setTimeout(() => setControlError(null), 5000);
      } finally {
        setControllingAction(null);
      }
    },
    [activeSession]
  );

  // Stats
  const connectedServices = servicesData?.items?.filter(
    (s: any) => s.connection_status === 'connected' && s.is_enabled
  ).length ?? 0;
  const totalServices = servicesData?.total ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Now Playing Hero */}
      {activeSession && (
        <NowPlayingHero
          session={activeSession}
          detail={activeSessionDetail ?? null}
          liveState={liveState?.session_id === activeSession.id ? liveState : null}
          actionLog={actionLog || []}
          language={language}
          onControl={handleControl}
          controllingAction={controllingAction}
          controlError={controlError}
        />
      )}

      {/* Quick Stats */}
      <StatsRow
        connectedServices={connectedServices}
        totalServices={totalServices}
        sessionsToday={sessionStats?.sessions_today ?? 0}
        totalSessions={sessionStats?.total_sessions ?? sessions.length}
        readyTrailers={trailerStats?.ready_trailers ?? 0}
        totalTrailers={trailerStats?.total_trailers ?? 0}
        language={language}
      />

      {/* Upcoming Sessions */}
      <UpcomingSessions sessions={upcomingSessions} language={language} />

      {/* Recent Activity + Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        <div className="md:col-span-2">
          <RecentActivity events={recentActivity || []} language={language} />
        </div>
        <div>
          <QuickActions language={language} />
        </div>
      </div>
    </div>
  );
}
