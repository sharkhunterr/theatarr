/**
 * Collapsible sidebar navigation for admin interface.
 * Design aligned with ghostarr: w-56, h-14 header, px-3 py-2 nav items, text-sm.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Play,
  Film,
  Vote,
  Plug,
  History,
  ScrollText,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useLayoutStore } from '../../stores/layoutStore';

interface NavItem {
  labelKey: string;
  icon: LucideIcon;
  path: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { labelKey: 'admin:sidebar.dashboard', icon: LayoutDashboard, path: '/' },
  { labelKey: 'admin:sidebar.sessions', icon: Play, path: '/sessions' },
  { labelKey: 'admin:sidebar.votesQuiz', icon: Vote, path: '/votes' },
  { labelKey: 'admin:sidebar.users', icon: Users, path: '/users' },
  { labelKey: 'admin:sidebar.media', icon: Film, path: '/media' },
  { labelKey: 'admin:sidebar.services', icon: Plug, path: '/services' },
  { labelKey: 'admin:sidebar.history', icon: History, path: '/history' },
  { labelKey: 'admin:sidebar.logs', icon: ScrollText, path: '/logs' },
  { labelKey: 'admin:sidebar.settings', icon: Settings, path: '/settings' },
];

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
}

function NavItemComponent({ item, collapsed }: NavItemComponentProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const isActive = location.pathname === item.path ||
    (item.path !== '/' && location.pathname.startsWith(item.path)) ||
    (item.children && item.children.some((child) => location.pathname === child.path));

  const label = t(item.labelKey);
  const Icon = item.icon;

  if (item.children && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-theatarr-500/15 text-theatarr-400'
              : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/50'
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown
            className={clsx('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-0.5">
            {item.children.map((child) => (
              <NavItemComponent
                key={child.path}
                item={child}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.path}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-theatarr-500/15 text-theatarr-400'
          : 'text-dark-muted hover:text-dark-text hover:bg-dark-border/50',
        collapsed && 'justify-center px-0'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen, toggleSidebar } = useLayoutStore();
  const { t } = useTranslation('admin');

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-dark-surface border-r border-dark-border',
          'transition-all duration-300 ease-in-out',
          'hidden md:flex',
          sidebarCollapsed ? 'md:w-16' : 'md:w-56'
        )}
      >
        {/* Logo */}
        <div
          className={clsx(
            'h-14 flex items-center border-b border-dark-border px-4',
            sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5'
          )}
        >
          <img src="/favicon.svg" alt="Theatarr" className="h-8 w-8 flex-shrink-0" />
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold text-dark-text">Theatarr</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-dark-border">
          <button
            onClick={toggleSidebar}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
              'text-dark-muted hover:text-dark-text hover:bg-dark-border/50',
              sidebarCollapsed && 'justify-center px-0'
            )}
            title={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!sidebarCollapsed && <span className="text-sm">{t('sidebar.collapse')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar (drawer) */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 w-56 bg-dark-surface border-r border-dark-border z-50',
          'flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 border-b border-dark-border px-4">
          <img src="/favicon.svg" alt="Theatarr" className="h-8 w-8" />
          <span className="text-lg font-semibold text-dark-text">Theatarr</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <div key={item.path} onClick={() => !item.children && setSidebarOpen(false)}>
              <NavItemComponent item={item} collapsed={false} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
