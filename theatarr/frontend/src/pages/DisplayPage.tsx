/**
 * Display Page — Kiosk/PC mode for cinema session playback.
 *
 * Two screens:
 * 1. Code input (/display) — OTP-style 6-char code entry
 * 2. Session display (/display/:code) — fullscreen template + audio + video
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { TemplateRenderer } from '../components/wallmount';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { API_BASE } from '../api/client';

// ============================================================================
// Types
// ============================================================================

interface DisplayMovie {
  id?: string;
  title: string;
  original_title?: string;
  year?: number;
  runtime_minutes?: number;
  overview?: string;
  tagline?: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  vote_count?: number;
  genres?: string[];
  directors?: string[];
  cast?: string[];
  studios?: string[];
  keywords?: string[];
  extra_backdrops?: string[];
  extra_posters?: string[];
  logos?: string[];
  enrichment_sources?: string[];
}

interface DisplayTemplate {
  id: string;
  name: string;
  template_type: string;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
}

interface DisplaySession {
  session_id: string;
  session_name: string;
  session_status: string;
  movie: DisplayMovie | null;
  display_code: string;
  color_palette: Record<string, string> | null;
  template_id: string | null;
  template: DisplayTemplate | null;
}

interface ActionPayload {
  action_type: string;
  command: string;
  parameters: Record<string, unknown>;
  is_replay?: boolean;
  broadcast_at?: string;
}

// ============================================================================
// Code Input Screen
// ============================================================================

function CodeInput() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInput = (index: number, value: string) => {
    const char = value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setError(null);

    // Auto-focus next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-validate within user gesture (keeps audio unlock working)
    if (newDigits.every((d) => d.length === 1)) {
      validateCodeDirect(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
    } else if (e.key === 'Enter') {
      validateCode();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, '')
      .slice(0, 6);
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setDigits(newDigits);
    // Focus last filled input
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();

    // Auto-validate within user gesture
    if (newDigits.every((d) => d.length === 1)) {
      validateCodeDirect(newDigits.join(''));
    }
  };

  const validateCodeDirect = async (code: string) => {
    if (code.length !== 6) {
      setError('Entrez les 6 caracteres');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/display/${code}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Code invalide');
        return;
      }
      // Unlock audio for later video playback (must happen within user gesture)
      try {
        const ctx = new AudioContext();
        await ctx.resume();
        ctx.close();
      } catch {
        // AudioContext may not be available
      }
      // Enter fullscreen (user gesture from click/Enter triggers this)
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be blocked by browser — continue anyway
      }
      navigate(`/display/${code}`);
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setIsValidating(false);
    }
  };

  const validateCode = () => validateCodeDirect(digits.join(''));

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-[#0a0a1a] to-[#0f0f2a] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white/90 tracking-wider">THEATARR</h1>
        <p className="text-center text-white/40 mt-2 text-sm tracking-widest uppercase">
          Session Display
        </p>
      </div>

      {/* Code label */}
      <p className="text-white/60 text-lg mb-6">Entrez le code de session</p>

      {/* Code inputs */}
      <div className="flex gap-3 mb-8" onPaste={handlePaste}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`
              w-16 h-20 text-center text-3xl font-mono font-bold
              bg-white/5 border-2 rounded-xl
              text-white outline-none transition-all duration-200
              ${error ? 'border-red-500/60' : 'border-white/20'}
              focus:border-blue-500/60 focus:bg-white/10
              hover:bg-white/8
            `}
            autoComplete="off"
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mb-4 animate-pulse">{error}</p>
      )}

      {/* Validation indicator */}
      {isValidating && (
        <div className="flex items-center gap-2 text-white/50">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          <span>Validation...</span>
        </div>
      )}

      {/* Help */}
      <p className="text-white/20 text-xs mt-12">
        Le code est affiche dans les details de la session
      </p>
    </div>
  );
}

// ============================================================================
// Session Display Screen
// ============================================================================

function SessionDisplay() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const audioEngine = useAudioEngine();

  const [session, setSession] = useState<DisplaySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch session info from display code
  useEffect(() => {
    if (!code) return;

    const fetchSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/display/${code.toUpperCase()}`);
        if (!res.ok) {
          setError('Code invalide ou session introuvable');
          return;
        }
        const data = await res.json();
        setSession(data);
      } catch {
        setError('Erreur de connexion au serveur');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [code]);

  // Handle WebSocket action messages
  const handleAction = useCallback(
    (payload: ActionPayload) => {
      const { action_type, command, parameters } = payload;

      switch (action_type) {
        case 'audio':
          handleAudioAction(command, parameters);
          break;
        case 'display':
          handleDisplayAction(command, parameters);
          break;
        case 'media':
          handleMediaAction(command, parameters);
          break;
        default:
          console.log('Unknown action type:', action_type, command, parameters);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleAudioAction = useCallback(
    (command: string, params: Record<string, unknown>) => {
      switch (command) {
        case 'play':
          audioEngine.play(
            params.url as string,
            (params.volume as number) ?? 0.8,
            (params.fade_in_ms as number) ?? 0
          );
          break;
        case 'stop':
          audioEngine.stop((params.fade_out_ms as number) ?? 0);
          break;
        case 'pause':
          audioEngine.pause();
          break;
        case 'resume':
          audioEngine.resume();
          break;
        case 'volume':
          audioEngine.setVolume(
            (params.volume as number) ?? 1,
            (params.fade_ms as number) ?? 0
          );
          break;
      }
    },
    [audioEngine]
  );

  const handleDisplayAction = useCallback(
    (command: string, params: Record<string, unknown>) => {
      switch (command) {
        case 'show': {
          const contentType = params.content_type as string | undefined;
          if (contentType === 'waiting_screen') {
            // Use the session's configured template for waiting screen
            setCurrentTemplate(session?.template || null);
            setShowVideo(false);
          } else if (params.template_id || params.layout) {
            // Explicit template override from action parameters
            setCurrentTemplate({
              name: (params.template_name as string) || 'Display Template',
              template_type: (params.template_type as string) || 'movie_info',
              layout: params.layout,
              config: params.config,
            });
            setShowVideo(false);
          }
          break;
        }
        case 'blank':
        case 'black':
          setCurrentTemplate(null);
          setShowVideo(false);
          break;
      }
    },
    [session?.template]
  );

  const handleMediaAction = useCallback(
    (command: string, params: Record<string, unknown>) => {
      switch (command) {
        case 'play': {
          const url = params.url as string;
          if (url) {
            setVideoUrl(url);
            setShowVideo(true);
            enterFullscreen();
          } else {
            // No stream URL (e.g. Plex plays on its own device)
            // Hide template — external player handles the video
            setCurrentTemplate(null);
            setShowVideo(false);
          }
          break;
        }
        case 'stop':
          setShowVideo(false);
          setVideoUrl(null);
          break;
        case 'pause':
          videoRef.current?.pause();
          break;
        case 'resume':
          videoRef.current?.play();
          break;
      }
    },
    []
  );

  // Handle replayed action (reconnection) — same as normal but seeks video/audio to current position
  const handleReplayAction = useCallback(
    (payload: ActionPayload) => {
      const { action_type, command, parameters, broadcast_at } = payload;
      const elapsedSec = broadcast_at
        ? (Date.now() - new Date(broadcast_at).getTime()) / 1000
        : 0;

      switch (action_type) {
        case 'media':
          if (command === 'play') {
            const url = parameters.url as string;
            if (url) {
              setVideoUrl(url);
              setShowVideo(true);
              // Seek to current position once video is ready
              const seekOnReady = () => {
                const video = videoRef.current;
                if (video && elapsedSec > 0) {
                  video.currentTime = elapsedSec;
                }
              };
              // Wait for the next useEffect cycle to set up the video, then seek
              setTimeout(seekOnReady, 500);
            } else {
              setCurrentTemplate(null);
              setShowVideo(false);
            }
          } else if (command === 'pause') {
            // Session is paused with video — show video paused at position
            const url = parameters.url as string;
            if (url) {
              setVideoUrl(url);
              setShowVideo(true);
              setTimeout(() => {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = elapsedSec;
                  video.pause();
                }
              }, 500);
            }
          } else if (command === 'stop') {
            setShowVideo(false);
            setVideoUrl(null);
          }
          break;
        case 'audio':
          if (command === 'play') {
            audioEngine.play(
              parameters.url as string,
              (parameters.volume as number) ?? 0.8,
              0 // No fade on replay
            );
            // Audio seek if possible
            if (elapsedSec > 0 && audioEngine.seek) {
              setTimeout(() => audioEngine.seek?.(elapsedSec), 200);
            }
          }
          break;
        case 'display':
          // Display actions are stateless (images/text) — replay normally
          handleDisplayAction(command, parameters);
          break;
        default:
          console.log('Replay: unknown action type:', action_type, command);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [audioEngine, handleDisplayAction]
  );

  // WebSocket connection
  const { isConnected, send } = useWebSocket({
    autoConnect: !!session?.session_id,
    onConnect: () => {
      if (session?.session_id) {
        send({
          type: 'subscribe_display',
          payload: { session_id: session.session_id },
        });
      }
    },
    onMessage: (message) => {
      if (message.type === 'action_execute' && message.payload) {
        const payload = message.payload as unknown as ActionPayload;
        if (payload.is_replay) {
          handleReplayAction(payload);
        } else {
          handleAction(payload);
        }
        // Receiving an action means session is running — remove idle overlay
        setSession((prev) =>
          prev && prev.session_status !== 'running'
            ? { ...prev, session_status: 'running' }
            : prev
        );
      } else if (message.type === 'session_state' && message.payload) {
        // Update session status
        const p = message.payload;
        if (p.session_id === session?.session_id) {
          setSession((prev) =>
            prev ? { ...prev, session_status: p.status as string } : null
          );
        }
      }
    },
  });

  // Re-subscribe on reconnect
  useEffect(() => {
    if (isConnected && session?.session_id) {
      send({
        type: 'subscribe_display',
        payload: { session_id: session.session_id },
      });
    }
  }, [isConnected, session?.session_id, send]);

  // Fullscreen helpers
  const enterFullscreen = useCallback(() => {
    const el = containerRef.current || document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // HLS instance ref for cleanup
  const hlsRef = useRef<Hls | null>(null);

  // Attach video source (HLS or native) and start playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo || !videoUrl) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = videoUrl.includes('.m3u8');

    const startPlayback = () => {
      video.muted = false;
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => {
          // Autoplay with sound blocked — start muted, show unmute overlay
          video.muted = true;
          setVideoMuted(true);
          video.play();
        });
      }
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
      });
      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        startPlayback();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data.type, data.details);
        }
      });
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: native HLS support
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', startPlayback, { once: true });
    } else {
      // Direct URL (MP4, etc.)
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', startPlayback, { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [showVideo, videoUrl]);

  // React to session status changes (pause/stop/resume from admin)
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const status = session?.session_status;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status || null;

    if (!status || !prev || status === prev) return;

    const video = videoRef.current;

    if (status === 'paused') {
      if (video && !video.paused) {
        video.pause();
      }
      audioEngine.pause();
    } else if (status === 'completed' || status === 'interrupted') {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setShowVideo(false);
      setVideoUrl(null);
      setVideoMuted(false);
      audioEngine.stop(0);
    } else if (status === 'running' && prev === 'paused') {
      if (video && video.paused && showVideo) {
        video.play().catch(() => {});
      }
      audioEngine.resume();
    }
  }, [session?.session_status, showVideo, audioEngine]);

  // Video ended handler
  const handleVideoEnded = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setShowVideo(false);
    setVideoUrl(null);
    setVideoMuted(false);
    // Notify backend
    if (session?.session_id) {
      send({
        type: 'playback_ended',
        payload: { session_id: session.session_id },
      });
    }
  }, [session?.session_id, send]);

  // Loading state
  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="w-screen h-screen bg-gradient-to-b from-[#0a0a1a] to-[#0f0f2a] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-lg">{error || 'Session introuvable'}</p>
        <button
          onClick={() => navigate('/display')}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          Retour
        </button>
      </div>
    );
  }

  // Video playback mode
  if (showVideo && videoUrl) {
    return (
      <div ref={containerRef} className="w-screen h-screen bg-black relative">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onEnded={handleVideoEnded}
        />
        {videoMuted && (
          <button
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = false;
                setVideoMuted(false);
              }
            }}
            className="absolute bottom-8 right-8 px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full transition-all flex items-center gap-2 text-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            Activer le son
          </button>
        )}
      </div>
    );
  }

  // Template display mode (or idle waiting)
  // Use session template if available, otherwise a basic fallback
  const fallbackTemplate = {
    name: 'Waiting Screen',
    template_type: 'movie_info',
    layout: {
      components: [
        ...(session.movie?.poster_url
          ? [{ type: 'backdrop', opacity: 0.15, blur: 30 }]
          : []),
        { type: 'poster', position: 'center', size: 'large' },
        { type: 'title' },
      ],
    },
    config: {},
  };

  const template = currentTemplate || session.template || fallbackTemplate;

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen bg-black overflow-hidden relative"
    >
      {/* Template content */}
      <TemplateRenderer
        template={template}
        data={{
          movie: session.movie || undefined,
          session: {
            name: session.session_name,
            status: session.session_status,
          },
          palette: session.color_palette || undefined,
        }}
      />

      {/* Idle overlay when not running */}
      {session.session_status !== 'running' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-2">
              {session.session_name}
            </h2>
            {session.movie && (
              <p className="text-white/60 text-lg mb-8">{session.movie.title}</p>
            )}
            <p className="text-white/40 text-sm mb-6 uppercase tracking-widest">
              {session.session_status === 'draft'
                ? 'En attente du lancement...'
                : session.session_status === 'scheduled'
                  ? 'Session programmee...'
                  : session.session_status === 'paused'
                    ? 'Session en pause'
                    : session.session_status === 'completed'
                      ? 'Session terminee'
                      : `Status: ${session.session_status}`}
            </p>

            {/* Fullscreen button */}
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all duration-300 hover:scale-105"
              >
                Passer en plein ecran
              </button>
            )}
          </div>

          {/* Code display */}
          <div className="absolute bottom-8 flex flex-col items-center">
            <span className="text-white/20 text-xs uppercase tracking-widest mb-1">
              Code
            </span>
            <span className="text-white/40 font-mono text-lg tracking-[0.3em]">
              {session.display_code}
            </span>
          </div>
        </div>
      )}

      {/* Connection indicator */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full z-20">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          }`}
        />
        <span className="text-white/50 text-xs">
          {isConnected ? 'Connecte' : 'Connexion...'}
        </span>
        {audioEngine.isPlaying && (
          <span className="text-blue-400/60 text-xs ml-1">&#9835;</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { CodeInput as DisplayCodeInput, SessionDisplay };
