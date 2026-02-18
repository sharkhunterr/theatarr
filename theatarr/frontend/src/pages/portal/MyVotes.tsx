/**
 * My votes page for portal.
 */

import { useQuery } from '@tanstack/react-query';
import { Vote } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { VoteCard } from '../../components/portal/VoteCard';

interface PortalVote {
  id: string;
  name: string;
  description: string | null;
  movie_options_preview: Array<{ title?: string; poster_url?: string }>;
  has_voted: boolean;
  closes_at: string | null;
  status: string;
}

type TabType = 'pending' | 'all';

export function MyVotes() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  const { data: pendingVotes, isLoading: isPendingLoading } = useQuery({
    queryKey: ['portal', 'votes', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalVote[]; total: number }>('/portal/votes/pending'),
    enabled: activeTab === 'pending',
    refetchInterval: 15000,
  });

  const { data: allVotes, isLoading: isAllLoading } = useQuery({
    queryKey: ['portal', 'votes', 'all'],
    queryFn: () => apiClient.get<{ items: PortalVote[]; total: number }>('/portal/votes?limit=50'),
    enabled: activeTab === 'all',
    refetchInterval: 15000,
  });

  const isLoading = activeTab === 'pending' ? isPendingLoading : isAllLoading;
  const data = activeTab === 'pending' ? pendingVotes : allVotes;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-dark-text">Mes Votes</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        <button
          onClick={() => setActiveTab('pending')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'pending'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          A voter
          {pendingVotes && pendingVotes.items.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-theatarr-500 text-white text-xs">
              {pendingVotes.items.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'all'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          Tous les votes
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-dark-surface rounded-xl border border-dark-border animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Votes list */}
      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((vote) => (
            <VoteCard
              key={vote.id}
              id={vote.id}
              name={vote.name}
              description={vote.description}
              movieOptionsPreview={vote.movie_options_preview}
              hasVoted={vote.has_voted}
              closesAt={vote.closes_at}
              status={vote.status}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="text-center py-12">
          <Vote size={48} className="mx-auto text-dark-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text mb-2">
            {activeTab === 'pending' ? 'Aucun vote en attente' : 'Aucun vote'}
          </h3>
          <p className="text-dark-muted">
            {activeTab === 'pending'
              ? 'Vous avez vote pour toutes les sessions ouvertes.'
              : "Vous n'avez pas encore ete invite a voter."}
          </p>
        </div>
      )}
    </div>
  );
}
