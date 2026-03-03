/**
 * User profile page for portal.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Save, Eye, EyeOff, Shield, Bell, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';

interface ProfileData {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
  auto_accept_invitations: boolean;
  email_notifications: Record<string, boolean> | null;
  created_at: string;
}

const EMAIL_NOTIFICATION_KEYS = [
  'session_invitation',
  'session_started',
  'vote_invitation',
  'vote_closed',
  'quiz_invitation',
  'quiz_completed',
] as const;

const EMAIL_NOTIFICATION_LABEL_MAP: Record<string, string> = {
  session_invitation: 'portal:profile.emailNotifications.sessionInvitation',
  session_started: 'portal:profile.emailNotifications.sessionStarted',
  vote_invitation: 'portal:profile.emailNotifications.voteInvitation',
  vote_closed: 'portal:profile.emailNotifications.voteClosed',
  quiz_invitation: 'portal:profile.emailNotifications.quizInvitation',
  quiz_completed: 'portal:profile.emailNotifications.quizCompleted',
};

export function Profile() {
  const { t } = useTranslation(['portal', 'common']);
  const { formatDate: fmtDate } = useLocaleFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [autoAcceptInvitations, setAutoAcceptInvitations] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal', 'me'],
    queryFn: () => apiClient.get<ProfileData>('/portal/me'),
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setEmail(profile.email || '');
      setAutoAcceptInvitations(profile.auto_accept_invitations);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: { first_name?: string; last_name?: string; email?: string; auto_accept_invitations?: boolean }) =>
      apiClient.patch('/portal/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'me'] });
      setIsEditing(false);
    },
  });

  const toggleAutoAcceptMutation = useMutation({
    mutationFn: (value: boolean) =>
      apiClient.patch('/portal/me', { auto_accept_invitations: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'me'] });
    },
  });

  const toggleEmailNotifMutation = useMutation({
    mutationFn: (prefs: Record<string, boolean>) =>
      apiClient.patch('/portal/me', { email_notifications: prefs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal', 'me'] });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      apiClient.post('/portal/me/change-password', data),
    onSuccess: () => {
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (error: Error) => {
      setPasswordError(error.message);
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: email || undefined,
    });
  };

  const handleToggleAutoAccept = () => {
    const newValue = !autoAcceptInvitations;
    setAutoAcceptInvitations(newValue);
    toggleAutoAcceptMutation.mutate(newValue);
  };

  const handleChangePassword = () => {
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError(t('portal:profile.password.minLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('portal:profile.password.mismatch'));
      return;
    }

    changePasswordMutation.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateStr: string) => {
    return fmtDate(dateStr, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-dark-surface rounded-xl animate-pulse" />
        <div className="h-48 bg-dark-surface rounded-xl animate-pulse" />
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-4">
      {/* Header */}
      <h1 className="text-xl font-bold text-dark-text">{t('portal:profile.title')}</h1>

      {/* Avatar and basic info */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-theatarr-500/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-theatarr-500">
              {(profile?.first_name?.[0] || profile?.username?.[0] || 'U').toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-medium text-dark-text">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : profile?.username}
            </h2>
            <p className="text-dark-muted">@{profile?.username}</p>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-theatarr-500/20 text-theatarr-400 mt-1">
                <Shield size={12} />
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-dark-text">{t('portal:profile.info.title')}</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-theatarr-500 hover:underline"
            >
              {t('portal:profile.info.edit')}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="text-sm text-dark-muted hover:text-dark-text"
            >
              {t('portal:profile.info.cancel')}
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-dark-muted mb-1">{t('portal:profile.info.firstName')}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
              ) : (
                <p className="text-dark-text">{profile?.first_name || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-dark-muted mb-1">{t('portal:profile.info.lastName')}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
              ) : (
                <p className="text-dark-text">{profile?.last_name || '-'}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-dark-muted mb-1">{t('portal:profile.info.email')}</label>
            {isEditing ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
              />
            ) : (
              <p className="text-dark-text">{profile?.email || '-'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-dark-muted mb-1">{t('portal:profile.info.memberSince')}</label>
            <p className="text-dark-text">
              {profile?.created_at ? formatDate(profile.created_at) : '-'}
            </p>
          </div>

          {isEditing && (
            <button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="w-full py-3 bg-theatarr-500 text-white rounded-lg font-medium hover:bg-theatarr-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {updateProfileMutation.isPending ? t('portal:profile.info.saving') : t('portal:profile.info.save')}
            </button>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h3 className="font-medium text-dark-text flex items-center gap-2 mb-4">
          <Bell size={18} />
          {t('portal:profile.preferences.title')}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-dark-text text-sm">{t('portal:profile.preferences.autoAccept')}</p>
              <p className="text-xs text-dark-muted">
                {t('portal:profile.preferences.autoAcceptHint')}
              </p>
            </div>
            <button
              onClick={handleToggleAutoAccept}
              disabled={toggleAutoAcceptMutation.isPending}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                autoAcceptInvitations ? 'bg-theatarr-500' : 'bg-dark-border'
              } ${toggleAutoAcceptMutation.isPending ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  autoAcceptInvitations ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Email Notification Preferences */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <h3 className="font-medium text-dark-text flex items-center gap-2 mb-4">
          <Mail size={18} />
          {t('portal:profile.emailNotifications.title')}
        </h3>

        {!profile?.email ? (
          <p className="text-sm text-dark-muted">
            {t('portal:profile.emailNotifications.noEmailHint')}
          </p>
        ) : (
          <div className="space-y-3">
            {EMAIL_NOTIFICATION_KEYS.map((key) => {
              const prefs = profile?.email_notifications;
              // Default to true when prefs is null (all enabled by default)
              const isEnabled = prefs ? (prefs[key] ?? true) : true;

              return (
                <div key={key} className="flex items-center justify-between">
                  <p className="text-dark-text text-sm">{t(EMAIL_NOTIFICATION_LABEL_MAP[key])}</p>
                  <button
                    onClick={() => {
                      const current = profile?.email_notifications || {};
                      // Build full prefs object with defaults
                      const newPrefs: Record<string, boolean> = {};
                      EMAIL_NOTIFICATION_KEYS.forEach((k) => {
                        newPrefs[k] = current[k] ?? true;
                      });
                      newPrefs[key] = !isEnabled;
                      toggleEmailNotifMutation.mutate(newPrefs);
                    }}
                    disabled={toggleEmailNotifMutation.isPending}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      isEnabled ? 'bg-theatarr-500' : 'bg-dark-border'
                    } ${toggleEmailNotifMutation.isPending ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        isEnabled ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Password change */}
      <div className="bg-dark-surface rounded-xl border border-dark-border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-dark-text flex items-center gap-2">
            <Lock size={18} />
            {t('portal:profile.password.title')}
          </h3>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-sm text-theatarr-500 hover:underline"
            >
              {t('portal:profile.password.change')}
            </button>
          )}
        </div>

        {showPasswordForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-dark-muted mb-1">
                {t('portal:profile.password.current')}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-muted mb-1">
                {t('portal:profile.password.new')}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-muted mb-1">
                {t('portal:profile.password.confirm')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:border-theatarr-500 focus:outline-none"
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError('');
                }}
                className="flex-1 py-2 bg-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-muted/30 transition-colors"
              >
                {t('portal:profile.password.cancel')}
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending}
                className="flex-1 py-2 bg-theatarr-500 text-white rounded-lg font-medium hover:bg-theatarr-600 transition-colors disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? t('portal:profile.password.changing') : t('portal:profile.password.change')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-dark-muted text-sm">
            {t('portal:profile.password.secure')}
          </p>
        )}
      </div>

      {/* Admin link */}
      {isAdmin && (
        <a
          href="/"
          className="block bg-dark-surface rounded-xl border border-dark-border p-4 hover:border-theatarr-500/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-theatarr-500/20 flex items-center justify-center">
              <Shield className="text-theatarr-500" size={20} />
            </div>
            <div>
              <p className="font-medium text-dark-text">{t('portal:profile.admin.title')}</p>
              <p className="text-sm text-dark-muted">{t('portal:profile.admin.description')}</p>
            </div>
          </div>
        </a>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-red-500/10 text-red-400 rounded-xl font-medium hover:bg-red-500/20 transition-colors"
      >
        {t('portal:profile.logout')}
      </button>
    </div>
  );
}
