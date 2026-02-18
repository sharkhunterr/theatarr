/**
 * Bottom navigation for portal (mobile-first).
 */

import { Home, Play, Vote, HelpCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';

interface NavItem {
  icon: typeof Home;
  label: string;
  path: string;
  badgeKey?: 'sessions' | 'votes' | 'quiz';
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Accueil', path: '/portal' },
  { icon: Play, label: 'Sessions', path: '/portal/sessions', badgeKey: 'sessions' },
  { icon: Vote, label: 'Votes', path: '/portal/votes', badgeKey: 'votes' },
  { icon: HelpCircle, label: 'Quiz', path: '/portal/quiz', badgeKey: 'quiz' },
  { icon: User, label: 'Profil', path: '/portal/profile' },
];

export function BottomNav() {
  const location = useLocation();
  const { unseenSessions, unseenVotes, unseenQuiz } = usePortalNotifications();

  const badgeCounts: Record<string, number> = {
    sessions: unseenSessions,
    votes: unseenVotes,
    quiz: unseenQuiz,
  };

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
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors relative',
                active ? 'text-theatarr-500' : 'text-dark-muted'
              )}
            >
              <div className="relative">
                <Icon size={20} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
