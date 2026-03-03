/**
 * Portal notification system with "seen" tracking via localStorage.
 *
 * Tracks item counts from /portal/stats. When any count increases,
 * the delta shows as "unseen" badges. Visiting a page or opening the bell
 * acknowledges the current counts.
 *
 * Tracks both "pending" (actionable) and "completed" (results) counts:
 * - votes: pending_votes + closed_votes
 * - quiz: pending_quiz + completed_quiz
 * - sessions: pending_invitations + pending_feedback
 */

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';

const STORAGE_KEY = 'portal_ack_counts';
const NEEDS_INIT_KEY = 'portal_ack_needs_init';

interface PortalStats {
  pending_votes: number;
  pending_quiz: number;
  pending_invitations: number;
  pending_feedback: number;
  upcoming_sessions: number;
  total_sessions_attended: number;
  total_votes_cast: number;
  closed_votes: number;
  completed_quiz: number;
}

/** Per-type ack counts — tracks each notification type independently. */
interface AckCounts {
  invitations: number;
  feedback: number;
  votes_pending: number;
  votes_closed: number;
  quiz_pending: number;
  quiz_completed: number;
}

const EMPTY_ACK: AckCounts = {
  invitations: 0,
  feedback: 0,
  votes_pending: 0,
  votes_closed: 0,
  quiz_pending: 0,
  quiz_completed: 0,
};

function loadAck(): AckCounts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration: old format → mark for init from current stats
      if ('sessions' in parsed && !('invitations' in parsed)) {
        localStorage.setItem(NEEDS_INIT_KEY, '1');
        return { ...EMPTY_ACK };
      }
      return { ...EMPTY_ACK, ...parsed };
    }
  } catch {}
  // First use — mark for init from current stats
  localStorage.setItem(NEEDS_INIT_KEY, '1');
  return { ...EMPTY_ACK };
}

function persistAck(ack: AckCounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ack));
}

export interface NotificationItem {
  id: string;
  category: 'sessions' | 'votes' | 'quiz';
  label: string;
  count: number;
  path: string;
  color: string;
}

export interface PortalNotifications {
  /** Total unseen count for the bell badge */
  totalUnseen: number;
  /** Notification items for the dropdown */
  items: NotificationItem[];
  /** Per-category unseen counts (for nav badges) */
  unseenSessions: number;
  unseenVotes: number;
  unseenQuiz: number;
  /** Acknowledge all categories (when opening the bell) */
  markAllSeen: () => void;
  /** Acknowledge a specific category (when visiting a page) */
  markCategorySeen: (category: 'sessions' | 'votes' | 'quiz') => void;
}

export function usePortalNotifications(): PortalNotifications {
  const location = useLocation();

  const { data: stats } = useQuery<PortalStats>({
    queryKey: ['portal', 'badges'],
    queryFn: () => apiClient.get<PortalStats>('/portal/stats'),
    refetchInterval: 20000,
    staleTime: 10000,
  });

  // Reactive ack state — both in React state AND localStorage
  const [ack, setAck] = useState<AckCounts>(loadAck);

  const updateAck = useCallback((newAck: AckCounts) => {
    persistAck(newAck);
    setAck(newAck);
  }, []);

  // Current counts per notification type
  const currentCounts = useMemo((): AckCounts => {
    if (!stats) return { ...EMPTY_ACK };
    return {
      invitations: stats.pending_invitations,
      feedback: stats.pending_feedback,
      votes_pending: stats.pending_votes,
      votes_closed: stats.closed_votes,
      quiz_pending: stats.pending_quiz,
      quiz_completed: stats.completed_quiz,
    };
  }, [stats]);

  // On first use or migration: initialize ack to current counts so historical
  // items don't show as unseen. Only runs once when stats first load.
  useEffect(() => {
    if (!stats) return;
    if (localStorage.getItem(NEEDS_INIT_KEY)) {
      localStorage.removeItem(NEEDS_INIT_KEY);
      const initial = {
        invitations: stats.pending_invitations,
        feedback: stats.pending_feedback,
        votes_pending: stats.pending_votes,
        votes_closed: stats.closed_votes,
        quiz_pending: stats.pending_quiz,
        quiz_completed: stats.completed_quiz,
      };
      persistAck(initial);
      setAck(initial);
    }
  }, [stats]);

  // Auto-correct ack when current drops below ack (user acted on items).
  // Skip when stats haven't loaded yet to avoid wiping saved ack on page refresh.
  useEffect(() => {
    if (!stats) return;
    let needsUpdate = false;
    const corrected = { ...ack };
    for (const key of Object.keys(EMPTY_ACK) as (keyof AckCounts)[]) {
      if (currentCounts[key] < corrected[key]) {
        corrected[key] = currentCounts[key];
        needsUpdate = true;
      }
    }
    if (needsUpdate) updateAck(corrected);
  }, [currentCounts, ack, updateAck, stats]);

  // Compute unseen per type, then aggregate per category.
  // Return zeros until stats are loaded to avoid flash of stale badges.
  const unseen = useMemo(() => {
    if (!stats) return { sessions: 0, votes: 0, quiz: 0 };
    return {
      sessions:
        Math.max(0, currentCounts.invitations - ack.invitations) +
        Math.max(0, currentCounts.feedback - ack.feedback),
      votes:
        Math.max(0, currentCounts.votes_pending - ack.votes_pending) +
        Math.max(0, currentCounts.votes_closed - ack.votes_closed),
      quiz:
        Math.max(0, currentCounts.quiz_pending - ack.quiz_pending) +
        Math.max(0, currentCounts.quiz_completed - ack.quiz_completed),
    };
  }, [currentCounts, ack, stats]);

  const markAllSeen = useCallback(() => {
    if (!stats) return;
    updateAck({ ...currentCounts });
  }, [currentCounts, updateAck, stats]);

  const markCategorySeen = useCallback((category: 'sessions' | 'votes' | 'quiz') => {
    if (!stats) return;
    setAck((prev) => {
      const next = { ...prev };
      if (category === 'sessions') {
        next.invitations = currentCounts.invitations;
        next.feedback = currentCounts.feedback;
      } else if (category === 'votes') {
        next.votes_pending = currentCounts.votes_pending;
        next.votes_closed = currentCounts.votes_closed;
      } else if (category === 'quiz') {
        next.quiz_pending = currentCounts.quiz_pending;
        next.quiz_completed = currentCounts.quiz_completed;
      }
      persistAck(next);
      return next;
    });
  }, [currentCounts, stats]);

  // Use ref to avoid re-triggering the auto-clear effect when counts change.
  // We only want to auto-clear on actual page navigation.
  const markCategorySeenRef = useRef(markCategorySeen);
  markCategorySeenRef.current = markCategorySeen;

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/portal/sessions')) {
      markCategorySeenRef.current('sessions');
    } else if (path.startsWith('/portal/votes')) {
      markCategorySeenRef.current('votes');
    } else if (path.startsWith('/portal/quiz')) {
      markCategorySeenRef.current('quiz');
    }
  }, [location.pathname]);

  // Per-type unseen counts
  const unseenPerType = useMemo(() => {
    if (!stats) return EMPTY_ACK;
    return {
      invitations: Math.max(0, currentCounts.invitations - ack.invitations),
      feedback: Math.max(0, currentCounts.feedback - ack.feedback),
      votes_pending: Math.max(0, currentCounts.votes_pending - ack.votes_pending),
      votes_closed: Math.max(0, currentCounts.votes_closed - ack.votes_closed),
      quiz_pending: Math.max(0, currentCounts.quiz_pending - ack.quiz_pending),
      quiz_completed: Math.max(0, currentCounts.quiz_completed - ack.quiz_completed),
    };
  }, [currentCounts, ack, stats]);

  // Build notification items — only items with unseen > 0
  const items = useMemo(() => {
    const list: NotificationItem[] = [];

    if (unseenPerType.invitations > 0) {
      list.push({
        id: 'invitations',
        category: 'sessions',
        label: `Invitation${unseenPerType.invitations > 1 ? 's' : ''} en attente`,
        count: unseenPerType.invitations,
        path: '/portal/sessions',
        color: 'text-blue-400',
      });
    }

    if (unseenPerType.feedback > 0) {
      list.push({
        id: 'feedback',
        category: 'sessions',
        label: `Session${unseenPerType.feedback > 1 ? 's' : ''} a noter`,
        count: unseenPerType.feedback,
        path: '/portal/sessions',
        color: 'text-yellow-400',
      });
    }

    if (unseenPerType.votes_pending > 0) {
      list.push({
        id: 'votes',
        category: 'votes',
        label: `Vote${unseenPerType.votes_pending > 1 ? 's' : ''} en attente`,
        count: unseenPerType.votes_pending,
        path: '/portal/votes',
        color: 'text-red-400',
      });
    }

    if (unseenPerType.votes_closed > 0) {
      list.push({
        id: 'votes_closed',
        category: 'votes',
        label: `Resultat${unseenPerType.votes_closed > 1 ? 's' : ''} de vote`,
        count: unseenPerType.votes_closed,
        path: '/portal/votes',
        color: 'text-orange-400',
      });
    }

    if (unseenPerType.quiz_pending > 0) {
      list.push({
        id: 'quiz',
        category: 'quiz',
        label: `Quiz en cours`,
        count: unseenPerType.quiz_pending,
        path: '/portal/quiz',
        color: 'text-purple-400',
      });
    }

    if (unseenPerType.quiz_completed > 0) {
      list.push({
        id: 'quiz_completed',
        category: 'quiz',
        label: `Quiz termine${unseenPerType.quiz_completed > 1 ? 's' : ''}`,
        count: unseenPerType.quiz_completed,
        path: '/portal/quiz',
        color: 'text-green-400',
      });
    }

    return list;
  }, [unseenPerType]);

  return {
    totalUnseen: unseen.sessions + unseen.votes + unseen.quiz,
    items,
    unseenSessions: unseen.sessions,
    unseenVotes: unseen.votes,
    unseenQuiz: unseen.quiz,
    markAllSeen,
    markCategorySeen,
  };
}
