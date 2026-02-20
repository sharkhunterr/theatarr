/**
 * Compact header for portal interface.
 */

import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { NotificationBell } from './NotificationBell';
import { TheatarrLogo } from '../common';

export function PortalHeader() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useLayoutStore();

  const displayName = user?.first_name || user?.username || 'User';
  const isAdmin = user?.role === 'admin';
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-dark-surface border-b border-dark-border z-40">
      <div className="h-full px-4 flex items-center justify-between max-w-3xl mx-auto">
        {/* Logo */}
        <Link to="/portal" className="flex items-center gap-2">
          <TheatarrLogo size={32} />
          <span className="text-lg font-bold text-dark-text">Theatarr</span>
        </Link>

        {/* User info */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-dark-muted hidden sm:block mr-1">
            {displayName}
          </span>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors"
            title={isDark ? 'Theme clair' : 'Theme sombre'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notification bell */}
          <NotificationBell />

          {/* Admin button */}
          {isAdmin && (
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theatarr-500/10 text-theatarr-500 hover:bg-theatarr-500/20 transition-colors text-sm font-medium"
              title="Interface Admin"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
