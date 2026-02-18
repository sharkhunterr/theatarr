/**
 * Desktop horizontal navigation for portal.
 */

import { Home, Play, Vote, User } from 'lucide-react';
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
  { icon: User, label: 'Profil', path: '/portal/profile' },
];

export function DesktopNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/portal') {
      return location.pathname === '/portal';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="hidden md:block fixed top-14 left-0 right-0 h-10 bg-dark-surface/80 backdrop-blur border-b border-dark-border z-30">
      <div className="h-full flex items-center gap-1 px-4 max-w-3xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 rounded-lg transition-colors text-sm font-medium',
                active
                  ? 'bg-theatarr-500/10 text-theatarr-500'
                  : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/50'
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
