/**
 * Session store using Zustand.
 */

import { create } from 'zustand';

export type SessionStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'interrupted';

export type MovieSelectionMode = 'fixed' | 'vote' | 'mystery';

export type MysterySource = 'random' | 'filtered' | 'curated';

export interface Sequence {
  id: string;
  name: string;
  order_index?: number;
  duration_type: 'fixed' | 'dynamic' | 'manual';
  duration_ms: number | null;
  duration_fallback_ms?: number;
  transition_ms?: number;
  remaining_ms?: number;
  actions_count?: number;
  action_types?: string[];
  expected_duration_ms?: number | null;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  vibrant: string;
  vibrant_light: string;
  vibrant_dark: string;
  muted: string;
  raw_palette?: string[];
}

export interface MysteryFilters {
  genres?: string[];
  year_min?: number;
  year_max?: number;
  rating_min?: number;
}

export interface MysteryMovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  movie_id?: string;
  source?: string;
  source_id?: string;
}

export interface MysteryConfig {
  source: MysterySource;
  filters?: MysteryFilters;
  curated_movies?: MysteryMovieOption[];
}

export interface VoteSessionSummary {
  id: string;
  name: string;
  status: string;
  total_votes: number;
  is_open: boolean;
  winning_movie_index?: number;
  movie_options?: Array<{
    title: string;
    year?: number;
    poster_url?: string;
    movie_id?: string;
    vote_count?: number;
  }>;
}

export interface Session {
  id: string;
  name: string;
  description?: string;
  status: SessionStatus;
  movie_id?: string;
  movie_title?: string;
  movie_poster_url?: string;
  movie_source_id?: string;
  movie_source?: string;
  color_palette?: ColorPalette;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  current_sequence_index: number;
  current_sequence_elapsed_ms: number;
  total_sequences: number;
  sequences?: Sequence[];
  workflow?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Movie selection mode fields
  movie_selection_mode?: MovieSelectionMode;
  movie_resolved?: boolean;
  movie_resolved_at?: string;
  linked_vote_session_id?: string;
  linked_vote_session?: VoteSessionSummary;
  vote_reveal_at?: string;
  mystery_reveal_at?: string;
  mystery_config?: MysteryConfig;
  // Display
  display_code?: string;
  pause_on_display_disconnect?: boolean;
  // Movie runtime (from detail response)
  movie_runtime_minutes?: number;
  // Movie details (from detail response)
  movie_details?: {
    year?: number;
    runtime_minutes?: number;
    genres?: string[];
    overview?: string;
    backdrop_url?: string;
    logos?: string[];
    enrichment_sources?: string[];
    tmdb_id?: string;
  };
  // Enriched fields from list
  participants_accepted?: number;
  participants_total?: number;
  actions_count?: number;
  // Feedback
  feedback_count?: number;
  feedback_average?: number | null;
  // Trailer preparation
  preparing_trailers?: number;
}

export interface SessionState {
  session_id: string;
  status: SessionStatus;
  current_sequence_index: number;
  current_sequence_elapsed_ms: number;
  total_sequences: number;
  current_sequence?: Sequence;
}

interface SessionStoreState {
  sessions: Session[];
  currentSession: Session | null;
  sessionState: SessionState | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (session: Session | null) => void;
  updateSessionState: (state: SessionState) => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionStoreState>()((set) => ({
  sessions: [],
  currentSession: null,
  sessionState: null,
  isLoading: false,
  error: null,

  setSessions: (sessions) => set({ sessions }),

  setCurrentSession: (session) => set({ currentSession: session }),

  updateSessionState: (state) =>
    set((prev) => {
      const updates: Partial<SessionStoreState> = { sessionState: state };

      // Update the current session if it matches
      if (prev.currentSession?.id === state.session_id) {
        updates.currentSession = {
          ...prev.currentSession,
          status: state.status,
          current_sequence_index: state.current_sequence_index,
          current_sequence_elapsed_ms: state.current_sequence_elapsed_ms,
        };
      }

      // Update the session in the sessions list
      const idx = prev.sessions.findIndex((s) => s.id === state.session_id);
      if (idx !== -1) {
        const updated = [...prev.sessions];
        updated[idx] = {
          ...updated[idx],
          status: state.status,
          current_sequence_index: state.current_sequence_index,
          current_sequence_elapsed_ms: state.current_sequence_elapsed_ms,
        };
        updates.sessions = updated;
      }

      return updates;
    }),

  clearError: () => set({ error: null }),
}));
