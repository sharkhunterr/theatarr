/**
 * Admin user management page.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Shield, Trash2, Key, Edit2, X, Check } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { apiClient } from '../api/client';

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
  const [search, setSearch] = useState('');
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
    queryKey: ['users', search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Utilisateurs</h1>
          <p className="text-dark-muted text-sm mt-1">
            {data?.total || 0} utilisateur{(data?.total || 0) !== 1 ? 's' : ''} enregistre{(data?.total || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-theatarr-600 text-white rounded-lg font-medium hover:bg-theatarr-700 transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nouvel utilisateur</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:border-theatarr-500 focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
        >
          <option value="">Tous les roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-dark-surface rounded-xl border border-dark-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="bg-dark-surface rounded-xl border border-dark-border overflow-hidden">
          {data && data.items.length > 0 ? (
            <div className="divide-y divide-dark-border">
              {data.items.map((user) => (
                <div
                  key={user.id}
                  className={clsx(
                    'p-4 flex items-center gap-4',
                    !user.is_active && 'opacity-50'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
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
                      <span className="font-medium text-dark-text">
                        {user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.username}
                      </span>
                      {user.role === 'admin' && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-theatarr-500/20 text-theatarr-400">
                          <Shield size={10} />
                          Admin
                        </span>
                      )}
                      {!user.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-dark-muted">
                      <span>@{user.username}</span>
                      {user.email && (
                        <span className="hidden sm:inline">{user.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Last login */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm text-dark-muted">
                      {user.last_login_at
                        ? `Derniere connexion ${formatDate(user.last_login_at)}`
                        : 'Jamais connecte'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-dark-text transition-colors"
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setShowPasswordModal(user.id)}
                      className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted hover:text-dark-text transition-colors"
                      title="Changer le mot de passe"
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={clsx(
                        'p-2 rounded-lg hover:bg-dark-border/50 transition-colors',
                        user.is_active
                          ? 'text-green-400 hover:text-green-300'
                          : 'text-dark-muted hover:text-dark-text'
                      )}
                      title={user.is_active ? 'Desactiver' : 'Activer'}
                    >
                      {user.is_active ? <Check size={16} /> : <X size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-dark-muted hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Users size={48} className="mx-auto text-dark-muted mb-4" />
              <h3 className="text-lg font-medium text-dark-text mb-2">
                Aucun utilisateur
              </h3>
              <p className="text-dark-muted mb-4">
                Creez votre premier utilisateur pour commencer.
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-theatarr-600 text-white rounded-lg font-medium hover:bg-theatarr-700 transition-colors"
              >
                <Plus size={18} />
                Nouvel utilisateur
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-xl border border-dark-border w-full max-w-md">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-text">
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-1">
                  Nom d'utilisateur *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm text-dark-muted mb-1">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-dark-muted mb-1">Prenom</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-muted mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-dark-muted mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {formError && (
                <p className="text-sm text-red-400">{formError}</p>
              )}
            </div>

            <div className="p-4 border-t border-dark-border flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2 bg-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-muted/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={createUserMutation.isPending || updateUserMutation.isPending}
                className="flex-1 py-2 bg-theatarr-600 text-white rounded-lg font-medium hover:bg-theatarr-700 transition-colors disabled:opacity-50"
              >
                {createUserMutation.isPending || updateUserMutation.isPending
                  ? 'Enregistrement...'
                  : editingUser
                    ? 'Modifier'
                    : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-xl border border-dark-border w-full max-w-sm">
            <div className="p-4 border-b border-dark-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-text">Changer le mot de passe</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword('');
                }}
                className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-dark-border flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword('');
                }}
                className="flex-1 py-2 bg-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-muted/30 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (newPassword.length >= 6) {
                    changePasswordMutation.mutate({
                      id: showPasswordModal,
                      password: newPassword,
                    });
                  }
                }}
                disabled={newPassword.length < 6 || changePasswordMutation.isPending}
                className="flex-1 py-2 bg-theatarr-600 text-white rounded-lg font-medium hover:bg-theatarr-700 transition-colors disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? 'Changement...' : 'Changer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
