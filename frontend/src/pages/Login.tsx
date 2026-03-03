import { FormEvent, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardContent, Input, TheatarrLogo } from '../components/common';
import { useAuthStore } from '../stores/authStore';

export function Login() {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, user } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(username, password);
      // Get updated user after login
      const currentUser = useAuthStore.getState().user;
      // Redirect based on role
      if (from && !from.startsWith('/login')) {
        navigate(from, { replace: true });
      } else if (currentUser?.role === 'admin') {
        navigate('/', { replace: true });
      } else {
        navigate('/portal', { replace: true });
      }
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent>
          <div className="text-center mb-8">
            <div className="flex justify-center mb-3">
              <TheatarrLogo size={64} />
            </div>
            <h1 className="text-3xl font-bold text-theatarr-500 mb-2">Theatarr</h1>
            <p className="text-dark-muted">{t('settings:login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('settings:login.username')}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('settings:login.usernamePlaceholder')}
              autoComplete="username"
              required
            />

            <Input
              label={t('settings:login.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('settings:login.passwordPlaceholder')}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              {t('settings:login.signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
