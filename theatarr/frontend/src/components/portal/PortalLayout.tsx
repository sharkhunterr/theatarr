/**
 * Layout wrapper for portal interface (mobile-first, no sidebar).
 */

import { PortalHeader } from './PortalHeader';
import { BottomNav } from './BottomNav';
import { DesktopNav } from './DesktopNav';

interface PortalLayoutProps {
  children: React.ReactNode;
}

export function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-dark-bg text-dark-text">
      {/* Header */}
      <PortalHeader />

      {/* Desktop navigation (hidden on mobile) */}
      <DesktopNav />

      {/* Main content */}
      <main className="pt-14 md:pt-24 pb-20 md:pb-6 px-4 max-w-3xl mx-auto">
        {children}
      </main>

      {/* Bottom navigation (mobile only) */}
      <BottomNav />
    </div>
  );
}
