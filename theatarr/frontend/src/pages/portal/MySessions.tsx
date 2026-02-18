/**
 * My sessions page for portal.
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Star } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { SessionCard } from '../../components/portal/SessionCard';
import { useCountdown } from '../../hooks/useCountdown';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';

interface PortalSession {
  id: string;
  name: string;
  movie_title: string | null;
  movie_poster_url: string | null;
  status: string;
  scheduled_at: string | null;
  invitation_status: string;
  movie_selection_mode?: string | null;
  movie_resolved?: boolean;
  mystery_reveal_at?: string | null;
  vote_reveal_at?: string | null;
  linked_vote_session_id?: string | null;
  linked_vote_is_open?: boolean | null;
  vote_movie_posters?: string[] | null;
  feedback_available?: boolean;
  has_submitted_feedback?: boolean;
  feedback_count?: number;
  feedback_average?: number | null;
}

type TabType = 'all' | 'upcoming' | 'feedback';

export function MySessions() {
  useCountdown();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { items } = usePortalNotifications();
  const invitationCount = items.find((i) => i.id === 'invitations')?.count || 0;
  const feedbackCount = items.find((i) => i.id === 'feedback')?.count || 0;

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'sessions', activeTab],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab === 'upcoming') params.append('status_filter', 'scheduled');
      if (activeTab === 'feedback') params.append('status_filter', 'completed');
      params.append('limit', '50');
      return apiClient.get<{ items: PortalSession[]; total: number }>(
        `/portal/sessions?${params.toString()}`
      );
    },
    refetchInterval: 15000,
  });

  // Filter feedback tab to only show sessions needing feedback
  const displayItems = activeTab === 'feedback'
    ? (data?.items || []).filter((s) => s.feedback_available && !s.has_submitted_feedback)
    : data?.items || [];

  const tabs: Array<{ key: TabType; label: string; badge?: number; badgeColor?: string }> = [
    { key: 'all', label: 'Tous' },
    { key: 'upcoming', label: 'A venir', badge: invitationCount, badgeColor: 'bg-orange-500' },
    { key: 'feedback', label: 'A noter', badge: feedbackCount, badgeColor: 'bg-yellow-500' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-dark-text">Mes Sessions</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2',
              activeTab === tab.key
                ? 'border-theatarr-500 text-theatarr-500'
                : 'border-transparent text-dark-muted hover:text-dark-text'
            )}
          >
            {tab.key === 'feedback' && <Star size={14} />}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className={clsx(
                'min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-white text-[10px] font-bold leading-none',
                tab.badgeColor || 'bg-theatarr-500'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-dark-surface rounded-xl border border-dark-border animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Sessions list */}
      {!isLoading && displayItems.length > 0 && (
        <div className="space-y-3">
          {displayItems.map((session) => (
            <SessionCard
              key={session.id}
              id={session.id}
              name={session.name}
              movieTitle={session.movie_title}
              moviePosterUrl={session.movie_poster_url}
              status={session.status}
              scheduledAt={session.scheduled_at}
              invitationStatus={session.invitation_status}
              movieSelectionMode={session.movie_selection_mode}
              movieResolved={session.movie_resolved}
              mysteryRevealAt={session.mystery_reveal_at}
              voteRevealAt={session.vote_reveal_at}
              linkedVoteSessionId={session.linked_vote_session_id}
              linkedVoteIsOpen={session.linked_vote_is_open}
              voteMoviePosters={session.vote_movie_posters}
              feedbackAvailable={session.feedback_available}
              hasSubmittedFeedback={session.has_submitted_feedback}
              feedbackCount={session.feedback_count}
              feedbackAverage={session.feedback_average}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayItems.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-dark-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text mb-2">
            {activeTab === 'feedback'
              ? 'Aucune notation en attente'
              : activeTab === 'upcoming'
              ? 'Aucune session a venir'
              : 'Aucune session'}
          </h3>
          <p className="text-dark-muted">
            {activeTab === 'feedback'
              ? 'Vous avez note toutes vos sessions.'
              : activeTab === 'upcoming'
              ? 'Aucune session planifiee pour le moment.'
              : "Vous n'avez pas encore ete invite a des sessions."}
          </p>
        </div>
      )}
    </div>
  );
}
