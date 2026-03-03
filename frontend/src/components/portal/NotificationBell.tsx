/**
 * Notification bell with dropdown for portal header.
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, Mail, Star, Vote, HelpCircle, ChevronRight, Trophy, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { usePortalNotifications, NotificationItem } from '../../hooks/usePortalNotifications';

const ICON_MAP: Record<string, typeof Bell> = {
  invitations: Mail,
  feedback: Star,
  votes: Vote,
  votes_closed: BarChart3,
  quiz: HelpCircle,
  quiz_completed: Trophy,
};

export function NotificationBell() {
  const { t } = useTranslation(['portal', 'common']);
  const { totalUnseen, items, markAllSeen, markCategorySeen } = usePortalNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [snapshotItems, setSnapshotItems] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        markAllSeen();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, markAllSeen]);

  const handleToggle = () => {
    if (!isOpen) {
      // Snapshot current items so they stay visible while dropdown is open
      setSnapshotItems(items);
    } else {
      // Closing: acknowledge all
      markAllSeen();
    }
    setIsOpen(!isOpen);
  };

  const handleItemClick = (category: 'sessions' | 'votes' | 'quiz') => {
    markCategorySeen(category);
    setIsOpen(false);
  };

  const displayItems = isOpen ? snapshotItems : items;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className={clsx(
          'relative p-2 rounded-lg transition-colors',
          isOpen
            ? 'bg-dark-border/50 text-dark-text'
            : 'hover:bg-dark-border/50 text-dark-muted'
        )}
        title={t('portal:notifications.title')}
      >
        <Bell size={18} />
        {totalUnseen > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none animate-bounce-in">
            {totalUnseen > 9 ? '9+' : totalUnseen}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden z-50 animate-slide-down">
          {/* Header */}
          <div className="px-4 py-3 border-b border-dark-border">
            <h3 className="text-sm font-semibold text-dark-text">{t('portal:notifications.title')}</h3>
          </div>

          {/* Items */}
          {displayItems.length > 0 ? (
            <div className="divide-y divide-dark-border/50 max-h-80 overflow-y-auto">
              {displayItems.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item.category)}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto text-dark-muted mb-2 opacity-50" />
              <p className="text-sm text-dark-muted">{t('portal:notifications.empty')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const Icon = ICON_MAP[item.id] || Bell;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 hover:bg-dark-border/30 transition-colors"
    >
      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', getBgColor(item.id))}>
        <Icon size={16} className={item.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-text">{item.label}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className={clsx(
          'min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-white text-xs font-bold',
          getBadgeColor(item.id)
        )}>
          {item.count}
        </span>
        <ChevronRight size={14} className="text-dark-muted" />
      </div>
    </Link>
  );
}

function getBgColor(id: string): string {
  switch (id) {
    case 'invitations': return 'bg-blue-500/15';
    case 'feedback': return 'bg-yellow-500/15';
    case 'votes': return 'bg-red-500/15';
    case 'votes_closed': return 'bg-orange-500/15';
    case 'quiz': return 'bg-purple-500/15';
    case 'quiz_completed': return 'bg-green-500/15';
    default: return 'bg-dark-border/50';
  }
}

function getBadgeColor(id: string): string {
  switch (id) {
    case 'invitations': return 'bg-blue-500';
    case 'feedback': return 'bg-yellow-500';
    case 'votes': return 'bg-red-500';
    case 'votes_closed': return 'bg-orange-500';
    case 'quiz': return 'bg-purple-500';
    case 'quiz_completed': return 'bg-green-500';
    default: return 'bg-dark-muted';
  }
}
