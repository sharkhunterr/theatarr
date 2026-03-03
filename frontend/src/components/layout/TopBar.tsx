/**
 * Top navigation bar with language, theme, and user controls.
 * Design aligned with ghostarr: h-14, glassmorphism backdrop-blur, h-9 icon buttons.
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Sun, Moon, User, LogOut, ChevronDown, UserCircle, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useLayoutStore, type Language } from '../../stores/layoutStore';
import { useAuthStore } from '../../stores/authStore';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { theme, setTheme, language, setLanguage } = useLayoutStore();
  const { user, logout } = useAuthStore();

  return (
    <header
      className={clsx(
        'sticky top-0 right-0 h-14 z-30',
        'bg-dark-surface/95 backdrop-blur supports-[backdrop-filter]:bg-dark-surface/60',
        'border-b border-dark-border',
        'flex items-center justify-between px-4 transition-all duration-300',
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-dark-border/50 transition-colors md:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        <LanguageSelector language={language} setLanguage={setLanguage} />
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <UserDropdown user={user} logout={logout} />
      </div>
    </header>
  );
}

// Language Selector Component
interface LanguageSelectorProps {
  language: string;
  setLanguage: (lang: Language) => void;
}

function LanguageSelector({ language, setLanguage }: LanguageSelectorProps) {
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

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '\u{1F1EB}\u{1F1F7}' },
    { code: 'en', label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
    { code: 'it', label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
    { code: 'es', label: 'Español', flag: '\u{1F1EA}\u{1F1F8}' },
    { code: 'de', label: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}' },
  ];

  const current = languages.find((l) => l.code === language);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg hover:bg-dark-border/50 transition-colors text-sm font-medium"
      >
        <span className="text-base">{current?.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1 z-50">
          {languages.map((lang) => (
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

// Theme Toggle Component
interface ThemeToggleProps {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  const { t } = useTranslation('admin');
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

  const options = [
    { key: 'light' as const, label: t('topBar.themeLight'), icon: Sun },
    { key: 'dark' as const, label: t('topBar.themeDark'), icon: Moon },
    { key: 'system' as const, label: t('topBar.themeSystem'), icon: Monitor },
  ];

  const currentIcon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const CurrentIcon = currentIcon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-dark-border/50 transition-colors"
        aria-label="Theme"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1 z-50">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setTheme(opt.key);
                setOpen(false);
              }}
              className={clsx(
                'w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2',
                theme === opt.key && 'text-theatarr-500'
              )}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// User Dropdown Component
interface UserDropdownProps {
  user: { username: string } | null;
  logout: () => void;
}

function UserDropdown({ user, logout }: UserDropdownProps) {
  const { t } = useTranslation('admin');
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-dark-border/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-theatarr-500/20 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-theatarr-500" />
        </div>
        <span className="text-sm font-medium hidden sm:block">{user?.username || 'User'}</span>
        <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform hidden sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-dark-border">
            <p className="text-sm font-medium text-dark-text">{user?.username}</p>
            <p className="text-xs text-dark-muted">{t('topBar.administrator')}</p>
          </div>
          <Link
            to="/portal"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-theatarr-500"
          >
            <UserCircle className="h-4 w-4" />
            {t('topBar.userPortal')}
          </Link>
          <a
            href="/wallmount"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-dark-text"
          >
            <Monitor className="h-4 w-4" />
            Wallmount
          </a>
          <div className="border-t border-dark-border my-1" />
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-red-400"
          >
            <LogOut className="h-4 w-4" />
            {t('topBar.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
