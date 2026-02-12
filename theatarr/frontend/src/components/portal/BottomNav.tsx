/**
 * Bottom navigation for portal (mobile-first).
 */

import { Home, Play, Vote, HelpCircle, History, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

interface NavItem {
  icon: typeof Home;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Accueil', path: '/portal' },
  { icon: Play, label: 'Sessions', path: '/portal/sessions' },
  { icon: Vote, label: 'Votes', path: '/portal/votes' },
  { icon: HelpCircle, label: 'Quiz', path: '/portal/quiz' },
  { icon: History, label: 'Historique', path: '/portal/history' },
  { icon: User, label: 'Profil', path: '/portal/profile' },
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/portal') {
      return location.pathname === '/portal';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-dark-surface border-t border-dark-border z-40 md:hidden">
      <div className="h-full flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                active ? 'text-theatarr-500' : 'text-dark-muted'
              )}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
