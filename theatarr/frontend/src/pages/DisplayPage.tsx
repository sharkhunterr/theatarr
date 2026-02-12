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
  block_id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DisplayLayer {
  id: string;
  template: any;
  zIndex: number;
  expiresAt?: number; // JS timestamp (ms) — layer auto-removed after this
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
  const [displayLayers, setDisplayLayers] = useState<DisplayLayer[]>([]);
  const currentBlockIdRef = useRef<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [sequenceDurationMs, setSequenceDurationMs] = useState<number | null>(null);
  const [sequenceStartedAt, setSequenceStartedAt] = useState<number | null>(null);

  // Quiz display state
  interface QuizDisplayInfo {
    quiz_session_id: string;
    name: string;
    status: string;
    phase: string;
    current_question_index: number;
    total_questions: number;
    current_question?: {
      text: string;
      choices: string[];
      time_limit_seconds?: number;
      hint?: string;
      allow_multiple?: boolean;
    };
    correct_indices?: number[];
    time_remaining_seconds?: number;
    participants: Array<{ name: string; score: number; has_answered_current: boolean }>;
    scoreboard: Array<{ name: string; score: number; avg_response_time_ms: number }>;
    answer_distribution?: Record<number, number>;
    join_url?: string;
    join_code?: string;
  }
  const [quizState, setQuizState] = useState<QuizDisplayInfo | null>(null);
  const quizTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quizSubscribedRef = useRef<string | null>(null);

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

  // -------------------------------------------------------
  // Action handlers — stored in refs to avoid stale closures
  // -------------------------------------------------------

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
    (command: string, params: Record<string, unknown>, blockId?: string) => {
      // Capture sequence timing for countdown support (universal, all template types)
      if (params.sequence_duration_ms) {
        setSequenceDurationMs(params.sequence_duration_ms as number);
        setSequenceStartedAt(
          params.sequence_started_at
            ? new Date(params.sequence_started_at as string).getTime()
            : Date.now()
        );
      } else {
        setSequenceDurationMs(null);
        setSequenceStartedAt(null);
      }

      switch (command) {
        case 'show': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let template: any = null;
          const contentType = params.content_type as string | undefined;
          if (contentType === 'waiting_screen' && params.layout) {
            template = {
              name: (params.template_name as string) || 'Waiting Screen',
              template_type: 'waiting_screen',
              layout: params.layout,
              config: params.config,
            };
          } else if (contentType === 'waiting_screen') {
            template = session?.template || null;
          } else if (contentType === 'quiz') {
            // Quiz display action — show quiz template and subscribe to quiz WS
            const quizSessionId = params.quiz_session_id as string;
            template = {
              name: (params.template_name as string) || 'Quiz',
              template_type: 'quiz',
              layout: params.layout || { style: 'quiz-classic', components: [] },
              config: params.config || {},
            };
            if (quizSessionId) {
              // Use full quiz state from engine broadcast if available
              const qds = params.quiz_display_state as Record<string, unknown> | undefined;
              if (qds) {
                setQuizState({
                  quiz_session_id: (qds.quiz_session_id as string) || quizSessionId,
                  name: (qds.name as string) || 'Quiz',
                  status: (qds.status as string) || 'active',
                  phase: (qds.phase as string) || 'waiting',
                  current_question_index: (qds.current_question_index as number) ?? -1,
                  total_questions: (qds.total_questions as number) || 0,
                  current_question: qds.current_question as QuizDisplayInfo['current_question'],
                  time_remaining_seconds: qds.time_remaining_seconds as number | undefined,
                  participants: (qds.participants as QuizDisplayInfo['participants']) || [],
                  scoreboard: (qds.scoreboard as QuizDisplayInfo['scoreboard']) || [],
                  answer_distribution: qds.answer_distribution as Record<number, number> | undefined,
                  join_url: qds.join_url as string | undefined,
                  join_code: qds.join_code as string | undefined,
                });
              } else {
                // Fallback: initialize with partial data from action parameters
                setQuizState({
                  quiz_session_id: quizSessionId,
                  name: (params.quiz_name as string) || 'Quiz',
                  status: 'open',
                  phase: 'waiting',
                  current_question_index: -1,
                  total_questions: (params.total_questions as number) || 0,
                  participants: [],
                  scoreboard: [],
                  join_url: params.join_url as string | undefined,
                });
              }
              // Subscribe to quiz WS channel
              if (quizSubscribedRef.current !== quizSessionId) {
                send({ type: 'subscribe_quiz', payload: { quiz_session_id: quizSessionId } });
                quizSubscribedRef.current = quizSessionId;
              }
            }
          } else if (contentType === 'text' && params.content) {
            // Convert position_h + position_v into combined position for TemplateRenderer
            const posH = (params.position_h as string) || 'center';
            const posV = (params.position_v as string) || 'center';
            let computedPosition = (params.position as string) || 'center';
            let computedX = params.position_x as number | undefined;
            let computedY = params.position_y as number | undefined;

            if (params.position_h !== undefined || params.position_v !== undefined) {
              // New format: derive combined position from H/V
              if (posH === 'custom' || posV === 'custom') {
                computedPosition = 'custom';
                const hMap: Record<string, number> = { left: 5, center: 50, right: 95 };
                const vMap: Record<string, number> = { top: 5, center: 50, bottom: 95 };
                computedX = posH === 'custom' ? (params.position_x as number ?? 50) : hMap[posH] ?? 50;
                computedY = posV === 'custom' ? (params.position_y as number ?? 50) : vMap[posV] ?? 50;
              } else if (posH === 'center' && posV === 'center') {
                computedPosition = 'center';
              } else if (posH === 'center' && posV === 'top') {
                computedPosition = 'top';
              } else if (posH === 'center' && posV === 'bottom') {
                computedPosition = 'bottom';
              } else if (posH === 'left' && posV === 'center') {
                computedPosition = 'left';
              } else if (posH === 'right' && posV === 'center') {
                computedPosition = 'right';
              } else if (posH === 'left' && posV === 'top') {
                computedPosition = 'top-left';
              } else if (posH === 'right' && posV === 'top') {
                computedPosition = 'top-right';
              } else if (posH === 'left' && posV === 'bottom') {
                computedPosition = 'bottom-left';
              } else if (posH === 'right' && posV === 'bottom') {
                computedPosition = 'bottom-right';
              }
            }

            // Text overlay — render as a waiting_screen with a single custom_text component
            template = {
              name: 'Text Overlay',
              template_type: 'waiting_screen',
              layout: {
                components: [
                  {
                    type: 'custom_text',
                    text: params.content as string,
                    position: computedPosition,
                    position_x: computedX,
                    position_y: computedY,
                    style: (params.style as string) || 'subtitle',
                    font_family: params.font_family as string | undefined,
                    font_size: params.font_size as number | undefined,
                    font_weight: params.font_weight as string | undefined,
                    text_color: params.text_color as string | undefined,
                    animation: params.animation as string | undefined,
                    animation_speed: params.animation_speed as number | undefined,
                  },
                ],
              },
              config: { transparent_bg: true },
            };
          } else if (contentType === 'image' && params.image_url) {
            // Image overlay
            template = {
              name: 'Image Overlay',
              template_type: 'waiting_screen',
              layout: {
                components: [
                  {
                    type: 'backdrop',
                    url: params.image_url as string,
                    opacity: (params.opacity as number) ?? 1,
                  },
                ],
              },
              config: {},
            };
          } else if (params.template_id || params.layout) {
            template = {
              name: (params.template_name as string) || 'Display Template',
              template_type: (params.template_type as string) || 'movie_info',
              layout: params.layout,
              config: params.config,
            };
          }

          if (template) {
            // Per-action duration: if action_duration_ms < sequence_duration_ms, layer auto-expires
            const actionDurationMs = params.action_duration_ms as number | undefined;
            const seqDurationMs = params.sequence_duration_ms as number | undefined;
            const expiresAt = (actionDurationMs && seqDurationMs && actionDurationMs < seqDurationMs)
              ? Date.now() + actionDurationMs
              : undefined;

            const newLayer: DisplayLayer = {
              id: Math.random().toString(36).slice(2) + Date.now().toString(36),
              template,
              zIndex: 0,
              expiresAt,
            };

            if (blockId && blockId === currentBlockIdRef.current) {
              // Same block: add as overlay layer
              setDisplayLayers(prev => {
                const layer = { ...newLayer, zIndex: prev.length };
                return [...prev, layer];
              });
            } else {
              // New block or no block: clear all, start fresh
              currentBlockIdRef.current = blockId || null;
              setDisplayLayers([newLayer]);
            }
            setShowVideo(false);
          }
          break;
        }
        case 'blank':
        case 'black':
          setDisplayLayers([]);
          currentBlockIdRef.current = null;
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
            setDisplayLayers([]);
            currentBlockIdRef.current = null;
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

  // Use refs so that onMessage always calls the latest handlers (no stale closures)
  const handleDisplayActionRef = useRef(handleDisplayAction);
  handleDisplayActionRef.current = handleDisplayAction;
  const handleAudioActionRef = useRef(handleAudioAction);
  handleAudioActionRef.current = handleAudioAction;
  const handleMediaActionRef = useRef(handleMediaAction);
  handleMediaActionRef.current = handleMediaAction;

  // Handle WebSocket action messages (uses refs to always call latest handlers)
  const handleAction = useCallback(
    (payload: ActionPayload) => {
      const { action_type, command, parameters, block_id } = payload;

      switch (action_type) {
        case 'audio':
          handleAudioActionRef.current(command, parameters);
          break;
        case 'display':
          handleDisplayActionRef.current(command, parameters, block_id);
          break;
        case 'media':
          handleMediaActionRef.current(command, parameters);
          break;
        default:
          console.log('Unknown action type:', action_type, command, parameters);
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
              setDisplayLayers([]);
              currentBlockIdRef.current = null;
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
          handleDisplayActionRef.current(command, parameters, payload.block_id);
          break;
        default:
          console.log('Replay: unknown action type:', action_type, command);
      }
    },
    [audioEngine]
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
        // But don't override terminal statuses (completed/interrupted)
        setSession((prev) =>
          prev && prev.session_status !== 'running'
            && prev.session_status !== 'completed'
            && prev.session_status !== 'interrupted'
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

      // Quiz WS events
      else if (message.type === 'quiz_started' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        setQuizState(prev => prev ? {
          ...prev,
          status: 'active',
          phase: 'question',
          total_questions: (p.total_questions as number) || prev.total_questions,
        } : prev);
      }
      else if (message.type === 'quiz_question' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        const q = p.question as Record<string, unknown> | undefined;
        setQuizState(prev => prev ? {
          ...prev,
          phase: 'question',
          current_question_index: (p.question_index as number) ?? prev.current_question_index,
          current_question: q ? {
            text: (q.text as string) || '',
            choices: (q.choices as string[]) || [],
            time_limit_seconds: q.time_limit_seconds as number | undefined,
            hint: q.hint as string | undefined,
            allow_multiple: q.allow_multiple as boolean | undefined,
          } : undefined,
          correct_indices: undefined,
          answer_distribution: undefined,
          time_remaining_seconds: q?.time_limit_seconds as number | undefined,
          total_questions: (p.total_questions as number) || prev.total_questions,
          participants: prev.participants.map(pp => ({ ...pp, has_answered_current: false })),
        } : prev);
      }
      else if (message.type === 'quiz_answer_submitted' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        const stats = p.stats as Record<string, unknown> | undefined;
        setQuizState(prev => {
          if (!prev) return prev;
          // Update answer distribution if provided
          const newDist = stats?.answer_distribution as Record<number, number> | undefined;
          return {
            ...prev,
            answer_distribution: newDist || prev.answer_distribution,
          };
        });
      }
      else if (message.type === 'quiz_question_results' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        setQuizState(prev => prev ? {
          ...prev,
          phase: 'feedback',
          correct_indices: (p.correct_indices as number[]) || undefined,
        } : prev);
      }
      else if (message.type === 'quiz_ended' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        // Map scoreboard entries: backend sends participant_name, frontend expects name
        const rawScoreboard = p.scoreboard as Array<Record<string, unknown>> | undefined;
        const mappedScoreboard = rawScoreboard?.map(entry => ({
          name: (entry.name as string) || (entry.participant_name as string) || 'Anonymous',
          score: (entry.score as number) || 0,
          avg_response_time_ms: (entry.avg_response_time_ms as number) || 0,
        }));
        setQuizState(prev => prev ? {
          ...prev,
          status: 'completed',
          phase: 'podium',
          scoreboard: mappedScoreboard || prev.scoreboard,
        } : prev);
      }
      else if (message.type === 'quiz_participant_joined' && message.payload) {
        const p = message.payload as Record<string, unknown>;
        setQuizState(prev => {
          if (!prev) return prev;
          const name = (p.participant_name as string) || 'Anonyme';
          return {
            ...prev,
            participants: [...prev.participants, { name, score: 0, has_answered_current: false }],
          };
        });
      }
    },
  });

  // Re-subscribe on reconnect (display + quiz channels)
  useEffect(() => {
    if (isConnected && session?.session_id) {
      send({
        type: 'subscribe_display',
        payload: { session_id: session.session_id },
      });
      // Re-subscribe quiz channel if active
      if (quizSubscribedRef.current) {
        send({
          type: 'subscribe_quiz',
          payload: { quiz_session_id: quizSubscribedRef.current },
        });
      }
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
      setDisplayLayers([]);
      currentBlockIdRef.current = null;
      audioEngine.stop(0);
    } else if (status === 'running' && prev === 'paused') {
      if (video && video.paused && showVideo) {
        video.play().catch(() => {});
      }
      audioEngine.resume();
    }
  }, [session?.session_status, showVideo, audioEngine]);

  // Auto-remove expired display layers (per-action duration)
  useEffect(() => {
    const hasExpiring = displayLayers.some(l => l.expiresAt);
    if (!hasExpiring) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setDisplayLayers(prev => {
        const filtered = prev.filter(l => !l.expiresAt || l.expiresAt > now);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [displayLayers]);

  // Quiz timer countdown — decrement time_remaining_seconds every second during "question" phase
  useEffect(() => {
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current);
      quizTimerRef.current = null;
    }

    if (quizState?.phase === 'question' && quizState.time_remaining_seconds && quizState.time_remaining_seconds > 0) {
      quizTimerRef.current = setInterval(() => {
        setQuizState(prev => {
          if (!prev || prev.phase !== 'question' || !prev.time_remaining_seconds) return prev;
          const next = Math.max(0, prev.time_remaining_seconds - 1);
          if (next <= 0) {
            // Timer expired — clear interval
            if (quizTimerRef.current) {
              clearInterval(quizTimerRef.current);
              quizTimerRef.current = null;
            }
          }
          return { ...prev, time_remaining_seconds: next };
        });
      }, 1000);
    }

    return () => {
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current);
        quizTimerRef.current = null;
      }
    };
  }, [quizState?.phase, quizState?.current_question_index]);

  // Clean up quiz state when session ends
  useEffect(() => {
    if (session?.session_status === 'completed' || session?.session_status === 'interrupted') {
      setQuizState(null);
      quizSubscribedRef.current = null;
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current);
        quizTimerRef.current = null;
      }
    }
  }, [session?.session_status]);

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

  // Template data for TemplateRenderer
  const templateData = {
    movie: session.movie || undefined,
    session: {
      name: session.session_name,
      status: session.session_status,
      current_sequence_duration_ms: sequenceDurationMs ?? undefined,
      current_sequence_started_at: sequenceStartedAt ?? undefined,
    },
    palette: session.color_palette || undefined,
    quiz_info: quizState || undefined,
  };

  // Before session starts or after it ends: simple black screen with status text.
  // Active display layers only shown when the engine has broadcast actions.
  const isIdle = session.session_status !== 'running' && displayLayers.length === 0;

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen bg-black overflow-hidden relative"
    >
      {/* Template layers (only when the engine has sent display actions) */}
      {displayLayers.map((layer) => (
        <div key={layer.id} className="absolute inset-0" style={{ zIndex: layer.zIndex }}>
          <TemplateRenderer
            template={layer.template}
            data={templateData}
          />
        </div>
      ))}

      {/* Idle screen: simple black + session info */}
      {isIdle && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="text-center">
            <p className="text-white/30 text-sm uppercase tracking-widest mb-2">
              {session.session_status === 'draft'
                ? 'En attente du lancement'
                : session.session_status === 'scheduled'
                  ? 'Session programmee'
                  : session.session_status === 'paused'
                    ? 'Session en pause'
                    : session.session_status === 'completed'
                      ? 'Session terminee'
                      : ''}
            </p>
            <h2 className="text-2xl font-semibold text-white/50">
              {session.session_name}
            </h2>

            {/* Fullscreen button */}
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all duration-300 hover:scale-105"
              >
                Passer en plein ecran
              </button>
            )}
          </div>
        </div>
      )}

      {/* Paused overlay on top of display layers */}
      {session.session_status === 'paused' && displayLayers.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <p className="text-white/60 text-lg uppercase tracking-widest">
            Session en pause
          </p>
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
