/**
 * Collapsible sidebar navigation for admin interface.
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Play,
  Film,
  Vote,
  HelpCircle,
  Palette,
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
import { useLayoutStore } from '../../stores/layoutStore';

interface NavItem {
  label: string;
  labelFr: string;
  icon: LucideIcon;
  path: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', labelFr: 'Tableau de bord', icon: LayoutDashboard, path: '/' },
  { label: 'Sessions', labelFr: 'Sessions', icon: Play, path: '/sessions' },
  { label: 'Votes', labelFr: 'Votes', icon: Vote, path: '/votes' },
  { label: 'Quiz', labelFr: 'Quiz', icon: HelpCircle, path: '/quiz' },
  { label: 'Users', labelFr: 'Utilisateurs', icon: Users, path: '/users' },
  { label: 'Media', labelFr: 'Média', icon: Film, path: '/media' },
  { label: 'Templates', labelFr: 'Modèles', icon: Palette, path: '/templates' },
  { label: 'Services', labelFr: 'Services', icon: Plug, path: '/services' },
  { label: 'History', labelFr: 'Historique', icon: History, path: '/history' },
  { label: 'Logs', labelFr: 'Logs', icon: ScrollText, path: '/logs' },
  { label: 'Settings', labelFr: 'Paramètres', icon: Settings, path: '/settings' },
];

interface NavItemComponentProps {
  item: NavItem;
  collapsed: boolean;
  language: 'en' | 'fr';
}

function NavItemComponent({ item, collapsed, language }: NavItemComponentProps) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const isActive = location.pathname === item.path ||
    (item.children && item.children.some((child) => location.pathname === child.path));

  const label = language === 'fr' ? item.labelFr : item.label;
  const Icon = item.icon;

  if (item.children && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            'hover:bg-dark-border/50',
            isActive && 'bg-theatarr-500/10 text-theatarr-500'
          )}
        >
          <Icon size={20} className={clsx(isActive && 'text-theatarr-500')} />
          <span className="flex-1 text-left text-sm font-medium">{label}</span>
          <ChevronDown
            size={16}
            className={clsx('transition-transform', expanded && 'rotate-180')}
          />
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavItemComponent
                key={child.path}
                item={child}
                collapsed={collapsed}
                language={language}
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
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        'hover:bg-dark-border/50',
        isActive && 'bg-theatarr-500/10 text-theatarr-500',
        collapsed && 'justify-center'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon size={20} className={clsx(isActive && 'text-theatarr-500')} />
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen, toggleSidebar, language } = useLayoutStore();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full bg-dark-surface border-r border-dark-border z-50',
          'flex flex-col transition-all duration-300',
          // Desktop
          'hidden md:flex',
          sidebarCollapsed ? 'md:w-16' : 'md:w-64',
          // Mobile
          'md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div
          className={clsx(
            'h-16 flex items-center border-b border-dark-border px-4',
            sidebarCollapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-theatarr-500 flex items-center justify-center">
            <Film size={18} className="text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-dark-text">Theatarr</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItemComponent
              key={item.path}
              item={item}
              collapsed={sidebarCollapsed}
              language={language}
            />
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t border-dark-border">
          <button
            onClick={toggleSidebar}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
              'hover:bg-dark-border/50 text-dark-muted',
              sidebarCollapsed && 'justify-center'
            )}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!sidebarCollapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar (drawer) */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-dark-surface border-r border-dark-border z-50',
          'flex flex-col transition-transform duration-300 md:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 border-b border-dark-border px-4">
          <div className="w-8 h-8 rounded-lg bg-theatarr-500 flex items-center justify-center">
            <Film size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-dark-text">Theatarr</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <div key={item.path} onClick={() => !item.children && setSidebarOpen(false)}>
              <NavItemComponent item={item} collapsed={false} language={language} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
