/**
 * My quizzes page for portal.
 */

import { useQuery } from '@tanstack/react-query';
import { HelpCircle, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';

interface PortalQuiz {
  id: string;
  name: string;
  description: string | null;
  status: string;
  question_count: number;
  has_joined: boolean;
  my_score: number;
}

type TabType = 'pending' | 'all';

export function MyQuiz() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const { items } = usePortalNotifications();
  const pendingQuizCount = items.find((i) => i.id === 'quiz')?.count || 0;

  const { data: pendingQuiz, isLoading: isPendingLoading } = useQuery({
    queryKey: ['portal', 'quiz', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalQuiz[]; total: number }>('/portal/quiz/pending'),
    enabled: activeTab === 'pending',
    refetchInterval: 15000,
  });

  const { data: allQuiz, isLoading: isAllLoading } = useQuery({
    queryKey: ['portal', 'quiz', 'all'],
    queryFn: () => apiClient.get<{ items: PortalQuiz[]; total: number }>('/portal/quiz?limit=50'),
    enabled: activeTab === 'all',
    refetchInterval: 15000,
  });

  const isLoading = activeTab === 'pending' ? isPendingLoading : isAllLoading;
  const data = activeTab === 'pending' ? pendingQuiz : allQuiz;

  const completedQuizCount = items.find((i) => i.id === 'quiz_completed')?.count || 0;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; label: string }> = {
      draft: { bg: 'bg-yellow-500/20 text-yellow-400', label: 'Brouillon' },
      open: { bg: 'bg-blue-500/20 text-blue-400', label: 'Ouvert' },
      active: { bg: 'bg-green-500/20 text-green-400', label: 'En cours' },
      completed: { bg: 'bg-dark-muted/20 text-dark-muted', label: 'Termine' },
    };
    return styles[status] || { bg: 'bg-dark-muted/20 text-dark-muted', label: status };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-dark-text">Mes Quiz</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-border">
        <button
          onClick={() => setActiveTab('pending')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2',
            activeTab === 'pending'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          En cours
          {pendingQuizCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-purple-500 text-white text-[10px] font-bold leading-none">
              {pendingQuizCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={clsx(
            'flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2',
            activeTab === 'all'
              ? 'border-theatarr-500 text-theatarr-500'
              : 'border-transparent text-dark-muted hover:text-dark-text'
          )}
        >
          Tous les quiz
          {completedQuizCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-dark-muted/50 text-dark-text text-[10px] font-bold leading-none">
              {completedQuizCount}
            </span>
          )}
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

      {/* Quiz list */}
      {!isLoading && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((quiz) => {
            const badge = getStatusBadge(quiz.status);
            return (
              <Link
                key={quiz.id}
                to={`/portal/quiz/${quiz.id}`}
                className="block bg-dark-surface rounded-xl border border-dark-border p-4 hover:border-theatarr-500/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-theatarr-500/20 flex items-center justify-center flex-shrink-0">
                    <HelpCircle size={20} className="text-theatarr-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-dark-text truncate">{quiz.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    {quiz.description && (
                      <p className="text-sm text-dark-muted line-clamp-1">{quiz.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-dark-muted">
                      <span>{quiz.question_count} questions</span>
                      {quiz.has_joined && quiz.my_score > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Trophy size={12} />
                          {quiz.my_score}/{quiz.question_count}
                        </span>
                      )}
                      {!quiz.has_joined && (
                        <span className="text-blue-400">Pas encore rejoint</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="text-center py-12">
          <HelpCircle size={48} className="mx-auto text-dark-muted mb-4" />
          <h3 className="text-lg font-medium text-dark-text mb-2">
            {activeTab === 'pending' ? 'Aucun quiz en cours' : 'Aucun quiz'}
          </h3>
          <p className="text-dark-muted">
            {activeTab === 'pending'
              ? 'Aucun quiz actif pour le moment.'
              : "Vous n'avez pas encore ete invite a un quiz."}
          </p>
        </div>
      )}
    </div>
  );
}
