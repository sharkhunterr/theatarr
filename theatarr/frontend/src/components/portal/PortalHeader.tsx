/**
 * Compact header for portal interface.
 */

import { useState, useRef, useEffect } from 'react';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useLayoutStore, type Language } from '../../stores/layoutStore';
import { NotificationBell } from './NotificationBell';
import { TheatarrLogo } from '../common';

export function PortalHeader() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme, language, setLanguage } = useLayoutStore();
  const { t } = useTranslation('portal');

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

          {/* Language selector */}
          <PortalLanguageSelector language={language} setLanguage={setLanguage} />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors"
            title={isDark ? t('header.themeLight') : t('header.themeDark')}
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
              title={t('header.adminInterface')}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors"
            title={t('header.logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

// Language Selector for Portal
interface PortalLanguageSelectorProps {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  { code: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'es', label: 'Español', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
];

function PortalLanguageSelector({ language, setLanguage }: PortalLanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === language);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-dark-border/50 text-dark-muted transition-colors text-base"
      >
        {current?.flag}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1 z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2',
                language === lang.code && 'text-theatarr-500'
              )}
            >
              <span>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
