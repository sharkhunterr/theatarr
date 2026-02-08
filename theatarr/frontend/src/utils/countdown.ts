/**
 * Countdown formatting utilities for mystery reveals and session starts.
 */

/**
 * Format a countdown as a short French string: "2j 5h", "3h 15m", "12m".
 */
export function formatCountdownShort(targetDate: string): string {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return 'NOW';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export interface SessionStartInfo {
  text: string;
  color: string;
  pulse: boolean;
  urgency: 'low' | 'medium' | 'high' | 'imminent';
}

/**
 * Get session start countdown info with contextual urgency.
 */
export function getSessionStartCountdown(scheduledAt: string): SessionStartInfo {
  const target = new Date(scheduledAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { text: 'Maintenant', color: '#22c55e', pulse: true, urgency: 'imminent' };
  }

  const minutes = diff / (1000 * 60);
  const hours = minutes / 60;
  const days = hours / 24;

  if (minutes <= 5) {
    return { text: 'Imminent', color: '#ef4444', pulse: true, urgency: 'imminent' };
  }
  if (minutes <= 15) {
    return { text: `Dans ${Math.ceil(minutes)} min`, color: '#ef4444', pulse: true, urgency: 'high' };
  }
  if (minutes <= 60) {
    return { text: `Dans ${Math.ceil(minutes)} min`, color: '#f97316', pulse: true, urgency: 'medium' };
  }
  if (hours <= 3) {
    const h = Math.floor(hours);
    const m = Math.ceil(minutes % 60);
    return { text: `Dans ${h}h${m > 0 ? ` ${m}m` : ''}`, color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  if (days < 1) {
    return { text: `Aujourd'hui ${formatTime(scheduledAt)}`, color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  if (days < 2) {
    return { text: `Demain ${formatTime(scheduledAt)}`, color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  return { text: `Dans ${Math.ceil(days)} jours`, color: '#6b7280', pulse: false, urgency: 'low' };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get mystery reveal countdown info.
 */
export function getMysteryRevealCountdown(revealAt: string): { text: string; color: string; pulse: boolean } {
  const target = new Date(revealAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { text: 'Revelation imminente', color: '#a855f7', pulse: true };
  }

  return {
    text: `Revelation dans ${formatCountdownShort(revealAt)}`,
    color: '#a855f7',
    pulse: diff < 5 * 60 * 1000,
  };
}
