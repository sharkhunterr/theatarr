/**
 * Admin layout wrapper combining sidebar, topbar, and main content area.
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
    <div className="min-h-screen bg-dark-bg text-dark-text">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={clsx(
          'transition-all duration-300',
          // Adjust margin based on sidebar state
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
        )}
      >
        {/* Top bar */}
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content - pt-20 accounts for fixed topbar (h-16) + spacing */}
        <main className="pt-20 px-4 pb-4 md:px-6 md:pb-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
