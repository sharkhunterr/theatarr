/**
 * Session detail page for portal.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Check, X, Clock, MapPin, Film } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { apiClient } from '../../api/client';

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
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ['portal', 'sessions', id],
    queryFn: () => apiClient.get<SessionDetail>(`/portal/sessions/${id}`),
    enabled: !!id,
  });

  const respondMutation = useMutation({
    mutationFn: (accept: boolean) =>
      apiClient.post(`/portal/sessions/${id}/respond`, { accept }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'sessions'] });
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
        style={{ backgroundColor: bgColor }}
      >
        {session.movie_poster_url && (
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
          {/* Poster */}
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

          {/* Info */}
          <div className="flex-1 flex flex-col justify-end">
            <span
              className={clsx(
                'inline-block self-start px-2 py-0.5 rounded-full text-xs font-medium mb-2',
                statusColors[session.status] || statusColors.draft
              )}
            >
              {statusLabels[session.status] || session.status}
            </span>
            <h1 className="text-xl font-bold text-white">{session.name}</h1>
            {session.movie_title && (
              <p className="text-white/80">{session.movie_title}</p>
            )}
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
    </div>
  );
}
