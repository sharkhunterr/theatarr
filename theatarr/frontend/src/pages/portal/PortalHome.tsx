/**
 * Portal home page with welcome message and quick stats.
 */

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, Vote, CheckCircle, Film } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { VoteCard } from '../../components/portal/VoteCard';
import { SessionCard } from '../../components/portal/SessionCard';

interface PortalStats {
  pending_votes: number;
  upcoming_sessions: number;
  total_sessions_attended: number;
  total_votes_cast: number;
}

interface PortalSession {
  id: string;
  name: string;
  movie_title: string | null;
  movie_poster_url: string | null;
  status: string;
  scheduled_at: string | null;
  invitation_status: string;
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

      {/* Pending votes alert */}
      {pendingVotes && pendingVotes.items.length > 0 && (
        <div className="bg-theatarr-500/10 border border-theatarr-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theatarr-500/20 flex items-center justify-center">
              <AlertCircle className="text-theatarr-500" size={20} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-dark-text">
                {pendingVotes.items.length} vote{pendingVotes.items.length > 1 ? 's' : ''} en attente
              </p>
              <p className="text-sm text-dark-muted">
                N'oubliez pas de voter pour les prochaines sessions
              </p>
            </div>
            <Link
              to="/portal/votes"
              className="px-4 py-2 bg-theatarr-500 text-white rounded-lg text-sm font-medium hover:bg-theatarr-600 transition-colors"
            >
              Voter
            </Link>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Calendar className="text-blue-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-text">
                {stats?.upcoming_sessions ?? '-'}
              </p>
              <p className="text-xs text-dark-muted">Sessions a venir</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theatarr-500/10 flex items-center justify-center">
              <Vote className="text-theatarr-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-text">
                {stats?.pending_votes ?? '-'}
              </p>
              <p className="text-xs text-dark-muted">Votes en attente</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Film className="text-green-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-text">
                {stats?.total_sessions_attended ?? '-'}
              </p>
              <p className="text-xs text-dark-muted">Sessions vues</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <CheckCircle className="text-purple-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-dark-text">
                {stats?.total_votes_cast ?? '-'}
              </p>
              <p className="text-xs text-dark-muted">Votes effectues</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending votes */}
      {pendingVotes && pendingVotes.items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-dark-text">Votes en attente</h2>
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
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {(!sessions || sessions.items.length === 0) &&
        (!pendingVotes || pendingVotes.items.length === 0) && (
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
