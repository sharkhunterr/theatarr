/**
 * Shared timeline utilities for proportional widths, durations, and colors.
 */

import {
  Film,
  Lightbulb,
  Music,
  ScreenShare,
  Settings,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface SequenceLike {
  duration_type: string;
  duration_ms: number | null;
  duration_fallback_ms?: number;
  expected_duration_ms?: number | null;
  action_types?: string[];
  actions_count?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const ACTION_TYPE_COLORS: Record<string, string> = {
  media: '#3b82f6',
  lighting: '#eab308',
  audio: '#22c55e',
  display: '#a855f7',
  actuator: '#f97316',
};

export const ACTION_TYPE_ICONS: Record<string, typeof Film> = {
  media: Film,
  lighting: Lightbulb,
  audio: Music,
  display: ScreenShare,
  actuator: Settings,
};

export const MIN_BLOCK_PERCENT = 3;

// ============================================================================
// Duration helpers
// ============================================================================

export function getEffectiveDuration(seq: SequenceLike): number {
  if (seq.duration_type === 'fixed' && seq.duration_ms && seq.duration_ms > 0) return seq.duration_ms;
  if (seq.duration_ms && seq.duration_ms > 0) return seq.duration_ms;
  if (seq.duration_fallback_ms && seq.duration_fallback_ms > 0) return seq.duration_fallback_ms;
  return 60000;
}

/**
 * Get the expected duration of a sequence for timeline display.
 * Uses expected_duration_ms from backend (based on pause_at_ms for manual),
 * movie runtime for open-ended manual sequences, or fixed duration.
 */
export function getBlockDuration(seq: SequenceLike, movieRuntimeMs: number, knownManualMs: number): number {
  if (seq.expected_duration_ms && seq.expected_duration_ms > 0) return seq.expected_duration_ms;
  if (seq.duration_type === 'manual') {
    return Math.max(movieRuntimeMs - knownManualMs, 60000);
  }
  return getEffectiveDuration(seq);
}

/**
 * Compute stable proportional widths. Computed once from sequence definitions
 * and movie runtime — does NOT depend on elapsed time, so blocks never shift.
 */
export function computeProportionalWidths(
  sequences: SequenceLike[],
  movieRuntimeMs: number,
): number[] {
  if (sequences.length === 0) return [];

  const knownManualMs = sequences
    .filter((s) => s.duration_type === 'manual' && s.expected_duration_ms && s.expected_duration_ms > 0)
    .reduce((sum, s) => sum + s.expected_duration_ms!, 0);

  const durations = sequences.map((seq) => getBlockDuration(seq, movieRuntimeMs, knownManualMs));

  const total = durations.reduce((s, d) => s + d, 0);
  if (total === 0) return sequences.map(() => 100 / sequences.length);

  const raw = durations.map((d) => (d / total) * 100);
  const clamped = raw.map((w) => Math.max(w, MIN_BLOCK_PERCENT));
  const clampedSum = clamped.reduce((s, w) => s + w, 0);
  return clamped.map((w) => (w / clampedSum) * 100);
}

/**
 * Compute known manual milliseconds from sequences.
 */
export function computeKnownManualMs(sequences: SequenceLike[]): number {
  return sequences
    .filter((s) => s.duration_type === 'manual' && s.expected_duration_ms && s.expected_duration_ms > 0)
    .reduce((sum, s) => sum + s.expected_duration_ms!, 0);
}

// ============================================================================
// Formatting
// ============================================================================

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours}h${remainMinutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
