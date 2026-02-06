/**
 * History page for portal - past sessions and votes.
 */

import { useQuery } from '@tanstack/react-query';
import { Film, Vote, Trophy, Check } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../../api/client';

interface HistorySession {
  id: string;
  name: string;
  movie_title: string | null;
  movie_poster_url: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  invitation_status: string;
}

interface HistoryVote {
  id: string;
  name: string;
  voted_movie_title: string | null;
  voted_movie_poster_url: string | null;
  winner_movie_title: string | null;
  winner_movie_poster_url: string | null;
  voted_at: string | null;
  closed_at: string | null;
}

type TabType = 'sessions' | 'votes';

export function History() {
  const [activeTab, setActiveTab] = useState<TabType>('sessions');

  const { data: sessionsData, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['portal', 'history', 'sessions'],
    queryFn: () => apiClient.get<{ items: HistorySession[]; total: number }>('/portal/history/sessions'),
    enabled: activeTab === 'sessions',
  });

  const { data: votesData, isLoading: isVotesLoading } = useQuery({
    queryKey: ['portal', 'history', 'votes'],
    queryFn: () => apiClient.get<{ items: HistoryVote[]; total: number }>('/portal/history/votes'),
    enabled: activeTab === 'votes',
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isLoading = activeTab === 'sessions' ? isSessionsLoading : isVotesLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <h1 className="text-xl font-bold text-dark-text">Historique</h1>

      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        <button
          onClick={() => setActiveTab('sessions')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2',
            activeTab === 'sessions'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          <Film size={16} />
          Sessions
        </button>
        <button
          onClick={() => setActiveTab('votes')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2',
            activeTab === 'votes'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          <Vote size={16} />
          Votes
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 bg-dark-surface rounded-xl border border-dark-border animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Sessions history */}
      {!isLoading && activeTab === 'sessions' && (
        <>
          {sessionsData && sessionsData.items.length > 0 ? (
            <div className="space-y-3">
              {sessionsData.items.map((session) => (
                <div
                  key={session.id}
                  className="bg-dark-surface rounded-xl border border-dark-border overflow-hidden"
                >
                  <div className="flex">
                    {/* Poster */}
                    <div className="w-16 h-24 flex-shrink-0 bg-dark-border">
                      {session.movie_poster_url ? (
                        <img
                          src={session.movie_poster_url}
                          alt={session.movie_title || session.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-dark-muted">
                          <Film size={20} />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-3">
                      <h3 className="font-medium text-dark-text line-clamp-1">
                        {session.name}
                      </h3>
                      {session.movie_title && (
                        <p className="text-sm text-dark-muted line-clamp-1">
                          {session.movie_title}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {session.invitation_status === 'accepted' && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Check size={12} />
                            Participe
                          </span>
                        )}
                        {session.completed_at && (
                          <span className="text-xs text-dark-muted">
                            {formatDate(session.completed_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film size={48} className="mx-auto text-dark-muted mb-4" />
              <h3 className="text-lg font-medium text-dark-text mb-2">
                Aucune session passee
              </h3>
              <p className="text-dark-muted">
                Vos sessions terminees apparaitront ici.
              </p>
            </div>
          )}
        </>
      )}

      {/* Votes history */}
      {!isLoading && activeTab === 'votes' && (
        <>
          {votesData && votesData.items.length > 0 ? (
            <div className="space-y-3">
              {votesData.items.map((vote) => (
                <div
                  key={vote.id}
                  className="bg-dark-surface rounded-xl border border-dark-border p-4"
                >
                  <h3 className="font-medium text-dark-text mb-3">{vote.name}</h3>

                  <div className="flex gap-4">
                    {/* Your vote */}
                    <div className="flex-1">
                      <p className="text-xs text-dark-muted mb-2">Votre vote</p>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-14 rounded bg-dark-border overflow-hidden flex-shrink-0">
                          {vote.voted_movie_poster_url ? (
                            <img
                              src={vote.voted_movie_poster_url}
                              alt={vote.voted_movie_title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-dark-muted">
                              <Film size={14} />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-dark-text line-clamp-2">
                          {vote.voted_movie_title || 'Non vote'}
                        </span>
                      </div>
                    </div>

                    {/* Winner */}
                    <div className="flex-1">
                      <p className="text-xs text-dark-muted mb-2 flex items-center gap-1">
                        <Trophy size={12} className="text-yellow-400" />
                        Gagnant
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-14 rounded bg-dark-border overflow-hidden flex-shrink-0 ring-2 ring-yellow-500/50">
                          {vote.winner_movie_poster_url ? (
                            <img
                              src={vote.winner_movie_poster_url}
                              alt={vote.winner_movie_title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-dark-muted">
                              <Film size={14} />
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-dark-text line-clamp-2">
                          {vote.winner_movie_title || 'Pas de gagnant'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {vote.closed_at && (
                    <p className="text-xs text-dark-muted mt-3">
                      Termine le {formatDate(vote.closed_at)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Vote size={48} className="mx-auto text-dark-muted mb-4" />
              <h3 className="text-lg font-medium text-dark-text mb-2">
                Aucun vote passe
              </h3>
              <p className="text-dark-muted">
                Vos votes termines apparaitront ici.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
