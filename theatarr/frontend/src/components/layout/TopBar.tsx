/**
 * Top navigation bar with language, theme, and user controls.
 * Design aligned with ghostarr: h-14, glassmorphism backdrop-blur, h-9 icon buttons.
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Globe, Sun, Moon, User, LogOut, ChevronDown, UserCircle, Monitor } from 'lucide-react';
import clsx from 'clsx';
import { useLayoutStore } from '../../stores/layoutStore';
import { useAuthStore } from '../../stores/authStore';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { sidebarCollapsed, theme, setTheme, language, setLanguage } = useLayoutStore();
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
        <UserDropdown user={user} logout={logout} language={language} />
      </div>
    </header>
  );
}

// Language Selector Component
interface LanguageSelectorProps {
  language: 'en' | 'fr';
  setLanguage: (lang: 'en' | 'fr') => void;
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

  const languages = [
    { code: 'en' as const, label: 'English', flag: 'EN' },
    { code: 'fr' as const, label: 'Francais', flag: 'FR' },
  ];

  const current = languages.find((l) => l.code === language);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg hover:bg-dark-border/50 transition-colors text-sm font-medium"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current?.flag}</span>
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
                'w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors',
                language === lang.code && 'text-theatarr-500'
              )}
            >
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
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

function ThemeToggle({ theme, setTheme }: ThemeToggleProps) {
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-dark-border/50 transition-colors"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

// User Dropdown Component
interface UserDropdownProps {
  user: { username: string } | null;
  logout: () => void;
  language: 'en' | 'fr';
}

function UserDropdown({ user, logout, language }: UserDropdownProps) {
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

  const logoutLabel = language === 'fr' ? 'Deconnexion' : 'Logout';
  const portalLabel = language === 'fr' ? 'Portail Utilisateur' : 'User Portal';
  const wallmountLabel = language === 'fr' ? 'Wallmount' : 'Wallmount';

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
            <p className="text-xs text-dark-muted">Administrator</p>
          </div>
          <Link
            to="/portal"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-theatarr-500"
          >
            <UserCircle className="h-4 w-4" />
            {portalLabel}
          </Link>
          <a
            href="/wallmount"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-dark-text"
          >
            <Monitor className="h-4 w-4" />
            {wallmountLabel}
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
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
