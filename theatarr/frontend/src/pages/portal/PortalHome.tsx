/**
 * Portal home page with welcome message and quick stats.
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Vote, CheckCircle, Film, HelpCircle, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const { user } = useAuthStore();
  const displayName = user?.first_name || user?.username || 'User';

  const { data: stats } = useQuery({
    queryKey: ['portal', 'stats'],
    queryFn: () => apiClient.get<PortalStats>('/portal/stats'),
  });

  const { data: pendingVotes } = useQuery({
    queryKey: ['portal', 'votes', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalVote[]; total: number }>('/portal/votes/pending'),
  });

  const { data: pendingInvitations } = useQuery({
    queryKey: ['portal', 'sessions', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalSession[]; total: number }>('/portal/sessions/pending'),
  });

  const { data: pendingQuiz } = useQuery({
    queryKey: ['portal', 'quiz', 'pending'],
    queryFn: () => apiClient.get<{ items: PortalQuiz[]; total: number }>('/portal/quiz/pending'),
  });

  const { data: sessions } = useQuery({
    queryKey: ['portal', 'sessions'],
    queryFn: () => apiClient.get<{ items: PortalSession[]; total: number }>('/portal/sessions?limit=5'),
  });

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-dark-text">
          Bonjour, {displayName}
        </h1>
        <p className="text-dark-muted mt-1">Bienvenue sur votre portail cinema</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-dark-surface rounded-lg border border-dark-border p-2 text-center">
          <Calendar className="text-blue-400 mx-auto mb-1" size={16} />
          <p className="text-lg font-bold text-dark-text">{stats?.upcoming_sessions ?? '-'}</p>
          <p className="text-[10px] text-dark-muted">A venir</p>
        </div>
        <div className="bg-dark-surface rounded-lg border border-dark-border p-2 text-center">
          <Vote className="text-theatarr-400 mx-auto mb-1" size={16} />
          <p className="text-lg font-bold text-dark-text">{stats?.pending_votes ?? '-'}</p>
          <p className="text-[10px] text-dark-muted">Votes</p>
        </div>
        <div className="bg-dark-surface rounded-lg border border-dark-border p-2 text-center">
          <Film className="text-green-400 mx-auto mb-1" size={16} />
          <p className="text-lg font-bold text-dark-text">{stats?.total_sessions_attended ?? '-'}</p>
          <p className="text-[10px] text-dark-muted">Vues</p>
        </div>
        <div className="bg-dark-surface rounded-lg border border-dark-border p-2 text-center">
          <CheckCircle className="text-purple-400 mx-auto mb-1" size={16} />
          <p className="text-lg font-bold text-dark-text">{stats?.total_votes_cast ?? '-'}</p>
          <p className="text-[10px] text-dark-muted">Votes</p>
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvitations && pendingInvitations.items.length > 0 && (
        <section className="animate-pulse-subtle">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-blue-400" />
              <h2 className="text-lg font-semibold text-dark-text">Invitations en attente</h2>
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
              <h2 className="text-lg font-semibold text-dark-text">Votes en attente</h2>
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
              <h2 className="text-lg font-semibold text-dark-text">Quiz en cours</h2>
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
                      <span>{quiz.question_count} questions</span>
                      {!quiz.has_joined && (
                        <span className="text-blue-400">Pas encore rejoint</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming sessions */}
      {sessions && sessions.items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-dark-text">Prochaines sessions</h2>
            <Link to="/portal/sessions" className="text-sm text-theatarr-500 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {sessions.items.slice(0, 3).map((session) => (
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
        </section>
      )}

      {/* Empty state */}
      {(!sessions || sessions.items.length === 0) &&
        (!pendingVotes || pendingVotes.items.length === 0) &&
        (!pendingQuiz || pendingQuiz.items.length === 0) && (
          <div className="text-center py-12">
            <Film size={48} className="mx-auto text-dark-muted mb-4" />
            <h3 className="text-lg font-medium text-dark-text mb-2">
              Aucune activite pour le moment
            </h3>
            <p className="text-dark-muted">
              Vous serez notifie lorsque vous serez invite a une session ou un vote.
            </p>
          </div>
        )}
    </div>
  );
}
