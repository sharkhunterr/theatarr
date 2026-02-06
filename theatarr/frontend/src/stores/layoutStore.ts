/**
 * Layout state management for admin interface.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'fr';

interface LayoutState {
  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarOpen: boolean; // For mobile drawer

  // Preferences
  theme: Theme;
  language: Language;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarCollapsed: false,
      sidebarOpen: false,
      theme: 'dark',
      language: 'fr',

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setTheme: (theme) => {
        // Update document class for Tailwind dark mode
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        set({ theme });
      },
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'theatarr-layout',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        language: state.language,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme on rehydration
        if (state?.theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
