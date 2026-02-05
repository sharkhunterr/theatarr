/**
 * Authentication store using Zustand.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, clearAuthToken, setAuthToken } from '../api/client';

interface User {
  id: string;
  username: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.login(username, password);
          setAuthToken(response.access_token);

          const user = await apiClient.getMe();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          clearAuthToken();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: () => {
        clearAuthToken();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('theatarr_token');
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });

        try {
          const user = await apiClient.getMe();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          clearAuthToken();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'theatarr-auth',
      partialize: (state) => ({
        // Only persist user info, not loading/error state
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
