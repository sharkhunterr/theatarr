import { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  Monitor,
  MonitorOff,
  Film,
  Clapperboard,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface SessionEvent {
  id: string;
  session_id: string;
  session_name: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  timestamp: string;
}

interface EventTimelineProps {
  events: SessionEvent[];
  sessionStartedAt?: string | null;
}

const EVENT_CONFIG: Record<string, { icon: typeof Play; color: string; label: string }> = {
  session_started: { icon: Play, color: 'text-green-400', label: 'Session demarrée' },
  session_paused: { icon: Pause, color: 'text-yellow-400', label: 'Session en pause' },
  session_resumed: { icon: RotateCcw, color: 'text-blue-400', label: 'Session reprise' },
  session_stopped: { icon: Square, color: 'text-red-400', label: 'Session arretee' },
  session_completed: { icon: CheckCircle, color: 'text-green-400', label: 'Session terminee' },
  session_interrupted: { icon: AlertCircle, color: 'text-red-400', label: 'Session interrompue' },
  sequence_started: { icon: Play, color: 'text-blue-400', label: 'Sequence demarrée' },
  sequence_completed: { icon: CheckCircle, color: 'text-blue-300', label: 'Sequence terminee' },
  sequence_skipped: { icon: SkipForward, color: 'text-yellow-400', label: 'Sequence sautee' },
  action_executed: { icon: Zap, color: 'text-purple-400', label: 'Action executee' },
  trailer_resolved: { icon: Film, color: 'text-indigo-400', label: 'Bande-annonce resolue' },
  preroll_resolved: { icon: Clapperboard, color: 'text-indigo-400', label: 'Pre-roll resolu' },
  playback_ended: { icon: Square, color: 'text-orange-400', label: 'Lecture terminee' },
  display_connected: { icon: Monitor, color: 'text-green-400', label: 'Display connecte' },
  display_disconnected: { icon: MonitorOff, color: 'text-red-400', label: 'Display deconnecte' },
};

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem > 0 ? ` ${rem}s` : ''}`;
}

function getEventDescription(event: SessionEvent): string {
  const d = event.event_data || {};

  switch (event.event_type) {
    case 'session_started':
      return `${d.name || ''} — ${d.total_sequences || '?'} sequences`;
    case 'session_paused':
      return `Sequence ${(d.sequence_index as number ?? 0) + 1}, elapsed ${formatDurationMs((d.elapsed_ms as number) || 0)}`;
    case 'session_resumed':
      return `Reprise a la sequence ${(d.sequence_index as number ?? 0) + 1}`;
    case 'session_stopped':
      return `Arret ${d.reason === 'manual' ? 'manuel' : (d.reason as string) || ''}`;
    case 'session_completed': {
      const dur = d.duration_seconds as number | null;
      return dur ? `Duree totale: ${Math.floor(dur / 60)}m ${dur % 60}s` : 'Terminee';
    }
    case 'session_interrupted':
      return `Erreur: ${(d.error as string) || 'inconnue'}`;
    case 'sequence_started':
      return `#${(d.order_index as number ?? 0) + 1} "${d.sequence_name}" — ${d.duration_type} ${formatDurationMs((d.duration_ms as number) || 0)}, ${d.action_count} action(s)${d.resuming ? ' (reprise)' : ''}`;
    case 'sequence_completed': {
      const planned = d.planned_duration_ms as number | undefined;
      const actual = d.actual_duration_ms as number | undefined;
      let desc = `#${(d.order_index as number ?? 0) + 1} "${d.sequence_name}"`;
      if (actual != null) desc += ` — ${formatDurationMs(actual)}`;
      if (planned != null && actual != null && planned > 0) {
        const diff = actual - planned;
        desc += ` (prevu ${formatDurationMs(planned)}, ${diff > 0 ? '+' : ''}${formatDurationMs(Math.abs(diff))})`;
      }
      return desc;
    }
    case 'sequence_skipped':
      return `Index ${d.from_index} → ${d.to_index}${d.session_completed ? ' (fin session)' : ''}`;
    case 'action_executed': {
      const type = d.action_type as string || '';
      const cmd = d.command as string || '';
      const success = d.success as boolean;
      const durMs = d.duration_ms as number || 0;
      const err = d.error as string | null;
      let desc = `${type}:${cmd}`;
      if (d.sequence_name) desc += ` [${d.sequence_name}]`;
      desc += ` — ${formatDurationMs(durMs)}`;
      if (!success && err) desc += ` — ERREUR: ${err}`;
      return desc;
    }
    case 'trailer_resolved': {
      const mode = d.mode as string || '';
      const title = d.movie_title as string || '';
      const trailerTitle = d.trailer_title as string || '';
      if (title) return `${title} — ${trailerTitle} (${mode})`;
      return `Mode: ${mode}`;
    }
    case 'preroll_resolved':
      return `ID: ${d.preroll_id || '?'}`;
    case 'playback_ended':
      return `Source: ${d.source || 'display'}`;
    case 'display_connected':
      return '';
    case 'display_disconnected':
      return d.auto_paused ? 'Auto-pause active' : '';
    default:
      return JSON.stringify(d);
  }
}

function EventRow({ event, sessionStartedAt }: { event: SessionEvent; sessionStartedAt?: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const config = EVENT_CONFIG[event.event_type] || { icon: Zap, color: 'text-dark-muted', label: event.event_type };
  const Icon = config.icon;
  const description = getEventDescription(event);
  const isAction = event.event_type === 'action_executed';
  const hasParams = isAction && !!event.event_data?.parameters && Object.keys(event.event_data.parameters as object).length > 0;
  const success = event.event_data?.success as boolean | undefined;
  const isError = event.event_type === 'session_interrupted' || (isAction && success === false);

  // Relative time from session start
  let relativeTime = '';
  if (sessionStartedAt) {
    const startMs = new Date(sessionStartedAt).getTime();
    const eventMs = new Date(event.timestamp).getTime();
    const diff = eventMs - startMs;
    if (diff >= 0) {
      relativeTime = `+${formatDurationMs(diff)}`;
    }
  }

  return (
    <div className="group">
      <div
        className={`flex items-start gap-3 py-1.5 px-2 rounded-lg hover:bg-dark-surface/50 ${hasParams ? 'cursor-pointer' : ''}`}
        onClick={hasParams ? () => setExpanded(!expanded) : undefined}
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-0.5 shrink-0">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isError ? 'bg-red-500/20' : 'bg-dark-surface'}`}>
            <Icon size={12} className={isError ? 'text-red-400' : config.color} />
          </div>
        </div>

        {/* Time */}
        <div className="w-16 shrink-0 text-xs text-dark-muted pt-0.5 font-mono">
          {formatTime(event.timestamp)}
        </div>

        {/* Relative time */}
        {relativeTime && (
          <div className="w-14 shrink-0 text-xs text-dark-muted/60 pt-0.5 font-mono">
            {relativeTime}
          </div>
        )}

        {/* Label */}
        <div className="w-36 shrink-0 pt-0.5">
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
        </div>

        {/* Description */}
        <div className={`flex-1 text-sm ${isError ? 'text-red-400' : 'text-dark-text/80'} truncate`}>
          {description}
        </div>

        {/* Duration badge for actions */}
        {isAction && event.event_data?.duration_ms != null && (
          <div className="shrink-0 flex items-center gap-1">
            <Clock size={10} className="text-dark-muted" />
            <span className="text-xs text-dark-muted">{formatDurationMs(event.event_data.duration_ms as number)}</span>
          </div>
        )}

        {/* Success/fail badge for actions */}
        {isAction && (
          <div className="shrink-0">
            {success ? (
              <CheckCircle size={14} className="text-green-400" />
            ) : (
              <AlertCircle size={14} className="text-red-400" />
            )}
          </div>
        )}

        {/* Expand chevron */}
        {hasParams && (
          <div className="shrink-0 text-dark-muted">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Expanded parameters */}
      {expanded && hasParams && (
        <div className="ml-24 mr-4 mb-2 p-2 bg-dark-bg rounded border border-dark-border text-xs font-mono text-dark-muted overflow-x-auto">
          <pre className="whitespace-pre-wrap">{JSON.stringify(event.event_data?.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export function EventTimeline({ events, sessionStartedAt }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-dark-muted text-sm">
        Aucun evenement enregistre pour cette session
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-[21px] top-2 bottom-2 w-px bg-dark-border" />

      {/* Events */}
      <div className="space-y-0.5">
        {events.map((event) => (
          <EventRow key={event.id} event={event} sessionStartedAt={sessionStartedAt} />
        ))}
      </div>
    </div>
  );
}
