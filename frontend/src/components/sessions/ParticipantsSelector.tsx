/**
 * Participants selector component - allows selecting users before saving session.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Users, UserCheck, UserX, CheckSquare, Square } from 'lucide-react';
import { apiClient } from '../../api/client';
import { Spinner } from '../common';
import clsx from 'clsx';

interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
}

interface ParticipantsSelectorProps {
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
}

export function ParticipantsSelector({ selectedUserIds, onChange }: ParticipantsSelectorProps) {
  const { t } = useTranslation('sessions');

  // Fetch all users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => apiClient.get<{ items: User[]; total: number }>('/users?limit=100'),
  });

  const users = usersData?.items || [];

  const toggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      onChange(selectedUserIds.filter(id => id !== userId));
    } else {
      onChange([...selectedUserIds, userId]);
    }
  };

  const selectAll = () => {
    onChange(users.map(u => u.id));
  };

  const deselectAll = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-theatarr-500" />
          <span className="text-sm font-medium text-dark-text">
            {selectedUserIds.length} {t('participants.selected')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
          >
            <UserCheck size={14} />
            {t('participants.selectAll')}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            <UserX size={14} />
            {t('participants.deselectAll')}
          </button>
        </div>
      </div>

      {/* Users grid */}
      {users.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {users.map((user) => {
            const isSelected = selectedUserIds.includes(user.id);
            const displayName = user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : user.username;
            const initials = (user.first_name?.[0] || user.username[0]).toUpperCase();

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUser(user.id)}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all',
                  isSelected
                    ? 'border-theatarr-500 bg-theatarr-500/10'
                    : 'border-dark-border bg-dark-bg hover:border-dark-muted'
                )}
              >
                {/* Checkbox */}
                <div className={clsx(
                  'flex-shrink-0',
                  isSelected ? 'text-theatarr-500' : 'text-dark-muted'
                )}>
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>

                {/* Avatar */}
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0',
                  isSelected
                    ? 'bg-theatarr-500 text-white'
                    : 'bg-dark-border text-dark-text'
                )}>
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className={clsx(
                    'text-sm font-medium truncate',
                    isSelected ? 'text-theatarr-400' : 'text-dark-text'
                  )}>
                    {displayName}
                  </div>
                  {user.email && (
                    <div className="text-xs text-dark-muted truncate">{user.email}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-dark-muted">
          <Users size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t('participants.noUsers')}</p>
        </div>
      )}
    </div>
  );
}
