/**
 * Desktop horizontal navigation for portal.
 */

import { Home, Play, Vote, HelpCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';

interface NavItem {
  icon: typeof Home;
  labelKey: string;
  path: string;
  badgeKey?: 'sessions' | 'votes' | 'quiz';
}

const navItems: NavItem[] = [
  { icon: Home, labelKey: 'portal:nav.home', path: '/portal' },
  { icon: Play, labelKey: 'portal:nav.sessions', path: '/portal/sessions', badgeKey: 'sessions' },
  { icon: Vote, labelKey: 'portal:nav.votes', path: '/portal/votes', badgeKey: 'votes' },
  { icon: HelpCircle, labelKey: 'portal:nav.quiz', path: '/portal/quiz', badgeKey: 'quiz' },
  { icon: User, labelKey: 'portal:nav.profile', path: '/portal/profile' },
];

export function DesktopNav() {
  const location = useLocation();
  const { t } = useTranslation();
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
    <nav className="hidden md:block fixed top-14 left-0 right-0 h-10 bg-dark-surface/80 backdrop-blur border-b border-dark-border z-30">
      <div className="h-full flex items-center gap-1 px-4 max-w-3xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 rounded-lg transition-colors text-sm font-medium relative',
                active
                  ? 'bg-theatarr-500/10 text-theatarr-500'
                  : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/50'
              )}
            >
              <Icon size={16} />
              <span>{t(item.labelKey)}</span>
              {badgeCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
