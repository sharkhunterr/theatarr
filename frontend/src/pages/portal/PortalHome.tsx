/**
 * Portal home page with welcome message and quick stats.
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Vote, CheckCircle, Film, HelpCircle, Mail, Play, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { VoteCard } from '../../components/portal/VoteCard';
import { SessionCard } from '../../components/portal/SessionCard';
import { useCountdown } from '../../hooks/useCountdown';

interface PortalStats {
  pending_votes: number;
  pending_quiz: number;
  pending_invitations: number;
  upcoming_sessions: number;
  total_sessions_attended: number;
  total_votes_cast: number;
}

interface PortalQuiz {
  id: string;
  name: string;
  description: string | null;
  status: string;
  question_count: number;
  has_joined: boolean;
  my_score: number;
}

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
  qr_tickets_enabled?: boolean;
}

interface PortalVote {
  id: string;
  name: string;
  description: string | null;
  movie_options_preview: Array<{ title?: string; poster_url?: string }>;
  has_voted: boolean;
  closes_at: string | null;
  status: string;
}

export function PortalHome() {
  useCountdown();
  const { t } = useTranslation(['portal', 'common']);
  const { user } = useAuthStore();
  const displayName = user?.first_name || user?.username || 'User';

  const { data: stats } = useQuery({
    queryKey: ['portal', 'stats'],
    queryFn: () => apiClient.get<PortalStats>('/portal/stats'),
    refetchInterval: 15000,
  });

  const { data: pendingVotes } = useQuery({
    queryKey: ['portal', 'votes', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalVote[]; total: number }>('/portal/votes/pending'),
    refetchInterval: 15000,
  });

  const { data: pendingInvitations } = useQuery({
    queryKey: ['portal', 'sessions', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalSession[]; total: number }>('/portal/sessions/pending'),
    refetchInterval: 15000,
  });

  const { data: pendingQuiz } = useQuery({
    queryKey: ['portal', 'quiz', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalQuiz[]; total: number }>('/portal/quiz/pending'),
    refetchInterval: 15000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['portal', 'sessions', 'upcoming'],
    queryFn: () => apiClient.get<{ items: PortalSession[]; total: number }>('/portal/sessions?status_filter=scheduled&limit=5'),
    refetchInterval: 15000,
  });

  // Sessions starting soon: accepted + scheduled within next 48h
  const startingSoon = (sessions?.items || []).filter((s) => {
    if (s.invitation_status !== 'accepted' || !s.scheduled_at) return false;
    const diff = new Date(s.scheduled_at).getTime() - Date.now();
    return diff > 0 && diff < 48 * 3600 * 1000;
  });

  const formatCountdown = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return t('portal:home.countdown.now');
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const h = hours % 24;
      return t('portal:home.countdown.inDaysHours', { days, hours: h });
    }
    if (hours >= 1) {
      const m = minutes % 60;
      return t('portal:home.countdown.inHoursMinutes', { hours, minutes: m > 0 ? m.toString().padStart(2, '0') : '' });
    }
    return t('portal:home.countdown.inMinutes', { minutes });
  };

  const statItems = [
    {
      icon: Calendar,
      value: stats?.upcoming_sessions ?? '-',
      label: t('portal:home.stats.upcoming'),
      color: 'blue',
      gradient: 'from-blue-500/15 to-blue-500/5',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
    },
    {
      icon: Vote,
      value: stats?.pending_votes ?? '-',
      label: t('portal:home.stats.votes'),
      color: 'theatarr',
      gradient: 'from-theatarr-500/15 to-theatarr-500/5',
      iconBg: 'bg-theatarr-500/20',
      iconColor: 'text-theatarr-400',
    },
    {
      icon: Film,
      value: stats?.total_sessions_attended ?? '-',
      label: t('portal:home.stats.watched'),
      color: 'green',
      gradient: 'from-green-500/15 to-green-500/5',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    {
      icon: CheckCircle,
      value: stats?.total_votes_cast ?? '-',
      label: t('portal:home.stats.voted'),
      color: 'purple',
      gradient: 'from-purple-500/15 to-purple-500/5',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className={`bg-gradient-to-br ${stat.gradient} rounded-xl p-3 flex items-center gap-3`}
          >
            <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon size={18} className={stat.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-dark-text leading-none">{stat.value}</p>
              <p className="text-[11px] text-dark-muted mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions aujourd'hui */}
      {startingSoon.length > 0 && (() => {
        const nearest = startingSoon.reduce((a, b) =>
          new Date(a.scheduled_at!).getTime() < new Date(b.scheduled_at!).getTime() ? a : b
        );
        const nearestDiff = new Date(nearest.scheduled_at!).getTime() - Date.now();
        const isImminent = nearestDiff < 3600 * 1000;
        const isClose = nearestDiff < 12 * 3600 * 1000;

        return (
          <section className={isImminent ? 'animate-pulse-subtle' : ''}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Play size={18} className={isImminent ? 'text-green-400' : 'text-theatarr-400'} />
                <h2 className="text-lg font-semibold text-dark-text">{t('portal:home.sessionsToday')}</h2>
                <span className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${
                  isImminent
                    ? 'bg-green-500 text-white animate-pulse'
                    : isClose
                      ? 'bg-theatarr-500 text-white animate-blink'
                      : 'bg-blue-500 text-white'
                }`}>
                  <Clock size={10} />
                  {formatCountdown(nearest.scheduled_at!)}
                </span>
              </div>
              <Link to="/portal/sessions" className="text-sm text-theatarr-500 hover:underline">
                {t('portal:home.viewAll')}
              </Link>
            </div>
            <div className="space-y-3">
              {startingSoon.map((session, i) => (
                  <div key={session.id} className="relative overflow-hidden rounded-xl">
                    <SessionCard
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
                      qrTicketsEnabled={session.qr_tickets_enabled}
                    />
                    {/* Shine sweep overlay */}
                    <div
                      className="absolute inset-0 pointer-events-none rounded-xl"
                      style={{
                        background: 'linear-gradient(110deg, transparent 33%, var(--shine-color) 50%, transparent 67%)',
                        backgroundSize: '300% 100%',
                        backgroundPosition: '200% 0',
                        animation: `card-shine 2.5s ease-in-out infinite ${i * 0.8}s`,
                      }}
                    />
                  </div>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Pending invitations */}
      {pendingInvitations && pendingInvitations.items.length > 0 && (
        <section className="animate-pulse-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-dark-text">{t('portal:home.pendingInvitations')}</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-500 text-white rounded-full animate-blink">
                {pendingInvitations.items.length}
              </span>
            </div>
            <Link to="/portal/sessions" className="text-sm text-theatarr-500 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingInvitations.items.slice(0, 3).map((session) => (
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
              qrTicketsEnabled={session.qr_tickets_enabled}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending votes */}
      {pendingVotes && pendingVotes.items.length > 0 && (
        <section className="animate-pulse-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Vote size={18} className="text-theatarr-400" />
              <h2 className="text-lg font-semibold text-dark-text">{t('portal:home.pendingVotes')}</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-theatarr-500 text-white rounded-full animate-blink">
                {pendingVotes.items.length}
              </span>
            </div>
            <Link to="/portal/votes" className="text-sm text-theatarr-500 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingVotes.items.slice(0, 2).map((vote) => (
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
        </section>
      )}

      {/* Pending quiz */}
      {pendingQuiz && pendingQuiz.items.length > 0 && (
        <section className="animate-pulse-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HelpCircle size={18} className="text-yellow-400" />
              <h2 className="text-lg font-semibold text-dark-text">{t('portal:home.pendingQuiz')}</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500 text-white rounded-full animate-blink">
                {pendingQuiz.items.length}
              </span>
            </div>
            <Link to="/portal/quiz" className="text-sm text-theatarr-500 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingQuiz.items.slice(0, 2).map((quiz) => (
              <Link
                key={quiz.id}
                to={`/portal/quiz/${quiz.id}`}
                className="block bg-dark-surface rounded-xl border border-dark-border p-4 hover:border-theatarr-500/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <HelpCircle size={20} className="text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-dark-text truncate">{quiz.name}</h3>
                    {quiz.description && (
                      <p className="text-sm text-dark-muted line-clamp-1 mt-0.5">{quiz.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-dark-muted">
                      <span>{t('portal:home.quiz.questions', { count: quiz.question_count })}</span>
                      {!quiz.has_joined && (
                        <span className="text-blue-400">{t('portal:home.quiz.notJoined')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming sessions (exclude starting soon to avoid duplicates) */}
      {(() => {
        const startingSoonIds = new Set(startingSoon.map((s) => s.id));
        const upcomingFiltered = (sessions?.items || []).filter((s) => !startingSoonIds.has(s.id));
        return upcomingFiltered.length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-dark-text">{t('portal:home.upcomingSessions')}</h2>
            <Link to="/portal/sessions" className="text-sm text-theatarr-500 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingFiltered.slice(0, 3).map((session) => (
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
              qrTicketsEnabled={session.qr_tickets_enabled}
              />
            ))}
          </div>
        </section>
        ) : null;
      })()}

      {/* Empty state */}
      {(!sessions || sessions.items.length === 0) &&
        (!pendingVotes || pendingVotes.items.length === 0) &&
        (!pendingQuiz || pendingQuiz.items.length === 0) && (
          <div className="text-center py-12">
            <Film size={48} className="mx-auto text-dark-muted mb-4" />
            <h3 className="text-lg font-medium text-dark-text mb-2">
              {t('portal:home.emptyTitle')}
            </h3>
            <p className="text-dark-muted">
              {t('portal:home.emptyDescription')}
            </p>
          </div>
        )}
    </div>
  );
}
