/**
 * Session detail page for portal.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Check, X, Clock, MapPin, Film, Vote, Shuffle, Sparkles, Eye } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../api/client';
import { getMysteryRevealCountdown, getSessionStartCountdown } from '../../utils/countdown';
import { useCountdown } from '../../hooks/useCountdown';
import { MysteryPoster } from '../../components/common/MysteryPoster';

interface SessionDetail {
  id: string;
  name: string;
  description: string | null;
  movie_title: string | null;
  movie_poster_url: string | null;
  movie_source: string | null;
  color_palette: Record<string, string> | null;
  status: string;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  invitation_status: string;
  responded_at: string | null;
  movie_selection_mode: string | null;
  movie_resolved: boolean;
  mystery_reveal_at: string | null;
  linked_vote_session_id: string | null;
  linked_vote_is_open: boolean | null;
}

export function SessionDetail() {
  useCountdown();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: session, isLoading } = useQuery({
    queryKey: ['portal', 'sessions', id],
    queryFn: () => apiClient.get<SessionDetail>(`/portal/sessions/${id}`),
    enabled: !!id,
  });

  const respondMutation = useMutation({
    mutationFn: (accept: boolean) =>
      apiClient.post(`/portal/sessions/${id}/respond`, { accept }),
    onSuccess: (_, accept) => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'sessions'] });
      // If accepted and there's an open vote, redirect to vote page
      if (accept && session?.linked_vote_session_id && session?.linked_vote_is_open) {
        navigate(`/portal/votes/${session.linked_vote_session_id}`);
      }
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    scheduled: 'Planifie',
    running: 'En cours',
    paused: 'En pause',
    completed: 'Termine',
    interrupted: 'Interrompu',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-dark-muted/20 text-dark-muted',
    scheduled: 'bg-blue-500/20 text-blue-400',
    running: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-dark-muted/20 text-dark-muted',
    interrupted: 'bg-red-500/20 text-red-400',
  };

  const invitationLabels: Record<string, string> = {
    pending: 'En attente de reponse',
    accepted: 'Accepte',
    declined: 'Decline',
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-dark-surface rounded animate-pulse" />
        <div className="h-64 bg-dark-surface rounded-xl animate-pulse" />
        <div className="h-32 bg-dark-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-dark-muted">Session non trouvee</p>
        <Link to="/portal/sessions" className="text-theatarr-500 hover:underline mt-2 inline-block">
          Retour aux sessions
        </Link>
      </div>
    );
  }

  const bgColor = session.color_palette?.dominant || '#1a1a1a';
  const isMysteryHidden = session.movie_selection_mode === 'mystery' && !session.movie_resolved;
  const isMysteryRevealed = session.movie_selection_mode === 'mystery' && session.movie_resolved;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        to="/portal/sessions"
        className="inline-flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
      >
        <ArrowLeft size={18} />
        <span>Retour</span>
      </Link>

      {/* Hero */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ backgroundColor: isMysteryHidden ? '#1a0a2e' : bgColor }}
      >
        {isMysteryHidden ? (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-purple-900/20" />
        ) : session.movie_poster_url && (
          <div className="absolute inset-0">
            <img
              src={session.movie_poster_url}
              alt={session.movie_title || session.name}
              className="w-full h-full object-cover opacity-30 blur-sm"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          </div>
        )}

        <div className="relative p-4 flex gap-4">
          {/* Poster / Mystery poster */}
          {isMysteryHidden ? (
            <MysteryPoster className="w-24 h-36 flex-shrink-0 rounded-lg shadow-lg" />
          ) : (
            <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden bg-dark-border shadow-lg">
              {session.movie_poster_url ? (
                <img
                  src={session.movie_poster_url}
                  alt={session.movie_title || session.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dark-muted">
                  <Film size={32} />
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className={clsx(
                  'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                  statusColors[session.status] || statusColors.draft
                )}
              >
                {statusLabels[session.status] || session.status}
              </span>
              {/* Session start countdown */}
              {session.scheduled_at && (session.status === 'scheduled' || session.status === 'draft') && (() => {
                const countdown = getSessionStartCountdown(session.scheduled_at);
                if (countdown.urgency === 'low') return null;
                return (
                  <span
                    className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', countdown.pulse && 'animate-pulse')}
                    style={{ backgroundColor: `${countdown.color}20`, color: countdown.color }}
                  >
                    {countdown.text}
                  </span>
                );
              })()}
            </div>
            <h1 className="text-xl font-bold text-white">{session.name}</h1>
            {isMysteryHidden ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Shuffle size={14} className="text-purple-400" />
                  <span className="text-purple-300 font-medium">Film mystere</span>
                </div>
                {session.mystery_reveal_at && (() => {
                  const reveal = getMysteryRevealCountdown(session.mystery_reveal_at);
                  return (
                    <span
                      className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', reveal.pulse && 'animate-pulse')}
                      style={{ backgroundColor: `${reveal.color}20`, color: reveal.color }}
                    >
                      <Eye size={10} />
                      {reveal.text}
                    </span>
                  );
                })()}
              </div>
            ) : isMysteryRevealed ? (
              <div className="flex items-center gap-1.5 mt-1">
                <Sparkles size={14} className="text-purple-400" />
                <p className="text-white/80">{session.movie_title}</p>
              </div>
            ) : session.movie_title ? (
              <p className="text-white/80">{session.movie_title}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4 space-y-4">
        {session.description && (
          <p className="text-dark-muted">{session.description}</p>
        )}

        {session.scheduled_at && (
          <div className="flex items-center gap-3 text-dark-text">
            <Calendar size={18} className="text-dark-muted" />
            <span>{formatDate(session.scheduled_at)}</span>
          </div>
        )}

        {session.movie_source && (
          <div className="flex items-center gap-3 text-dark-text">
            <MapPin size={18} className="text-dark-muted" />
            <span>Source: {session.movie_source}</span>
          </div>
        )}
      </div>

      {/* Invitation status */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h2 className="font-medium text-dark-text mb-3">Votre invitation</h2>

        <div className="flex items-center gap-3 mb-4">
          {session.invitation_status === 'accepted' && (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="text-green-400" size={20} />
            </div>
          )}
          {session.invitation_status === 'declined' && (
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="text-red-400" size={20} />
            </div>
          )}
          {session.invitation_status === 'pending' && (
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Clock className="text-yellow-400" size={20} />
            </div>
          )}
          <div>
            <p className="font-medium text-dark-text">
              {invitationLabels[session.invitation_status]}
            </p>
            {session.responded_at && (
              <p className="text-sm text-dark-muted">
                Repondu le {formatDate(session.responded_at)}
              </p>
            )}
          </div>
        </div>

        {/* Response buttons */}
        {session.invitation_status === 'pending' && (
          <div className="flex gap-3">
            <button
              onClick={() => respondMutation.mutate(true)}
              disabled={respondMutation.isPending}
              className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Accepter
            </button>
            <button
              onClick={() => respondMutation.mutate(false)}
              disabled={respondMutation.isPending}
              className="flex-1 py-3 bg-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-muted/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X size={18} />
              Decliner
            </button>
          </div>
        )}

        {/* Change response */}
        {session.invitation_status !== 'pending' && session.status !== 'completed' && (
          <div className="flex gap-3">
            {session.invitation_status === 'declined' && (
              <button
                onClick={() => respondMutation.mutate(true)}
                disabled={respondMutation.isPending}
                className="flex-1 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                Changer en Accepte
              </button>
            )}
            {session.invitation_status === 'accepted' && (
              <button
                onClick={() => respondMutation.mutate(false)}
                disabled={respondMutation.isPending}
                className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                Changer en Decline
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vote section - show if there's a linked vote */}
      {session.movie_selection_mode === 'vote' && session.linked_vote_session_id && (
        <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
          <h2 className="font-medium text-dark-text mb-3">Vote pour le film</h2>

          {session.movie_resolved ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="text-green-400" size={20} />
              </div>
              <div>
                <p className="font-medium text-dark-text">Vote termine</p>
                <p className="text-sm text-dark-muted">
                  Le film a ete choisi: {session.movie_title}
                </p>
              </div>
            </div>
          ) : session.linked_vote_is_open ? (
            session.invitation_status === 'accepted' ? (
              <Link
                to={`/portal/votes/${session.linked_vote_session_id}`}
                className="flex items-center justify-between p-3 bg-theatarr-500/10 border border-theatarr-500/30 rounded-lg hover:bg-theatarr-500/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-theatarr-500/20 flex items-center justify-center">
                    <Vote className="text-theatarr-400" size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-dark-text">Votez pour le film</p>
                    <p className="text-sm text-dark-muted">Le vote est ouvert</p>
                  </div>
                </div>
                <ArrowLeft size={18} className="text-dark-muted rotate-180" />
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="text-yellow-400" size={20} />
                </div>
                <div>
                  <p className="font-medium text-dark-text">Acceptez l'invitation pour voter</p>
                  <p className="text-sm text-dark-muted">Le vote est ouvert mais vous devez d'abord accepter</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-dark-border flex items-center justify-center">
                <Clock className="text-dark-muted" size={20} />
              </div>
              <div>
                <p className="font-medium text-dark-text">Vote en attente</p>
                <p className="text-sm text-dark-muted">Le vote n'est pas encore ouvert</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
