import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TemplateRenderer } from '../components/wallmount';
import { useWebSocket } from '../hooks/useWebSocket';
import { API_BASE } from '../api/client';

interface WallmountState {
  session_id: string | null;
  session_name: string | null;
  session_status: string | null;
  current_sequence_index: number;
  total_sequences: number;
  current_sequence_name: string | null;
  current_sequence_elapsed_ms: number;
  current_sequence_duration_ms: number | null;
  movie: {
    id: string;
    title: string;
    year?: number;
    runtime_minutes?: number;
    overview?: string;
    tagline?: string;
    poster_url?: string;
    backdrop_url?: string;
    rating?: number;
    genres?: string[];
    directors?: string[];
    cast?: string[];
    studios?: string[];
    original_title?: string;
    enrichment_sources?: string[];
    keywords?: string[];
    vote_count?: number;
    extra_backdrops?: string[];
    extra_posters?: string[];
    logos?: string[];
  } | null;
  palette: {
    primary: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    vibrant?: string;
    css_vars?: Record<string, string>;
  } | null;
  template: {
    name: string;
    template_type: string;
    layout?: any;
    config?: any;
  } | null;
  countdown_to: string | null;
}

export function WallmountPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const [state, setState] = useState<WallmountState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Connect to WebSocket for real-time updates (only for global wallmount)
  const { lastMessage, isConnected } = useWebSocket({
    autoConnect: !sessionId, // Only auto-connect if no specific session
    onMessage: (message) => {
      if (sessionId) return; // Ignore WebSocket updates for specific session view
      if (message.type === 'wallmount_state' && message.payload) {
        setState(message.payload as WallmountState);
      } else if (message.type === 'session_state' && message.payload) {
        // Update session-related fields
        setState((prev) =>
          prev
            ? {
                ...prev,
                session_status: message.payload.status,
                current_sequence_index: message.payload.current_sequence_index ?? prev.current_sequence_index,
                current_sequence_elapsed_ms: message.payload.current_sequence_elapsed_ms ?? prev.current_sequence_elapsed_ms,
              }
            : null
        );
      }
    },
  });

  // Fetch initial state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const url = sessionId
          ? `${API_BASE}/api/v1/wallmount/state?session_id=${sessionId}`
          : `${API_BASE}/api/v1/wallmount/state`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch wallmount state');
        }
        const data = await response.json();
        setState(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchState();

    // Poll for updates as backup to WebSocket
    const pollInterval = setInterval(fetchState, sessionId ? 30000 : 10000);
    return () => clearInterval(pollInterval);
  }, [sessionId]);

  // Subscribe to wallmount channel when connected
  useEffect(() => {
    if (isConnected) {
      // The WebSocket manager should auto-subscribe wallmount clients
    }
  }, [isConnected]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white/50 text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  // No active session
  if (!state?.session_id) {
    return (
      <div
        className="w-screen h-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: '#0a0a0f' }}
      >
        <div className="text-6xl font-bold text-white/10 mb-4">THEATARR</div>
        <div className="text-white/30">Waiting for session...</div>
        <div className="mt-8 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-white/30 text-sm">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>
    );
  }

  // Scheduled session with countdown
  if (state.session_status === 'scheduled' && state.countdown_to) {
    const template = state.template || {
      name: 'Countdown',
      template_type: 'countdown',
      layout: {
        components: [
          { type: 'backdrop', opacity: 0.3 },
          { type: 'countdown', position: 'center' },
          { type: 'title', position: 'bottom' },
        ],
      },
      config: {
        show_seconds: true,
        animate_numbers: true,
      },
    };

    return (
      <div className="w-screen h-screen overflow-hidden">
        <TemplateRenderer
          template={template}
          data={{
            movie: state.movie || undefined,
            session: {
              name: state.session_name || undefined,
              status: state.session_status || undefined,
            },
            countdown_to: state.countdown_to,
            palette: state.palette || undefined,
          }}
        />
      </div>
    );
  }

  // Active session
  const template = state.template || {
    name: 'Movie Info',
    template_type: 'movie_info',
    layout: {
      components: [
        { type: 'backdrop', opacity: 0.2, blur: 20 },
        { type: 'poster', position: 'left', size: 'large' },
        { type: 'title' },
        { type: 'metadata' },
        { type: 'overview', max_lines: 4 },
        { type: 'cast', limit: 5 },
      ],
    },
    config: {
      show_rating: true,
      show_genres: true,
    },
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      <TemplateRenderer
        template={template}
        data={{
          movie: state.movie || undefined,
          session: {
            name: state.session_name || undefined,
            status: state.session_status || undefined,
            current_sequence_index: state.current_sequence_index,
            total_sequences: state.total_sequences,
            current_sequence_name: state.current_sequence_name || undefined,
            current_sequence_elapsed_ms: state.current_sequence_elapsed_ms,
            current_sequence_duration_ms: state.current_sequence_duration_ms || undefined,
          },
          palette: state.palette || undefined,
        }}
      />

      {/* Connection indicator */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
        />
        <span className="text-white/50 text-xs">
          {state.session_status === 'running' ? 'Live' : state.session_status}
        </span>
      </div>
    </div>
  );
}
