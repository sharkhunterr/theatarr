/**
 * Admin layout wrapper combining sidebar, topbar, and main content area.
 * Design aligned with ghostarr: w-56 sidebar, h-14 topbar, p-4 md:p-6 content.
 */

import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useLayoutStore } from '../../stores/layoutStore';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { sidebarCollapsed, setSidebarOpen } = useLayoutStore();

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={clsx(
          'flex-1 flex flex-col w-full transition-all duration-300',
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-56'
        )}
      >
        {/* Top bar */}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
