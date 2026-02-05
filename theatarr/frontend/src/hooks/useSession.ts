/**
 * Hook for managing session state and controls.
 */

import { useCallback, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionStore, SessionState } from '../stores/sessionStore';
import { apiClient } from '../api/client';

interface UseSessionOptions {
  sessionId?: string;
  autoSubscribe?: boolean;
}

interface UseSessionReturn {
  session: ReturnType<typeof useSessionStore>['currentSession'];
  sessionState: SessionState | null;
  isLoading: boolean;
  error: string | null;

  // Controls
  play: () => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  skip: () => Promise<void>;
  restart: () => Promise<void>;

  // Data fetching
  fetchSession: (id: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
}

export function useSession(options: UseSessionOptions = {}): UseSessionReturn {
  const { sessionId, autoSubscribe = true } = options;

  const {
    currentSession,
    sessionState,
    setCurrentSession,
    updateSessionState,
    sessions,
    setSessions,
  } = useSessionStore();

  const token = localStorage.getItem('theatarr_token');

  const { subscribe, unsubscribe, lastMessage, isConnected } = useWebSocket({
    token,
    autoConnect: !!sessionId,
    onMessage: (message) => {
      if (message.type === 'session_state' && message.payload) {
        updateSessionState(message.payload as SessionState);
      }
    },
  });

  // Subscribe to session channel when connected
  useEffect(() => {
    if (sessionId && isConnected && autoSubscribe) {
      subscribe(`session:${sessionId}`);
      return () => {
        unsubscribe(`session:${sessionId}`);
      };
    }
  }, [sessionId, isConnected, autoSubscribe, subscribe, unsubscribe]);

  const fetchSession = useCallback(async (id: string) => {
    try {
      const session = await apiClient.get<any>(`/api/v1/sessions/${id}`);
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to fetch session:', error);
      throw error;
    }
  }, [setCurrentSession]);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await apiClient.get<{ items: any[]; total: number }>('/api/v1/sessions');
      setSessions(response.items);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      throw error;
    }
  }, [setSessions]);

  const controlSession = useCallback(
    async (action: 'play' | 'pause' | 'stop' | 'skip' | 'restart') => {
      if (!sessionId && !currentSession?.id) {
        throw new Error('No session selected');
      }

      const id = sessionId || currentSession?.id;
      const response = await apiClient.post<any>(`/api/v1/sessions/${id}/control`, {
        action,
      });

      if (response.new_state) {
        updateSessionState(response.new_state);
      }
    },
    [sessionId, currentSession, updateSessionState]
  );

  const play = useCallback(() => controlSession('play'), [controlSession]);
  const pause = useCallback(() => controlSession('pause'), [controlSession]);
  const stop = useCallback(() => controlSession('stop'), [controlSession]);
  const skip = useCallback(() => controlSession('skip'), [controlSession]);
  const restart = useCallback(() => controlSession('restart'), [controlSession]);

  return {
    session: currentSession,
    sessionState,
    isLoading: false, // TODO: Add loading state
    error: null, // TODO: Add error state

    play,
    pause,
    stop,
    skip,
    restart,

    fetchSession,
    fetchSessions,
  };
}
