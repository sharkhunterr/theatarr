/**
 * Countdown formatting utilities for mystery reveals and session starts.
 */

import i18n from '../i18n';

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-US' };

function getLocale(): string {
  return LOCALE_MAP[i18n.language] || 'fr-FR';
}

/**
 * Format a countdown as a short localized string: "2j 5h" / "2d 5h", "3h 15m", "12m".
 */
export function formatCountdownShort(targetDate: string): string {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return i18n.t('common:time.now');

  const d = i18n.t('common:countdown.daysShort');
  const h = i18n.t('common:countdown.hoursShort');
  const m = i18n.t('common:countdown.minutesShort');

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}${d} ${hours}${h}`;
  if (hours > 0) return `${hours}${h} ${minutes}${m}`;
  return `${minutes}${m}`;
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
    return { text: i18n.t('common:time.now'), color: '#22c55e', pulse: true, urgency: 'imminent' };
  }

  const minutes = diff / (1000 * 60);
  const hours = minutes / 60;
  const days = hours / 24;

  if (minutes <= 5) {
    return { text: i18n.t('common:time.imminent'), color: '#ef4444', pulse: true, urgency: 'imminent' };
  }
  if (minutes <= 15) {
    return { text: i18n.t('common:time.inMinutes', { count: Math.ceil(minutes) }), color: '#ef4444', pulse: true, urgency: 'high' };
  }
  if (minutes <= 60) {
    return { text: i18n.t('common:time.inMinutes', { count: Math.ceil(minutes) }), color: '#f97316', pulse: true, urgency: 'medium' };
  }
  if (hours <= 3) {
    const h = Math.floor(hours);
    const m = Math.ceil(minutes % 60);
    return { text: i18n.t('common:time.inHoursMinutes', { h, m: m > 0 ? ` ${m}` : '' }), color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  if (days < 1) {
    return { text: i18n.t('common:time.today', { time: formatTime(scheduledAt) }), color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  if (days < 2) {
    return { text: i18n.t('common:time.tomorrow', { time: formatTime(scheduledAt) }), color: '#3b82f6', pulse: false, urgency: 'low' };
  }
  return { text: i18n.t('common:time.inDays', { count: Math.ceil(days) }), color: '#6b7280', pulse: false, urgency: 'low' };
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get mystery reveal countdown info.
 */
export function getMysteryRevealCountdown(revealAt: string): { text: string; color: string; pulse: boolean } {
  const target = new Date(revealAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { text: i18n.t('common:countdown.revealImminent'), color: '#a855f7', pulse: true };
  }

  return {
    text: i18n.t('common:countdown.revealIn', { time: formatCountdownShort(revealAt) }),
    color: '#a855f7',
    pulse: diff < 5 * 60 * 1000,
  };
}

/**
 * Get vote reveal countdown info.
 */
export function getVoteRevealCountdown(revealAt: string): { text: string; color: string; pulse: boolean } {
  const target = new Date(revealAt).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { text: i18n.t('common:countdown.revealImminent'), color: '#3b82f6', pulse: true };
  }

  return {
    text: i18n.t('common:countdown.revealIn', { time: formatCountdownShort(revealAt) }),
    color: '#3b82f6',
    pulse: diff < 5 * 60 * 1000,
  };
}
