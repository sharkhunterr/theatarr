/**
 * Admin user management page.
 * Ghostarr-aligned: h-10 inputs, h-9 icon buttons, p-4 sm:p-6 cards, rounded-lg.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Shield, Trash2, Key, Edit2, X, Check } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../api/client';
import { PageHeader, ButtonGroup, Modal } from '../components/common';

interface UserData {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'user',
  });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      params.append('limit', '100');
      return apiClient.get<{ items: UserData[]; total: number }>(`/users?${params.toString()}`);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: UserFormData) => apiClient.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiClient.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiClient.post(`/users/${id}/change-password`, { new_password: password }),
    onSuccess: () => {
      setShowPasswordModal(null);
      setNewPassword('');
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      role: 'user',
    });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role,
    });
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError('');
  };

  const handleSubmit = () => {
    setFormError('');

    if (!formData.username) {
      setFormError("Le nom d'utilisateur est requis");
      return;
    }

    if (!editingUser && !formData.password) {
      setFormError('Le mot de passe est requis');
      return;
    }

    if (!editingUser && formData.password.length < 6) {
      setFormError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    if (editingUser) {
      updateUserMutation.mutate({
        id: editingUser.id,
        data: {
          first_name: formData.first_name || undefined,
          last_name: formData.last_name || undefined,
          email: formData.email || undefined,
          role: formData.role,
        },
      });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleDelete = (user: UserData) => {
    if (confirm(`Supprimer l'utilisateur "${user.username}" ?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleToggleActive = (user: UserData) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { is_active: !user.is_active },
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (user: UserData) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username[0].toUpperCase();
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérez les comptes et les permissions"
      />

      {/* Filters + Actions */}
      <div className="flex items-center justify-between mb-6">
        <ButtonGroup
          options={[
            { key: '', label: 'Tous' },
            { key: 'admin', label: 'Admin' },
            { key: 'user', label: 'User' },
          ]}
          value={roleFilter}
          onChange={setRoleFilter}
        />
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 h-9 px-3 bg-theatarr-600 text-white rounded-md text-sm font-medium hover:bg-theatarr-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvel utilisateur</span>
        </button>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-dark-surface rounded-lg border border-dark-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dark-border bg-dark-surface shadow-sm overflow-hidden">
          {data && data.items.length > 0 ? (
            <div className="divide-y divide-dark-border">
              {data.items.map((user) => (
                <div
                  key={user.id}
                  className={clsx(
                    'p-4 flex items-center gap-3',
                    !user.is_active && 'opacity-50'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
                      user.role === 'admin'
                        ? 'bg-theatarr-500/20 text-theatarr-500'
                        : 'bg-blue-500/20 text-blue-400'
                    )}
                  >
                    {getInitials(user)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-dark-text truncate">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.username}
                      </span>
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-theatarr-500/20 text-theatarr-400 font-semibold">
                          <Shield className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                      {!user.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-muted mt-0.5">
                      <span>@{user.username}</span>
                      {user.email && (
                        <span className="hidden sm:inline truncate">{user.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Last login */}
                  <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-xs text-dark-muted">
                      {user.last_login_at
                        ? formatDate(user.last_login_at)
                        : 'Jamais connecte'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(user)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-dark-text transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowPasswordModal(user.id)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-dark-text transition-colors"
                      title="Changer le mot de passe"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={clsx(
                        'h-9 w-9 flex items-center justify-center rounded-lg hover:bg-dark-border/50 transition-colors',
                        user.is_active
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-dark-muted hover:text-dark-text'
                      )}
                      title={user.is_active ? 'Desactiver' : 'Activer'}
                    >
                      {user.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-dark-muted hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <Users size={32} className="mx-auto text-dark-muted mb-3" />
              <h3 className="text-sm font-medium text-dark-text mb-1">
                Aucun utilisateur
              </h3>
              <p className="text-xs text-dark-muted mb-3">
                Creez votre premier utilisateur pour commencer.
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 h-10 px-4 bg-theatarr-600 text-white rounded-md text-sm font-medium hover:bg-theatarr-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nouvel utilisateur
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-text">
              Nom d'utilisateur *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={!!editingUser}
              className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {!editingUser && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-text">
                Mot de passe *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-text">Prenom</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark-text">Nom</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-text">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-text">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
            >
              <option value="user">Utilisateur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-dark-border">
            <button
              onClick={closeModal}
              className="h-10 px-4 rounded-md border border-dark-border bg-dark-bg text-sm font-medium text-dark-text hover:bg-dark-border/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
              className="h-10 px-4 rounded-md bg-theatarr-600 text-white text-sm font-medium hover:bg-theatarr-700 transition-colors disabled:opacity-50"
            >
              {createUserMutation.isPending || updateUserMutation.isPending
                ? 'Enregistrement...'
                : editingUser
                  ? 'Modifier'
                  : 'Creer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal
        isOpen={!!showPasswordModal}
        onClose={() => {
          setShowPasswordModal(null);
          setNewPassword('');
        }}
        title="Changer le mot de passe"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-text">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-theatarr-500 focus:outline-none focus:ring-2 focus:ring-theatarr-500/20"
            />
            <p className="text-xs text-dark-muted">Minimum 6 caracteres</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-dark-border">
            <button
              onClick={() => {
                setShowPasswordModal(null);
                setNewPassword('');
              }}
              className="h-10 px-4 rounded-md border border-dark-border bg-dark-bg text-sm font-medium text-dark-text hover:bg-dark-border/50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                if (showPasswordModal && newPassword.length >= 6) {
                  changePasswordMutation.mutate({
                    id: showPasswordModal,
                    password: newPassword,
                  });
                }
              }}
              disabled={newPassword.length < 6 || changePasswordMutation.isPending}
              className="h-10 px-4 rounded-md bg-theatarr-600 text-white text-sm font-medium hover:bg-theatarr-700 transition-colors disabled:opacity-50"
            >
              {changePasswordMutation.isPending ? 'Changement...' : 'Changer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
