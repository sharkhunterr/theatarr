/**
 * Gantt-style timeline detail modal for admin session view.
 * Shows one lane per action type, with zoom, tooltips, and live cursor.
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Maximize2,
  Minus,
  Plus,
  X,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../common/Modal';
import { apiClient } from '../../api/client';
import {
  ACTION_TYPE_COLORS,
  ACTION_TYPE_ICONS,
  getBlockDuration,
  computeKnownManualMs,
  formatDuration,
} from '../../utils/timeline';

// ============================================================================
// Types
// ============================================================================

interface ActionDetail {
  id: string;
  action_type: string;
  command: string;
  parameters: Record<string, unknown>;
  delay_ms: number;
  on_failure: string;
  service_id: string | null;
}

interface SequenceWithActions {
  id: string;
  name: string;
  order_index: number;
  duration_type: string;
  duration_ms: number | null;
  duration_fallback_ms: number;
  transition_ms: number;
  actions_count: number;
  action_types: string[];
  expected_duration_ms: number | null;
  actions: ActionDetail[];
}

interface SessionTimelineData {
  session_id: string;
  movie_runtime_minutes: number | null;
  sequences: SequenceWithActions[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  language: string;
  currentIndex: number;
  elapsedMs: number;
  status: string;
}

// ============================================================================
// Constants
// ============================================================================

const LANE_ORDER = ['media', 'lighting', 'audio', 'display', 'actuator'];
const LANE_HEIGHT = 40;
const HEADER_HEIGHT = 32;
const TIME_AXIS_HEIGHT = 28;
const MIN_ACTION_WIDTH = 20;
const LABEL_WIDTH = 100;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Estimate action visual duration in ms.
 */
function getActionDurationMs(
  action: ActionDetail,
  sequenceDurationMs: number,
): number {
  const params = action.parameters || {};

  // media:play with pause_at_ms
  if (action.command === 'play' && params.pause_at_ms != null) {
    return Math.max(Number(params.pause_at_ms) - action.delay_ms, 0);
  }

  // media:resume — runs until end of sequence
  if (action.command === 'resume') {
    return Math.max(sequenceDurationMs - action.delay_ms, 0);
  }

  // Audio/display with explicit duration
  if (params.duration_ms != null) {
    return Number(params.duration_ms);
  }

  // Fallback: instant action
  return 0;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// Component
// ============================================================================

export function TimelineDetailModal({
  isOpen,
  onClose,
  sessionId,
  language,
  currentIndex,
  elapsedMs,
  status,
}: Props) {
  const [scale, setScale] = useState(1);
  const [hoveredAction, setHoveredAction] = useState<{
    action: ActionDetail;
    seqName: string;
    clientX: number;
    clientY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch timeline data only when modal is open
  const { data, isLoading } = useQuery({
    queryKey: ['session-timeline', sessionId],
    queryFn: () => apiClient.get<SessionTimelineData>(`/sessions/${sessionId}/timeline`),
    enabled: isOpen,
  });

  const sequences = data?.sequences || [];
  const movieRuntimeMs = (data?.movie_runtime_minutes ?? 0) * 60 * 1000;
  const knownManualMs = useMemo(() => computeKnownManualMs(sequences), [sequences]);

  // Compute sequence start offsets and total duration
  const { sequenceStarts, totalDurationMs, sequenceDurations } = useMemo(() => {
    const starts: number[] = [];
    const durations: number[] = [];
    let offset = 0;
    for (const seq of sequences) {
      starts.push(offset);
      const dur = getBlockDuration(seq, movieRuntimeMs, knownManualMs);
      durations.push(dur);
      offset += dur + (seq.transition_ms || 0);
    }
    return { sequenceStarts: starts, totalDurationMs: offset, sequenceDurations: durations };
  }, [sequences, movieRuntimeMs, knownManualMs]);

  // Determine active lanes (only types that have at least 1 action)
  const activeLanes = useMemo(() => {
    const types = new Set<string>();
    for (const seq of sequences) {
      for (const action of seq.actions) {
        types.add(action.action_type);
      }
    }
    return LANE_ORDER.filter((t) => types.has(t));
  }, [sequences]);

  // Base container width (excluding label)
  const baseWidth = 800;
  const contentWidth = baseWidth * scale;

  const handleZoomIn = useCallback(() => setScale((s) => Math.min(s * 1.5, 10)), []);
  const handleZoomOut = useCallback(() => setScale((s) => Math.max(s / 1.5, 0.5)), []);
  const handleFit = useCallback(() => setScale(1), []);

  // Current position cursor
  const isActive = status === 'running' || status === 'paused';
  const cursorMs = useMemo(() => {
    if (!isActive) return null;
    if (currentIndex < sequenceStarts.length) {
      return sequenceStarts[currentIndex] + elapsedMs;
    }
    return null;
  }, [isActive, currentIndex, sequenceStarts, elapsedMs]);

  // Time axis tick interval
  const tickIntervalMs = useMemo(() => {
    const pixelsPerMs = contentWidth / Math.max(totalDurationMs, 1);
    // Target roughly 80-120px between ticks
    const targetPixels = 100;
    const rawIntervalMs = targetPixels / pixelsPerMs;
    // Snap to nice intervals
    const intervals = [10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000, 3600000];
    return intervals.find((i) => i >= rawIntervalMs) || 3600000;
  }, [contentWidth, totalDurationMs]);

  const ticks = useMemo(() => {
    const result: number[] = [];
    for (let t = 0; t <= totalDurationMs; t += tickIntervalMs) {
      result.push(t);
    }
    return result;
  }, [totalDurationMs, tickIntervalMs]);

  // Position helpers
  const msToX = useCallback(
    (ms: number) => (totalDurationMs > 0 ? (ms / totalDurationMs) * contentWidth : 0),
    [totalDurationMs, contentWidth],
  );

  const totalHeight = HEADER_HEIGHT + activeLanes.length * LANE_HEIGHT + TIME_AXIS_HEIGHT;

  const t = {
    title: language === 'fr' ? 'Timeline de la seance' : 'Session Timeline',
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
    noActions: language === 'fr' ? 'Aucune action' : 'No actions',
    delay: language === 'fr' ? 'Delai' : 'Delay',
    onFailure: language === 'fr' ? 'Si echec' : 'On failure',
    service: 'Service',
    command: language === 'fr' ? 'Commande' : 'Command',
    params: language === 'fr' ? 'Parametres' : 'Parameters',
    instant: language === 'fr' ? 'Instantane' : 'Instant',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" showHeader={false}>
      <div className="space-y-3">
        {/* Custom header with zoom controls */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-dark-text">{t.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors"
              title="Zoom out"
            >
              <Minus size={16} />
            </button>
            <span className="text-xs text-dark-muted w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors"
              title="Zoom in"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors"
              title="Fit"
            >
              <Maximize2 size={16} />
            </button>
            <div className="w-px h-5 bg-dark-border mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border transition-colors"
              title={language === 'fr' ? 'Fermer' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-dark-muted">{t.loading}</div>
        ) : sequences.length === 0 || activeLanes.length === 0 ? (
          <div className="text-center py-12 text-dark-muted">{t.noActions}</div>
        ) : (
          <div className="flex">
            {/* Lane labels (fixed left column) */}
            <div className="flex-shrink-0" style={{ width: LABEL_WIDTH }}>
              {/* Header spacer */}
              <div style={{ height: HEADER_HEIGHT }} />
              {/* Lane labels */}
              {activeLanes.map((type) => {
                const Icon = ACTION_TYPE_ICONS[type] || Zap;
                const color = ACTION_TYPE_COLORS[type] || '#6b7280';
                return (
                  <div
                    key={type}
                    className="flex items-center gap-1.5 px-2 border-b border-dark-border/30"
                    style={{ height: LANE_HEIGHT }}
                  >
                    <Icon size={14} style={{ color }} />
                    <span className="text-xs font-medium" style={{ color }}>
                      {type}
                    </span>
                  </div>
                );
              })}
              {/* Time axis spacer */}
              <div style={{ height: TIME_AXIS_HEIGHT }} />
            </div>

            {/* Scrollable timeline area */}
            <div
              ref={containerRef}
              className="flex-1 overflow-x-auto overflow-y-hidden relative border-l border-dark-border/30"
            >
              <div style={{ width: contentWidth, minHeight: totalHeight }} className="relative">
                {/* Sequence headers */}
                <div className="flex" style={{ height: HEADER_HEIGHT }}>
                  {sequences.map((seq, i) => {
                    const left = msToX(sequenceStarts[i]);
                    const width = msToX(sequenceDurations[i]);
                    return (
                      <div
                        key={seq.id}
                        className="absolute flex items-center px-2 text-[11px] font-medium text-dark-text truncate border-b border-dark-border/30"
                        style={{ left, width: Math.max(width, 1), height: HEADER_HEIGHT }}
                        title={seq.name}
                      >
                        {width > 40 ? seq.name : ''}
                      </div>
                    );
                  })}
                </div>

                {/* Lanes */}
                {activeLanes.map((type, laneIdx) => {
                  const laneTop = HEADER_HEIGHT + laneIdx * LANE_HEIGHT;
                  return (
                    <div
                      key={type}
                      className="absolute w-full border-b border-dark-border/20"
                      style={{ top: laneTop, height: LANE_HEIGHT }}
                    >
                      {/* Alternating background */}
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: laneIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
                      />

                      {/* Actions in this lane */}
                      {sequences.map((seq, seqIdx) => {
                        const seqStart = sequenceStarts[seqIdx];
                        const seqDur = sequenceDurations[seqIdx];

                        return seq.actions
                          .filter((a) => a.action_type === type)
                          .map((action) => {
                            const actionStart = seqStart + action.delay_ms;
                            const actionDurMs = getActionDurationMs(action, seqDur);
                            const left = msToX(actionStart);
                            const rawWidth = actionDurMs > 0 ? msToX(actionDurMs) : 0;
                            const width = Math.max(rawWidth, MIN_ACTION_WIDTH);
                            const color = ACTION_TYPE_COLORS[type] || '#6b7280';
                            const isInstant = actionDurMs === 0;

                            return (
                              <div
                                key={action.id}
                                className={clsx(
                                  'absolute rounded-sm cursor-pointer transition-opacity hover:opacity-100',
                                  isInstant ? 'opacity-80' : 'opacity-70',
                                )}
                                style={{
                                  left,
                                  width,
                                  top: 4,
                                  height: LANE_HEIGHT - 8,
                                  backgroundColor: color,
                                  borderLeft: isInstant ? `2px solid ${color}` : undefined,
                                  backgroundImage: isInstant
                                    ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)'
                                    : undefined,
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredAction({
                                    action,
                                    seqName: seq.name,
                                    clientX: e.clientX,
                                    clientY: e.clientY,
                                  });
                                }}
                                onMouseLeave={() => setHoveredAction(null)}
                              >
                                {/* Command label if block is wide enough */}
                                {width > 50 && (
                                  <div className="absolute inset-0 flex items-center px-1.5 overflow-hidden">
                                    <span className="text-[10px] text-white font-medium truncate">
                                      {action.command}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          });
                      })}
                    </div>
                  );
                })}

                {/* Sequence separators (vertical dashed lines) */}
                {sequences.map((seq, i) => {
                  if (i === 0) return null;
                  const x = msToX(sequenceStarts[i]);
                  // Transition zone
                  const transitionMs = sequences[i - 1].transition_ms || 0;
                  const transitionWidth = msToX(transitionMs);
                  return (
                    <div key={`sep-${seq.id}`}>
                      {/* Transition zone */}
                      {transitionWidth > 0 && (
                        <div
                          className="absolute bg-white/5"
                          style={{
                            left: x - transitionWidth,
                            width: transitionWidth,
                            top: HEADER_HEIGHT,
                            height: activeLanes.length * LANE_HEIGHT,
                          }}
                        />
                      )}
                      {/* Separator line */}
                      <div
                        className="absolute border-l border-dashed border-dark-muted/40"
                        style={{
                          left: x,
                          top: 0,
                          height: HEADER_HEIGHT + activeLanes.length * LANE_HEIGHT,
                        }}
                      />
                    </div>
                  );
                })}

                {/* Current position cursor */}
                {cursorMs != null && (
                  <div
                    className="absolute w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] z-20 pointer-events-none"
                    style={{
                      left: msToX(cursorMs),
                      top: 0,
                      height: HEADER_HEIGHT + activeLanes.length * LANE_HEIGHT + TIME_AXIS_HEIGHT,
                    }}
                  />
                )}

                {/* Time axis */}
                <div
                  className="absolute w-full border-t border-dark-border/30"
                  style={{ top: HEADER_HEIGHT + activeLanes.length * LANE_HEIGHT, height: TIME_AXIS_HEIGHT }}
                >
                  {ticks.map((tickMs) => {
                    const x = msToX(tickMs);
                    return (
                      <div key={tickMs} className="absolute" style={{ left: x }}>
                        <div className="w-px h-2 bg-dark-muted/40" />
                        <div className="text-[10px] text-dark-muted mt-0.5 -translate-x-1/2">
                          {formatTimestamp(tickMs)}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed-position tooltip — rendered outside scrollable container to avoid clipping */}
      {hoveredAction && (() => {
        const TOOLTIP_HEIGHT_ESTIMATE = 160;
        const nearBottom = hoveredAction.clientY + TOOLTIP_HEIGHT_ESTIMATE > window.innerHeight;
        return (
          <div
            className="fixed z-[60] pointer-events-none"
            style={{
              left: Math.min(hoveredAction.clientX + 12, window.innerWidth - 300),
              ...(nearBottom
                ? { bottom: window.innerHeight - hoveredAction.clientY + 8 }
                : { top: hoveredAction.clientY + 12 }),
            }}
          >
            <div className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 shadow-xl min-w-[180px] max-w-[280px]">
              <div className="text-xs font-medium text-dark-text mb-1">
                {hoveredAction.action.command}
              </div>
              <div className="text-[10px] text-dark-muted space-y-0.5">
                <div>{t.command}: <span className="text-dark-text">{hoveredAction.action.action_type}:{hoveredAction.action.command}</span></div>
                {hoveredAction.action.delay_ms > 0 && (
                  <div>{t.delay}: <span className="text-dark-text">{formatDuration(hoveredAction.action.delay_ms)}</span></div>
                )}
                {hoveredAction.action.service_id && (
                  <div>{t.service}: <span className="text-dark-text">{hoveredAction.action.service_id}</span></div>
                )}
                <div>{t.onFailure}: <span className="text-dark-text">{hoveredAction.action.on_failure}</span></div>
                {Object.entries(hoveredAction.action.parameters).length > 0 && (
                  <div className="mt-1 pt-1 border-t border-dark-border/30">
                    {Object.entries(hoveredAction.action.parameters).slice(0, 5).map(([key, value]) => (
                      <div key={key} className="truncate">
                        <span className="text-dark-muted">{key}:</span>{' '}
                        <span className="text-dark-text">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-dark-muted/60 mt-1">
                {hoveredAction.seqName}
              </div>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
}
