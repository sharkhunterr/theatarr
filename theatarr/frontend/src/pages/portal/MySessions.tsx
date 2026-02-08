/**
 * My sessions page for portal.
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { SessionCard } from '../../components/portal/SessionCard';
import { useCountdown } from '../../hooks/useCountdown';

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
  linked_vote_session_id?: string | null;
  linked_vote_is_open?: boolean | null;
}

const statusFilters = [
  { value: '', label: 'Tous' },
  { value: 'scheduled', label: 'A venir' },
  { value: 'running', label: 'En cours' },
  { value: 'completed', label: 'Termines' },
];

export function MySessions() {
  useCountdown();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'sessions', statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status_filter', statusFilter);
      params.append('limit', '50');
      return apiClient.get<{ items: PortalSession[]; total: number }>(
        `/portal/sessions?${params.toString()}`
      );
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-dark-text">Mes Sessions</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={clsx(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              statusFilter === filter.value
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface border border-dark-border text-dark-muted hover:text-dark-text'
            )}
          >
            {filter.label}
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
      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((session) => (
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
              linkedVoteSessionId={session.linked_vote_session_id}
              linkedVoteIsOpen={session.linked_vote_is_open}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-dark-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text mb-2">
            Aucune session
          </h3>
          <p className="text-dark-muted">
            Vous n'avez pas encore ete invite a des sessions.
          </p>
        </div>
      )}
    </div>
  );
}
