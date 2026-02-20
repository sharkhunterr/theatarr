/**
 * Participants manager component for sessions.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, UserPlus, X, ChevronDown, ChevronUp, Check, Clock, XCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Spinner } from '../common';

interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Participant {
  id: string;
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  invitation_status: string;
  invited_at?: string;
  responded_at?: string;
}

interface ParticipantsManagerProps {
  sessionId: string;
  isNew?: boolean;
}

export function ParticipantsManager({ sessionId, isNew }: ParticipantsManagerProps) {
  const { t } = useTranslation('sessions');
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Fetch participants
  const { data: participantsData, isLoading: isLoadingParticipants } = useQuery({
    queryKey: ['session-participants', sessionId],
    queryFn: () => apiClient.get<{ items: Participant[]; total: number }>(`/sessions/${sessionId}/participants`),
    enabled: !isNew && !!sessionId,
  });

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: () => apiClient.get<{ items: User[] }>(`/users?search=${encodeURIComponent(searchQuery)}&limit=10`),
    enabled: searchQuery.length >= 2,
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.post(`/sessions/${sessionId}/participants`, [userId]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-participants', sessionId] });
      setSearchQuery('');
      setIsSearchOpen(false);
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiClient.delete(`/sessions/${sessionId}/participants/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-participants', sessionId] });
    },
  });

  const participants = participantsData?.items || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Check size={14} className="text-green-400" />;
      case 'declined':
        return <XCircle size={14} className="text-red-400" />;
      default:
        return <Clock size={14} className="text-yellow-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return t('participantsManager.accepted');
      case 'declined':
        return t('participantsManager.declined');
      default:
        return t('participantsManager.pending');
    }
  };

  // Filter out already added users from search results
  const filteredSearchResults = searchResults?.items.filter(
    (user) => !participants.some((p) => p.user_id === user.id)
  );

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
      {/* Header - Clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-dark-border/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-theatarr-500" />
          <span className="text-sm font-medium text-dark-text">{t('participantsManager.title')}</span>
          <span className="text-xs text-dark-muted">({participants.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-dark-muted" />
        ) : (
          <ChevronDown size={16} className="text-dark-muted" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-dark-border p-3 space-y-3">
          {isNew ? (
            <p className="text-sm text-dark-muted text-center py-2">{t('participantsManager.saveFirst')}</p>
          ) : (
            <>
              {/* Add participant search */}
              <div className="relative">
                <div className="relative">
                  <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                  <input
                    type="text"
                    placeholder={t('participantsManager.searchUser')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm text-dark-text placeholder:text-dark-muted"
                  />
                </div>

                {/* Search results dropdown */}
                {isSearchOpen && searchQuery.length >= 2 && (
                  <div className="absolute z-20 w-full mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-3 text-center">
                        <Spinner size="sm" />
                      </div>
                    ) : filteredSearchResults && filteredSearchResults.length > 0 ? (
                      <div className="py-1">
                        {filteredSearchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addParticipantMutation.mutate(user.id)}
                            disabled={addParticipantMutation.isPending}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-border/50 disabled:opacity-50"
                          >
                            <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center text-theatarr-400 text-xs font-medium">
                              {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-dark-text truncate">
                                {user.first_name && user.last_name
                                  ? `${user.first_name} ${user.last_name}`
                                  : user.username}
                              </div>
                              <div className="text-xs text-dark-muted truncate">{user.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-sm text-dark-muted">{t('participantsManager.noResults')}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Participants list */}
              {isLoadingParticipants ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : participants.length > 0 ? (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="flex items-center gap-2 p-2 bg-dark-bg rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center text-theatarr-400 text-xs font-medium flex-shrink-0">
                        {(participant.first_name?.[0] || participant.username[0]).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-dark-text truncate">
                          {participant.first_name && participant.last_name
                            ? `${participant.first_name} ${participant.last_name}`
                            : participant.username}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-dark-muted">
                          {getStatusIcon(participant.invitation_status)}
                          <span>{getStatusLabel(participant.invitation_status)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeParticipantMutation.mutate(participant.user_id)}
                        disabled={removeParticipantMutation.isPending}
                        className="p-1.5 text-dark-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title={t('participantsManager.remove')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-dark-muted text-center py-2">{t('participantsManager.noParticipants')}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
