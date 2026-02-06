/**
 * Top navigation bar with language, theme, and user controls.
 */

import { useState, useRef, useEffect } from 'react';
import { Menu, Globe, Sun, Moon, User, LogOut, ChevronDown } from 'lucide-react';
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
        'fixed top-0 right-0 h-16 bg-dark-surface border-b border-dark-border z-30',
        'flex items-center justify-between px-4 transition-all duration-300',
        // Adjust left position based on sidebar
        sidebarCollapsed ? 'md:left-16' : 'md:left-64',
        'left-0'
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-dark-border/50 md:hidden"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors"
      >
        <Globe size={18} />
        <span className="text-sm font-medium">{current?.flag}</span>
        <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
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
      className="p-2 rounded-lg hover:bg-dark-border/50 transition-colors"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-border/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center">
          <User size={16} className="text-theatarr-500" />
        </div>
        <span className="text-sm font-medium hidden sm:block">{user?.username || 'User'}</span>
        <ChevronDown size={14} className={clsx('transition-transform hidden sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-dark-surface border border-dark-border rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-dark-border">
            <p className="text-sm font-medium text-dark-text">{user?.username}</p>
            <p className="text-xs text-dark-muted">Administrator</p>
          </div>
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-dark-border/50 transition-colors flex items-center gap-2 text-red-400"
          >
            <LogOut size={16} />
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
