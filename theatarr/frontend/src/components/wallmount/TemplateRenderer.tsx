import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { MovieInfo } from './MovieInfo';
import { CountdownTimer } from './CountdownTimer';
import { formatCountdownShort } from '../../utils/countdown';

// CSS keyframes for animations
const animationStyles = `
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-33.33%); }
}
@keyframes blink {
  0%, 50%, 100% { opacity: 1; }
  25%, 75% { opacity: 0.3; }
}
@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 10px currentColor); }
  50% { filter: drop-shadow(0 0 25px currentColor); }
}
@keyframes badge-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 20px 10px rgba(239, 68, 68, 0);
  }
}
@keyframes badge-glow {
  0%, 100% {
    box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor;
  }
  50% {
    box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor;
  }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes neon-flicker {
  0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
    text-shadow:
      0 0 4px #fff,
      0 0 11px #fff,
      0 0 19px #fff,
      0 0 40px var(--neon-color, #ff00ff),
      0 0 80px var(--neon-color, #ff00ff),
      0 0 90px var(--neon-color, #ff00ff);
  }
  20%, 24%, 55% {
    text-shadow: none;
  }
}
@keyframes neon-border-pulse {
  0%, 100% {
    box-shadow:
      0 0 5px var(--neon-color, #ff00ff),
      0 0 10px var(--neon-color, #ff00ff),
      0 0 20px var(--neon-color, #ff00ff),
      inset 0 0 10px rgba(255,0,255,0.1);
  }
  50% {
    box-shadow:
      0 0 10px var(--neon-color, #ff00ff),
      0 0 20px var(--neon-color, #ff00ff),
      0 0 40px var(--neon-color, #ff00ff),
      inset 0 0 20px rgba(255,0,255,0.2);
  }
}
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes flip-digit {
  0% { transform: rotateX(0deg); }
  50% { transform: rotateX(-90deg); }
  100% { transform: rotateX(0deg); }
}
@keyframes glass-shimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}
@keyframes spotlight-move {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}
@keyframes ticket-stamp {
  0% { transform: scale(0) rotate(-30deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(-15deg); opacity: 1; }
  100% { transform: scale(1) rotate(-15deg); opacity: 1; }
}
@keyframes dust-particle {
  0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
}
@keyframes gold-shine {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes scroll-left {
  0% { transform: translateX(100vw); }
  100% { transform: translateX(-100%); }
}
@keyframes scroll-right {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100vw); }
}
@keyframes scroll-up {
  0% { transform: translateY(100vh); }
  100% { transform: translateY(-100%); }
}
@keyframes scroll-down {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes fade-in-text {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes fade-out-text {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes rotate-text {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// Helper to resolve dynamic text variables
function resolveDynamicText(
  text: string,
  movie?: { title: string; year?: number; runtime_minutes?: number; rating?: number },
  session?: { name?: string; status?: string },
  countdown_to?: string,
  vote_info?: { total_votes?: number; is_open?: boolean; status?: string },
  mystery_info?: { reveal_at: string | null; is_revealed: boolean; selection_mode: string }
): string {
  if (!text) return '';

  let resolved = text;

  // Movie variables
  if (movie) {
    resolved = resolved.replace(/\{\{movie\.title\}\}/g, movie.title || '');
    resolved = resolved.replace(/\{\{movie\.year\}\}/g, String(movie.year || ''));
    resolved = resolved.replace(/\{\{movie\.rating\}\}/g, movie.rating ? movie.rating.toFixed(1) : '');
    resolved = resolved.replace(/\{\{runtime\}\}/g, movie.runtime_minutes
      ? `${Math.floor(movie.runtime_minutes / 60)}h${movie.runtime_minutes % 60}m`
      : '');
    resolved = resolved.replace(/\{\{rating\}\}/g, movie.rating ? movie.rating.toFixed(1) : '');
  }

  // Session variables
  if (session) {
    resolved = resolved.replace(/\{\{session\.name\}\}/g, session.name || '');
    resolved = resolved.replace(/\{\{session\.status\}\}/g, session.status || '');
  }

  // Time variables
  if (countdown_to) {
    resolved = resolved.replace(/\{\{countdown_short\}\}/g, formatCountdownShort(countdown_to));
    const targetDate = new Date(countdown_to);
    resolved = resolved.replace(/\{\{date\}\}/g, targetDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    resolved = resolved.replace(/\{\{date_full\}\}/g, targetDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    resolved = resolved.replace(/\{\{time\}\}/g, targetDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }

  // Mystery variables
  if (mystery_info) {
    if (mystery_info.reveal_at && !mystery_info.is_revealed) {
      resolved = resolved.replace(/\{\{mystery_countdown\}\}/g, formatCountdownShort(mystery_info.reveal_at));
      resolved = resolved.replace(/\{\{mystery_status\}\}/g, 'Film mystere');
    } else if (mystery_info.is_revealed) {
      resolved = resolved.replace(/\{\{mystery_countdown\}\}/g, '');
      resolved = resolved.replace(/\{\{mystery_status\}\}/g, 'Film revele');
    } else {
      resolved = resolved.replace(/\{\{mystery_countdown\}\}/g, '');
      resolved = resolved.replace(/\{\{mystery_status\}\}/g, 'Film mystere');
    }
  } else {
    resolved = resolved.replace(/\{\{mystery_countdown\}\}/g, '');
    resolved = resolved.replace(/\{\{mystery_status\}\}/g, '');
  }

  // Status text for dynamic badge
  if (mystery_info && !mystery_info.is_revealed) {
    resolved = resolved.replace(/\{\{status_text\}\}/g, 'Film mystere');
  } else if (mystery_info?.is_revealed && movie) {
    resolved = resolved.replace(/\{\{status_text\}\}/g, 'Film revele');
  } else if (vote_info) {
    let statusText = 'A venir';
    if (vote_info.is_open) statusText = 'Vote en cours';
    else if (vote_info.status === 'closed') statusText = 'Film choisi';
    else if (session?.status === 'running') statusText = 'En cours';
    else if (session?.status === 'scheduled') statusText = 'Prochainement';
    resolved = resolved.replace(/\{\{status_text\}\}/g, statusText);
  } else {
    resolved = resolved.replace(/\{\{status_text\}\}/g, session?.status === 'scheduled' ? 'Prochainement' : 'A venir');
  }

  return resolved;
}

// Helper to get badge color based on status
function getBadgeColor(
  config: any,
  vote_info?: { is_open?: boolean; status?: string },
  session_status?: string,
  palette?: { vibrant?: string; accent?: string; primary?: string },
  mystery_info?: { is_revealed: boolean }
): string {
  const badgeConfig = config?.badge;
  if (!badgeConfig) return mystery_info && !mystery_info.is_revealed ? '#8b5cf6' : palette?.vibrant || '#ef4444';

  // Check for dynamic colors
  if (badgeConfig.colors) {
    if (mystery_info && !mystery_info.is_revealed) return badgeConfig.colors.mystery || '#8b5cf6';
    if (mystery_info?.is_revealed) return badgeConfig.colors.mystery_revealed || '#22c55e';
    if (vote_info?.is_open) return badgeConfig.colors.vote_open || '#f59e0b';
    if (vote_info?.status === 'closed') return badgeConfig.colors.vote_closed || '#22c55e';
    if (session_status === 'running') return badgeConfig.colors.running || '#ef4444';
    if (session_status === 'scheduled') return badgeConfig.colors.scheduled || '#6366f1';
    return badgeConfig.colors.default || '#6b7280';
  }

  // Resolve palette references
  let color = badgeConfig.color || '#ef4444';
  if (color === 'palette.vibrant') return palette?.vibrant || '#ef4444';
  if (color === 'palette.accent') return palette?.accent || '#6366f1';
  if (color === 'palette.primary') return palette?.primary || '#6366f1';

  return color;
}

interface TemplateLayout {
  components: Array<{
    type: string;
    position?: string;
    size?: string;
    opacity?: number;
    blur?: number;
    fields?: string[];
    limit?: number;
    max_lines?: number;
    format?: string;
    text?: string;
    speed?: string;
    animation?: string;
    gradient?: string;
    shadow?: boolean;
    weight?: string;
    style?: string;
  }>;
}

interface BadgeConfig {
  text?: string;
  show_when?: 'always' | 'scheduled' | 'running' | 'countdown_under_24h' | 'never';
  fallback_text?: string;
  style?: 'pulse' | 'glow' | 'shimmer' | 'neon' | 'solid' | 'outline' | 'gradient' | 'glass-pill' | 'gold-ribbon' | 'stamp' | 'status-badge' | 'pill-animated' | 'gradient-border';
  color?: string;
  colors?: Record<string, string>;
  dynamic_texts?: Record<string, string>;
  rotation?: number;
}

interface CustomText {
  text: string;
  position: string;
  position_x?: number;
  position_y?: number;
  style?: string;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  text_color?: string;
  animation?: string;
  animation_speed?: number;
}

interface TemplateConfig {
  show_seconds?: boolean;
  animate_numbers?: boolean;
  use_palette_colors?: boolean;
  show_rating?: boolean;
  show_genres?: boolean;
  animate_entry?: boolean;
  show_elapsed_time?: boolean;
  show_remaining_time?: boolean;
  marquee_speed?: number;
  blink_interval?: number;
  show_particles?: boolean;
  enable_glow_effects?: boolean;
  font_style?: string;
  gradient_direction?: string;
  gradient_opacity?: number;
  font_family?: string;
  text_shadow?: boolean;
  card_style?: string;
  show_logo?: boolean;
  // New dynamic props
  theme?: 'dark' | 'light' | 'neon' | 'elegant' | 'retro' | 'glass' | 'ticket' | 'minimal' | 'dynamic' | 'board' | 'social' | 'dramatic';
  badge?: BadgeConfig;
  custom_texts?: CustomText[];
  neon_color?: string;
  secondary_neon?: string;
  accent_color?: string;
  background_color?: string;
  text_color?: string;
  show_grid?: boolean;
  scanlines?: boolean;
  glass_blur?: number;
  glass_opacity?: number;
  show_vote_info?: boolean;
  show_participant_count?: boolean;
  // Alternative images
  backdrop_index?: number;
  poster_index?: number;
  rotate_backdrops?: boolean;
  rotate_interval?: number;
  rotate_posters?: boolean;
  poster_rotate_interval?: number;
  use_logo_image?: boolean;
  // Enrichment display
  show_enrichment_sources?: boolean;
  show_studios?: boolean;
  show_original_title?: boolean;
  show_overview?: boolean;
  cast_scroll?: boolean;
  transparent_bg?: boolean;
}

interface TemplateRendererProps {
  template: {
    name: string;
    template_type: string;
    content?: string;
    styles?: string;
    script?: string;
    layout?: TemplateLayout;
    config?: TemplateConfig;
  };
  data: {
    movie?: {
      title: string;
      year?: number;
      runtime_minutes?: number;
      overview?: string;
      tagline?: string;
      poster_url?: string;
      backdrop_url?: string;
      extra_backdrops?: string[];
      extra_posters?: string[];
      logos?: string[];
      rating?: number;
      genres?: string[];
      directors?: string[];
      cast?: string[];
      studios?: string[];
      original_title?: string;
      enrichment_sources?: string[];
      keywords?: string[];
      vote_count?: number;
    };
    session?: {
      name?: string;
      status?: string;
      current_sequence_index?: number;
      total_sequences?: number;
      current_sequence_name?: string;
      current_sequence_elapsed_ms?: number;
      current_sequence_duration_ms?: number;
      current_sequence_started_at?: number; // JS timestamp (ms) for live countdown
    };
    countdown_to?: string;
    palette?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      text?: string;
      vibrant?: string;
      css_vars?: Record<string, string>;
    };
    vote_info?: {
      total_votes?: number;
      is_open?: boolean;
      status?: string;
      winning_movie_index?: number;
      closes_at?: string;
      close_when_all_voted?: boolean;
      total_tokens?: number;
      vote_counts?: Record<number, number>;
      movie_options?: Array<{ title: string; poster_url?: string; year?: number }>;
      vote_reveal_at?: string;
      show_results_during_voting?: boolean;
    };
    mystery_info?: {
      reveal_at: string | null;
      is_revealed: boolean;
      selection_mode: string;
    };
    quiz_info?: {
      quiz_session_id: string;
      name: string;
      status: string;
      phase: string; // waiting | question | feedback | results | podium
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
    };
    session_overview?: {
      participants_accepted: number;
      participants_total: number;
      sequences: Array<{
        name: string;
        order_index: number;
        duration_ms: number;
        duration_type: string;
        actions: Array<{
          action_type: string;
          command: string;
          label: string;
          icon: string;
          details: Record<string, unknown>;
        }>;
      }>;
      total_duration_ms: number;
      estimated_end_time: string;
      current_sequence_index: number;
    };
    feedback_info?: {
      session_id: string;
      session_name: string;
      movie_title: string | null;
      movie_poster_url: string | null;
      action_types: string[];
      feedback_url: string;
    };
  };
}

export function TemplateRenderer({ template, data }: TemplateRendererProps) {
  const { layout, config } = template;
  const { movie, session, countdown_to, palette, vote_info, mystery_info, quiz_info, session_overview, feedback_info } = data;

  // Apply CSS variables from palette
  const cssVars = useMemo(() => {
    if (!palette?.css_vars) return {};
    return palette.css_vars;
  }, [palette]);

  // Resolve effective backdrop from config (static index or rotation)
  const allBackdrops = useMemo(() => {
    const list: string[] = [];
    if (movie?.backdrop_url) list.push(movie.backdrop_url);
    if (movie?.extra_backdrops) list.push(...movie.extra_backdrops);
    return list;
  }, [movie?.backdrop_url, movie?.extra_backdrops]);

  const [rotatingIndex, setRotatingIndex] = useState(0);
  useEffect(() => {
    if (!config?.rotate_backdrops || allBackdrops.length <= 1) return;
    const interval = (config.rotate_interval ?? 30) * 1000;
    const timer = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % allBackdrops.length);
    }, interval);
    return () => clearInterval(timer);
  }, [config?.rotate_backdrops, config?.rotate_interval, allBackdrops.length]);

  const effectiveBackdrop = useMemo(() => {
    if (!movie) return undefined;
    if (config?.rotate_backdrops && allBackdrops.length > 0) {
      return allBackdrops[rotatingIndex % allBackdrops.length];
    }
    if (config?.backdrop_index !== undefined && config.backdrop_index > 0) {
      const altIndex = config.backdrop_index - 1;
      if (movie.extra_backdrops && movie.extra_backdrops[altIndex]) {
        return movie.extra_backdrops[altIndex];
      }
    }
    return movie.backdrop_url || movie.poster_url;
  }, [movie, config?.backdrop_index, config?.rotate_backdrops, allBackdrops, rotatingIndex]);

  const effectivePoster = useMemo(() => {
    if (!movie) return undefined;
    if (config?.poster_index !== undefined && config.poster_index > 0) {
      const altIndex = config.poster_index - 1;
      if (movie.extra_posters && movie.extra_posters[altIndex]) {
        return movie.extra_posters[altIndex];
      }
    }
    return movie.poster_url;
  }, [movie, config?.poster_index]);

  const effectiveLogo = useMemo(() => {
    if (!movie?.logos?.length) return undefined;
    return movie.logos[0];
  }, [movie?.logos]);

  // All posters for rotation
  const allPosters = useMemo(() => {
    const list: string[] = [];
    if (movie?.poster_url) list.push(movie.poster_url);
    if (movie?.extra_posters) list.push(...movie.extra_posters);
    return list;
  }, [movie?.poster_url, movie?.extra_posters]);

  const [posterRotatingIndex, setPosterRotatingIndex] = useState(0);
  useEffect(() => {
    if (!config?.rotate_posters || allPosters.length <= 1) return;
    const interval = (config.poster_rotate_interval ?? 15) * 1000;
    const timer = setInterval(() => {
      setPosterRotatingIndex((prev) => (prev + 1) % allPosters.length);
    }, interval);
    return () => clearInterval(timer);
  }, [config?.rotate_posters, config?.poster_rotate_interval, allPosters.length]);

  // ====================================================================
  // UNIVERSAL SEQUENCE COUNTDOWN — available to all template types
  // ====================================================================
  // Computes remaining seconds from sequence_duration_ms + sequence_started_at.
  // Updated every second. Returns null when no countdown data available.
  const [sequenceRemaining, setSequenceRemaining] = useState<number | null>(null);
  useEffect(() => {
    const durationMs = session?.current_sequence_duration_ms;
    const startedAt = session?.current_sequence_started_at;
    if (!durationMs || !startedAt) {
      setSequenceRemaining(null);
      return;
    }
    const update = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      setSequenceRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session?.current_sequence_duration_ms, session?.current_sequence_started_at]);

  // Format sequence countdown: "5:23" or "45s"
  const formatSeqCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `${s}s`;
  };

  // Progress ratio 0..1 (0 = just started, 1 = done)
  const sequenceProgress = useMemo(() => {
    const durationMs = session?.current_sequence_duration_ms;
    const startedAt = session?.current_sequence_started_at;
    if (!durationMs || !startedAt || sequenceRemaining === null) return null;
    const elapsed = durationMs / 1000 - sequenceRemaining;
    return Math.min(1, Math.max(0, elapsed / (durationMs / 1000)));
  }, [session?.current_sequence_duration_ms, session?.current_sequence_started_at, sequenceRemaining]);

  const renderComponent = (component: TemplateLayout['components'][0], index: number) => {
    switch (component.type) {
      case 'backdrop':
        if (!effectiveBackdrop && !movie?.poster_url) return null;
        const bgImage = effectiveBackdrop || movie?.poster_url;
        return (
          <div key={index} className="absolute inset-0">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${bgImage})`,
                opacity: component.opacity ?? 0.3,
                filter: component.blur ? `blur(${component.blur}px)` : undefined,
              }}
            />
            {/* Gradient overlay */}
            {component.gradient && (
              <div
                className="absolute inset-0"
                style={{
                  background: component.gradient === 'left-to-right'
                    ? `linear-gradient(to right, ${palette?.background || '#0a0a0f'}ee 0%, ${palette?.background || '#0a0a0f'}99 40%, transparent 100%)`
                    : component.gradient === 'right-to-left'
                      ? `linear-gradient(to left, ${palette?.background || '#0a0a0f'}ee 0%, ${palette?.background || '#0a0a0f'}99 40%, transparent 100%)`
                      : `linear-gradient(to top, ${palette?.background || '#0a0a0f'}ee 0%, transparent 50%, ${palette?.background || '#0a0a0f'}cc 100%)`,
                }}
              />
            )}
          </div>
        );

      case 'poster': {
        const isMysteryHidden = mystery_info && !mystery_info.is_revealed;
        const sizeClass = component.size === 'large' ? 'w-80' :
          component.size === 'small' ? 'w-48' :
          component.size === 'full-height' ? 'h-full w-auto max-w-[45vw] object-contain' :
          'w-64';

        if (isMysteryHidden) {
          return (
            <div
              key={index}
              className={`flex-shrink-0 ${
                component.position === 'left' ? 'order-first' :
                component.position === 'right' ? 'order-last' :
                component.position === 'center' ? 'mx-auto' : ''
              } ${component.size === 'full-height' ? 'h-full flex items-center' : ''}`}
            >
              <div
                className={`rounded-lg ${sizeClass} flex items-center justify-center`}
                style={{
                  aspectRatio: component.size === 'full-height' ? undefined : '2/3',
                  background: `linear-gradient(135deg, ${palette?.primary || '#1a1a2e'}, ${palette?.accent || '#8b5cf6'}40)`,
                  border: `2px solid ${palette?.accent || '#8b5cf6'}60`,
                  boxShadow: `0 0 30px ${palette?.accent || '#8b5cf6'}20`,
                }}
              >
                <span
                  className="text-8xl font-bold"
                  style={{
                    color: palette?.accent || '#8b5cf6',
                    textShadow: `0 0 20px ${palette?.accent || '#8b5cf6'}80`,
                    animation: 'pulse-glow 2s ease-in-out infinite',
                  }}
                >
                  ?
                </span>
              </div>
            </div>
          );
        }

        return (effectivePoster || movie?.poster_url) ? (
          <div
            key={index}
            className={`flex-shrink-0 ${
              component.position === 'left' ? 'order-first' :
              component.position === 'right' ? 'order-last' :
              component.position === 'center' ? 'mx-auto' : ''
            } ${component.size === 'full-height' ? 'h-full flex items-center' : ''}`}
          >
            <img
              src={effectivePoster || movie?.poster_url}
              alt={movie?.title || ''}
              className={`rounded-lg ${sizeClass}`}
              style={{
                boxShadow: component.shadow || palette?.primary
                  ? `0 25px 50px -12px ${palette?.primary || '#000000'}60, 0 10px 20px -5px rgba(0,0,0,0.5)`
                  : undefined,
              }}
            />
          </div>
        ) : null;
      }

      case 'countdown':
        return countdown_to ? (
          <div key={index} className="flex items-center justify-center p-8">
            <CountdownTimer
              targetDate={countdown_to}
              palette={palette}
              size="xl"
              showSeconds={config?.show_seconds ?? true}
              animate={config?.animate_numbers ?? true}
            />
          </div>
        ) : null;

      case 'mystery_countdown':
        if (!mystery_info || mystery_info.is_revealed) return null;
        return (
          <div key={index} className="flex flex-col items-center justify-center p-8 gap-4">
            <div className="text-2xl font-bold opacity-80" style={{ color: palette?.accent || '#8b5cf6' }}>
              Film mystere
            </div>
            {mystery_info.reveal_at && (
              <>
                <div className="text-lg opacity-60">Revelation dans</div>
                <CountdownTimer
                  targetDate={mystery_info.reveal_at}
                  palette={{ primary: palette?.accent || '#8b5cf6', accent: palette?.accent, text: palette?.text }}
                  size="xl"
                  showSeconds
                  animate
                />
              </>
            )}
            {!mystery_info.reveal_at && (
              <div className="text-lg opacity-60">Revelation imminente...</div>
            )}
          </div>
        );

      case 'title': {
        const isTitleHidden = mystery_info && !mystery_info.is_revealed;
        if (!movie && !isTitleHidden) return null;
        return (
          <h1
            key={index}
            className={`mb-4 ${
              component.size === 'xlarge' ? 'text-7xl' :
              component.size === 'large' ? 'text-6xl' :
              component.size === 'small' ? 'text-3xl' :
              'text-5xl'
            } ${component.weight === 'bold' ? 'font-bold' : 'font-semibold'}`}
            style={{
              color: isTitleHidden ? palette?.accent || '#8b5cf6' : palette?.text || '#ffffff',
              textShadow: isTitleHidden
                ? `0 0 20px ${palette?.accent || '#8b5cf6'}60`
                : config?.text_shadow ? '0 4px 8px rgba(0,0,0,0.5)' : undefined,
            }}
          >
            {isTitleHidden ? 'Film mystere' : movie!.title}
            {!isTitleHidden && movie?.year && <span className="opacity-60 ml-3">({movie.year})</span>}
          </h1>
        );
      }

      case 'metadata':
        if (mystery_info && !mystery_info.is_revealed) return null;
        return movie ? (
          <div key={index} className="flex items-center gap-6 text-lg opacity-80">
            {movie.year && (
              <span>{movie.year}</span>
            )}
            {movie.runtime_minutes && (
              <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>
            )}
            {config?.show_rating && movie.rating && (
              <span style={{ color: palette?.accent || '#fbbf24' }}>
                ★ {movie.rating.toFixed(1)}
              </span>
            )}
          </div>
        ) : null;

      case 'overview':
        if (mystery_info && !mystery_info.is_revealed) return null;
        return movie?.overview ? (
          <p
            key={index}
            className={`text-lg leading-relaxed opacity-90 ${
              component.max_lines ? `line-clamp-${component.max_lines}` : ''
            }`}
            style={{ color: palette?.text || '#ffffff' }}
          >
            {movie.overview}
          </p>
        ) : null;

      case 'cast':
        if (mystery_info && !mystery_info.is_revealed) return null;
        return movie?.cast && movie.cast.length > 0 ? (
          <div key={index} className="opacity-80">
            <span className="opacity-60">Starring </span>
            <span className="font-semibold">
              {movie.cast.slice(0, component.limit || 5).join(', ')}
            </span>
          </div>
        ) : null;

      case 'session_progress':
        return session ? (
          <div key={index} className="p-6 bg-black/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold">{session.name}</span>
              <span className="opacity-60 capitalize">{session.status}</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    session.total_sequences
                      ? ((session.current_sequence_index || 0) / session.total_sequences) * 100
                      : 0
                  }%`,
                  backgroundColor: palette?.accent || palette?.primary || '#6366f1',
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm opacity-60">
              <span>Sequence {(session.current_sequence_index || 0) + 1} of {session.total_sequences || 0}</span>
              {session.current_sequence_name && (
                <span>{session.current_sequence_name}</span>
              )}
            </div>
          </div>
        ) : null;

      case 'current_sequence':
        return session?.current_sequence_name ? (
          <div key={index} className="text-center p-4">
            <div className="text-sm opacity-60 mb-1">Now Playing</div>
            <div className="text-2xl font-semibold">{session.current_sequence_name}</div>
            {config?.show_elapsed_time && session.current_sequence_elapsed_ms !== undefined && (
              <div className="text-sm opacity-60 mt-1">
                {Math.floor(session.current_sequence_elapsed_ms / 1000)}s
                {session.current_sequence_duration_ms && (
                  <> / {Math.floor(session.current_sequence_duration_ms / 1000)}s</>
                )}
              </div>
            )}
          </div>
        ) : null;

      case 'marquee': {
        const textContent = component.text === 'session_name'
          ? session?.name
          : component.text === 'tagline'
            ? movie?.tagline
            : movie?.title;
        if (!textContent) return null;
        const speed = component.speed === 'slow' ? 30 : component.speed === 'fast' ? 10 : 20;
        return (
          <div
            key={index}
            className={`absolute left-0 right-0 overflow-hidden py-4 ${
              component.position === 'top' ? 'top-0' : 'bottom-0'
            }`}
            style={{
              background: `linear-gradient(to right, ${palette?.background || '#0a0a0f'}dd, transparent 10%, transparent 90%, ${palette?.background || '#0a0a0f'}dd)`,
            }}
          >
            <div
              className="whitespace-nowrap text-2xl font-bold animate-marquee"
              style={{
                color: palette?.accent || palette?.primary || '#ffffff',
                textShadow: config?.enable_glow_effects ? `0 0 20px ${palette?.accent || palette?.primary || '#ffffff'}80` : undefined,
                animation: `marquee ${speed}s linear infinite`,
              }}
            >
              {textContent} &nbsp;&nbsp;&nbsp; {textContent} &nbsp;&nbsp;&nbsp; {textContent}
            </div>
          </div>
        );
      }

      case 'blink': {
        const countdownText = countdown_to ? formatCountdownShort(countdown_to) : '';
        if (!countdownText && component.text === 'countdown_short') return null;
        const displayText = component.text === 'countdown_short' ? countdownText : component.text;
        return (
          <div
            key={index}
            className={`absolute text-xl font-bold animate-pulse ${
              component.position === 'corners'
                ? 'top-4 left-4'
                : component.position === 'top-right'
                  ? 'top-4 right-4'
                  : 'bottom-4 right-4'
            }`}
            style={{
              color: palette?.vibrant || palette?.accent || '#ff0000',
              textShadow: config?.enable_glow_effects ? `0 0 15px ${palette?.vibrant || palette?.accent || '#ff0000'}` : undefined,
              animation: `blink ${(config?.blink_interval || 1000) / 1000}s ease-in-out infinite`,
            }}
          >
            {displayText}
          </div>
        );
      }

      case 'tagline':
        return movie?.tagline ? (
          <p
            key={index}
            className={`text-xl opacity-80 ${component.style === 'italic' ? 'italic' : ''}`}
            style={{
              color: palette?.secondary || palette?.text || '#ffffff',
              textShadow: config?.text_shadow ? '0 2px 4px rgba(0,0,0,0.5)' : undefined,
            }}
          >
            "{movie.tagline}"
          </p>
        ) : null;

      case 'session_info':
        return session ? (
          <div
            key={index}
            className={`absolute ${
              component.position === 'top-left' ? 'top-4 left-4' : 'top-4 right-4'
            } bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2`}
          >
            {component.fields?.includes('name') && session.name && (
              <div className="text-lg font-semibold">{session.name}</div>
            )}
            {component.fields?.includes('scheduled_at') && countdown_to && (
              <div className="text-sm opacity-70">
                {new Date(countdown_to).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        ) : null;

      case 'logo':
        if (!effectiveLogo && !(config?.use_logo_image && movie?.logos?.length)) return null;
        const logoUrl = effectiveLogo;
        if (!logoUrl) return null;
        return (
          <div key={index} className={`${
            component.position === 'top-left' ? 'absolute top-4 left-4' :
            component.position === 'top-right' ? 'absolute top-4 right-4' :
            component.position === 'bottom-left' ? 'absolute bottom-4 left-4' :
            component.position === 'bottom-right' ? 'absolute bottom-4 right-4' :
            'flex justify-center'
          }`}>
            <img
              src={logoUrl}
              alt={`${movie?.title || ''} logo`}
              className={`object-contain drop-shadow-lg ${
                component.size === 'small' ? 'max-w-[150px] max-h-[60px]' :
                component.size === 'large' ? 'max-w-[400px] max-h-[160px]' :
                'max-w-[250px] max-h-[100px]'
              }`}
            />
          </div>
        );

      case 'custom_text': {
        const comp = component as any;
        const textContent = comp.text || '';
        if (!textContent) return null;

        const textPos = comp.position || 'center';
        const textStyle = comp.style || '';
        const fontFamily = comp.font_family as string | undefined;
        const fontSize = comp.font_size as number | undefined;
        const fontWeight = comp.font_weight as string | undefined;
        const textColor = (comp.text_color as string) || palette?.text || '#ffffff';
        const animationType = (comp.animation as string) || 'none';
        const animSpeed = (comp.animation_speed as number) || 10;

        // Position
        let positionStyle: React.CSSProperties = {};
        let posClasses = '';

        if (textPos === 'custom' && comp.position_x !== undefined && comp.position_y !== undefined) {
          positionStyle = {
            position: 'absolute',
            left: `${comp.position_x}%`,
            top: `${comp.position_y}%`,
            transform: 'translate(-50%, -50%)',
          };
        } else {
          posClasses =
            textPos === 'top' ? 'absolute top-8 left-0 right-0 text-center' :
            textPos === 'bottom' ? 'absolute bottom-8 left-0 right-0 text-center' :
            textPos === 'left' ? 'absolute top-0 bottom-0 left-8 flex items-center' :
            textPos === 'right' ? 'absolute top-0 bottom-0 right-8 flex items-center justify-end' :
            textPos === 'top-left' ? 'absolute top-8 left-8' :
            textPos === 'top-right' ? 'absolute top-8 right-8' :
            textPos === 'bottom-left' ? 'absolute bottom-8 left-8' :
            textPos === 'bottom-right' ? 'absolute bottom-8 right-8' :
            'flex items-center justify-center text-center';
        }

        // Typography — use explicit values or fall back to preset style classes
        const typoStyle: React.CSSProperties = {
          color: textColor,
          textShadow: '0 2px 8px rgba(0,0,0,0.6)',
        };
        if (fontFamily) typoStyle.fontFamily = fontFamily;
        if (fontSize) typoStyle.fontSize = `${fontSize}px`;
        if (fontWeight) typoStyle.fontWeight = fontWeight;

        const sizeClass = fontSize ? '' : (
          textStyle === 'title' ? 'text-5xl font-bold' :
          textStyle === 'subtitle' ? 'text-2xl font-medium' :
          textStyle === 'cinema-label' ? 'text-lg uppercase tracking-[0.3em] font-light' :
          textStyle === 'small' ? 'text-sm' :
          'text-xl'
        );

        // Animation
        const animMap: Record<string, string> = {
          'scroll-left': `scroll-left ${animSpeed}s linear infinite`,
          'scroll-right': `scroll-right ${animSpeed}s linear infinite`,
          'scroll-up': `scroll-up ${animSpeed}s linear infinite`,
          'scroll-down': `scroll-down ${animSpeed}s linear infinite`,
          'blink': `blink ${animSpeed}s ease-in-out infinite`,
          'pulse-glow': `pulse-glow ${animSpeed}s ease-in-out infinite`,
          'fade-in': `fade-in-text ${animSpeed}s ease-in forwards`,
          'fade-out': `fade-out-text ${animSpeed}s ease-out forwards`,
          'rotate': `rotate-text ${animSpeed}s linear infinite`,
          'float': `float ${animSpeed}s ease-in-out infinite`,
          'neon-flicker': `neon-flicker ${animSpeed}s ease-in-out infinite`,
          'shimmer': `shimmer ${animSpeed}s linear infinite`,
        };
        if (animationType !== 'none' && animMap[animationType]) {
          typoStyle.animation = animMap[animationType];
        }
        if (animationType === 'shimmer') {
          typoStyle.background = `linear-gradient(90deg, ${textColor} 0%, ${textColor}88 50%, ${textColor} 100%)`;
          typoStyle.backgroundSize = '200% 100%';
          typoStyle.WebkitBackgroundClip = 'text';
          typoStyle.WebkitTextFillColor = 'transparent';
        }

        const needsOverflow = ['scroll-left', 'scroll-right', 'scroll-up', 'scroll-down'].includes(animationType);

        return (
          <div
            key={index}
            className={`z-20 ${posClasses} ${needsOverflow ? 'overflow-hidden' : ''}`}
            style={positionStyle}
          >
            <p
              className={`${sizeClass} whitespace-pre-line`}
              style={typoStyle}
            >
              {textContent}
            </p>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // If template has raw HTML content, render it in sandboxed iframe
  if (template.content) {
    return (
      <CustomHtmlRenderer
        content={template.content}
        styles={template.styles}
        script={template.script}
        data={{ movie, session, countdown_to, palette, vote_info, mystery_info }}
        config={config}
        sequenceRemaining={sequenceRemaining}
        sequenceProgress={sequenceProgress}
        templateName={template.name}
      />
    );
  }

  // Render structured layout based on style
  if (layout?.components) {
    const hasAnimations = layout.components.some(c =>
      c.type === 'marquee' || c.type === 'blink' || c.animation
    );
    const layoutStyle = (layout as any).style || 'default';
    const baseStyles = {
      ...cssVars as React.CSSProperties,
      backgroundColor: config?.transparent_bg ? 'transparent' : (palette?.background || '#0a0a0f'),
      color: palette?.text || '#ffffff',
    };

    // MYSTERY MODE — Show mystery overlay instead of regular template when movie not revealed
    // (skip for templates that handle mystery mode themselves)
    if (mystery_info && !mystery_info.is_revealed && layoutStyle !== 'cinematic-mystery') {
      const mysteryAccent = palette?.accent || '#8b5cf6';
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}</style>
          {/* Subtle animated background */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 50%, ${mysteryAccent}15 0%, transparent 70%)`,
            }}
          />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-8">
            {/* Mystery question mark */}
            <div
              className="w-64 h-96 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${palette?.background || '#1a1a2e'}, ${mysteryAccent}25)`,
                border: `2px solid ${mysteryAccent}50`,
                boxShadow: `0 0 60px ${mysteryAccent}15, inset 0 0 30px ${mysteryAccent}08`,
              }}
            >
              <span
                className="text-[12rem] font-bold leading-none"
                style={{
                  color: mysteryAccent,
                  textShadow: `0 0 40px ${mysteryAccent}60, 0 0 80px ${mysteryAccent}30`,
                  animation: 'pulse-glow 3s ease-in-out infinite',
                }}
              >
                ?
              </span>
            </div>

            {/* Session name */}
            {session?.name && (
              <div className="text-2xl font-light opacity-60">{session.name}</div>
            )}

            {/* Mystery label */}
            <div
              className="text-4xl font-bold tracking-wider"
              style={{ color: mysteryAccent }}
            >
              FILM MYSTERE
            </div>

            {/* Countdown to reveal */}
            {mystery_info.reveal_at && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-lg opacity-50">Revelation dans</div>
                <CountdownTimer
                  targetDate={mystery_info.reveal_at}
                  palette={{ primary: mysteryAccent, accent: palette?.accent, text: palette?.text }}
                  size="xl"
                  showSeconds
                  animate
                />
              </div>
            )}

            {/* Session countdown (start time) */}
            {!mystery_info.reveal_at && countdown_to && (
              <div className="flex flex-col items-center gap-3">
                <div className="text-lg opacity-50">Seance dans</div>
                <CountdownTimer
                  targetDate={countdown_to}
                  palette={palette}
                  size="xl"
                  showSeconds
                  animate
                />
              </div>
            )}

            {/* Badge */}
            <div
              className="px-5 py-2 rounded-full text-sm font-semibold tracking-wide"
              style={{
                backgroundColor: `${mysteryAccent}30`,
                color: mysteryAccent,
                border: `1px solid ${mysteryAccent}50`,
                animation: 'badge-pulse 3s ease-in-out infinite',
              }}
            >
              Film mystere
            </div>
          </div>
        </div>
      );
    }

    // POSTER FULLSCREEN - Full screen poster with overlay (uses backdrop if available, falls back to poster)
    if (layoutStyle === 'poster-fullscreen') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          {hasAnimations && <style>{animationStyles}</style>}
          {/* Full screen poster */}
          {movie?.poster_url && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${movie.poster_url})` }}
            />
          )}
          {/* Gradient overlay at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1/3"
            style={{
              background: `linear-gradient(to top, ${palette?.background || '#0a0a0f'} 0%, transparent 100%)`,
            }}
          />
          {/* Content at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
            {movie && (
              <h1 className="text-5xl md:text-7xl font-bold mb-6" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                {movie.title}
              </h1>
            )}
            {countdown_to && (
              <div className="flex justify-center">
                <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
              </div>
            )}
          </div>
        </div>
      );
    }

    // SPLIT HORIZONTAL - Poster left, info right
    if (layoutStyle === 'split-horizontal') {
      return (
        <div className="relative w-full h-full overflow-hidden flex" style={baseStyles}>
          {hasAnimations && <style>{animationStyles}</style>}
          {/* Left: Poster */}
          <div className="w-[40%] h-full flex items-center justify-center p-8">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="max-h-full max-w-full object-contain rounded-lg"
                style={{ boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}60` }}
              />
            )}
          </div>
          {/* Right: Info */}
          <div className="w-[60%] h-full flex flex-col justify-center p-8 pr-12 overflow-hidden">
            {session?.name && (
              <div className="text-sm uppercase tracking-widest opacity-60 mb-2">{session.name}</div>
            )}
            {movie && (
              <>
                <h1 className="text-4xl md:text-5xl font-bold mb-3">{movie.title}</h1>
                {movie.tagline && <p className="text-lg italic opacity-80 mb-4">"{movie.tagline}"</p>}

                {/* Metadata row: year, runtime, rating, votes */}
                <div className="flex flex-wrap items-center gap-4 text-lg opacity-80 mb-4">
                  {movie.year && <span>{movie.year}</span>}
                  {movie.runtime_minutes && (
                    <>
                      <span className="opacity-40">•</span>
                      <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>
                    </>
                  )}
                  {movie.rating && (
                    <>
                      <span className="opacity-40">•</span>
                      <span style={{ color: palette?.accent || '#fbbf24' }}>★ {movie.rating.toFixed(1)}</span>
                    </>
                  )}
                  {vote_info && vote_info.total_votes !== undefined && vote_info.total_votes > 0 && (
                    <>
                      <span className="opacity-40">•</span>
                      <span className="flex items-center gap-1" style={{ color: palette?.vibrant || palette?.accent || '#22c55e' }}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" />
                        </svg>
                        {vote_info.total_votes} vote{vote_info.total_votes > 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>

                {/* Genres */}
                {movie.genres && movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {movie.genres.slice(0, 4).map((genre, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: `${palette?.primary || '#6366f1'}30`,
                          color: palette?.primary || '#6366f1',
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Director */}
                {movie.directors && movie.directors.length > 0 && (
                  <div className="text-base opacity-80 mb-3">
                    <span className="opacity-60">Réalisé par </span>
                    <span className="font-semibold">{movie.directors.join(', ')}</span>
                  </div>
                )}

                {/* Cast */}
                {movie.cast && movie.cast.length > 0 && (
                  <div className="text-base opacity-80 mb-4">
                    <span className="opacity-60">Avec </span>
                    <span className="font-semibold">{movie.cast.slice(0, 4).join(', ')}</span>
                  </div>
                )}

                {/* Overview */}
                {movie.overview && (
                  <p className="text-base leading-relaxed opacity-80 mb-6 line-clamp-4">
                    {movie.overview}
                  </p>
                )}
              </>
            )}
            {countdown_to && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="text-sm uppercase tracking-widest opacity-60 mb-3">Commence dans</div>
                <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
              </div>
            )}
          </div>
        </div>
      );
    }

    // CINEMA MARQUEE - Animated with scrolling text
    if (layoutStyle === 'cinema-marquee') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}</style>
          {/* Backdrop */}
          {movie?.poster_url && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${movie.poster_url})`, filter: 'blur(20px)' }}
            />
          )}
          {/* Top marquee */}
          <div className="absolute top-0 left-0 right-0 py-4 overflow-hidden bg-black/50">
            <div
              className="whitespace-nowrap text-3xl font-bold"
              style={{
                color: palette?.accent || '#fbbf24',
                textShadow: `0 0 20px ${palette?.accent || '#fbbf24'}`,
                animation: 'marquee 25s linear infinite',
              }}
            >
              {movie?.title || session?.name} &nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp; {movie?.title || session?.name} &nbsp;&nbsp;&nbsp;★&nbsp;&nbsp;&nbsp; {movie?.title || session?.name}
            </div>
          </div>
          {/* Center poster */}
          <div className="absolute inset-0 flex items-center justify-center">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="max-h-[70vh] rounded-lg"
                style={{ boxShadow: `0 0 60px ${palette?.primary || '#6366f1'}40` }}
              />
            )}
          </div>
          {/* Blinking corners */}
          {countdown_to && (
            <>
              <div
                className="absolute top-20 left-8 text-2xl font-bold"
                style={{ color: palette?.vibrant || '#ff0000', animation: 'blink 1s ease-in-out infinite' }}
              >
                {formatCountdownShort(countdown_to)}
              </div>
              <div
                className="absolute top-20 right-8 text-2xl font-bold"
                style={{ color: palette?.vibrant || '#ff0000', animation: 'blink 1s ease-in-out infinite' }}
              >
                {formatCountdownShort(countdown_to)}
              </div>
            </>
          )}
          {/* Bottom marquee */}
          <div className="absolute bottom-0 left-0 right-0 py-4 overflow-hidden bg-black/50">
            <div
              className="whitespace-nowrap text-xl"
              style={{
                color: palette?.text || '#ffffff',
                animation: 'marquee 35s linear infinite',
              }}
            >
              {session?.name || 'Seance Cinema'} &nbsp;&nbsp;&nbsp;🎬&nbsp;&nbsp;&nbsp; {session?.name || 'Seance Cinema'} &nbsp;&nbsp;&nbsp;🎬&nbsp;&nbsp;&nbsp; {session?.name || 'Seance Cinema'}
            </div>
          </div>
        </div>
      );
    }

    // MINIMAL CENTER - Big countdown in center
    if (layoutStyle === 'minimal-center') {
      return (
        <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center" style={baseStyles}>
          {hasAnimations && <style>{animationStyles}</style>}
          {/* Blurred backdrop */}
          {movie?.poster_url && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10"
              style={{ backgroundImage: `url(${movie.poster_url})`, filter: 'blur(50px)' }}
            />
          )}
          {/* Session name at top */}
          {session?.name && (
            <div className="absolute top-8 text-xl uppercase tracking-[0.3em] opacity-60">
              {session.name}
            </div>
          )}
          {/* Giant countdown */}
          {countdown_to && (
            <div className="relative z-10">
              <CountdownTimer targetDate={countdown_to} palette={palette} size="giant" showSeconds animate />
            </div>
          )}
          {/* Title at bottom */}
          {movie && (
            <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
              <h2 className="text-2xl font-semibold opacity-80">{movie.title}</h2>
              {movie.poster_url && (
                <img src={movie.poster_url} alt={movie.title} className="h-24 rounded opacity-80" />
              )}
            </div>
          )}
        </div>
      );
    }

    // MODERN GRADIENT - Poster right, info left with gradient
    if (layoutStyle === 'modern-gradient') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          {hasAnimations && <style>{animationStyles}</style>}
          {/* Backdrop with gradient */}
          {movie?.poster_url && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center opacity-50"
                style={{ backgroundImage: `url(${movie.poster_url})` }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, ${palette?.background || '#0a0a0f'}ee 0%, ${palette?.background || '#0a0a0f'}99 50%, transparent 100%)`,
                }}
              />
            </>
          )}
          {/* Session info top left */}
          {session?.name && (
            <div className="absolute top-6 left-8 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="text-lg font-semibold">{session.name}</div>
              {countdown_to && (
                <div className="text-sm opacity-70">
                  {new Date(countdown_to).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )}
          {/* Left content */}
          <div className="absolute left-8 top-1/2 -translate-y-1/2 max-w-[50%] z-10">
            {movie && (
              <>
                <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                  {movie.title}
                </h1>
                {movie.tagline && <p className="text-xl italic opacity-80 mb-6">"{movie.tagline}"</p>}
                <div className="flex items-center gap-4 text-lg opacity-70 mb-8">
                  {movie.year && <span>{movie.year}</span>}
                  {movie.runtime_minutes && <span>•</span>}
                  {movie.runtime_minutes && <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>}
                  {movie.rating && <span>•</span>}
                  {movie.rating && <span style={{ color: palette?.accent }}>★ {movie.rating.toFixed(1)}</span>}
                </div>
              </>
            )}
            {countdown_to && (
              <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
            )}
          </div>
          {/* Right poster */}
          <div className="absolute right-0 top-0 bottom-0 w-[45%] flex items-center justify-center p-8">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="max-h-full max-w-full object-contain rounded-lg"
                style={{ boxShadow: `0 25px 80px -12px ${palette?.primary || '#000'}80` }}
              />
            )}
          </div>
        </div>
      );
    }

    // RESPONSIVE BADGE - Responsive layout with animated badge
    if (layoutStyle === 'responsive-badge') {
      // Responsive CSS that uses clamp() for fluid typography and spacing
      const responsiveStyles = `
        .responsive-badge-layout {
          --title-size: clamp(1.5rem, 4vw, 4rem);
          --tagline-size: clamp(0.875rem, 1.5vw, 1.25rem);
          --text-size: clamp(0.75rem, 1.2vw, 1rem);
          --meta-size: clamp(0.875rem, 1.3vw, 1.125rem);
          --badge-size: clamp(0.75rem, 1.2vw, 1rem);
          --spacing: clamp(0.5rem, 2vw, 2rem);
          --poster-width: clamp(200px, 35vw, 500px);
        }
        @media (max-width: 768px) {
          .responsive-badge-layout {
            --poster-width: clamp(120px, 30vw, 200px);
          }
          .responsive-badge-layout .content-area {
            flex-direction: column !important;
          }
          .responsive-badge-layout .poster-area {
            width: 100% !important;
            height: auto !important;
            max-height: 40vh;
          }
          .responsive-badge-layout .info-area {
            width: 100% !important;
            padding: 1rem !important;
          }
        }
        @media (max-height: 600px) {
          .responsive-badge-layout .overview-text {
            display: none;
          }
          .responsive-badge-layout .cast-text {
            display: none;
          }
        }
        @media (min-width: 1920px) {
          .responsive-badge-layout {
            --title-size: 5rem;
            --tagline-size: 1.5rem;
            --text-size: 1.25rem;
          }
        }
      `;

      return (
        <div className="responsive-badge-layout relative w-full h-full overflow-hidden flex" style={baseStyles}>
          <style>{animationStyles}</style>
          <style>{responsiveStyles}</style>

          {/* Backdrop */}
          {(effectiveBackdrop || movie?.poster_url) && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${effectiveBackdrop || movie?.poster_url})`,
                  opacity: 0.25,
                  filter: 'blur(30px)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, ${palette?.background || '#0a0a0f'}f5 0%, ${palette?.background || '#0a0a0f'}dd 50%, ${palette?.background || '#0a0a0f'}cc 100%)`,
                }}
              />
            </>
          )}

          {/* Animated Badge - Prochainement */}
          <div
            className="absolute z-30"
            style={{
              top: 'clamp(1rem, 3vh, 2rem)',
              right: 'clamp(1rem, 3vw, 2rem)',
            }}
          >
            <div
              className="relative px-6 py-3 rounded-full font-bold uppercase tracking-wider"
              style={{
                fontSize: 'var(--badge-size)',
                background: `linear-gradient(135deg, ${palette?.vibrant || palette?.accent || '#ef4444'} 0%, ${palette?.primary || '#dc2626'} 100%)`,
                color: '#ffffff',
                animation: 'badge-pulse 2s ease-in-out infinite',
                boxShadow: `0 4px 15px ${palette?.vibrant || palette?.accent || '#ef4444'}60`,
              }}
            >
              {/* Shimmer effect overlay */}
              <div
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 3s linear infinite',
                }}
              />
              <span className="relative z-10 flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: '#ffffff',
                    animation: 'blink 1s ease-in-out infinite',
                  }}
                />
                Prochainement
              </span>
            </div>
          </div>

          {/* Main content area */}
          <div className="content-area relative z-10 w-full h-full flex">
            {/* Left: Poster */}
            <div
              className="poster-area h-full flex items-center justify-center"
              style={{
                width: 'var(--poster-width)',
                padding: 'var(--spacing)',
              }}
            >
              {movie?.poster_url && (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="max-h-[85vh] max-w-full object-contain rounded-xl"
                  style={{
                    boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}60, 0 10px 30px -5px rgba(0,0,0,0.5)`,
                  }}
                />
              )}
            </div>

            {/* Right: Info panel */}
            <div
              className="info-area flex-1 h-full flex flex-col justify-center overflow-hidden"
              style={{
                padding: 'var(--spacing)',
                paddingRight: 'clamp(1rem, 4vw, 4rem)',
              }}
            >
              {/* Session name */}
              {session?.name && (
                <div
                  className="uppercase tracking-[0.2em] opacity-60 mb-2"
                  style={{ fontSize: 'var(--text-size)' }}
                >
                  {session.name}
                </div>
              )}

              {/* Title */}
              {movie && (
                <h1
                  className="font-bold leading-tight mb-2"
                  style={{
                    fontSize: 'var(--title-size)',
                    color: palette?.text || '#ffffff',
                    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  }}
                >
                  {movie.title}
                  {movie.year && (
                    <span className="opacity-50 ml-3" style={{ fontSize: '0.6em' }}>
                      ({movie.year})
                    </span>
                  )}
                </h1>
              )}

              {/* Tagline */}
              {movie?.tagline && (
                <p
                  className="italic opacity-80 mb-4"
                  style={{
                    fontSize: 'var(--tagline-size)',
                    color: palette?.secondary || palette?.text || '#ffffff',
                  }}
                >
                  "{movie.tagline}"
                </p>
              )}

              {/* Metadata row */}
              <div
                className="flex flex-wrap items-center gap-4 opacity-80 mb-4"
                style={{ fontSize: 'var(--meta-size)' }}
              >
                {movie?.runtime_minutes && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m
                  </span>
                )}
                {movie?.rating && (
                  <span className="flex items-center gap-1" style={{ color: palette?.accent || '#fbbf24' }}>
                    ★ {movie.rating.toFixed(1)}
                  </span>
                )}
                {vote_info && vote_info.total_votes !== undefined && vote_info.total_votes > 0 && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${palette?.vibrant || palette?.accent || '#22c55e'}20`,
                      color: palette?.vibrant || palette?.accent || '#22c55e',
                    }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" />
                    </svg>
                    {vote_info.total_votes} vote{vote_info.total_votes > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Genres */}
              {movie?.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {movie.genres.slice(0, 5).map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full font-medium"
                      style={{
                        fontSize: 'calc(var(--text-size) * 0.9)',
                        backgroundColor: `${palette?.primary || '#6366f1'}25`,
                        color: palette?.primary || '#6366f1',
                        border: `1px solid ${palette?.primary || '#6366f1'}40`,
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Director */}
              {movie?.directors && movie.directors.length > 0 && (
                <div className="opacity-80 mb-2" style={{ fontSize: 'var(--text-size)' }}>
                  <span className="opacity-60">Réalisé par </span>
                  <span className="font-semibold">{movie.directors.join(', ')}</span>
                </div>
              )}

              {/* Cast */}
              {movie?.cast && movie.cast.length > 0 && (
                <div className="cast-text opacity-80 mb-4" style={{ fontSize: 'var(--text-size)' }}>
                  <span className="opacity-60">Avec </span>
                  <span className="font-semibold">{movie.cast.slice(0, 4).join(', ')}</span>
                </div>
              )}

              {/* Overview */}
              {movie?.overview && (
                <p
                  className="overview-text leading-relaxed opacity-75 mb-6 line-clamp-3"
                  style={{ fontSize: 'var(--text-size)' }}
                >
                  {movie.overview}
                </p>
              )}

              {/* Countdown */}
              {countdown_to && (
                <div
                  className="mt-auto pt-4"
                  style={{
                    borderTop: `1px solid ${palette?.text || '#ffffff'}15`,
                  }}
                >
                  <div
                    className="uppercase tracking-widest opacity-50 mb-3"
                    style={{ fontSize: 'calc(var(--text-size) * 0.85)' }}
                  >
                    Commence dans
                  </div>
                  <CountdownTimer
                    targetDate={countdown_to}
                    palette={palette}
                    size="lg"
                    showSeconds={config?.show_seconds ?? true}
                    animate={config?.animate_numbers ?? true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // NEON RETRO - 80s neon style with grid and glow effects
    if (layoutStyle === 'neon-retro') {
      const neonColor = config?.neon_color || '#ff00ff';
      const secondaryNeon = config?.secondary_neon || '#00ffff';

      return (
        <div
          className="relative w-full h-full overflow-hidden"
          style={{
            ...baseStyles,
            '--neon-color': neonColor,
            '--secondary-neon': secondaryNeon,
          } as React.CSSProperties}
        >
          <style>{animationStyles}</style>

          {/* Background with grid */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0015] via-[#1a0030] to-[#0a0015]" />

          {/* Retro grid */}
          {config?.show_grid !== false && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(${neonColor}20 1px, transparent 1px),
                  linear-gradient(90deg, ${neonColor}20 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                perspective: '500px',
                transform: 'rotateX(60deg)',
                transformOrigin: 'center 120%',
              }}
            />
          )}

          {/* Scanlines overlay */}
          {config?.scanlines !== false && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
              }}
            />
          )}

          {/* Neon badge with countdown */}
          <div
            className="absolute top-6 right-6 px-6 py-3 rounded-lg font-bold text-xl"
            style={{
              color: secondaryNeon,
              border: `2px solid ${secondaryNeon}`,
              boxShadow: `0 0 10px ${secondaryNeon}, 0 0 20px ${secondaryNeon}, inset 0 0 10px ${secondaryNeon}30`,
              animation: 'neon-border-pulse 2s ease-in-out infinite',
              textShadow: `0 0 10px ${secondaryNeon}`,
            }}
          >
            {countdown_to ? formatCountdownShort(countdown_to) : 'SOON'}
          </div>

          {/* Custom text - SEANCE CINEMA */}
          <div
            className="absolute top-8 left-1/2 -translate-x-1/2 text-2xl font-bold tracking-[0.3em]"
            style={{
              color: neonColor,
              textShadow: `0 0 10px ${neonColor}, 0 0 20px ${neonColor}, 0 0 40px ${neonColor}`,
            }}
          >
            SEANCE CINEMA
          </div>

          {/* Center poster with neon border */}
          <div className="absolute inset-0 flex items-center justify-center pt-16">
            {movie?.poster_url && (
              <div
                className="relative"
                style={{
                  animation: 'neon-border-pulse 3s ease-in-out infinite',
                }}
              >
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="max-h-[55vh] rounded-lg"
                  style={{
                    border: `3px solid ${neonColor}`,
                    boxShadow: `0 0 20px ${neonColor}, 0 0 40px ${neonColor}50`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Title with neon glow */}
          {movie && (
            <div className="absolute bottom-32 left-0 right-0 text-center">
              <h1
                className="text-5xl md:text-6xl font-bold"
                style={{
                  color: '#ffffff',
                  animation: 'neon-flicker 4s ease-in-out infinite',
                }}
              >
                {movie.title}
              </h1>
            </div>
          )}

          {/* Metadata row */}
          <div
            className="absolute bottom-16 left-0 right-0 flex items-center justify-center gap-8 text-lg"
            style={{ color: secondaryNeon }}
          >
            {movie?.year && <span>{movie.year}</span>}
            {movie?.runtime_minutes && (
              <span>{Math.floor(movie.runtime_minutes / 60)}h{movie.runtime_minutes % 60}m</span>
            )}
            {movie?.rating && <span>★ {movie.rating.toFixed(1)}</span>}
          </div>

          {/* Session name at bottom */}
          {session?.name && (
            <div
              className="absolute bottom-4 left-0 right-0 text-center text-sm tracking-widest"
              style={{ color: neonColor, opacity: 0.7 }}
            >
              {session.name}
            </div>
          )}
        </div>
      );
    }

    // ELEGANT PREMIUM - Luxurious design with gold accents
    if (layoutStyle === 'elegant-premium') {
      const goldColor = config?.accent_color || '#d4af37';

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}</style>

          {/* Background with vignette */}
          {effectiveBackdrop && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${effectiveBackdrop})`,
                  opacity: 0.3,
                  filter: 'blur(10px)',
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.8) 100%)',
                }}
              />
            </>
          )}

          {/* Decorative gold corners */}
          <div className="absolute top-4 left-4 w-24 h-24 border-t-2 border-l-2" style={{ borderColor: goldColor }} />
          <div className="absolute top-4 right-4 w-24 h-24 border-t-2 border-r-2" style={{ borderColor: goldColor }} />
          <div className="absolute bottom-4 left-4 w-24 h-24 border-b-2 border-l-2" style={{ borderColor: goldColor }} />
          <div className="absolute bottom-4 right-4 w-24 h-24 border-b-2 border-r-2" style={{ borderColor: goldColor }} />

          {/* Gold ribbon badge */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <div
              className="relative px-8 py-3 text-sm font-bold tracking-widest"
              style={{
                background: `linear-gradient(135deg, ${goldColor} 0%, #f5e6a3 50%, ${goldColor} 100%)`,
                backgroundSize: '200% auto',
                animation: 'gold-shine 3s linear infinite',
                color: '#1a1a1a',
                clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)',
              }}
            >
              {resolveDynamicText(config?.badge?.text || 'AVANT-PREMIERE', movie, session, countdown_to, vote_info, mystery_info)}
            </div>
          </div>

          {/* Main content */}
          <div className="relative z-10 w-full h-full flex p-12">
            {/* Left: Poster with gold frame */}
            <div className="w-[35%] flex items-center justify-center">
              {movie?.poster_url && (
                <div
                  className="p-2 rounded"
                  style={{
                    background: `linear-gradient(135deg, ${goldColor}, #f5e6a3, ${goldColor})`,
                  }}
                >
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="max-h-[70vh] rounded"
                  />
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex-1 flex flex-col justify-center pl-12">
              {/* Title */}
              {movie && (
                <h1
                  className="text-5xl md:text-6xl font-serif mb-4"
                  style={{ color: goldColor }}
                >
                  {movie.title}
                </h1>
              )}

              {/* Tagline */}
              {movie?.tagline && (
                <p className="text-xl italic opacity-80 mb-6" style={{ fontFamily: 'Georgia, serif' }}>
                  "{movie.tagline}"
                </p>
              )}

              {/* Gold divider */}
              <div className="w-32 h-px mb-6" style={{ background: `linear-gradient(90deg, ${goldColor}, transparent)` }} />

              {/* Director */}
              {movie?.directors && movie.directors.length > 0 && (
                <div className="text-lg mb-3">
                  <span className="opacity-60">Un film de </span>
                  <span className="font-semibold" style={{ color: goldColor }}>{movie.directors.join(', ')}</span>
                </div>
              )}

              {/* Cast */}
              {movie?.cast && movie.cast.length > 0 && (
                <div className="text-lg mb-6">
                  <span className="opacity-60">Avec </span>
                  <span className="font-semibold">{movie.cast.slice(0, 3).join(', ')}</span>
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-6 text-lg opacity-80 mb-8">
                {movie?.year && <span>{movie.year}</span>}
                {movie?.runtime_minutes && (
                  <>
                    <span style={{ color: goldColor }}>•</span>
                    <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>
                  </>
                )}
                {movie?.rating && (
                  <>
                    <span style={{ color: goldColor }}>•</span>
                    <span style={{ color: goldColor }}>★ {movie.rating.toFixed(1)}</span>
                  </>
                )}
              </div>

              {/* Countdown */}
              {countdown_to && (
                <div>
                  <div className="text-sm uppercase tracking-widest opacity-60 mb-3">Projection le</div>
                  <div className="text-2xl" style={{ color: goldColor }}>
                    {new Date(countdown_to).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // SPOTLIGHT DRAMATIC - Dramatic spotlight effect
    if (layoutStyle === 'spotlight-dramatic') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#0a0a12' }}>
          <style>{animationStyles}</style>

          {/* Very dark backdrop */}
          {effectiveBackdrop && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10"
              style={{ backgroundImage: `url(${effectiveBackdrop})`, filter: 'blur(20px)' }}
            />
          )}

          {/* Spotlight effect */}
          <div
            className="absolute top-1/2 left-1/2 w-[80vmax] h-[80vmax] rounded-full"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.15) 0%, transparent 50%)',
              animation: 'spotlight-move 8s ease-in-out infinite',
            }}
          />

          {/* Dust particles */}
          {config?.show_particles !== false && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-white/30 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 10}s`,
                    animation: `dust-particle ${15 + Math.random() * 10}s linear infinite`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Badge */}
          <div
            className="absolute top-6 right-6 px-4 py-2 rounded-full font-bold"
            style={{
              backgroundColor: getBadgeColor(config, vote_info, session?.status, palette, mystery_info),
              color: '#ffffff',
              animation: 'badge-glow 2s ease-in-out infinite',
            }}
          >
            {resolveDynamicText(config?.badge?.text || 'Ce Soir', movie, session, countdown_to, vote_info, mystery_info)}
          </div>

          {/* Center poster with spotlight */}
          <div className="absolute inset-0 flex items-center justify-center">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="max-h-[70vh] rounded-xl"
                style={{
                  boxShadow: '0 0 100px rgba(255,255,255,0.2), 0 25px 50px rgba(0,0,0,0.5)',
                }}
              />
            )}
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
            <div
              className="absolute inset-0 -top-20"
              style={{
                background: 'linear-gradient(to top, rgba(10,10,18,1) 0%, transparent 100%)',
              }}
            />
            {movie && (
              <div className="relative z-10">
                <h1 className="text-5xl md:text-6xl font-bold mb-4" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>
                  {movie.title}
                </h1>
                <div className="flex items-center justify-center gap-6 text-lg opacity-70 mb-6">
                  {movie.year && <span>{movie.year}</span>}
                  {movie.runtime_minutes && <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>}
                </div>
                {countdown_to && (
                  <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // GLASSMORPHISM - Modern glass effect
    if (layoutStyle === 'glassmorphism') {
      const glassBlur = config?.glass_blur || 20;
      const glassOpacity = config?.glass_opacity || 0.15;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}</style>

          {/* Full backdrop */}
          {effectiveBackdrop && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${effectiveBackdrop})` }}
            />
          )}

          {/* Glass panel on right */}
          <div
            className="absolute right-0 top-0 bottom-0 w-[55%] flex flex-col justify-center p-8"
            style={{
              background: `rgba(255, 255, 255, ${glassOpacity})`,
              backdropFilter: `blur(${glassBlur}px)`,
              borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            {/* Glass shimmer effect */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'glass-shimmer 8s ease-in-out infinite',
              }}
            />

            {/* Badge */}
            <div
              className="absolute top-6 right-6 px-4 py-2 rounded-full font-medium text-sm"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: palette?.text || '#ffffff',
              }}
            >
              {resolveDynamicText(config?.badge?.text || 'Nouveau', movie, session, countdown_to, vote_info, mystery_info)}
            </div>

            {/* Content */}
            <div className="relative z-10">
              {movie && (
                <>
                  <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: palette?.text || '#ffffff' }}>
                    {movie.title}
                  </h1>
                  {movie.tagline && (
                    <p className="text-lg italic opacity-80 mb-4">"{movie.tagline}"</p>
                  )}

                  {/* Glass tags for genres */}
                  {movie.genres && movie.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {movie.genres.slice(0, 4).map((genre, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                          }}
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-base opacity-80 mb-4">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.runtime_minutes && (
                      <>
                        <span className="opacity-40">•</span>
                        <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>
                      </>
                    )}
                    {movie.rating && (
                      <>
                        <span className="opacity-40">•</span>
                        <span style={{ color: palette?.accent || '#fbbf24' }}>★ {movie.rating.toFixed(1)}</span>
                      </>
                    )}
                  </div>

                  {/* Directors */}
                  {movie.directors && movie.directors.length > 0 && (
                    <div className="text-base opacity-80 mb-2">
                      <span className="opacity-60">Réalisé par </span>
                      <span className="font-semibold">{movie.directors.join(', ')}</span>
                    </div>
                  )}

                  {/* Overview */}
                  {movie.overview && (
                    <p className="text-sm leading-relaxed opacity-70 mb-6 line-clamp-3">
                      {movie.overview}
                    </p>
                  )}
                </>
              )}

              {/* Countdown */}
              {countdown_to && (
                <div className="pt-4 border-t border-white/20">
                  <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
                </div>
              )}
            </div>
          </div>

          {/* Floating poster on left */}
          <div className="absolute left-8 top-1/2 -translate-y-1/2 w-[40%] flex items-center justify-center">
            {movie?.poster_url && (
              <img
                src={movie.poster_url}
                alt={movie.title}
                className="max-h-[80vh] rounded-2xl"
                style={{
                  boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
                  animation: 'float 6s ease-in-out infinite',
                }}
              />
            )}
          </div>
        </div>
      );
    }

    // EVENT BOARD - Cinema event board style
    if (layoutStyle === 'event-board') {
      const boardColor = '#1a1a1a';
      const letterColor = '#ffcc00';

      return (
        <div className="relative w-full h-full overflow-hidden flex" style={{ ...baseStyles, backgroundColor: '#0d0d0d' }}>
          <style>{animationStyles}</style>

          {/* Board background */}
          <div
            className="absolute inset-4 rounded-lg"
            style={{
              backgroundColor: boardColor,
              border: '8px solid #333333',
              boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)',
            }}
          />

          {/* Board content */}
          <div className="relative z-10 w-full h-full flex p-12">
            {/* Left: Board info */}
            <div className="flex-1 flex flex-col justify-center pr-8">
              {/* Header */}
              <div
                className="text-3xl font-bold tracking-[0.5em] mb-8 text-center"
                style={{ color: letterColor }}
              >
                A L'AFFICHE
              </div>

              {/* Title */}
              {movie && (
                <div
                  className="text-5xl md:text-6xl font-bold mb-8 tracking-wide text-center"
                  style={{ color: letterColor, textTransform: 'uppercase' }}
                >
                  {movie.title}
                </div>
              )}

              {/* Info rows */}
              <div className="space-y-4">
                {session?.name && (
                  <div className="flex justify-between text-xl px-8 py-2 border-b border-yellow-900/30">
                    <span className="opacity-60">SEANCE</span>
                    <span style={{ color: letterColor }}>{session.name}</span>
                  </div>
                )}
                {countdown_to && (
                  <div className="flex justify-between text-xl px-8 py-2 border-b border-yellow-900/30">
                    <span className="opacity-60">HORAIRE</span>
                    <span style={{ color: letterColor }}>
                      {new Date(countdown_to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {movie?.runtime_minutes && (
                  <div className="flex justify-between text-xl px-8 py-2 border-b border-yellow-900/30">
                    <span className="opacity-60">DUREE</span>
                    <span style={{ color: letterColor }}>
                      {Math.floor(movie.runtime_minutes / 60)}H{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
                {movie?.rating && (
                  <div className="flex justify-between text-xl px-8 py-2 border-b border-yellow-900/30">
                    <span className="opacity-60">NOTE</span>
                    <span style={{ color: letterColor }}>{movie.rating.toFixed(1)}/10</span>
                  </div>
                )}
              </div>

              {/* Countdown flip clock style */}
              {countdown_to && (
                <div className="mt-8">
                  <div className="text-center text-sm opacity-60 mb-3 tracking-widest">DANS</div>
                  <CountdownTimer targetDate={countdown_to} palette={{ text: letterColor, accent: letterColor }} size="xl" showSeconds animate />
                </div>
              )}
            </div>

            {/* Right: Poster */}
            <div className="w-[35%] flex items-center justify-center">
              {movie?.poster_url && (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="max-h-[70vh] rounded"
                  style={{
                    border: '4px solid #333333',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      );
    }

    // CINEMA TICKETS - Vintage ticket design
    if (layoutStyle === 'cinema-tickets') {
      const ticketColor = config?.ticket_color || '#f5e6c8';
      const textColor = config?.text_color || '#2d2d2d';
      const accentColor = config?.accent_color || '#c41e3a';

      return (
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center" style={baseStyles}>
          <style>{animationStyles}</style>

          {/* Background */}
          {effectiveBackdrop && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${effectiveBackdrop})`, filter: 'blur(10px)' }}
            />
          )}

          {/* Ticket shape */}
          <div
            className="relative w-[90%] max-w-4xl flex rounded-lg overflow-hidden"
            style={{
              backgroundColor: ticketColor,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Perforations left */}
            <div className="absolute left-0 top-0 bottom-0 w-4 flex flex-col justify-around">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: palette?.background || '#0a0a0f' }} />
              ))}
            </div>

            {/* Left: Poster area */}
            <div className="w-[35%] p-6 pl-8 flex items-center justify-center" style={{ borderRight: `2px dashed ${textColor}40` }}>
              {movie?.poster_url && (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="max-h-[50vh] rounded shadow-lg"
                />
              )}
            </div>

            {/* Right: Ticket info */}
            <div className="flex-1 p-8 flex flex-col justify-between" style={{ color: textColor }}>
              {/* Header */}
              <div className="text-center text-sm tracking-[0.5em] opacity-60 mb-4">ADMIT ONE</div>

              {/* Title */}
              {movie && (
                <h1 className="text-3xl md:text-4xl font-bold text-center mb-4" style={{ fontFamily: 'Georgia, serif' }}>
                  {movie.title}
                </h1>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {countdown_to && (
                  <>
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Date</div>
                      <div className="font-bold">
                        {new Date(countdown_to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Heure</div>
                      <div className="font-bold">
                        {new Date(countdown_to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </>
                )}
                {session?.name && (
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Salle</div>
                    <div className="font-bold">{session.name}</div>
                  </div>
                )}
                {movie?.runtime_minutes && (
                  <div className="text-center">
                    <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Durée</div>
                    <div className="font-bold">{Math.floor(movie.runtime_minutes / 60)}h{movie.runtime_minutes % 60}m</div>
                  </div>
                )}
              </div>

              {/* Barcode */}
              <div className="flex justify-center mb-4">
                <div className="flex gap-0.5">
                  {[...Array(40)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12"
                      style={{
                        width: `${Math.random() * 2 + 1}px`,
                        backgroundColor: textColor,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Ticket number */}
              <div className="text-center text-xs tracking-widest opacity-60">
                #{session?.name?.toUpperCase().slice(0, 6) || 'CINEMA'}
              </div>
            </div>

            {/* Stamp badge */}
            <div
              className="absolute top-8 right-8 px-4 py-2 font-bold text-xl rounded"
              style={{
                color: accentColor,
                border: `3px solid ${accentColor}`,
                transform: 'rotate(-15deg)',
                animation: 'ticket-stamp 0.5s ease-out forwards',
              }}
            >
              VIP
            </div>

            {/* Perforations right */}
            <div className="absolute right-0 top-0 bottom-0 w-4 flex flex-col justify-around">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-full" style={{ backgroundColor: palette?.background || '#0a0a0f' }} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // MINIMAL FOCUS - Ultra-minimal design
    if (layoutStyle === 'minimal-focus') {
      return (
        <div
          className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center"
          style={{ ...baseStyles, backgroundColor: config?.background_color || '#000000' }}
        >
          <style>{animationStyles}</style>

          {/* Title only */}
          {movie && (
            <h1
              className="text-6xl md:text-8xl font-bold tracking-tight text-center mb-12"
              style={{
                color: config?.text_color || '#ffffff',
                fontFamily: config?.typography === 'mono' ? 'monospace' : 'inherit',
              }}
            >
              {movie.title}
            </h1>
          )}

          {/* Countdown */}
          {countdown_to && (
            <CountdownTimer
              targetDate={countdown_to}
              palette={{
                text: config?.text_color || '#ffffff',
                accent: config?.accent_color || '#ffffff',
              }}
              size="giant"
              showSeconds
              animate
            />
          )}

          {/* Session name */}
          {session?.name && (
            <div
              className="absolute bottom-8 text-sm uppercase tracking-[0.3em] opacity-40"
              style={{ color: config?.text_color || '#ffffff' }}
            >
              {session.name}
            </div>
          )}
        </div>
      );
    }

    // DYNAMIC INFO - Context-aware display with vote progress
    if (layoutStyle === 'dynamic-info') {
      const badgeColor = getBadgeColor(config, vote_info, session?.status, palette, mystery_info);
      const badgeText = resolveDynamicText(config?.badge?.text || '{{status_text}}', movie, session, countdown_to, vote_info, mystery_info);

      return (
        <div className="relative w-full h-full overflow-hidden flex" style={baseStyles}>
          <style>{animationStyles}</style>

          {/* Backdrop */}
          {effectiveBackdrop && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${effectiveBackdrop})`, opacity: 0.25, filter: 'blur(20px)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
            </>
          )}

          {/* Status badge */}
          <div
            className="absolute top-6 right-6 px-4 py-2 rounded-full font-bold flex items-center gap-2"
            style={{
              backgroundColor: badgeColor,
              color: '#ffffff',
              animation: vote_info?.is_open ? 'badge-pulse 2s ease-in-out infinite' : undefined,
            }}
          >
            {vote_info?.is_open && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
            {badgeText}
          </div>

          {/* Main content */}
          <div className="relative z-10 w-full h-full flex p-8">
            {/* Left: Poster */}
            <div className="w-[35%] flex items-center justify-center">
              {movie?.poster_url && (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="max-h-[80vh] rounded-xl shadow-2xl"
                />
              )}
            </div>

            {/* Right: Info */}
            <div className="flex-1 flex flex-col justify-center pl-8">
              {movie && (
                <>
                  <h1 className="text-5xl md:text-6xl font-bold mb-4">{movie.title}</h1>
                  {movie.tagline && (
                    <p className="text-xl italic opacity-80 mb-4">"{movie.tagline}"</p>
                  )}

                  {/* Vote progress if vote is open */}
                  {config?.show_vote_info && vote_info?.is_open && (
                    <div className="mb-6 p-4 rounded-lg bg-white/10 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Vote en cours</span>
                        <span className="text-sm opacity-70">{vote_info.total_votes || 0} vote(s)</span>
                      </div>
                      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min((vote_info.total_votes || 0) * 20, 100)}%`,
                            backgroundColor: palette?.accent || '#6366f1',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-lg opacity-80 mb-4">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.runtime_minutes && (
                      <>
                        <span className="opacity-40">•</span>
                        <span>{Math.floor(movie.runtime_minutes / 60)}h {movie.runtime_minutes % 60}m</span>
                      </>
                    )}
                    {movie.rating && (
                      <>
                        <span className="opacity-40">•</span>
                        <span style={{ color: palette?.accent || '#fbbf24' }}>★ {movie.rating.toFixed(1)}</span>
                      </>
                    )}
                  </div>

                  {/* Genres */}
                  {movie.genres && movie.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {movie.genres.slice(0, 4).map((genre, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{
                            backgroundColor: `${palette?.primary || '#6366f1'}30`,
                            color: palette?.primary || '#6366f1',
                          }}
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Countdown */}
              {countdown_to && (
                <div className="mt-auto pt-6 border-t border-white/10">
                  <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
                </div>
              )}
            </div>
          </div>

          {/* Participant avatars placeholder */}
          {config?.show_participant_count && vote_info && (
            <div className="absolute bottom-6 left-6 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm">
              <div className="flex -space-x-2">
                {[...Array(Math.min(vote_info.total_votes || 0, 4))].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-black flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: palette?.primary || '#6366f1' }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm opacity-70">{vote_info.total_votes || 0} participant(s)</span>
            </div>
          )}
        </div>
      );
    }

    // SOCIAL VERTICAL - Story/TikTok style
    if (layoutStyle === 'social-vertical') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}</style>

          {/* Full poster background */}
          {movie?.poster_url && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${movie.poster_url})` }}
            />
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.5) 100%)',
            }}
          />

          {/* Animated badge */}
          <div
            className="absolute top-6 left-6 px-4 py-2 rounded-full font-bold text-sm"
            style={{
              background: palette?.vibrant || palette?.accent || '#ef4444',
              color: '#ffffff',
              animation: 'badge-pulse 2s ease-in-out infinite',
            }}
          >
            BIENTOT
          </div>

          {/* Logo placeholder */}
          <div className="absolute top-6 right-6 text-2xl font-bold opacity-80">
            🎬
          </div>

          {/* Content - centered vertically */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            {/* Title */}
            {movie && (
              <h1
                className="text-4xl md:text-6xl font-bold text-center mb-4"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}
              >
                {movie.title}
              </h1>
            )}

            {/* Rating stars */}
            {movie?.rating && (
              <div className="flex items-center gap-1 mb-4" style={{ color: palette?.accent || '#fbbf24' }}>
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-2xl">
                    {i < Math.round(movie.rating! / 2) ? '★' : '☆'}
                  </span>
                ))}
                <span className="ml-2 text-lg opacity-80">{movie.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Genre pills */}
            {movie?.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {movie.genres.slice(0, 3).map((genre, i) => (
                  <span
                    key={i}
                    className="px-4 py-1 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div className="absolute bottom-0 left-0 right-0 p-8 text-center">
            {/* Countdown */}
            {countdown_to && (
              <div className="mb-6">
                <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
              </div>
            )}

            {/* CTA */}
            <div className="text-sm opacity-60 animate-pulse">
              Glissez pour plus d'infos ↑
            </div>

            {/* Session name */}
            {session?.name && (
              <div className="mt-4 text-lg font-semibold opacity-80">
                {session.name}
              </div>
            )}
          </div>
        </div>
      );
    }

    // CINEMATIC IMMERSIVE - Full backdrop rotation with minimal overlay
    if (layoutStyle === 'cinematic-immersive') {
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes backdrop-fade {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
            @keyframes ken-burns {
              0% { transform: scale(1) translate(0, 0); }
              50% { transform: scale(1.08) translate(-1%, -0.5%); }
              100% { transform: scale(1) translate(0, 0); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            .cinematic-backdrop {
              animation: ken-burns ${config?.rotate_backdrops ? (config.rotate_interval ?? 30) : 60}s ease-in-out infinite;
              transition: opacity 1.5s ease-in-out;
            }
            .cinematic-info {
              animation: fade-in-up 1s ease-out both;
            }
            .cinematic-gradient-bar {
              background: linear-gradient(90deg,
                ${palette?.vibrant || '#6366f1'}40,
                ${palette?.accent || '#8b5cf6'}40,
                ${palette?.vibrant || '#6366f1'}40
              );
              background-size: 200% 100%;
              animation: gradient-shift 8s ease-in-out infinite;
            }
          `}</style>

          {/* Full bleed backdrops with Ken Burns + crossfade */}
          {config?.rotate_backdrops && allBackdrops.length > 1 ? (
            allBackdrops.map((url, i) => (
              <div
                key={`backdrop-${i}`}
                className="absolute inset-0 bg-cover bg-center cinematic-backdrop"
                style={{
                  backgroundImage: `url(${url})`,
                  opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
                }}
              />
            ))
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center cinematic-backdrop"
              style={{
                backgroundImage: `url(${effectiveBackdrop})`,
              }}
            />
          ) : null}

          {/* Cinematic gradient overlays */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#0a0a0f'} 0%, transparent 40%, transparent 70%, ${palette?.background || '#0a0a0f'}90 100%)`,
          }} />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to right, ${palette?.background || '#0a0a0f'}cc 0%, transparent 30%, transparent 70%, ${palette?.background || '#0a0a0f'}cc 100%)`,
          }} />

          {/* Accent gradient bar at top */}
          <div className="absolute top-0 left-0 right-0 h-1 cinematic-gradient-bar" />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-12">

            {/* Logo or Title */}
            <div className="cinematic-info" style={{ animationDelay: '0.2s' }}>
              {config?.use_logo_image && effectiveLogo ? (
                <img
                  src={effectiveLogo}
                  alt={movie?.title || ''}
                  className="max-w-[350px] max-h-[120px] object-contain mb-6 drop-shadow-2xl"
                />
              ) : (
                <h1
                  className="text-6xl font-bold mb-2 tracking-tight"
                  style={{
                    color: palette?.text || '#ffffff',
                    textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                  }}
                >
                  {movie?.title}
                  {movie?.year && (
                    <span className="ml-4 text-3xl font-light opacity-60">({movie.year})</span>
                  )}
                </h1>
              )}
            </div>

            {/* Tagline */}
            {movie?.tagline && (
              <div className="cinematic-info text-xl italic opacity-70 mb-6" style={{ animationDelay: '0.4s' }}>
                {movie.tagline}
              </div>
            )}

            {/* Metadata row */}
            <div className="cinematic-info flex items-center gap-6 mb-8" style={{ animationDelay: '0.6s' }}>
              {movie?.runtime_minutes && (
                <span className="text-lg opacity-80">
                  {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                </span>
              )}
              {movie?.rating && (
                <span className="flex items-center gap-1.5 text-lg">
                  <span style={{ color: palette?.accent || '#fbbf24' }}>★</span>
                  <span className="opacity-90">{movie.rating.toFixed(1)}</span>
                </span>
              )}
              {movie?.genres?.slice(0, 3).map((genre, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-sm border"
                  style={{
                    borderColor: `${palette?.vibrant || '#ffffff'}40`,
                    color: palette?.text || '#ffffff',
                    backgroundColor: `${palette?.vibrant || '#ffffff'}15`,
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>

            {/* Countdown */}
            {countdown_to && (
              <div className="cinematic-info" style={{ animationDelay: '0.8s' }}>
                <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
              </div>
            )}

            {/* Session info */}
            {session?.name && (
              <div className="cinematic-info mt-6 text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '1s' }}>
                {session.name}
              </div>
            )}
          </div>

          {/* Small poster in corner */}
          {effectivePoster && (
            <div className="absolute top-8 right-8 z-20 cinematic-info" style={{ animationDelay: '1.2s' }}>
              <img
                src={effectivePoster}
                alt={movie?.title || ''}
                className="w-32 rounded-lg shadow-2xl"
                style={{
                  boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}80`,
                }}
              />
            </div>
          )}

          {/* Badge */}
          {config?.badge?.show_when !== 'never' && (
            <div className="absolute top-8 left-8 z-20 cinematic-info" style={{ animationDelay: '1.4s' }}>
              <span
                className="px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md"
                style={{
                  backgroundColor: `${palette?.vibrant || '#6366f1'}30`,
                  color: palette?.text || '#ffffff',
                  border: `1px solid ${palette?.vibrant || '#6366f1'}50`,
                }}
              >
                {resolveDynamicText(config?.badge?.text || '{{status_text}}', movie, session, countdown_to, vote_info, mystery_info)}
              </span>
            </div>
          )}
        </div>
      );
    }

    // CINEMATIC MYSTERY - Immersive mystery variant with reveal countdown and hidden movie info
    if (layoutStyle === 'cinematic-mystery') {
      const mysteryAccent = palette?.accent || '#8b5cf6';
      const isRevealed = mystery_info?.is_revealed ?? false;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes ken-burns {
              0% { transform: scale(1) translate(0, 0); }
              50% { transform: scale(1.08) translate(-1%, -0.5%); }
              100% { transform: scale(1) translate(0, 0); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes mystery-pulse {
              0%, 100% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.02); }
            }
            @keyframes mystery-glow {
              0%, 100% { text-shadow: 0 0 20px ${mysteryAccent}40, 0 0 60px ${mysteryAccent}20; }
              50% { text-shadow: 0 0 40px ${mysteryAccent}80, 0 0 80px ${mysteryAccent}40, 0 0 120px ${mysteryAccent}20; }
            }
            @keyframes particle-float {
              0% { transform: translateY(100vh) scale(0); opacity: 0; }
              10% { opacity: 0.6; }
              90% { opacity: 0.6; }
              100% { transform: translateY(-10vh) scale(1); opacity: 0; }
            }
            @keyframes reveal-burst {
              0% { transform: scale(0.8); opacity: 0; filter: blur(10px); }
              60% { transform: scale(1.05); opacity: 1; filter: blur(0); }
              100% { transform: scale(1); opacity: 1; filter: blur(0); }
            }
            .cinematic-backdrop {
              animation: ken-burns ${config?.rotate_backdrops ? (config.rotate_interval ?? 30) : 60}s ease-in-out infinite;
              transition: opacity 1.5s ease-in-out;
            }
            .cinematic-info {
              animation: fade-in-up 1s ease-out both;
            }
            .mystery-gradient-bar {
              background: linear-gradient(90deg,
                ${mysteryAccent}60,
                ${palette?.vibrant || '#a855f7'}60,
                ${mysteryAccent}60
              );
              background-size: 200% 100%;
              animation: gradient-shift 6s ease-in-out infinite;
            }
            .mystery-question {
              animation: mystery-glow 3s ease-in-out infinite;
            }
            .mystery-particle {
              position: absolute;
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: ${mysteryAccent};
              animation: particle-float linear infinite;
            }
            .reveal-anim {
              animation: reveal-burst 1.2s ease-out both;
            }
          `}</style>

          {/* Backdrop: blur heavy when hidden, clear when revealed */}
          {isRevealed && effectiveBackdrop ? (
            config?.rotate_backdrops && allBackdrops.length > 1 ? (
              allBackdrops.map((url, i) => (
                <div
                  key={`backdrop-${i}`}
                  className="absolute inset-0 bg-cover bg-center cinematic-backdrop"
                  style={{
                    backgroundImage: `url(${url})`,
                    opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
                  }}
                />
              ))
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center cinematic-backdrop"
                style={{ backgroundImage: `url(${effectiveBackdrop})` }}
              />
            )
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center cinematic-backdrop"
              style={{
                backgroundImage: `url(${effectiveBackdrop})`,
                filter: 'blur(30px) brightness(0.3)',
                transform: 'scale(1.1)',
              }}
            />
          ) : null}

          {/* Cinematic gradient overlays */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#0a0a0f'} 0%, transparent 40%, transparent 70%, ${palette?.background || '#0a0a0f'}90 100%)`,
          }} />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to right, ${palette?.background || '#0a0a0f'}cc 0%, transparent 30%, transparent 70%, ${palette?.background || '#0a0a0f'}cc 100%)`,
          }} />

          {/* Floating particles (mystery only) */}
          {!isRevealed && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={`particle-${i}`}
                  className="mystery-particle"
                  style={{
                    left: `${5 + Math.random() * 90}%`,
                    animationDuration: `${6 + Math.random() * 10}s`,
                    animationDelay: `${Math.random() * 8}s`,
                    opacity: 0.3 + Math.random() * 0.4,
                    width: `${2 + Math.random() * 4}px`,
                    height: `${2 + Math.random() * 4}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Accent gradient bar at top */}
          <div className="absolute top-0 left-0 right-0 h-1 mystery-gradient-bar" />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-12">

            {isRevealed ? (
              <>
                {/* REVEALED STATE — show movie info like cinematic-immersive */}
                <div className="reveal-anim" style={{ animationDelay: '0.2s' }}>
                  {config?.use_logo_image && effectiveLogo ? (
                    <img
                      src={effectiveLogo}
                      alt={movie?.title || ''}
                      className="max-w-[350px] max-h-[120px] object-contain mb-6 drop-shadow-2xl"
                    />
                  ) : (
                    <h1
                      className="text-6xl font-bold mb-2 tracking-tight"
                      style={{
                        color: palette?.text || '#ffffff',
                        textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                      }}
                    >
                      {movie?.title}
                      {movie?.year && (
                        <span className="ml-4 text-3xl font-light opacity-60">({movie.year})</span>
                      )}
                    </h1>
                  )}
                </div>

                {movie?.tagline && (
                  <div className="reveal-anim text-xl italic opacity-70 mb-6" style={{ animationDelay: '0.4s' }}>
                    {movie.tagline}
                  </div>
                )}

                <div className="reveal-anim flex items-center gap-6 mb-8" style={{ animationDelay: '0.6s' }}>
                  {movie?.runtime_minutes && (
                    <span className="text-lg opacity-80">
                      {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </span>
                  )}
                  {movie?.rating && (
                    <span className="flex items-center gap-1.5 text-lg">
                      <span style={{ color: palette?.accent || '#fbbf24' }}>★</span>
                      <span className="opacity-90">{movie.rating.toFixed(1)}</span>
                    </span>
                  )}
                  {movie?.genres?.slice(0, 3).map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm border"
                      style={{
                        borderColor: `${palette?.vibrant || '#ffffff'}40`,
                        color: palette?.text || '#ffffff',
                        backgroundColor: `${palette?.vibrant || '#ffffff'}15`,
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                {countdown_to && (
                  <div className="reveal-anim" style={{ animationDelay: '0.8s' }}>
                    <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                  </div>
                )}

                {session?.name && (
                  <div className="reveal-anim mt-6 text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '1s' }}>
                    {session.name}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* MYSTERY STATE — hidden movie, show countdown to reveal */}
                <div className="flex-1 flex flex-col items-center justify-center -mb-12">
                  {/* Mystery poster placeholder */}
                  <div
                    className="w-56 h-80 rounded-2xl flex items-center justify-center mb-10"
                    style={{
                      background: `linear-gradient(135deg, ${palette?.background || '#1a1a2e'}, ${mysteryAccent}20)`,
                      border: `2px solid ${mysteryAccent}40`,
                      boxShadow: `0 0 80px ${mysteryAccent}15, inset 0 0 40px ${mysteryAccent}05`,
                      animation: 'mystery-pulse 4s ease-in-out infinite',
                    }}
                  >
                    <span
                      className="text-[10rem] font-bold leading-none mystery-question"
                      style={{ color: mysteryAccent }}
                    >
                      ?
                    </span>
                  </div>

                  {/* Mystery label */}
                  <h1
                    className="text-5xl font-bold tracking-wider mb-4 mystery-question"
                    style={{ color: mysteryAccent }}
                  >
                    FILM MYSTERE
                  </h1>

                  {/* Reveal countdown */}
                  {mystery_info?.reveal_at && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <div className="text-lg opacity-50 uppercase tracking-widest">Revelation dans</div>
                      <CountdownTimer
                        targetDate={mystery_info.reveal_at}
                        palette={{ primary: mysteryAccent, accent: mysteryAccent, text: palette?.text }}
                        size="xl"
                        showSeconds
                        animate
                      />
                    </div>
                  )}

                  {/* Session start countdown (if different from reveal) */}
                  {countdown_to && countdown_to !== mystery_info?.reveal_at && (
                    <div className="flex flex-col items-center gap-2 mt-6">
                      <div className="text-sm opacity-40 uppercase tracking-widest">Seance dans</div>
                      <CountdownTimer
                        targetDate={countdown_to}
                        palette={palette}
                        size="lg"
                        showSeconds
                        animate
                      />
                    </div>
                  )}
                </div>

                {/* Session name at bottom */}
                {session?.name && (
                  <div className="cinematic-info text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '0.5s' }}>
                    {session.name}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Poster in corner (revealed only) */}
          {isRevealed && effectivePoster && (
            <div className="absolute top-8 right-8 z-20 reveal-anim" style={{ animationDelay: '1.2s' }}>
              <img
                src={effectivePoster}
                alt={movie?.title || ''}
                className="w-32 rounded-lg shadow-2xl"
                style={{
                  boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}80`,
                }}
              />
            </div>
          )}

          {/* Badge */}
          <div className="absolute top-8 left-8 z-20 cinematic-info" style={{ animationDelay: '0.3s' }}>
            <span
              className="px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md"
              style={{
                backgroundColor: isRevealed
                  ? `${palette?.vibrant || '#22c55e'}30`
                  : `${mysteryAccent}30`,
                color: palette?.text || '#ffffff',
                border: `1px solid ${isRevealed ? (palette?.vibrant || '#22c55e') : mysteryAccent}50`,
              }}
            >
              {isRevealed
                ? resolveDynamicText(config?.badge?.text || '{{status_text}}', movie, session, countdown_to, vote_info, mystery_info)
                : 'Film mystere'}
            </span>
          </div>
        </div>
      );
    }

    // CINEMATIC VOTE - Vote mode template with blue theme
    if (layoutStyle === 'cinematic-vote') {
      const voteAccent = '#3b82f6';
      const voteAccentLight = '#60a5fa';
      const isResolved = vote_info?.status === 'closed' && vote_info?.winning_movie_index != null && !!movie;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes ken-burns-vote {
              0% { transform: scale(1) translate(0, 0); }
              50% { transform: scale(1.08) translate(-1%, -0.5%); }
              100% { transform: scale(1) translate(0, 0); }
            }
            @keyframes fade-in-up-vote {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gradient-shift-vote {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes vote-pulse {
              0%, 100% { opacity: 0.6; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.02); }
            }
            @keyframes vote-glow {
              0%, 100% { text-shadow: 0 0 20px ${voteAccent}40, 0 0 60px ${voteAccent}20; }
              50% { text-shadow: 0 0 40px ${voteAccent}80, 0 0 80px ${voteAccent}40, 0 0 120px ${voteAccent}20; }
            }
            @keyframes vote-particle-float {
              0% { transform: translateY(100vh) scale(0); opacity: 0; }
              10% { opacity: 0.6; }
              90% { opacity: 0.6; }
              100% { transform: translateY(-10vh) scale(1); opacity: 0; }
            }
            @keyframes vote-reveal-burst {
              0% { transform: scale(0.8); opacity: 0; filter: blur(10px); }
              60% { transform: scale(1.05); opacity: 1; filter: blur(0); }
              100% { transform: scale(1); opacity: 1; filter: blur(0); }
            }
            @keyframes vote-progress-fill {
              from { width: 0%; }
              to { width: var(--progress-width); }
            }
            .vote-backdrop {
              animation: ken-burns-vote ${config?.rotate_backdrops ? (config.rotate_interval ?? 30) : 60}s ease-in-out infinite;
              transition: opacity 1.5s ease-in-out;
            }
            .vote-info-anim {
              animation: fade-in-up-vote 1s ease-out both;
            }
            .vote-gradient-bar {
              background: linear-gradient(90deg, ${voteAccent}60, ${voteAccentLight}60, ${voteAccent}60);
              background-size: 200% 100%;
              animation: gradient-shift-vote 6s ease-in-out infinite;
            }
            .vote-icon-glow {
              animation: vote-glow 3s ease-in-out infinite;
            }
            .vote-particle {
              position: absolute;
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: ${voteAccent};
              animation: vote-particle-float linear infinite;
            }
            .vote-reveal-anim {
              animation: vote-reveal-burst 1.2s ease-out both;
            }
          `}</style>

          {/* Backdrop: blur heavy when voting, clear when resolved */}
          {isResolved && effectiveBackdrop ? (
            config?.rotate_backdrops && allBackdrops.length > 1 ? (
              allBackdrops.map((url, i) => (
                <div
                  key={`backdrop-${i}`}
                  className="absolute inset-0 bg-cover bg-center vote-backdrop"
                  style={{
                    backgroundImage: `url(${url})`,
                    opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
                  }}
                />
              ))
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center vote-backdrop"
                style={{ backgroundImage: `url(${effectiveBackdrop})` }}
              />
            )
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center vote-backdrop"
              style={{
                backgroundImage: `url(${effectiveBackdrop})`,
                filter: 'blur(30px) brightness(0.3)',
                transform: 'scale(1.1)',
              }}
            />
          ) : null}

          {/* Dark blue gradient overlays */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, #0a1628 0%, transparent 40%, transparent 70%, #0a162890 100%)`,
          }} />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to right, #0a1628cc 0%, transparent 30%, transparent 70%, #0a1628cc 100%)`,
          }} />

          {/* Floating particles (vote in progress only) */}
          {!isResolved && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={`vote-particle-${i}`}
                  className="vote-particle"
                  style={{
                    left: `${5 + Math.random() * 90}%`,
                    animationDuration: `${6 + Math.random() * 10}s`,
                    animationDelay: `${Math.random() * 8}s`,
                    opacity: 0.3 + Math.random() * 0.4,
                    width: `${2 + Math.random() * 4}px`,
                    height: `${2 + Math.random() * 4}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Accent gradient bar at top */}
          <div className="absolute top-0 left-0 right-0 h-1 vote-gradient-bar" />

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-12">

            {isResolved ? (
              <>
                {/* RESOLVED STATE — show winning movie info */}
                <div className="vote-reveal-anim" style={{ animationDelay: '0.2s' }}>
                  {config?.use_logo_image && effectiveLogo ? (
                    <img
                      src={effectiveLogo}
                      alt={movie?.title || ''}
                      className="max-w-[350px] max-h-[120px] object-contain mb-6 drop-shadow-2xl"
                    />
                  ) : (
                    <h1
                      className="text-6xl font-bold mb-2 tracking-tight"
                      style={{
                        color: palette?.text || '#ffffff',
                        textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                      }}
                    >
                      {movie?.title}
                      {movie?.year && (
                        <span className="ml-4 text-3xl font-light opacity-60">({movie.year})</span>
                      )}
                    </h1>
                  )}
                </div>

                {movie?.tagline && (
                  <div className="vote-reveal-anim text-xl italic opacity-70 mb-6" style={{ animationDelay: '0.4s' }}>
                    {movie.tagline}
                  </div>
                )}

                <div className="vote-reveal-anim flex items-center gap-6 mb-8" style={{ animationDelay: '0.6s' }}>
                  {movie?.runtime_minutes && (
                    <span className="text-lg opacity-80">
                      {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </span>
                  )}
                  {movie?.rating && (
                    <span className="flex items-center gap-1.5 text-lg">
                      <span style={{ color: '#fbbf24' }}>★</span>
                      <span className="opacity-90">{movie.rating.toFixed(1)}</span>
                    </span>
                  )}
                  {movie?.genres?.slice(0, 3).map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm border"
                      style={{
                        borderColor: `${voteAccent}40`,
                        color: '#ffffff',
                        backgroundColor: `${voteAccent}15`,
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>

                {countdown_to && (
                  <div className="vote-reveal-anim" style={{ animationDelay: '0.8s' }}>
                    <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                  </div>
                )}

                {session?.name && (
                  <div className="vote-reveal-anim mt-6 text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '1s' }}>
                    {session.name}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* VOTE IN PROGRESS STATE */}
                <div className="flex-1 flex flex-col items-center justify-center -mb-12">
                  {/* Vote icon placeholder */}
                  <div
                    className="w-56 h-80 rounded-2xl flex items-center justify-center mb-10"
                    style={{
                      background: `linear-gradient(135deg, #0a1628, ${voteAccent}20)`,
                      border: `2px solid ${voteAccent}40`,
                      boxShadow: `0 0 80px ${voteAccent}15, inset 0 0 40px ${voteAccent}05`,
                      animation: 'vote-pulse 4s ease-in-out infinite',
                    }}
                  >
                    {/* Vote ballot SVG icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="w-32 h-32 vote-icon-glow"
                      style={{ color: voteAccent }}
                    >
                      <path
                        d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm4.293 10.707a1 1 0 0 1 0-1.414L11.586 10 9.293 7.707a1 1 0 1 1 1.414-1.414l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414 0z"
                        fill="currentColor"
                        opacity="0.9"
                      />
                      <path
                        d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                    </svg>
                  </div>

                  {/* Vote label */}
                  <h1
                    className="text-5xl font-bold tracking-wider mb-4 vote-icon-glow"
                    style={{ color: voteAccent }}
                  >
                    VOTE EN COURS
                  </h1>

                  {/* Vote progress: X/Y votes if close_when_all_voted */}
                  {vote_info?.close_when_all_voted && (vote_info?.total_tokens ?? 0) > 0 && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <div className="text-lg opacity-50 uppercase tracking-widest">Votes</div>
                      <div className="flex items-center gap-4">
                        <span className="text-4xl font-bold" style={{ color: voteAccent }}>
                          {vote_info?.total_votes ?? 0}
                        </span>
                        <span className="text-2xl opacity-40">/</span>
                        <span className="text-4xl font-bold opacity-60">
                          {vote_info?.total_tokens ?? 0}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-64 h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${voteAccent}20` }}>
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: `${Math.min(100, ((vote_info?.total_votes ?? 0) / (vote_info?.total_tokens || 1)) * 100)}%`,
                            background: `linear-gradient(90deg, ${voteAccent}, ${voteAccentLight})`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Close countdown */}
                  {vote_info?.closes_at && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <div className="text-lg opacity-50 uppercase tracking-widest">Cloture dans</div>
                      <CountdownTimer
                        targetDate={vote_info.closes_at}
                        palette={{ primary: voteAccent, accent: voteAccent, text: palette?.text }}
                        size="xl"
                        showSeconds
                        animate
                      />
                    </div>
                  )}

                  {/* Reveal countdown (vote closed but delayed reveal) */}
                  {vote_info?.status === 'closed' && vote_info?.vote_reveal_at && (
                    <div className="flex flex-col items-center gap-3 mt-4">
                      <div className="text-lg opacity-50 uppercase tracking-widest">Revelation dans</div>
                      <CountdownTimer
                        targetDate={vote_info.vote_reveal_at}
                        palette={{ primary: '#22c55e', accent: '#22c55e', text: palette?.text }}
                        size="xl"
                        showSeconds
                        animate
                      />
                    </div>
                  )}

                  {/* Session start countdown (if different) */}
                  {countdown_to && (
                    <div className="flex flex-col items-center gap-2 mt-6">
                      <div className="text-sm opacity-40 uppercase tracking-widest">Seance dans</div>
                      <CountdownTimer
                        targetDate={countdown_to}
                        palette={palette}
                        size="lg"
                        showSeconds
                        animate
                      />
                    </div>
                  )}
                </div>

                {/* Session name at bottom */}
                {session?.name && (
                  <div className="vote-info-anim text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '0.5s' }}>
                    {session.name}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Poster in corner (resolved only) */}
          {isResolved && effectivePoster && (
            <div className="absolute top-8 right-8 z-20 vote-reveal-anim" style={{ animationDelay: '1.2s' }}>
              <img
                src={effectivePoster}
                alt={movie?.title || ''}
                className="w-32 rounded-lg shadow-2xl"
                style={{
                  boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}80`,
                }}
              />
            </div>
          )}

          {/* Badge */}
          <div className="absolute top-8 left-8 z-20 vote-info-anim" style={{ animationDelay: '0.3s' }}>
            <span
              className="px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md"
              style={{
                backgroundColor: isResolved
                  ? `#22c55e30`
                  : `${voteAccent}30`,
                color: '#ffffff',
                border: `1px solid ${isResolved ? '#22c55e' : voteAccent}50`,
              }}
            >
              {isResolved ? 'Film choisi par vote' : 'Vote en cours'}
            </span>
          </div>
        </div>
      );
    }

    // CINEMATIC VOTE PODIUM - Vote with movie grid and podium reveal
    if (layoutStyle === 'cinematic-vote-podium') {
      const voteAccent = '#3b82f6';
      const voteAccentLight = '#60a5fa';
      const isResolved = vote_info?.status === 'closed' && vote_info?.winning_movie_index != null && !!movie;
      const movieOptions = vote_info?.movie_options || [];
      const voteCounts = vote_info?.vote_counts || {};
      const maxVotes = Math.max(1, ...Object.values(voteCounts));

      // Sort movies by vote count for podium (descending)
      const sortedMovies = movieOptions
        .map((m, i) => ({ ...m, index: i, votes: voteCounts[i] || 0 }))
        .sort((a, b) => b.votes - a.votes);

      // Podium colors
      const podiumColors = ['#fbbf24', '#94a3b8', '#cd7f32']; // Gold, Silver, Bronze

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes podium-fade-in {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes podium-slide-up {
              from { opacity: 0; transform: translateY(60px) scale(0.9); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes card-pulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 ${voteAccent}30; }
              50% { transform: scale(1.01); box-shadow: 0 0 20px 0 ${voteAccent}20; }
            }
            @keyframes confetti-fall {
              0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }
            @keyframes trophy-bounce {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
            @keyframes gradient-shift-podium {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes bar-fill {
              from { width: 0%; }
            }
            .podium-gradient-bar {
              background: linear-gradient(90deg, ${voteAccent}60, ${voteAccentLight}60, ${voteAccent}60);
              background-size: 200% 100%;
              animation: gradient-shift-podium 6s ease-in-out infinite;
            }
            .podium-card {
              animation: card-pulse 4s ease-in-out infinite;
            }
            .podium-entry {
              animation: podium-slide-up 0.8s ease-out both;
            }
            .confetti-piece {
              position: absolute;
              width: 8px;
              height: 8px;
              animation: confetti-fall linear infinite;
            }
            .trophy-anim {
              animation: trophy-bounce 2s ease-in-out infinite;
            }
          `}</style>

          {/* Background */}
          {effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${effectiveBackdrop})`,
                filter: isResolved ? 'blur(20px) brightness(0.25)' : 'blur(30px) brightness(0.2)',
                transform: 'scale(1.1)',
              }}
            />
          ) : null}

          {/* Dark overlay */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #0a1628e0 0%, #0a1628f0 100%)',
          }} />

          {/* Accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 podium-gradient-bar" />

          {/* Confetti (resolved only, first 5 seconds handled by CSS) */}
          {isResolved && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={`confetti-${i}`}
                  className="confetti-piece"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: [
                      '#fbbf24', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#f97316',
                    ][i % 6],
                    borderRadius: i % 3 === 0 ? '50%' : '0',
                    width: `${4 + Math.random() * 8}px`,
                    height: `${4 + Math.random() * 8}px`,
                    animationDuration: `${3 + Math.random() * 4}s`,
                    animationDelay: `${Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 w-full h-full flex flex-col p-8">

            {/* Badge */}
            <div className="mb-6">
              <span
                className="px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md inline-block"
                style={{
                  backgroundColor: isResolved ? '#22c55e30' : `${voteAccent}30`,
                  color: '#ffffff',
                  border: `1px solid ${isResolved ? '#22c55e' : voteAccent}50`,
                }}
              >
                {isResolved ? 'Resultats du vote' : 'Vote en cours'}
              </span>
              {session?.name && (
                <span className="ml-4 text-sm uppercase tracking-widest opacity-40">
                  {session.name}
                </span>
              )}
            </div>

            {isResolved ? (
              <>
                {/* PODIUM STATE */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  {/* Winner title */}
                  <div className="podium-entry text-center mb-8" style={{ animationDelay: '0.2s' }}>
                    <div className="trophy-anim text-5xl mb-2">🏆</div>
                    <h2 className="text-2xl font-bold opacity-60 uppercase tracking-widest">Film choisi</h2>
                  </div>

                  {/* Podium */}
                  <div className="flex items-end justify-center gap-6 w-full max-w-4xl">
                    {sortedMovies.slice(0, Math.min(sortedMovies.length, 5)).map((m, podiumPos) => {
                      const isWinner = podiumPos === 0;
                      const podiumColor = podiumColors[podiumPos] || '#6b7280';
                      const cardHeight = isWinner ? 'h-72' : podiumPos < 3 ? 'h-56' : 'h-44';
                      const posterWidth = isWinner ? 'w-44' : podiumPos < 3 ? 'w-32' : 'w-24';

                      return (
                        <div
                          key={m.index}
                          className={`podium-entry flex flex-col items-center`}
                          style={{ animationDelay: `${0.3 + podiumPos * 0.15}s` }}
                        >
                          {/* Rank badge */}
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2"
                            style={{
                              backgroundColor: `${podiumColor}30`,
                              color: podiumColor,
                              border: `2px solid ${podiumColor}`,
                            }}
                          >
                            {podiumPos + 1}
                          </div>

                          {/* Poster */}
                          <div className={`${posterWidth} ${cardHeight} rounded-xl overflow-hidden mb-3 relative`}
                            style={{
                              boxShadow: isWinner
                                ? `0 0 40px ${podiumColor}40, 0 20px 40px rgba(0,0,0,0.5)`
                                : '0 10px 30px rgba(0,0,0,0.4)',
                              border: isWinner ? `2px solid ${podiumColor}60` : '1px solid rgba(255,255,255,0.1)',
                            }}
                          >
                            {m.poster_url ? (
                              <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, #1a2744, ${voteAccent}20)` }}
                              >
                                <span className="text-2xl opacity-30">🎬</span>
                              </div>
                            )}
                            {isWinner && (
                              <div className="absolute inset-0 pointer-events-none"
                                style={{ boxShadow: `inset 0 0 30px ${podiumColor}20` }}
                              />
                            )}
                          </div>

                          {/* Title */}
                          <div className="text-center max-w-[150px]">
                            <div className={`font-semibold truncate ${isWinner ? 'text-base' : 'text-sm'}`}
                              style={{ color: isWinner ? podiumColor : '#ffffff' }}
                            >
                              {m.title}
                            </div>
                            {m.votes > 0 && (
                              <div className="text-xs opacity-50 mt-0.5">
                                {m.votes} vote{m.votes > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Session countdown if scheduled */}
                {countdown_to && (
                  <div className="flex justify-center mt-4">
                    <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* VOTE IN PROGRESS — Movie grid */}
                <div className="flex-1 flex flex-col">
                  {/* Title */}
                  <h1 className="text-3xl font-bold mb-6 text-center" style={{ color: voteAccent }}>
                    Quel film pour ce soir ?
                  </h1>

                  {/* Movie options grid */}
                  <div className={`flex-1 grid gap-4 ${
                    movieOptions.length <= 2 ? 'grid-cols-2' :
                    movieOptions.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' :
                    movieOptions.length <= 6 ? 'grid-cols-3' :
                    'grid-cols-4'
                  } items-center justify-items-center max-w-5xl mx-auto w-full`}>
                    {movieOptions.map((m, i) => {
                      const voteCount = voteCounts[i] || 0;
                      const barWidth = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

                      return (
                        <div
                          key={i}
                          className="podium-card flex flex-col items-center p-3 rounded-xl w-full max-w-[200px]"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${voteAccent}20`,
                            animationDelay: `${i * 0.5}s`,
                          }}
                        >
                          {/* Poster */}
                          <div className="w-full aspect-[2/3] rounded-lg overflow-hidden mb-3">
                            {m.poster_url ? (
                              <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, #1a2744, ${voteAccent}15)` }}
                              >
                                <span className="text-3xl opacity-30">🎬</span>
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <div className="text-sm font-medium text-center truncate w-full mb-1">
                            {m.title}
                          </div>
                          {m.year && (
                            <div className="text-xs opacity-40 mb-2">{m.year}</div>
                          )}

                          {/* Vote bar (only if show_results_during_voting is enabled) */}
                          {vote_info?.show_results_during_voting && (vote_info?.total_votes ?? 0) > 0 && (
                            <div className="w-full">
                              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${voteAccent}15` }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${barWidth}%`,
                                    background: `linear-gradient(90deg, ${voteAccent}, ${voteAccentLight})`,
                                    animation: `bar-fill 1s ease-out`,
                                    transition: 'width 0.5s ease-out',
                                  }}
                                />
                              </div>
                              <div className="text-xs text-center opacity-40 mt-1">
                                {voteCount} vote{voteCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom info */}
                  <div className="flex items-center justify-center gap-8 mt-4">
                    {/* Vote progress */}
                    {vote_info?.close_when_all_voted && (vote_info?.total_tokens ?? 0) > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm opacity-50">Votes:</span>
                        <span className="text-xl font-bold" style={{ color: voteAccent }}>
                          {vote_info?.total_votes ?? 0} / {vote_info?.total_tokens ?? 0}
                        </span>
                      </div>
                    )}

                    {/* Close countdown */}
                    {vote_info?.closes_at && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm opacity-50">Cloture:</span>
                        <CountdownTimer
                          targetDate={vote_info.closes_at}
                          palette={{ primary: voteAccent, accent: voteAccent, text: '#ffffff' }}
                          size="lg"
                          showSeconds
                          animate
                        />
                      </div>
                    )}
                  </div>

                  {/* Session countdown */}
                  {countdown_to && (
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <span className="text-sm opacity-40">Seance:</span>
                      <CountdownTimer targetDate={countdown_to} palette={palette} size="md" showSeconds animate />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    // SHOWCASE ENRICHED - Premium template leveraging TMDB + Fanart.tv data
    if (layoutStyle === 'showcase-enriched') {
      const currentPoster = allPosters.length > 0
        ? allPosters[posterRotatingIndex % allPosters.length]
        : movie?.poster_url;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes ken-burns-slow {
              0% { transform: scale(1) translate(0, 0); }
              50% { transform: scale(1.06) translate(-0.5%, -0.3%); }
              100% { transform: scale(1) translate(0, 0); }
            }
            @keyframes fade-in-up {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes cast-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes poster-fade {
              0%, 90% { opacity: 1; }
              95%, 100% { opacity: 0; }
            }
            .showcase-backdrop {
              animation: ken-burns-slow ${config?.rotate_interval ?? 20}s ease-in-out infinite;
              transition: opacity 2s ease-in-out;
            }
            .showcase-fade-in {
              animation: fade-in-up 0.8s ease-out both;
            }
            .showcase-glass {
              backdrop-filter: blur(20px) saturate(1.5);
              -webkit-backdrop-filter: blur(20px) saturate(1.5);
              background: rgba(0, 0, 0, 0.35);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 16px;
            }
            .showcase-gradient-bar {
              background: linear-gradient(90deg,
                ${palette?.vibrant || '#6366f1'}60,
                ${palette?.accent || '#8b5cf6'}60,
                ${palette?.vibrant || '#6366f1'}60
              );
              background-size: 200% 100%;
              animation: gradient-shift 6s ease-in-out infinite;
            }
            .showcase-cast-track {
              display: flex;
              gap: 1.5rem;
              animation: cast-marquee 30s linear infinite;
              width: max-content;
            }
            .showcase-poster {
              transition: opacity 1s ease-in-out;
            }
          `}</style>

          {/* Full bleed backdrops with Ken Burns + crossfade */}
          {config?.rotate_backdrops && allBackdrops.length > 1 ? (
            allBackdrops.map((url, i) => (
              <div
                key={`showcase-bd-${i}`}
                className="absolute inset-0 bg-cover bg-center showcase-backdrop"
                style={{
                  backgroundImage: `url(${url})`,
                  opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
                }}
              />
            ))
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center showcase-backdrop"
              style={{ backgroundImage: `url(${effectiveBackdrop})` }}
            />
          ) : null}

          {/* Gradient overlays for readability */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to right, ${palette?.background || '#0a0a0f'}ee 0%, ${palette?.background || '#0a0a0f'}cc 40%, ${palette?.background || '#0a0a0f'}60 60%, transparent 100%)`,
          }} />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#0a0a0f'}cc 0%, transparent 30%, transparent 80%, ${palette?.background || '#0a0a0f'}80 100%)`,
          }} />

          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-0.5 showcase-gradient-bar z-20" />

          {/* Main content: 2 columns */}
          <div className="relative z-10 w-full h-full flex">

            {/* LEFT COLUMN (55%) - Movie info */}
            <div className="w-[55%] h-full flex flex-col justify-between p-10">

              {/* Top: Logo or Title */}
              <div>
                <div className="showcase-fade-in" style={{ animationDelay: '0.2s' }}>
                  {config?.use_logo_image && effectiveLogo ? (
                    <img
                      src={effectiveLogo}
                      alt={movie?.title || ''}
                      className="max-w-[450px] max-h-[140px] object-contain mb-4 drop-shadow-2xl"
                    />
                  ) : (
                    <h1
                      className="text-5xl font-bold mb-1 tracking-tight leading-tight"
                      style={{
                        color: palette?.text || '#ffffff',
                        textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                      }}
                    >
                      {movie?.title}
                    </h1>
                  )}
                </div>

                {/* Original title */}
                {config?.show_original_title && movie?.original_title && movie.original_title !== movie.title && (
                  <div className="showcase-fade-in text-lg opacity-50 italic mb-3" style={{ animationDelay: '0.3s' }}>
                    {movie.original_title}
                  </div>
                )}

                {/* Tagline */}
                {movie?.tagline && (
                  <div className="showcase-fade-in text-xl italic opacity-70 mb-5" style={{
                    animationDelay: '0.4s',
                    color: palette?.accent || '#a5b4fc',
                  }}>
                    "{movie.tagline}"
                  </div>
                )}

                {/* Rating + Year + Runtime row */}
                <div className="showcase-fade-in flex items-center gap-5 mb-5" style={{ animationDelay: '0.5s' }}>
                  {movie?.rating && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" style={{ color: palette?.accent || '#fbbf24' }}>★</span>
                      <span className="text-2xl font-bold">{movie.rating.toFixed(1)}</span>
                      <span className="text-sm opacity-50">/10</span>
                      {movie.vote_count && (
                        <span className="text-xs opacity-40 ml-1">({movie.vote_count.toLocaleString()} votes)</span>
                      )}
                    </div>
                  )}
                  {movie?.year && (
                    <span className="text-lg opacity-70 font-medium">{movie.year}</span>
                  )}
                  {movie?.runtime_minutes && (
                    <span className="text-lg opacity-70">
                      {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>

                {/* Genres pills */}
                {movie?.genres && movie.genres.length > 0 && (
                  <div className="showcase-fade-in flex flex-wrap gap-2 mb-5" style={{ animationDelay: '0.6s' }}>
                    {movie.genres.slice(0, 5).map((genre, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: `${palette?.vibrant || '#6366f1'}25`,
                          color: palette?.vibrant || '#a5b4fc',
                          border: `1px solid ${palette?.vibrant || '#6366f1'}40`,
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Keywords */}
                {movie?.keywords && movie.keywords.length > 0 && (
                  <div className="showcase-fade-in flex flex-wrap gap-1.5 mb-5" style={{ animationDelay: '0.65s' }}>
                    {movie.keywords.slice(0, 6).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs opacity-50"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Directors */}
                {movie?.directors && movie.directors.length > 0 && (
                  <div className="showcase-fade-in mb-3 text-base" style={{ animationDelay: '0.7s' }}>
                    <span className="opacity-50 uppercase tracking-wider text-xs mr-2">Réalisé par</span>
                    <span className="font-semibold opacity-90">{movie.directors.join(', ')}</span>
                  </div>
                )}

                {/* Studios */}
                {config?.show_studios && movie?.studios && movie.studios.length > 0 && (
                  <div className="showcase-fade-in text-sm opacity-40" style={{ animationDelay: '0.8s' }}>
                    {movie.studios.join(' · ')}
                  </div>
                )}
              </div>

              {/* Bottom: Countdown + Session */}
              <div>
                {countdown_to && (
                  <div className="showcase-fade-in mb-4" style={{ animationDelay: '1s' }}>
                    <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                  </div>
                )}
                {session?.name && (
                  <div className="showcase-fade-in text-sm uppercase tracking-[0.3em] opacity-40" style={{ animationDelay: '1.2s' }}>
                    {session.name}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN (45%) - Glass panel */}
            <div className="w-[45%] h-full flex flex-col p-10 pl-0">
              <div className="showcase-glass flex-1 flex flex-col p-8 overflow-hidden showcase-fade-in" style={{ animationDelay: '0.6s' }}>

                {/* Synopsis */}
                {config?.show_overview && movie?.overview && (
                  <div className="mb-6 flex-shrink-0">
                    <div className="text-xs uppercase tracking-wider opacity-40 mb-3" style={{ color: palette?.accent || '#a5b4fc' }}>
                      Synopsis
                    </div>
                    <p className="text-base leading-relaxed opacity-80 line-clamp-6">
                      {movie.overview}
                    </p>
                  </div>
                )}

                {/* Separator */}
                <div className="h-px my-4 flex-shrink-0" style={{
                  background: `linear-gradient(to right, transparent, ${palette?.vibrant || '#ffffff'}30, transparent)`,
                }} />

                {/* Cast - scrolling marquee */}
                {movie?.cast && movie.cast.length > 0 && (
                  <div className="mb-6 flex-shrink-0">
                    <div className="text-xs uppercase tracking-wider opacity-40 mb-3" style={{ color: palette?.accent || '#a5b4fc' }}>
                      Casting
                    </div>
                    <div className="overflow-hidden">
                      {config?.cast_scroll && movie.cast.length > 4 ? (
                        <div className="showcase-cast-track">
                          {[...movie.cast, ...movie.cast].map((name, i) => (
                            <span key={i} className="text-sm opacity-70 whitespace-nowrap">{name}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {movie.cast.map((name, i) => (
                            <span key={i} className="text-sm opacity-70">{name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Poster thumbnail with rotation */}
                {currentPoster && (
                  <div className="flex items-end justify-between mt-4">
                    <div className="flex-shrink-0">
                      <img
                        src={currentPoster}
                        alt={movie?.title || ''}
                        className="w-24 h-36 object-cover rounded-lg shadow-xl showcase-poster"
                        style={{
                          boxShadow: `0 15px 40px -10px ${palette?.primary || '#000'}80`,
                        }}
                      />
                    </div>

                    {/* Enrichment badges */}
                    {config?.show_enrichment_sources && movie?.enrichment_sources && movie.enrichment_sources.length > 0 && (
                      <div className="flex items-center gap-2 opacity-30">
                        {movie.enrichment_sources.includes('tmdb') && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-current">TMDB</span>
                        )}
                        {movie.enrichment_sources.includes('fanart') && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-current">Fanart</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // FANART GALLERY - Full screen backdrop slideshow with minimal overlay
    if (layoutStyle === 'fanart-gallery') {
      const bdCount = allBackdrops.length;
      const progressPct = bdCount > 1 ? ((rotatingIndex % bdCount) + 1) / bdCount * 100 : 100;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes gallery-ken-burns {
              0% { transform: scale(1); }
              100% { transform: scale(1.08); }
            }
            @keyframes gallery-fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .gallery-slide {
              animation: gallery-ken-burns ${config?.rotate_interval ?? 12}s ease-out forwards;
              transition: opacity 1.5s ease-in-out;
            }
            .gallery-info {
              animation: gallery-fade-in 0.6s ease-out both;
            }
          `}</style>

          {/* Full bleed backdrops with crossfade */}
          {config?.rotate_backdrops && bdCount > 1 ? (
            allBackdrops.map((url, i) => (
              <div
                key={`gallery-bd-${i}`}
                className="absolute inset-0 bg-cover bg-center gallery-slide"
                style={{
                  backgroundImage: `url(${url})`,
                  opacity: i === rotatingIndex % bdCount ? 1 : 0,
                }}
              />
            ))
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center gallery-slide"
              style={{ backgroundImage: `url(${effectiveBackdrop})` }}
            />
          ) : null}

          {/* Subtle vignette */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
          }} />

          {/* Bottom gradient for text readability */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#000'}cc 0%, ${palette?.background || '#000'}60 15%, transparent 40%)`,
          }} />

          {/* Top-left: Logo or Title */}
          <div className="absolute top-8 left-10 z-10 gallery-info" style={{ animationDelay: '0.2s' }}>
            {config?.use_logo_image && effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={movie?.title || ''}
                className="max-w-[300px] max-h-[80px] object-contain drop-shadow-2xl"
              />
            ) : (
              <h1 className="text-3xl font-bold drop-shadow-2xl" style={{
                color: palette?.text || '#fff',
              }}>
                {movie?.title}
              </h1>
            )}
          </div>

          {/* Bottom info bar */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-8 flex items-end justify-between">
            {/* Left: movie info */}
            <div className="gallery-info" style={{ animationDelay: '0.4s' }}>
              {/* Title (if logo shown above) */}
              {config?.use_logo_image && effectiveLogo && (
                <h2 className="text-2xl font-bold mb-1 drop-shadow-lg" style={{
                  color: palette?.text || '#fff',
                }}>
                  {movie?.title}
                </h2>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 text-sm opacity-80 mb-2">
                {movie?.year && <span>{movie.year}</span>}
                {movie?.runtime_minutes && (
                  <span>{Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}</span>
                )}
                {movie?.rating && (
                  <span className="flex items-center gap-1">
                    <span style={{ color: palette?.accent || '#fbbf24' }}>★</span>
                    {movie.rating.toFixed(1)}
                  </span>
                )}
                {movie?.directors && movie.directors.length > 0 && (
                  <span className="opacity-70">{movie.directors[0]}</span>
                )}
              </div>

              {/* Genres */}
              {movie?.genres && movie.genres.length > 0 && (
                <div className="flex gap-2">
                  {movie.genres.slice(0, 4).map((g, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.15)',
                      }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: countdown + progress */}
            <div className="gallery-info text-right" style={{ animationDelay: '0.6s' }}>
              {countdown_to && (
                <div className="mb-3">
                  <CountdownTimer targetDate={countdown_to} palette={palette} size="lg" showSeconds animate />
                </div>
              )}

              {/* Slide progress indicator */}
              {bdCount > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-40">{(rotatingIndex % bdCount) + 1}/{bdCount}</span>
                  <div className="w-24 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: palette?.vibrant || palette?.accent || '#fff',
                      }}
                    />
                  </div>
                </div>
              )}

              {session?.name && (
                <div className="text-xs uppercase tracking-widest opacity-30 mt-2">{session.name}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // PANORAMA SLIDE - Backdrops slide horizontally left-to-right
    if (layoutStyle === 'panorama-slide') {
      const bdCount = allBackdrops.length;
      const slideInterval = config?.rotate_interval ?? 10;

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes panorama-slide-in {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            @keyframes panorama-slide-out {
              from { transform: translateX(0); }
              to { transform: translateX(-100%); }
            }
            @keyframes panorama-zoom {
              0% { transform: scale(1); }
              100% { transform: scale(1.05); }
            }
            @keyframes panorama-info-in {
              from { opacity: 0; transform: translateX(-30px); }
              to { opacity: 1; transform: translateX(0); }
            }
            .panorama-active {
              animation: panorama-zoom ${slideInterval}s ease-out forwards;
              z-index: 1;
            }
            .panorama-info {
              animation: panorama-info-in 0.8s ease-out both;
            }
          `}</style>

          {/* Backdrops with horizontal slide transition */}
          {bdCount > 0 ? (
            allBackdrops.map((url, i) => {
              const isActive = i === rotatingIndex % bdCount;
              return (
                <div
                  key={`pano-bd-${i}`}
                  className={`absolute inset-0 bg-cover bg-center ${isActive ? 'panorama-active' : ''}`}
                  style={{
                    backgroundImage: `url(${url})`,
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 1.2s ease-in-out',
                  }}
                />
              );
            })
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center panorama-active"
              style={{ backgroundImage: `url(${effectiveBackdrop})` }}
            />
          ) : null}

          {/* Vignette overlay */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
          }} />

          {/* Left gradient for text readability */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to right, ${palette?.background || '#000'}cc 0%, ${palette?.background || '#000'}80 25%, transparent 50%)`,
          }} />

          {/* Bottom gradient */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#000'}bb 0%, transparent 25%)`,
          }} />

          {/* Left content column */}
          <div className="absolute left-0 top-0 bottom-0 w-[45%] z-10 flex flex-col justify-between p-10">

            {/* Top: Logo or Title */}
            <div className="panorama-info" style={{ animationDelay: '0.2s' }}>
              {config?.use_logo_image && effectiveLogo ? (
                <img
                  src={effectiveLogo}
                  alt={movie?.title || ''}
                  className="max-w-[400px] max-h-[120px] object-contain drop-shadow-2xl"
                />
              ) : movie ? (
                <h1
                  className="text-5xl font-bold tracking-tight drop-shadow-2xl"
                  style={{ color: palette?.text || '#fff' }}
                >
                  {movie.title}
                </h1>
              ) : null}

              {/* Tagline */}
              {movie?.tagline && (
                <p className="text-lg italic opacity-60 mt-3" style={{ color: palette?.accent || '#a5b4fc' }}>
                  "{movie.tagline}"
                </p>
              )}
            </div>

            {/* Middle: Movie info */}
            <div className="panorama-info" style={{ animationDelay: '0.5s' }}>
              {/* Rating */}
              {movie?.rating && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl" style={{ color: palette?.accent || '#fbbf24' }}>★</span>
                  <span className="text-3xl font-bold">{movie.rating.toFixed(1)}</span>
                  <span className="text-base opacity-40">/10</span>
                  {movie.vote_count && (
                    <span className="text-sm opacity-30">({movie.vote_count.toLocaleString()})</span>
                  )}
                </div>
              )}

              {/* Meta: year, runtime */}
              <div className="flex items-center gap-4 text-lg opacity-70 mb-4">
                {movie?.year && <span className="font-medium">{movie.year}</span>}
                {movie?.runtime_minutes && (
                  <>
                    <span className="opacity-30">·</span>
                    <span>{Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}</span>
                  </>
                )}
                {movie?.directors && movie.directors.length > 0 && (
                  <>
                    <span className="opacity-30">·</span>
                    <span>{movie.directors[0]}</span>
                  </>
                )}
              </div>

              {/* Genres */}
              {movie?.genres && movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {movie.genres.slice(0, 4).map((genre, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {movie?.overview && (
                <p className="text-base leading-relaxed opacity-60 line-clamp-3 mb-3">
                  {movie.overview}
                </p>
              )}
            </div>

            {/* Bottom: Countdown + session */}
            <div className="panorama-info" style={{ animationDelay: '0.8s' }}>
              {countdown_to && (
                <div className="mb-3">
                  <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                </div>
              )}
              <div className="flex items-center justify-between">
                {session?.name && (
                  <span className="text-xs uppercase tracking-[0.3em] opacity-30">{session.name}</span>
                )}
                {/* Slide indicator */}
                {bdCount > 1 && (
                  <div className="flex items-center gap-2">
                    {allBackdrops.map((_, i) => (
                      <div
                        key={i}
                        className="w-8 h-0.5 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: i === rotatingIndex % bdCount
                            ? (palette?.vibrant || palette?.accent || '#fff')
                            : 'rgba(255,255,255,0.15)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // MODERN ENRICHED - Modern design with all enriched data, logos, badges
    if (layoutStyle === 'modern-enriched') {
      const bdCount = allBackdrops.length;
      const currentPoster = allPosters.length > 0
        ? allPosters[posterRotatingIndex % allPosters.length]
        : movie?.poster_url;
      const badgeColor = getBadgeColor(config, vote_info, session?.status, palette, mystery_info);
      const badgeText = resolveDynamicText(
        config?.badge?.text || 'Prochainement',
        movie, session, countdown_to, vote_info, mystery_info
      );

      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes modern-ken-burns {
              0% { transform: scale(1.02) translate(0, 0); }
              50% { transform: scale(1.08) translate(-0.5%, -0.3%); }
              100% { transform: scale(1.02) translate(0, 0); }
            }
            @keyframes modern-fade-in {
              from { opacity: 0; transform: translateY(15px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gradient-border-spin {
              0% { --angle: 0deg; }
              100% { --angle: 360deg; }
            }
            @keyframes modern-cast-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            @keyframes glow-pulse {
              0%, 100% { box-shadow: 0 0 15px ${badgeColor}60, 0 0 30px ${badgeColor}20; }
              50% { box-shadow: 0 0 25px ${badgeColor}80, 0 0 50px ${badgeColor}40; }
            }
            @keyframes border-flow {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .modern-backdrop {
              animation: modern-ken-burns ${config?.rotate_interval ?? 15}s ease-in-out infinite;
              transition: opacity 2s ease-in-out;
            }
            .modern-fade {
              animation: modern-fade-in 0.7s ease-out both;
            }
            .modern-glass {
              backdrop-filter: blur(24px) saturate(1.4);
              -webkit-backdrop-filter: blur(24px) saturate(1.4);
              background: rgba(0, 0, 0, 0.3);
              border: 1px solid rgba(255, 255, 255, 0.06);
            }
            .modern-badge-gradient-border {
              position: relative;
              background: ${palette?.background || '#0a0a0f'};
              border-radius: 9999px;
              padding: 2px;
              animation: glow-pulse 3s ease-in-out infinite;
            }
            .modern-badge-gradient-border::before {
              content: '';
              position: absolute;
              inset: 0;
              border-radius: 9999px;
              padding: 2px;
              background: linear-gradient(135deg, ${badgeColor}, ${palette?.accent || '#8b5cf6'}, ${badgeColor});
              background-size: 200% 200%;
              animation: border-flow 4s ease-in-out infinite;
              -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
              -webkit-mask-composite: xor;
              mask-composite: exclude;
            }
            .modern-cast-track {
              display: flex;
              gap: 2rem;
              animation: modern-cast-scroll 35s linear infinite;
              width: max-content;
            }
          `}</style>

          {/* Full bleed backdrops with Ken Burns + crossfade */}
          {config?.rotate_backdrops && bdCount > 1 ? (
            allBackdrops.map((url, i) => (
              <div
                key={`modern-bd-${i}`}
                className="absolute inset-0 bg-cover bg-center modern-backdrop"
                style={{
                  backgroundImage: `url(${url})`,
                  opacity: i === rotatingIndex % bdCount ? 1 : 0,
                }}
              />
            ))
          ) : effectiveBackdrop ? (
            <div
              className="absolute inset-0 bg-cover bg-center modern-backdrop"
              style={{ backgroundImage: `url(${effectiveBackdrop})` }}
            />
          ) : null}

          {/* Multi-layer gradient overlay */}
          <div className="absolute inset-0" style={{
            background: `linear-gradient(135deg, ${palette?.background || '#0a0a0f'}ee 0%, ${palette?.background || '#0a0a0f'}bb 35%, ${palette?.background || '#0a0a0f'}60 60%, ${palette?.background || '#0a0a0f'}90 100%)`,
          }} />
          <div className="absolute inset-0" style={{
            background: `linear-gradient(to top, ${palette?.background || '#0a0a0f'}dd 0%, transparent 40%, transparent 70%, ${palette?.background || '#0a0a0f'}99 100%)`,
          }} />

          {/* Badge - top right with gradient border effect */}
          {badgeText && config?.badge?.show_when !== 'never' && (
            <div className="absolute top-8 right-10 z-20">
              <div className="modern-badge-gradient-border">
                <div
                  className="px-5 py-2 rounded-full font-semibold text-sm uppercase tracking-wider flex items-center gap-2"
                  style={{
                    background: `${palette?.background || '#0a0a0f'}`,
                    color: badgeColor,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: badgeColor,
                      animation: 'blink 1.5s ease-in-out infinite',
                    }}
                  />
                  {badgeText}
                </div>
              </div>
            </div>
          )}

          {/* Main content grid */}
          <div className="relative z-10 w-full h-full flex">

            {/* LEFT (60%) - Info */}
            <div className="w-[60%] h-full flex flex-col justify-between p-10">

              {/* Top section */}
              <div>
                {/* Logo or Title */}
                <div className="modern-fade" style={{ animationDelay: '0.2s' }}>
                  {config?.use_logo_image && effectiveLogo ? (
                    <img
                      src={effectiveLogo}
                      alt={movie?.title || ''}
                      className="max-w-[420px] max-h-[130px] object-contain mb-4 drop-shadow-2xl"
                    />
                  ) : movie ? (
                    <h1
                      className="text-5xl font-bold mb-2 tracking-tight"
                      style={{
                        color: palette?.text || '#ffffff',
                        textShadow: '0 4px 30px rgba(0,0,0,0.6)',
                      }}
                    >
                      {movie.title}
                    </h1>
                  ) : null}
                </div>

                {/* Original title */}
                {movie?.original_title && movie.original_title !== movie?.title && (
                  <div className="modern-fade text-base opacity-40 italic mb-3" style={{ animationDelay: '0.3s' }}>
                    {movie.original_title}
                  </div>
                )}

                {/* Tagline */}
                {movie?.tagline && (
                  <div className="modern-fade text-lg italic opacity-60 mb-5" style={{
                    animationDelay: '0.35s',
                    color: palette?.accent || '#a5b4fc',
                  }}>
                    "{movie.tagline}"
                  </div>
                )}

                {/* Rating row */}
                <div className="modern-fade flex items-center gap-5 mb-5" style={{ animationDelay: '0.4s' }}>
                  {movie?.rating && (
                    <div className="flex items-center gap-2">
                      {/* Star rating visual */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className="text-lg"
                            style={{
                              color: movie.rating! >= star * 2
                                ? (palette?.accent || '#fbbf24')
                                : movie.rating! >= star * 2 - 1
                                  ? (palette?.accent || '#fbbf24')
                                  : 'rgba(255,255,255,0.15)',
                              opacity: movie.rating! >= star * 2 ? 1 : movie.rating! >= star * 2 - 1 ? 0.5 : 1,
                            }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xl font-bold ml-1">{movie.rating.toFixed(1)}</span>
                      {movie.vote_count && (
                        <span className="text-xs opacity-30">({movie.vote_count.toLocaleString()})</span>
                      )}
                    </div>
                  )}
                  {movie?.year && (
                    <div className="px-3 py-1 rounded-md text-sm font-medium" style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      {movie.year}
                    </div>
                  )}
                  {movie?.runtime_minutes && (
                    <div className="px-3 py-1 rounded-md text-sm" style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>

                {/* Genres pills */}
                {movie?.genres && movie.genres.length > 0 && (
                  <div className="modern-fade flex flex-wrap gap-2 mb-5" style={{ animationDelay: '0.5s' }}>
                    {movie.genres.slice(0, 5).map((genre, i) => (
                      <span
                        key={i}
                        className="px-4 py-1.5 rounded-full text-sm font-medium"
                        style={{
                          background: `linear-gradient(135deg, ${palette?.vibrant || '#6366f1'}20, ${palette?.accent || '#8b5cf6'}15)`,
                          color: palette?.vibrant || '#a5b4fc',
                          border: `1px solid ${palette?.vibrant || '#6366f1'}30`,
                        }}
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Director */}
                {movie?.directors && movie.directors.length > 0 && (
                  <div className="modern-fade mb-3" style={{ animationDelay: '0.55s' }}>
                    <span className="text-xs uppercase tracking-wider opacity-40 mr-2">Réalisé par</span>
                    <span className="text-base font-semibold opacity-85">{movie.directors.join(', ')}</span>
                  </div>
                )}

                {/* Studios */}
                {config?.show_studios && movie?.studios && movie.studios.length > 0 && (
                  <div className="modern-fade text-sm opacity-35 mb-4" style={{ animationDelay: '0.6s' }}>
                    {movie.studios.join(' · ')}
                  </div>
                )}
              </div>

              {/* Bottom: Countdown */}
              <div>
                {countdown_to && (
                  <div className="modern-fade mb-4" style={{ animationDelay: '0.9s' }}>
                    <CountdownTimer targetDate={countdown_to} palette={palette} size="xl" showSeconds animate />
                  </div>
                )}
                {session?.name && (
                  <div className="modern-fade text-xs uppercase tracking-[0.3em] opacity-30" style={{ animationDelay: '1s' }}>
                    {session.name}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT (40%) - Glass panel with synopsis, cast, poster */}
            <div className="w-[40%] h-full flex flex-col p-10 pl-0">
              <div className="modern-glass rounded-2xl flex-1 flex flex-col p-8 overflow-hidden modern-fade" style={{ animationDelay: '0.5s' }}>

                {/* Synopsis */}
                {config?.show_overview && movie?.overview && (
                  <div className="mb-5 flex-shrink-0">
                    <div className="text-xs uppercase tracking-wider opacity-35 mb-3" style={{ color: palette?.accent || '#a5b4fc' }}>
                      Synopsis
                    </div>
                    <p className="text-sm leading-relaxed opacity-75 line-clamp-5">
                      {movie.overview}
                    </p>
                  </div>
                )}

                {/* Separator */}
                <div className="h-px my-3 flex-shrink-0" style={{
                  background: `linear-gradient(to right, transparent, ${palette?.vibrant || '#ffffff'}20, transparent)`,
                }} />

                {/* Cast */}
                {movie?.cast && movie.cast.length > 0 && (
                  <div className="mb-5 flex-shrink-0">
                    <div className="text-xs uppercase tracking-wider opacity-35 mb-3" style={{ color: palette?.accent || '#a5b4fc' }}>
                      Casting
                    </div>
                    <div className="overflow-hidden">
                      {config?.cast_scroll && movie.cast.length > 4 ? (
                        <div className="modern-cast-track">
                          {[...movie.cast, ...movie.cast].map((name, i) => (
                            <span key={i} className="text-sm opacity-65 whitespace-nowrap">{name}</span>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {movie.cast.slice(0, 8).map((name, i) => (
                            <span key={i} className="text-sm opacity-65">{name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {movie?.keywords && movie.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 flex-shrink-0">
                    {movie.keywords.slice(0, 5).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs opacity-35"
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Bottom: poster + enrichment sources */}
                <div className="flex items-end justify-between mt-4">
                  {currentPoster && (
                    <img
                      src={currentPoster}
                      alt={movie?.title || ''}
                      className="w-20 h-28 object-cover rounded-lg shadow-xl"
                      style={{
                        boxShadow: `0 12px 35px -8px ${palette?.primary || '#000'}80`,
                        transition: 'opacity 1s ease',
                      }}
                    />
                  )}

                  {/* Enrichment source badges */}
                  {config?.show_enrichment_sources && movie?.enrichment_sources && movie.enrichment_sources.length > 0 && (
                    <div className="flex items-center gap-2">
                      {movie.enrichment_sources.includes('tmdb') && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: `linear-gradient(135deg, #01d277 0%, #01b4e4 100%)`,
                            color: '#fff',
                            opacity: 0.6,
                          }}
                        >
                          TMDB
                        </span>
                      )}
                      {movie.enrichment_sources.includes('fanart') && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: `linear-gradient(135deg, #1da1f2 0%, #0d95e8 100%)`,
                            color: '#fff',
                            opacity: 0.6,
                          }}
                        >
                          Fanart
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // DEBUG TMDB - Simple template showing all TMDB data explicitly
    if (layoutStyle === 'debug-tmdb') {
      const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="flex gap-3 py-1.5 border-b border-white/10">
          <span className="text-yellow-400 font-mono text-sm w-44 flex-shrink-0 text-right">{label}</span>
          <span className="text-white/90 text-sm">{value || <span className="text-red-400/60 italic">vide</span>}</span>
        </div>
      );

      return (
        <div className="w-full h-full overflow-auto p-8" style={{ backgroundColor: '#0c0c14', color: '#e0e0e0', fontFamily: 'monospace' }}>
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-yellow-400 mb-1">Debug TMDB Data</h1>
            <p className="text-xs text-white/30 mb-6">Template de verification des donnees enrichies</p>

            <div className="grid grid-cols-2 gap-8">
              {/* Left: text fields */}
              <div>
                <h2 className="text-lg font-bold text-cyan-400 mb-3 border-b border-cyan-400/30 pb-1">Infos de base</h2>
                <Field label="Titre" value={movie?.title} />
                <Field label="Titre original" value={movie?.original_title} />
                <Field label="Annee" value={movie?.year} />
                <Field label="Duree" value={movie?.runtime_minutes ? `${movie.runtime_minutes} min (${Math.floor(movie.runtime_minutes / 60)}h${String(movie.runtime_minutes % 60).padStart(2, '0')})` : undefined} />
                <Field label="Tagline" value={movie?.tagline} />
                <Field label="Note TMDB" value={movie?.rating ? `${movie.rating.toFixed(1)}/10` : undefined} />
                <Field label="Nombre de votes" value={movie?.vote_count?.toLocaleString()} />
                <Field label="Synopsis" value={movie?.overview ? <span className="line-clamp-3">{movie.overview}</span> : undefined} />

                <h2 className="text-lg font-bold text-cyan-400 mt-6 mb-3 border-b border-cyan-400/30 pb-1">Listes</h2>
                <Field label="Genres" value={movie?.genres?.length ? movie.genres.join(', ') : undefined} />
                <Field label="Realisateurs" value={movie?.directors?.length ? movie.directors.join(', ') : undefined} />
                <Field label="Casting" value={movie?.cast?.length ? `${movie.cast.length} acteurs: ${movie.cast.join(', ')}` : undefined} />
                <Field label="Studios" value={movie?.studios?.length ? movie.studios.join(', ') : undefined} />
                <Field label="Mots-cles" value={movie?.keywords?.length ? movie.keywords.join(', ') : undefined} />

                <h2 className="text-lg font-bold text-cyan-400 mt-6 mb-3 border-b border-cyan-400/30 pb-1">Enrichissement</h2>
                <Field label="Sources" value={movie?.enrichment_sources?.length ? movie.enrichment_sources.join(', ') : undefined} />
              </div>

              {/* Right: images */}
              <div>
                <h2 className="text-lg font-bold text-green-400 mb-3 border-b border-green-400/30 pb-1">Images</h2>

                <div className="mb-4">
                  <div className="text-xs text-yellow-400 mb-1">Poster principal</div>
                  {movie?.poster_url ? (
                    <img src={movie.poster_url} alt="poster" className="w-32 h-48 object-cover rounded border border-white/20" />
                  ) : <span className="text-red-400/60 text-sm italic">aucun</span>}
                </div>

                <div className="mb-4">
                  <div className="text-xs text-yellow-400 mb-1">Backdrop principal</div>
                  {movie?.backdrop_url ? (
                    <img src={movie.backdrop_url} alt="backdrop" className="w-64 h-36 object-cover rounded border border-white/20" />
                  ) : <span className="text-red-400/60 text-sm italic">aucun</span>}
                </div>

                <div className="mb-4">
                  <div className="text-xs text-yellow-400 mb-1">Logos ({movie?.logos?.length || 0})</div>
                  {movie?.logos && movie.logos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {movie.logos.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt={`logo-${i}`} className="h-12 object-contain bg-white/10 rounded p-1" />
                      ))}
                    </div>
                  ) : <span className="text-red-400/60 text-sm italic">aucun</span>}
                </div>

                <div className="mb-4">
                  <div className="text-xs text-yellow-400 mb-1">Extra backdrops ({movie?.extra_backdrops?.length || 0})</div>
                  {movie?.extra_backdrops && movie.extra_backdrops.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {movie.extra_backdrops.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt={`bd-${i}`} className="w-28 h-16 object-cover rounded border border-white/10" />
                      ))}
                      {movie.extra_backdrops.length > 4 && <span className="text-xs text-white/40 self-end">+{movie.extra_backdrops.length - 4}</span>}
                    </div>
                  ) : <span className="text-red-400/60 text-sm italic">aucun</span>}
                </div>

                <div className="mb-4">
                  <div className="text-xs text-yellow-400 mb-1">Extra posters ({movie?.extra_posters?.length || 0})</div>
                  {movie?.extra_posters && movie.extra_posters.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {movie.extra_posters.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt={`poster-${i}`} className="w-16 h-24 object-cover rounded border border-white/10" />
                      ))}
                      {movie.extra_posters.length > 4 && <span className="text-xs text-white/40 self-end">+{movie.extra_posters.length - 4}</span>}
                    </div>
                  ) : <span className="text-red-400/60 text-sm italic">aucun</span>}
                </div>

                <h2 className="text-lg font-bold text-green-400 mt-4 mb-3 border-b border-green-400/30 pb-1">Session</h2>
                <Field label="Nom" value={session?.name} />
                <Field label="Countdown" value={countdown_to} />

                {palette && (
                  <>
                    <h2 className="text-lg font-bold text-purple-400 mt-4 mb-3 border-b border-purple-400/30 pb-1">Palette</h2>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(palette).filter(([k]) => k !== 'css_vars').map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: val as string }} />
                          <span className="text-xs text-white/60">{key}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ====================================================================
    // WAITING SCREEN layouts — dispatcher
    // ====================================================================
    if (layoutStyle.startsWith('waiting-') || layoutStyle.startsWith('quiz-')) {
      const hasComp = (type: string) => layout.components.some((c) => c.type === type);
      const bg = palette?.background || '#0a0a0f';
      const accent = palette?.accent || palette?.vibrant || '#6366f1';
      const txt = palette?.text || '#ffffff';

      // --- WAITING-SESSION-INFO: full session overview with movie info + programme ---
      if (layoutStyle === 'waiting-session-info') {
        const overview = session_overview;
        const iconMap: Record<string, string> = {
          film: '\uD83C\uDFAC', coffee: '\u2615', quiz: '\uD83C\uDFAF', audio: '\uD83D\uDD0A',
          lighting: '\uD83D\uDCA1', monitor: '\uD83D\uDCFA', text: '\uD83D\uDCDD', image: '\uD83D\uDDBC\uFE0F',
          default: '\u25B6',
        };
        const fmtDur = (ms: number) => {
          const totalMin = Math.round(ms / 60000);
          if (totalMin >= 60) {
            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;
            return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
          }
          return `${totalMin} min`;
        };
        const fmtTime = (iso: string) => {
          try {
            const d = new Date(iso);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          } catch { return ''; }
        };
        // Primary label per sequence = first action label (most meaningful)
        const seqLabel = (seq: NonNullable<typeof overview>['sequences'][number]) => {
          if (seq.actions.length > 0) return seq.actions[0].label;
          return seq.name;
        };
        const seqIcon = (seq: NonNullable<typeof overview>['sequences'][number]) => {
          if (seq.actions.length > 0) return iconMap[seq.actions[0].icon] || iconMap.default;
          return iconMap.default;
        };
        const currentIdx = overview?.current_sequence_index ?? 0;

        return (
          <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
            <style>{`
              @keyframes wsi-fade-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes wsi-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
              @keyframes wsi-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
              .wsi-anim { animation: wsi-fade-in 0.8s ease-out both; }
              .wsi-current { animation: wsi-pulse 2s ease-in-out infinite; }
            `}</style>

            {/* Blurred backdrop */}
            {effectiveBackdrop && (
              <div className="absolute inset-0">
                <div className="absolute inset-0 bg-cover bg-center" style={{
                  backgroundImage: `url(${effectiveBackdrop})`,
                  filter: 'blur(40px) brightness(0.18) saturate(1.2)',
                  transform: 'scale(1.1)',
                }} />
              </div>
            )}
            {/* Dark overlay with subtle gradient */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(160deg, ${bg}e6 0%, ${bg}cc 40%, ${accent}10 100%)`,
            }} />

            {/* Content */}
            <div className="relative z-10 w-full h-full flex flex-col p-10 overflow-hidden">

              {/* ---- TOP: Movie info row ---- */}
              {movie && (
                <div className="wsi-anim flex gap-8 mb-8" style={{ animationDelay: '0.1s' }}>
                  {/* Poster */}
                  {effectivePoster && (
                    <div className="flex-shrink-0">
                      <img
                        src={effectivePoster}
                        alt={movie.title}
                        className="h-[38vh] rounded-xl object-cover"
                        style={{ boxShadow: `0 20px 60px -15px ${accent}50, 0 8px 30px -8px rgba(0,0,0,0.7)` }}
                      />
                    </div>
                  )}
                  {/* Movie details */}
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    {/* Logo or title */}
                    {config?.use_logo_image && effectiveLogo ? (
                      <img src={effectiveLogo} alt="" className="max-w-[360px] max-h-[80px] object-contain mb-3 drop-shadow-2xl wsi-anim" style={{ animationDelay: '0.2s' }} />
                    ) : (
                      <h1 className="wsi-anim text-4xl font-bold tracking-tight mb-2" style={{ animationDelay: '0.2s', color: txt, textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                        {movie.title}
                        {movie.year && <span className="ml-3 text-xl font-light opacity-50">({movie.year})</span>}
                      </h1>
                    )}
                    {/* Rating + Runtime + Genres row */}
                    <div className="wsi-anim flex flex-wrap items-center gap-3 mb-3" style={{ animationDelay: '0.3s' }}>
                      {movie.rating && (
                        <span className="flex items-center gap-1 text-sm">
                          <span style={{ color: accent }}>&#9733;</span>
                          <span style={{ color: `${txt}cc` }}>{movie.rating.toFixed(1)}</span>
                        </span>
                      )}
                      {movie.runtime_minutes && (
                        <span className="text-sm opacity-60" style={{ color: txt }}>
                          {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                        </span>
                      )}
                      {movie.genres?.slice(0, 4).map((g, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-full text-xs border" style={{
                          borderColor: `${accent}30`, color: `${txt}bb`, backgroundColor: `${accent}0d`,
                        }}>{g}</span>
                      ))}
                    </div>
                    {/* Tagline */}
                    {movie.tagline && (
                      <p className="wsi-anim text-base italic opacity-50 mb-3" style={{ animationDelay: '0.4s', color: txt }}>
                        &laquo; {movie.tagline} &raquo;
                      </p>
                    )}
                    {/* Director */}
                    {movie.directors && movie.directors.length > 0 && (
                      <p className="wsi-anim text-sm opacity-50 mb-2" style={{ animationDelay: '0.45s', color: txt }}>
                        {movie.directors.length === 1 ? 'Realise par' : 'Realise par'} {movie.directors.join(', ')}
                      </p>
                    )}
                    {/* Cast */}
                    {movie.cast && movie.cast.length > 0 && (
                      <p className="wsi-anim text-sm opacity-40 mb-3" style={{ animationDelay: '0.5s', color: txt }}>
                        Avec {movie.cast.slice(0, 4).join(', ')}
                      </p>
                    )}
                    {/* Participants badge */}
                    {overview && overview.participants_total > 0 && (
                      <div className="wsi-anim flex items-center gap-2 mt-1" style={{ animationDelay: '0.55s' }}>
                        <span className="text-lg">&#128101;</span>
                        <span className="text-sm font-medium" style={{ color: `${txt}cc` }}>
                          {overview.participants_accepted}/{overview.participants_total} participants
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ---- PROGRAMME ---- */}
              {overview && overview.sequences.length > 0 && (
                <div className="wsi-anim flex-1 flex flex-col min-h-0" style={{ animationDelay: '0.6s' }}>
                  {/* Section title */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-px flex-1" style={{ backgroundColor: `${accent}25` }} />
                    <span className="text-xs uppercase tracking-[0.25em] font-semibold" style={{ color: `${accent}90` }}>
                      Programme de la seance
                    </span>
                    <div className="h-px flex-1" style={{ backgroundColor: `${accent}25` }} />
                  </div>

                  {/* Sequence list */}
                  <div className="flex flex-col gap-1.5 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                    {overview.sequences.map((seq, idx) => {
                      const isPast = idx < currentIdx;
                      const isCurrent = idx === currentIdx;
                      const label = seqLabel(seq);
                      const icon = seqIcon(seq);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${isCurrent ? 'wsi-current' : ''}`}
                          style={{
                            opacity: isPast ? 0.35 : isCurrent ? 1 : 0.75,
                            backgroundColor: isCurrent ? `${accent}15` : 'transparent',
                            borderLeft: isCurrent ? `3px solid ${accent}` : '3px solid transparent',
                          }}
                        >
                          {/* Icon */}
                          <span className="text-lg w-7 text-center flex-shrink-0">{icon}</span>
                          {/* Current indicator */}
                          {isCurrent && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent, boxShadow: `0 0 8px ${accent}` }} />
                          )}
                          {/* Label */}
                          <span className="flex-1 text-sm font-medium truncate" style={{ color: isCurrent ? txt : `${txt}cc` }}>
                            {label}
                          </span>
                          {/* Duration */}
                          {seq.duration_ms > 0 && (
                            <span className="text-xs font-mono opacity-50 flex-shrink-0" style={{ color: txt }}>
                              {fmtDur(seq.duration_ms)}
                            </span>
                          )}
                          {seq.duration_type === 'manual' && (
                            <span className="text-xs opacity-40 flex-shrink-0" style={{ color: txt }}>manuel</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ---- BOTTOM: Total duration + End time + Countdown ---- */}
              <div className="wsi-anim mt-4 pt-4" style={{ animationDelay: '0.8s', borderTop: `1px solid ${accent}20` }}>
                <div className="flex items-center justify-between mb-3">
                  {overview && overview.total_duration_ms > 0 && (
                    <span className="text-sm opacity-50" style={{ color: txt }}>
                      Duree totale : <span className="font-semibold opacity-80">{fmtDur(overview.total_duration_ms)}</span>
                    </span>
                  )}
                  {overview?.estimated_end_time && (
                    <span className="text-sm opacity-50" style={{ color: txt }}>
                      Fin estimee : <span className="font-semibold opacity-80">{fmtTime(overview.estimated_end_time)}</span>
                    </span>
                  )}
                </div>
                {/* Sequence countdown */}
                {sequenceRemaining !== null && sequenceRemaining > 0 && (
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-px flex-1" style={{ backgroundColor: `${accent}20` }} />
                    <span className="text-2xl font-mono font-bold tracking-wider" style={{ color: accent, textShadow: `0 0 20px ${accent}40` }}>
                      {formatSeqCountdown(sequenceRemaining)}
                    </span>
                    <div className="h-px flex-1" style={{ backgroundColor: `${accent}20` }} />
                  </div>
                )}
                {/* Session name */}
                {session?.name && (
                  <div className="text-center mt-3">
                    <span className="text-xs uppercase tracking-[0.2em] opacity-30" style={{ color: txt }}>{session.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // --- WAITING-CINEMA: generic cinema ambiance, no movie data ---
      if (layoutStyle === 'waiting-cinema') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#050510' }}>
            <style>{`
              @keyframes wc-gradient { 0%,100%{ background-position:0% 50% } 50%{ background-position:100% 50% } }
              @keyframes wc-fade-in { from{ opacity:0; transform:translateY(30px) } to{ opacity:1; transform:translateY(0) } }
              @keyframes wc-strip { 0%{ transform:translateX(0) } 100%{ transform:translateX(-50%) } }
              .wc-info { animation: wc-fade-in 1.2s ease-out both; }
            `}</style>
            {/* Animated gradient background */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 25%, #0a1a2e 50%, #0a0a1a 75%, #1a0a1a 100%)',
              backgroundSize: '400% 400%',
              animation: 'wc-gradient 20s ease-in-out infinite',
            }} />
            {/* Film strip decoration top */}
            <div className="absolute top-0 left-0 right-0 h-12 overflow-hidden opacity-15">
              <div className="flex" style={{ width: '200%', animation: 'wc-strip 30s linear infinite' }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-16 h-12 border-x-2 border-white/30 flex items-center justify-center">
                    <div className="w-10 h-7 rounded-sm bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
            {/* Film strip decoration bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-12 overflow-hidden opacity-15">
              <div className="flex" style={{ width: '200%', animation: 'wc-strip 30s linear infinite reverse' }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-16 h-12 border-x-2 border-white/30 flex items-center justify-center">
                    <div className="w-10 h-7 rounded-sm bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {session?.name && (
                <h1 className="wc-info text-5xl font-light tracking-[0.15em] text-white/90 mb-6" style={{ animationDelay: '0.3s' }}>
                  {session.name}
                </h1>
              )}
              <div className="wc-info w-24 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent mb-6" style={{ animationDelay: '0.6s' }} />
              <p className="wc-info text-lg text-white/40 tracking-[0.2em] uppercase" style={{ animationDelay: '0.9s' }}>
                La seance va bientot commencer
              </p>
              {/* Sequence countdown */}
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <div className="wc-info mt-10 flex flex-col items-center" style={{ animationDelay: '1.2s' }}>
                  <span className="text-6xl font-extralight tracking-[0.1em] text-white/60">
                    {formatSeqCountdown(sequenceRemaining)}
                  </span>
                  {sequenceProgress !== null && (
                    <div className="mt-4 w-48 h-px bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-white/30 transition-all duration-1000" style={{ width: `${sequenceProgress * 100}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      // --- WAITING-ANNONCE: glass card with message ---
      if (layoutStyle === 'waiting-annonce') {
        const customText = layout.components.find((c) => c.type === 'custom_text');
        const msgText = (customText as any)?.text || 'Bienvenue !';
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#080818' }}>
            <style>{`
              @keyframes wa-particle { 0%{ transform:translateY(100vh) scale(0); opacity:0 } 10%{ opacity:0.4 } 90%{ opacity:0.4 } 100%{ transform:translateY(-5vh) scale(1); opacity:0 } }
              @keyframes wa-fade-in { from{ opacity:0; transform:translateY(20px) scale(0.98) } to{ opacity:1; transform:translateY(0) scale(1) } }
              .wa-info { animation: wa-fade-in 0.8s ease-out both; }
            `}</style>
            {/* Particles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 3 + Math.random() * 4, height: 3 + Math.random() * 4,
                  left: `${Math.random() * 100}%`,
                  background: `${accent}60`,
                  animation: `wa-particle ${8 + Math.random() * 12}s linear infinite`,
                  animationDelay: `${Math.random() * 10}s`,
                }}
              />
            ))}
            {/* Badge "Prochainement" */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 wa-info" style={{ animationDelay: '0.2s' }}>
              <span className="px-5 py-2 rounded-full text-sm font-medium backdrop-blur-md" style={{
                backgroundColor: `${accent}25`, color: txt, border: `1px solid ${accent}40`,
              }}>
                Prochainement
              </span>
            </div>
            {/* Glass card */}
            <div className="relative z-10 w-full h-full flex items-center justify-center p-12">
              <div className="wa-info max-w-xl w-full rounded-2xl p-10 text-center" style={{
                animationDelay: '0.4s',
                backgroundColor: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
              }}>
                <p className="text-2xl leading-relaxed" style={{ color: txt }}>{msgText}</p>
              </div>
            </div>
            {/* Session info bottom */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 wa-info" style={{ animationDelay: '0.8s' }}>
                <span className="text-sm uppercase tracking-[0.3em] opacity-40" style={{ color: txt }}>{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-TRAILERS: cinematic trailer announcement ---
      if (layoutStyle === 'waiting-trailers') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#030318' }}>
            <style>{`
              @keyframes wtr-beam { 0%,100%{ opacity:0.3; transform:rotate(-8deg) scaleY(1) } 50%{ opacity:0.6; transform:rotate(-5deg) scaleY(1.05) } }
              @keyframes wtr-beam2 { 0%,100%{ opacity:0.2; transform:rotate(6deg) scaleY(1) } 50%{ opacity:0.5; transform:rotate(8deg) scaleY(1.05) } }
              @keyframes wtr-fade-in { from{ opacity:0; transform:translateY(20px) } to{ opacity:1; transform:translateY(0) } }
              @keyframes wtr-pulse-ring { 0%{ transform:scale(0.95); opacity:0.5 } 50%{ transform:scale(1.05); opacity:1 } 100%{ transform:scale(0.95); opacity:0.5 } }
              @keyframes wtr-count { 0%{ transform:scale(1.2); opacity:0 } 20%{ transform:scale(1); opacity:1 } 80%{ transform:scale(1); opacity:1 } 100%{ transform:scale(0.8); opacity:0 } }
              .wtr-info { animation: wtr-fade-in 1s ease-out both; }
            `}</style>
            {/* Projector beams */}
            <div className="absolute top-0 left-1/4 w-[600px] h-full origin-top opacity-30" style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 70%)',
              animation: 'wtr-beam 8s ease-in-out infinite', filter: 'blur(40px)',
            }} />
            <div className="absolute top-0 right-1/4 w-[400px] h-full origin-top opacity-20" style={{
              background: 'linear-gradient(180deg, rgba(180,160,255,0.12) 0%, transparent 60%)',
              animation: 'wtr-beam2 10s ease-in-out infinite', filter: 'blur(30px)',
            }} />
            {/* Floating particles (dust in projector light) */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white/20" style={{
                width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
                left: `${20 + Math.random() * 60}%`, top: `${Math.random() * 80}%`,
                animation: `wa-particle ${10 + Math.random() * 15}s linear infinite`,
                animationDelay: `${Math.random() * 8}s`,
              }} />
            ))}
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {/* Play icon with pulse ring */}
              <div className="wtr-info relative mb-8" style={{ animationDelay: '0.2s' }}>
                <div className="absolute inset-0 rounded-full border-2 border-white/20" style={{ animation: 'wtr-pulse-ring 3s ease-in-out infinite' }} />
                <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="white" className="ml-1">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                </div>
              </div>
              {/* Title */}
              <h1 className="wtr-info text-5xl font-light tracking-[0.15em] text-white/90 mb-4" style={{ animationDelay: '0.5s' }}>
                Bandes-Annonces
              </h1>
              <div className="wtr-info w-32 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mb-5" style={{ animationDelay: '0.7s' }} />
              <p className="wtr-info text-lg text-white/40 tracking-wider" style={{ animationDelay: '0.9s' }}>
                Les bandes-annonces vont commencer
              </p>
              {/* Sequence countdown if available */}
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <div className="wtr-info mt-8 flex flex-col items-center" style={{ animationDelay: '1.1s' }}>
                  <span className="text-4xl font-mono font-light text-white/70 tracking-widest">
                    {formatSeqCountdown(sequenceRemaining)}
                  </span>
                </div>
              )}
            </div>
            {/* Session name bottom */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 wtr-info" style={{ animationDelay: '1.2s' }}>
                <span className="text-xs uppercase tracking-[0.3em] opacity-30 text-white">{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-TRAILERS-RETRO: vintage film strip countdown ---
      if (layoutStyle === 'waiting-trailers-retro') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#1a1008' }}>
            <style>{`
              @keyframes wtr2-grain { 0%,100%{ transform:translate(0,0) } 10%{ transform:translate(-1%,-1%) } 30%{ transform:translate(1%,2%) } 50%{ transform:translate(-2%,1%) } 70%{ transform:translate(2%,-1%) } }
              @keyframes wtr2-vignette-pulse { 0%,100%{ opacity:0.7 } 50%{ opacity:0.5 } }
              @keyframes wtr2-number { 0%{ transform:scale(2) rotate(-10deg); opacity:0 } 15%{ transform:scale(1) rotate(0); opacity:1 } 85%{ transform:scale(1) rotate(0); opacity:1 } 100%{ transform:scale(0.5) rotate(10deg); opacity:0 } }
              @keyframes wtr2-fade-in { from{ opacity:0 } to{ opacity:1 } }
              @keyframes wtr2-strip { 0%{ transform:translateX(0) } 100%{ transform:translateX(-50%) } }
              .wtr2-info { animation: wtr2-fade-in 1s ease-out both; }
            `}</style>
            {/* Film grain overlay */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'256\' height=\'256\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
              animation: 'wtr2-grain 0.5s steps(4) infinite',
            }} />
            {/* Sepia vignette */}
            <div className="absolute inset-0" style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(20,10,0,0.8) 100%)',
              animation: 'wtr2-vignette-pulse 4s ease-in-out infinite',
            }} />
            {/* Film strips top/bottom */}
            <div className="absolute top-0 left-0 right-0 h-14 overflow-hidden opacity-25">
              <div className="flex" style={{ width: '200%', animation: 'wtr2-strip 20s linear infinite' }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-16 h-14 border-x-2 border-amber-700/50 flex items-center justify-center">
                    <div className="w-10 h-8 rounded-sm bg-amber-900/30" />
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-14 overflow-hidden opacity-25">
              <div className="flex" style={{ width: '200%', animation: 'wtr2-strip 20s linear infinite reverse' }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-16 h-14 border-x-2 border-amber-700/50 flex items-center justify-center">
                    <div className="w-10 h-8 rounded-sm bg-amber-900/30" />
                  </div>
                ))}
              </div>
            </div>
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {/* Cross-hair circle like retro film countdown */}
              <div className="wtr2-info relative w-52 h-52 mb-8 rounded-full border-4 border-amber-600/50" style={{ animationDelay: '0.3s' }}>
                <div className="absolute inset-0 rounded-full flex items-center justify-center">
                  {/* Crosshair lines */}
                  <div className="absolute w-full h-px bg-amber-600/30" />
                  <div className="absolute w-px h-full bg-amber-600/30" />
                  {/* Inner circle */}
                  <div className="w-40 h-40 rounded-full border-2 border-amber-600/30 flex items-center justify-center">
                    {sequenceRemaining !== null && sequenceRemaining > 0 ? (
                      <span className="text-7xl font-bold text-amber-400/90 font-mono" style={{ textShadow: '0 0 20px rgba(245,158,11,0.4)' }}>
                        {Math.min(9, Math.ceil(sequenceRemaining / ((session?.current_sequence_duration_ms || 60000) / 1000 / 9)))}
                      </span>
                    ) : (
                      <span className="text-7xl font-bold text-amber-400/90 font-mono">3</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Title */}
              <h1 className="wtr2-info text-4xl font-serif tracking-wider text-amber-200/80 mb-3" style={{ animationDelay: '0.6s', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                Bandes-Annonces
              </h1>
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <span className="wtr2-info text-xl font-mono text-amber-400/60" style={{ animationDelay: '0.8s' }}>
                  {formatSeqCountdown(sequenceRemaining)}
                </span>
              )}
            </div>
            {/* Session name */}
            {session?.name && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 wtr2-info" style={{ animationDelay: '1s' }}>
                <span className="text-xs uppercase tracking-[0.3em] text-amber-600/40">{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-INTERMISSION: elegant pause with countdown ---
      if (layoutStyle === 'waiting-intermission') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#0a0a1a' }}>
            <style>{`
              @keyframes wi-gradient { 0%,100%{ background-position:0% 50% } 50%{ background-position:100% 50% } }
              @keyframes wi-fade-in { from{ opacity:0; transform:translateY(30px) } to{ opacity:1; transform:translateY(0) } }
              @keyframes wi-countdown-pulse { 0%,100%{ transform:scale(1); opacity:0.9 } 50%{ transform:scale(1.02); opacity:1 } }
              @keyframes wi-progress { from{ width:0% } }
              .wi-info { animation: wi-fade-in 1s ease-out both; }
            `}</style>
            {/* Subtle animated gradient */}
            <div className="absolute inset-0" style={{
              background: `linear-gradient(135deg, #0a0a2e 0%, #1a0a3e 25%, #0a1a3e 50%, ${accent}08 75%, #0a0a2e 100%)`,
              backgroundSize: '400% 400%',
              animation: 'wi-gradient 25s ease-in-out infinite',
            }} />
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {/* Decorative line */}
              <div className="wi-info w-16 h-px mb-8" style={{ animationDelay: '0.2s', backgroundColor: `${accent}40` }} />
              {/* Title */}
              <h1 className="wi-info text-6xl font-extralight tracking-[0.2em] text-white/85 mb-4" style={{ animationDelay: '0.4s' }}>
                ENTRACTE
              </h1>
              <div className="wi-info w-24 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mb-8" style={{ animationDelay: '0.5s' }} />
              <p className="wi-info text-base text-white/40 tracking-wider mb-10" style={{ animationDelay: '0.6s' }}>
                La seance reprend dans quelques instants
              </p>
              {/* Countdown display */}
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <div className="wi-info flex flex-col items-center" style={{ animationDelay: '0.8s' }}>
                  <span className="text-8xl font-extralight tracking-[0.15em] mb-4" style={{
                    color: `${accent}dd`,
                    animation: 'wi-countdown-pulse 2s ease-in-out infinite',
                    textShadow: `0 0 60px ${accent}30`,
                  }}>
                    {formatSeqCountdown(sequenceRemaining)}
                  </span>
                  {/* Progress bar */}
                  {sequenceProgress !== null && (
                    <div className="w-64 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${accent}15` }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{
                        width: `${sequenceProgress * 100}%`,
                        background: `linear-gradient(90deg, ${accent}60, ${accent})`,
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Session name */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 wi-info" style={{ animationDelay: '1s' }}>
                <span className="text-xs uppercase tracking-[0.3em] opacity-30 text-white">{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-INTERMISSION-FUN: playful pause with icons ---
      if (layoutStyle === 'waiting-intermission-fun') {
        const funItems = [
          { icon: '\uD83C\uDF7F', label: 'Popcorn', delay: 0.3 },
          { icon: '\uD83E\uDD64', label: 'Boissons', delay: 0.5 },
          { icon: '\uD83D\uDEBB', label: 'Toilettes', delay: 0.7 },
          { icon: '\uD83D\uDCF1', label: 'Selfie time', delay: 0.9 },
        ];
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#080820' }}>
            <style>{`
              @keyframes wif-fade-in { from{ opacity:0; transform:translateY(25px) scale(0.95) } to{ opacity:1; transform:translateY(0) scale(1) } }
              @keyframes wif-bounce { 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-8px) } }
              @keyframes wif-confetti { 0%{ transform:translateY(-10px) rotate(0deg); opacity:0 } 10%{ opacity:0.6 } 90%{ opacity:0.6 } 100%{ transform:translateY(100vh) rotate(720deg); opacity:0 } }
              @keyframes wif-countdown-glow { 0%,100%{ text-shadow:0 0 20px rgba(167,139,250,0.3) } 50%{ text-shadow:0 0 40px rgba(167,139,250,0.5), 0 0 80px rgba(167,139,250,0.2) } }
              .wif-info { animation: wif-fade-in 0.8s ease-out both; }
              .wif-icon { animation: wif-bounce 3s ease-in-out infinite; }
            `}</style>
            {/* Confetti particles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="absolute" style={{
                left: `${Math.random() * 100}%`,
                width: 6 + Math.random() * 4, height: 6 + Math.random() * 4,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa'][i % 5],
                opacity: 0.4,
                animation: `wif-confetti ${8 + Math.random() * 10}s linear infinite`,
                animationDelay: `${Math.random() * 8}s`,
              }} />
            ))}
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {/* Title */}
              <h1 className="wif-info text-5xl font-bold tracking-wider text-white/90 mb-2" style={{ animationDelay: '0.1s' }}>
                Pause !
              </h1>
              <p className="wif-info text-base text-white/40 mb-10" style={{ animationDelay: '0.2s' }}>
                Profitez-en pour...
              </p>
              {/* Fun icons row */}
              <div className="flex gap-10 mb-12">
                {funItems.map((item, i) => (
                  <div key={i} className="wif-info flex flex-col items-center gap-3" style={{ animationDelay: `${item.delay}s` }}>
                    <span className="wif-icon text-5xl" style={{ animationDelay: `${i * 0.5}s` }}>{item.icon}</span>
                    <span className="text-sm text-white/50 tracking-wide">{item.label}</span>
                  </div>
                ))}
              </div>
              {/* Countdown */}
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <div className="wif-info flex flex-col items-center" style={{ animationDelay: '1.1s' }}>
                  <span className="text-sm uppercase tracking-widest text-white/40 mb-3">Reprise dans</span>
                  <span className="text-7xl font-mono font-light text-purple-300/90" style={{
                    animation: 'wif-countdown-glow 3s ease-in-out infinite',
                  }}>
                    {formatSeqCountdown(sequenceRemaining)}
                  </span>
                  {/* Progress bar */}
                  {sequenceProgress !== null && (
                    <div className="mt-6 w-48 h-1.5 rounded-full overflow-hidden bg-white/10">
                      <div className="h-full rounded-full transition-all duration-1000" style={{
                        width: `${sequenceProgress * 100}%`,
                        background: 'linear-gradient(90deg, #a78bfa, #f472b6)',
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Session name */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 wif-info" style={{ animationDelay: '1.3s' }}>
                <span className="text-xs uppercase tracking-[0.3em] opacity-30 text-white">{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-INTERMISSION-MINIMAL: ultra-minimal countdown ---
      if (layoutStyle === 'waiting-intermission-minimal') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#000' }}>
            <style>{`
              @keyframes wim-fade-in { from{ opacity:0 } to{ opacity:1 } }
              @keyframes wim-tick { 0%,100%{ opacity:1 } 50%{ opacity:0.7 } }
              .wim-info { animation: wim-fade-in 1.5s ease-out both; }
            `}</style>
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              <span className="wim-info text-lg uppercase tracking-[0.4em] text-white/30 mb-8 font-light" style={{ animationDelay: '0.2s' }}>
                Pause
              </span>
              {sequenceRemaining !== null && sequenceRemaining > 0 ? (
                <span className="wim-info font-mono text-white/80" style={{
                  animationDelay: '0.5s',
                  fontSize: 'clamp(5rem, 15vw, 12rem)',
                  letterSpacing: '0.1em',
                  animation: 'wim-tick 2s ease-in-out infinite',
                }}>
                  {formatSeqCountdown(sequenceRemaining)}
                </span>
              ) : (
                <span className="wim-info text-2xl text-white/40 font-light" style={{ animationDelay: '0.5s' }}>
                  En pause
                </span>
              )}
              {/* Minimal progress line */}
              {sequenceProgress !== null && (
                <div className="wim-info mt-12 w-1/3 h-px bg-white/10" style={{ animationDelay: '0.8s' }}>
                  <div className="h-full bg-white/40 transition-all duration-1000" style={{ width: `${sequenceProgress * 100}%` }} />
                </div>
              )}
            </div>
            {/* Session name */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 wim-info" style={{ animationDelay: '1s' }}>
                <span className="text-xs tracking-[0.3em] text-white/15">{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-SPOTLIGHT: poster center with radial spotlight ---
      if (layoutStyle === 'waiting-spotlight') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={{ ...baseStyles, backgroundColor: '#000' }}>
            <style>{`
              @keyframes ws-spot-breathe { 0%,100%{ opacity:0.6; transform:scale(1) } 50%{ opacity:0.8; transform:scale(1.05) } }
              @keyframes ws-fade-in { from{ opacity:0; transform:translateY(20px) } to{ opacity:1; transform:translateY(0) } }
              .ws-spot-info { animation: ws-fade-in 1s ease-out both; }
            `}</style>
            {/* Radial spotlight */}
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse 50% 60% at 50% 45%, ${accent}18 0%, transparent 70%)`,
              animation: 'ws-spot-breathe 6s ease-in-out infinite',
            }} />
            {/* Content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-12">
              {/* Large poster */}
              {effectivePoster && (
                <div className="ws-spot-info mb-8" style={{ animationDelay: '0.2s' }}>
                  <img
                    src={effectivePoster}
                    alt={movie?.title || ''}
                    className="h-[55vh] max-h-[500px] rounded-xl object-cover"
                    style={{ boxShadow: `0 30px 80px -20px ${accent}40, 0 10px 40px -10px rgba(0,0,0,0.8)` }}
                  />
                </div>
              )}
              {/* Title */}
              {movie?.title && (
                <h1 className="ws-spot-info text-4xl font-bold text-center mb-3" style={{
                  animationDelay: '0.5s', color: txt, textShadow: `0 0 40px ${accent}30, 0 4px 20px rgba(0,0,0,0.8)`,
                }}>
                  {movie.title}
                  {movie.year && <span className="ml-3 text-xl font-light opacity-50">({movie.year})</span>}
                </h1>
              )}
              {/* Genres */}
              {hasComp('genres') && movie?.genres && movie.genres.length > 0 && (
                <div className="ws-spot-info flex gap-2 mt-2" style={{ animationDelay: '0.7s' }}>
                  {movie.genres.slice(0, 4).map((g, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs border" style={{
                      borderColor: `${accent}30`, color: `${txt}cc`, backgroundColor: `${accent}10`,
                    }}>{g}</span>
                  ))}
                </div>
              )}
            </div>
            {/* Session info top-right */}
            {session?.name && (
              <div className="absolute top-6 right-6 z-20 ws-spot-info" style={{ animationDelay: '0.9s' }}>
                <span className="text-xs uppercase tracking-[0.2em] opacity-40" style={{ color: txt }}>{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // --- WAITING-PANORAMIC: split layout poster left, details right ---
      if (layoutStyle === 'waiting-panoramic') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
            <style>{`
              @keyframes wp-fade-in { from{ opacity:0; transform:translateX(20px) } to{ opacity:1; transform:translateX(0) } }
              @keyframes wp-slide-in { from{ opacity:0; transform:translateX(-30px) } to{ opacity:1; transform:translateX(0) } }
              .wp-info { animation: wp-fade-in 0.8s ease-out both; }
              .wp-poster { animation: wp-slide-in 1s ease-out both; }
            `}</style>
            {/* Blurred backdrop behind right side */}
            {effectiveBackdrop && (
              <div className="absolute inset-0 bg-cover bg-center" style={{
                backgroundImage: `url(${effectiveBackdrop})`,
                filter: 'blur(30px) brightness(0.3)',
              }} />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: `${bg}cc` }} />
            {/* Split layout */}
            <div className="relative z-10 w-full h-full flex">
              {/* Left: Poster */}
              {effectivePoster && (
                <div className="wp-poster flex-shrink-0 w-[38%] h-full p-8 flex items-center justify-center">
                  <img
                    src={effectivePoster}
                    alt={movie?.title || ''}
                    className="max-h-full max-w-full rounded-xl object-contain"
                    style={{ boxShadow: `0 30px 60px -15px ${palette?.primary || '#000'}80` }}
                  />
                </div>
              )}
              {/* Right: Details */}
              <div className="flex-1 h-full flex flex-col justify-center p-12 pl-4 overflow-hidden">
                {/* Logo or Title */}
                <div className="wp-info mb-4" style={{ animationDelay: '0.2s' }}>
                  {config?.use_logo_image && effectiveLogo ? (
                    <img src={effectiveLogo} alt="" className="max-w-[300px] max-h-[100px] object-contain mb-2 drop-shadow-2xl" />
                  ) : movie?.title ? (
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: txt, textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
                      {movie.title}
                      {movie.year && <span className="ml-3 text-2xl font-light opacity-50">({movie.year})</span>}
                    </h1>
                  ) : null}
                </div>
                {/* Tagline */}
                {hasComp('tagline') && movie?.tagline && (
                  <p className="wp-info text-lg italic opacity-60 mb-5" style={{ animationDelay: '0.4s', color: txt }}>
                    {movie.tagline}
                  </p>
                )}
                {/* Genres + Metadata row */}
                <div className="wp-info flex flex-wrap items-center gap-4 mb-5" style={{ animationDelay: '0.5s' }}>
                  {hasComp('genres') && movie?.genres?.slice(0, 4).map((g, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-sm border" style={{
                      borderColor: `${accent}40`, color: txt, backgroundColor: `${accent}15`,
                    }}>{g}</span>
                  ))}
                  {hasComp('metadata') && movie?.runtime_minutes && (
                    <span className="text-sm opacity-70" style={{ color: txt }}>
                      {Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}
                    </span>
                  )}
                  {hasComp('metadata') && movie?.rating && (
                    <span className="flex items-center gap-1 text-sm">
                      <span style={{ color: accent }}>★</span>
                      <span className="opacity-80" style={{ color: txt }}>{movie.rating.toFixed(1)}</span>
                    </span>
                  )}
                </div>
                {/* Overview */}
                {hasComp('overview') && movie?.overview && (
                  <p className="wp-info text-sm leading-relaxed opacity-60 mb-6" style={{
                    animationDelay: '0.6s', color: txt,
                    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {movie.overview}
                  </p>
                )}
                {/* Session info */}
                {session?.name && (
                  <div className="wp-info text-xs uppercase tracking-[0.3em] opacity-40 mt-auto" style={{ animationDelay: '0.8s', color: txt }}>
                    {session.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // --- WAITING-TEASER: full bleed backdrops + centered logo with glow ---
      if (layoutStyle === 'waiting-teaser') {
        return (
          <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
            <style>{`
              @keyframes wt-ken-burns { 0%{ transform:scale(1) translate(0,0) } 50%{ transform:scale(1.12) translate(-1.5%,-1%) } 100%{ transform:scale(1) translate(0,0) } }
              @keyframes wt-logo-glow { 0%,100%{ filter:drop-shadow(0 0 20px ${accent}40) } 50%{ filter:drop-shadow(0 0 50px ${accent}70) drop-shadow(0 0 80px ${accent}30) } }
              @keyframes wt-fade-in { from{ opacity:0; transform:scale(0.95) } to{ opacity:1; transform:scale(1) } }
              .wt-backdrop { animation: wt-ken-burns ${config?.rotate_interval ?? 20}s ease-in-out infinite; transition: opacity 2s ease-in-out; }
              .wt-logo { animation: wt-logo-glow 4s ease-in-out infinite, wt-fade-in 1.5s ease-out both; }
              .wt-info { animation: wt-fade-in 1s ease-out both; }
            `}</style>
            {/* Full bleed rotating backdrops */}
            {config?.rotate_backdrops && allBackdrops.length > 1 ? (
              allBackdrops.map((url, i) => (
                <div key={`wt-bd-${i}`} className="absolute inset-0 bg-cover bg-center wt-backdrop" style={{
                  backgroundImage: `url(${url})`, opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
                }} />
              ))
            ) : effectiveBackdrop ? (
              <div className="absolute inset-0 bg-cover bg-center wt-backdrop" style={{ backgroundImage: `url(${effectiveBackdrop})` }} />
            ) : null}
            {/* Dark vignette */}
            <div className="absolute inset-0" style={{
              background: `radial-gradient(ellipse at center, ${bg}40 0%, ${bg}dd 70%, ${bg} 100%)`,
            }} />
            {/* Center content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
              {/* Logo or Title */}
              {effectiveLogo ? (
                <img src={effectiveLogo} alt={movie?.title || ''} className="wt-logo max-w-[450px] max-h-[160px] object-contain mb-8" />
              ) : movie?.title ? (
                <h1 className="wt-info text-7xl font-bold text-center tracking-tight mb-6" style={{
                  color: txt, textShadow: `0 0 40px ${accent}40, 0 4px 30px rgba(0,0,0,0.8)`,
                }}>
                  {movie.title}
                </h1>
              ) : null}
              {/* Genres */}
              {hasComp('genres') && movie?.genres && movie.genres.length > 0 && (
                <div className="wt-info flex gap-3" style={{ animationDelay: '0.5s' }}>
                  {movie.genres.slice(0, 3).map((g, i) => (
                    <span key={i} className="px-4 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm" style={{
                      backgroundColor: `${accent}20`, color: `${txt}cc`, border: `1px solid ${accent}30`,
                    }}>{g}</span>
                  ))}
                </div>
              )}
              {/* Sequence countdown */}
              {sequenceRemaining !== null && sequenceRemaining > 0 && (
                <div className="wt-info mt-8 flex flex-col items-center" style={{ animationDelay: '0.7s' }}>
                  <span className="text-5xl font-extralight tracking-widest" style={{
                    color: `${txt}99`, textShadow: `0 0 30px ${accent}30`,
                  }}>
                    {formatSeqCountdown(sequenceRemaining)}
                  </span>
                </div>
              )}
            </div>
            {/* Session name watermark at bottom */}
            {session?.name && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 wt-info" style={{ animationDelay: '1s' }}>
                <span className="text-sm uppercase tracking-[0.4em] opacity-30" style={{ color: txt }}>{session.name}</span>
              </div>
            )}
          </div>
        );
      }

      // ============================================================
      // QUIZ LAYOUTS
      // ============================================================
      if (layoutStyle === 'quiz-classic' || layoutStyle === 'quiz-gameshow' || layoutStyle === 'quiz-minimal') {
        const qi = quiz_info;
        const isGameshow = layoutStyle === 'quiz-gameshow';
        const isMinimal = layoutStyle === 'quiz-minimal';
        const phase = qi?.phase || 'waiting';
        const choiceColors = (config as any)?.choice_colors || ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

        // Timer progress (0→1)
        const timerProgress = qi?.current_question?.time_limit_seconds && qi?.time_remaining_seconds != null
          ? qi.time_remaining_seconds / qi.current_question.time_limit_seconds
          : 1;
        const timerSec = Math.ceil(qi?.time_remaining_seconds ?? 0);

        // Background style
        const quizBg = (config as any)?.background_color || '#0a0a1a';
        const quizAccent = (config as any)?.accent_color || accent;
        const quizSecondary = (config as any)?.secondary_color || '#8b5cf6';

        return (
          <div className="relative w-full h-full overflow-hidden flex flex-col" style={{
            backgroundColor: quizBg,
            color: '#ffffff',
            fontFamily: isGameshow ? '"Poppins", "Segoe UI", sans-serif' : undefined,
          }}>
            <style>{`
              @keyframes quiz-fade-in { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
              @keyframes quiz-scale-in { from { opacity:0; transform:scale(0.8) } to { opacity:1; transform:scale(1) } }
              @keyframes quiz-pulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.05) } }
              @keyframes quiz-shake { 0%,100% { transform:translateX(0) } 25% { transform:translateX(-5px) } 75% { transform:translateX(5px) } }
              @keyframes quiz-confetti { 0% { transform:translateY(0) rotate(0deg); opacity:1 } 100% { transform:translateY(100vh) rotate(720deg); opacity:0 } }
              @keyframes quiz-slide-up { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
              @keyframes quiz-timer-pulse { 0%,100% { box-shadow:0 0 0 0 ${quizAccent}40 } 50% { box-shadow:0 0 0 15px ${quizAccent}00 } }
              .quiz-ani { animation: quiz-fade-in 0.5s ease-out both; }
              .quiz-scale { animation: quiz-scale-in 0.4s ease-out both; }
              .quiz-choice-enter { animation: quiz-slide-up 0.4s ease-out both; }
              ${isGameshow ? `
                @keyframes gs-glow { 0%,100% { text-shadow:0 0 20px ${quizAccent}60 } 50% { text-shadow:0 0 40px ${quizAccent}aa, 0 0 80px ${quizSecondary}40 } }
                .gs-title { animation: gs-glow 3s ease-in-out infinite; }
              ` : ''}
            `}</style>

            {/* Sequence remaining badge (global action timer) */}
            {sequenceRemaining !== null && sequenceRemaining > 0 && (
              <div className="absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5,4 15,12 5,20" /><line x1="19" y1="5" x2="19" y2="19" />
                </svg>
                <span>Suite {formatSeqCountdown(sequenceRemaining)}</span>
              </div>
            )}

            {/* === PHASE: WAITING === */}
            {phase === 'waiting' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12">
                {/* Quiz name */}
                <h1 className={`text-6xl font-bold text-center tracking-tight quiz-ani ${isGameshow ? 'gs-title' : ''}`}
                  style={{ color: quizAccent }}>
                  {qi?.name || 'Quiz'}
                </h1>
                {/* Join message */}
                <div className="quiz-ani text-2xl text-white/70 text-center" style={{ animationDelay: '0.2s' }}>
                  Ouvrez votre telephone et connectez-vous !
                </div>
                {/* QR code placeholder + URL */}
                {qi?.join_url && (config as any)?.show_qr_during_waiting !== false && (
                  <div className="quiz-ani flex flex-col items-center gap-4 mt-4" style={{ animationDelay: '0.4s' }}>
                    <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center p-3">
                      {/* QR code rendered as simple URL display — real QR would need a library */}
                      <div className="w-full h-full bg-black/5 rounded-xl flex items-center justify-center">
                        <span className="text-black text-xs text-center break-all px-2 font-mono">{qi.join_url}</span>
                      </div>
                    </div>
                    <span className="text-lg text-white/50">Scannez pour rejoindre</span>
                  </div>
                )}
                {/* Participant count */}
                <div className="quiz-ani flex items-center gap-3 mt-6" style={{ animationDelay: '0.6s' }}>
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xl text-white/80">
                    {qi?.participants?.length || 0} participant{(qi?.participants?.length || 0) !== 1 ? 's' : ''} connecte{(qi?.participants?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}

            {/* === PHASE: QUESTION === */}
            {phase === 'question' && qi?.current_question && (
              <div className="flex-1 flex flex-col p-8">
                {/* Header: progression + timer */}
                <div className="flex items-center justify-between mb-6">
                  <div className="quiz-ani flex items-center gap-4">
                    <span className="text-lg font-semibold" style={{ color: quizAccent }}>
                      Question {(qi.current_question_index || 0) + 1}/{qi.total_questions}
                    </span>
                    {!isMinimal && (
                      <span className="text-sm text-white/40">{qi.name}</span>
                    )}
                  </div>
                  {/* Timer */}
                  <div className="quiz-ani flex items-center gap-3" style={{ animationDelay: '0.1s' }}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4 ${timerSec <= 5 ? 'animate-pulse' : ''}`}
                      style={{
                        borderColor: timerSec <= 5 ? '#ef4444' : quizAccent,
                        color: timerSec <= 5 ? '#ef4444' : '#ffffff',
                        animation: timerSec <= 5 ? 'quiz-timer-pulse 1s ease-in-out infinite' : undefined,
                      }}>
                      {timerSec}
                    </div>
                  </div>
                </div>

                {/* Timer bar */}
                <div className="w-full h-2 rounded-full overflow-hidden mb-8" style={{ backgroundColor: `${quizAccent}20` }}>
                  <div className="h-full rounded-full transition-all duration-1000 ease-linear" style={{
                    width: `${timerProgress * 100}%`,
                    backgroundColor: timerSec <= 5 ? '#ef4444' : quizAccent,
                  }} />
                </div>

                {/* Question text */}
                <div className="flex-shrink-0 mb-8">
                  <h2 className="quiz-scale text-4xl font-bold text-center leading-tight" style={{ animationDelay: '0.15s' }}>
                    {qi.current_question.text}
                  </h2>
                  {/* Hint */}
                  {qi.current_question.hint && (
                    <p className="quiz-ani text-lg text-white/50 text-center mt-4 italic" style={{ animationDelay: '0.3s' }}>
                      Indice : {qi.current_question.hint}
                    </p>
                  )}
                </div>

                {/* Choices grid */}
                <div className={`flex-1 grid gap-4 ${qi.current_question.choices.length <= 2 ? 'grid-cols-2' : qi.current_question.choices.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {qi.current_question.choices.map((choice, i) => (
                    <div key={i}
                      className="quiz-choice-enter rounded-2xl flex items-center justify-center p-6 text-center cursor-default"
                      style={{
                        animationDelay: `${0.2 + i * 0.1}s`,
                        backgroundColor: isGameshow ? `${choiceColors[i % choiceColors.length]}dd` : `${quizAccent}20`,
                        border: isGameshow ? 'none' : `2px solid ${quizAccent}40`,
                        fontSize: choice.length > 60 ? '1.25rem' : choice.length > 30 ? '1.5rem' : '1.75rem',
                        fontWeight: 600,
                      }}>
                      {isGameshow && (
                        <span className="mr-3 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-lg font-bold flex-shrink-0">
                          {String.fromCharCode(65 + i)}
                        </span>
                      )}
                      <span>{choice}</span>
                    </div>
                  ))}
                </div>

                {/* Scoreboard sidebar (non-minimal) */}
                {!isMinimal && (config as any)?.show_scoreboard_during_question && qi.scoreboard && qi.scoreboard.length > 0 && (
                  <div className="absolute top-24 right-8 w-64 quiz-ani" style={{ animationDelay: '0.5s' }}>
                    <div className="rounded-xl p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                      <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: quizAccent }}>Classement</h3>
                      {qi.scoreboard.slice(0, (config as any)?.show_scoreboard_limit || 5).map((entry, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="w-5 text-white/40">{i + 1}.</span>
                            <span className="text-white/90 truncate max-w-[140px]">{entry.name}</span>
                          </span>
                          <span className="font-bold" style={{ color: quizAccent }}>{entry.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === PHASE: FEEDBACK === */}
            {phase === 'feedback' && qi?.current_question && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
                {/* Question recap */}
                <h2 className="quiz-ani text-3xl font-bold text-center text-white/80 mb-4">
                  {qi.current_question.text}
                </h2>

                {/* Choices with correct/incorrect highlighting */}
                <div className={`w-full max-w-4xl grid gap-4 ${qi.current_question.choices.length <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {qi.current_question.choices.map((choice, i) => {
                    const isCorrect = qi.correct_indices?.includes(i);
                    return (
                      <div key={i}
                        className="quiz-choice-enter rounded-2xl flex items-center justify-center p-5 text-center relative overflow-hidden"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          backgroundColor: isCorrect ? '#22c55e30' : '#ef444430',
                          border: `3px solid ${isCorrect ? '#22c55e' : '#ef4444'}`,
                          fontSize: '1.5rem',
                          fontWeight: 600,
                        }}>
                        <span className="mr-3 text-2xl">{isCorrect ? '✓' : '✗'}</span>
                        <span style={{ color: isCorrect ? '#22c55e' : '#ef4444cc' }}>{choice}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Answer distribution */}
                {(config as any)?.show_answer_distribution && qi.answer_distribution && (
                  <div className="quiz-ani w-full max-w-2xl mt-4" style={{ animationDelay: '0.4s' }}>
                    <h3 className="text-sm uppercase tracking-wider text-white/50 mb-3 text-center">Distribution des reponses</h3>
                    <div className="flex gap-3 justify-center">
                      {qi.current_question.choices.map((choice, i) => {
                        const count = qi.answer_distribution?.[i] || 0;
                        const total = Object.values(qi.answer_distribution || {}).reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        const isCorrect = qi.correct_indices?.includes(i);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full h-32 rounded-lg relative overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                              <div className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-1000" style={{
                                height: `${pct}%`,
                                backgroundColor: isCorrect ? '#22c55e80' : isGameshow ? `${choiceColors[i % choiceColors.length]}80` : `${quizAccent}60`,
                              }} />
                            </div>
                            <span className="text-xs text-white/60 truncate max-w-full">{choice.substring(0, 15)}</span>
                            <span className="text-sm font-bold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === PHASE: RESULTS (between questions) === */}
            {phase === 'results' && qi?.scoreboard && (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <h2 className="quiz-ani text-4xl font-bold mb-8" style={{ color: quizAccent }}>Classement</h2>
                <div className="w-full max-w-xl">
                  {qi.scoreboard.slice(0, 10).map((entry, i) => (
                    <div key={i} className="quiz-ani flex items-center gap-4 py-3 px-6 rounded-xl mb-2"
                      style={{
                        animationDelay: `${i * 0.1}s`,
                        backgroundColor: i === 0 ? `${quizAccent}30` : i < 3 ? `${quizAccent}15` : 'rgba(255,255,255,0.05)',
                      }}>
                      <span className="text-2xl font-bold w-10 text-center" style={{ color: i < 3 ? quizAccent : 'rgba(255,255,255,0.5)' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                      </span>
                      <span className="flex-1 text-xl font-semibold truncate">{entry.name}</span>
                      <span className="text-2xl font-bold" style={{ color: quizAccent }}>{entry.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* === PHASE: PODIUM (final) === */}
            {phase === 'podium' && qi?.scoreboard && (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                {(config as any)?.podium_animation && (
                  <style>{`
                    @keyframes podium-rise-1 { from { height:0; opacity:0 } to { height:220px; opacity:1 } }
                    @keyframes podium-rise-2 { from { height:0; opacity:0 } to { height:160px; opacity:1 } }
                    @keyframes podium-rise-3 { from { height:0; opacity:0 } to { height:110px; opacity:1 } }
                  `}</style>
                )}
                <h2 className="quiz-ani text-5xl font-bold mb-12" style={{ color: quizAccent }}>
                  {isGameshow ? '🏆 Resultats Finaux 🏆' : 'Resultats'}
                </h2>

                {/* Podium visualization */}
                <div className="flex items-end justify-center gap-6 mb-12">
                  {/* 2nd place */}
                  {qi.scoreboard.length > 1 && (
                    <div className="quiz-ani flex flex-col items-center" style={{ animationDelay: '0.3s' }}>
                      <span className="text-4xl mb-2">🥈</span>
                      <span className="text-lg font-semibold mb-2 truncate max-w-[150px]">{qi.scoreboard[1].name}</span>
                      <span className="text-xl font-bold mb-3" style={{ color: quizAccent }}>{qi.scoreboard[1].score} pts</span>
                      <div className="w-32 rounded-t-xl flex items-end justify-center"
                        style={{
                          height: '160px',
                          backgroundColor: `${quizSecondary}40`,
                          border: `2px solid ${quizSecondary}60`,
                          animation: (config as any)?.podium_animation ? 'podium-rise-2 1s ease-out 0.3s both' : undefined,
                        }}>
                        <span className="text-5xl font-bold opacity-30 mb-4">2</span>
                      </div>
                    </div>
                  )}
                  {/* 1st place */}
                  {qi.scoreboard.length > 0 && (
                    <div className="quiz-ani flex flex-col items-center" style={{ animationDelay: '0.1s' }}>
                      <span className="text-5xl mb-2">🥇</span>
                      <span className="text-xl font-bold mb-2 truncate max-w-[180px]">{qi.scoreboard[0].name}</span>
                      <span className="text-2xl font-bold mb-3" style={{ color: quizAccent }}>{qi.scoreboard[0].score} pts</span>
                      <div className="w-36 rounded-t-xl flex items-end justify-center"
                        style={{
                          height: '220px',
                          backgroundColor: `${quizAccent}40`,
                          border: `2px solid ${quizAccent}60`,
                          animation: (config as any)?.podium_animation ? 'podium-rise-1 1s ease-out 0.1s both' : undefined,
                        }}>
                        <span className="text-6xl font-bold opacity-30 mb-4">1</span>
                      </div>
                    </div>
                  )}
                  {/* 3rd place */}
                  {qi.scoreboard.length > 2 && (
                    <div className="quiz-ani flex flex-col items-center" style={{ animationDelay: '0.5s' }}>
                      <span className="text-4xl mb-2">🥉</span>
                      <span className="text-lg font-semibold mb-2 truncate max-w-[150px]">{qi.scoreboard[2].name}</span>
                      <span className="text-xl font-bold mb-3" style={{ color: quizAccent }}>{qi.scoreboard[2].score} pts</span>
                      <div className="w-32 rounded-t-xl flex items-end justify-center"
                        style={{
                          height: '110px',
                          backgroundColor: `${quizSecondary}30`,
                          border: `2px solid ${quizSecondary}40`,
                          animation: (config as any)?.podium_animation ? 'podium-rise-3 1s ease-out 0.5s both' : undefined,
                        }}>
                        <span className="text-5xl font-bold opacity-30 mb-4">3</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rest of scoreboard */}
                {qi.scoreboard.length > 3 && (
                  <div className="w-full max-w-md">
                    {qi.scoreboard.slice(3, 10).map((entry, i) => (
                      <div key={i} className="quiz-ani flex items-center gap-3 py-2 px-4 text-white/70"
                        style={{ animationDelay: `${0.7 + i * 0.1}s` }}>
                        <span className="w-8 text-right text-white/40">{i + 4}.</span>
                        <span className="flex-1 truncate">{entry.name}</span>
                        <span className="font-semibold" style={{ color: `${quizAccent}aa` }}>{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Participant count bar at bottom (question/feedback phases) */}
            {(phase === 'question' || phase === 'feedback') && qi?.participants && (
              <div className="flex-shrink-0 px-8 py-3 flex items-center justify-between border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <span className="text-sm text-white/50">
                  {qi.participants.filter(p => p.has_answered_current).length}/{qi.participants.length} ont repondu
                </span>
                <span className="text-sm text-white/50">
                  Question {(qi.current_question_index || 0) + 1}/{qi.total_questions}
                </span>
              </div>
            )}
          </div>
        );
      }

      // --- DEFAULT WAITING: cinematic ambient (waiting-ambient, waiting-poster-centered, etc.) ---
      return (
        <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
          <style>{animationStyles}{`
            @keyframes ws-ken-burns { 0%{ transform:scale(1) translate(0,0) } 50%{ transform:scale(1.08) translate(-1%,-0.5%) } 100%{ transform:scale(1) translate(0,0) } }
            @keyframes ws-fade-in-up { from{ opacity:0; transform:translateY(20px) } to{ opacity:1; transform:translateY(0) } }
            @keyframes ws-gradient-shift { 0%,100%{ background-position:0% 50% } 50%{ background-position:100% 50% } }
            .ws-backdrop { animation: ws-ken-burns ${config?.rotate_backdrops ? (config.rotate_interval ?? 25) : 50}s ease-in-out infinite; transition: opacity 1.5s ease-in-out; }
            .ws-info { animation: ws-fade-in-up 1s ease-out both; }
            .ws-gradient-bar { background: linear-gradient(90deg, ${accent}40, ${palette?.vibrant || '#8b5cf6'}40, ${accent}40); background-size: 200% 100%; animation: ws-gradient-shift 8s ease-in-out infinite; }
          `}</style>
          {/* Full bleed backdrops with Ken Burns + crossfade */}
          {config?.rotate_backdrops && allBackdrops.length > 1 ? (
            allBackdrops.map((url, i) => (
              <div key={`ws-bd-${i}`} className="absolute inset-0 bg-cover bg-center ws-backdrop" style={{
                backgroundImage: `url(${url})`, opacity: i === rotatingIndex % allBackdrops.length ? 1 : 0,
              }} />
            ))
          ) : effectiveBackdrop ? (
            <div className="absolute inset-0 bg-cover bg-center ws-backdrop" style={{ backgroundImage: `url(${effectiveBackdrop})` }} />
          ) : null}
          {/* Cinematic gradient overlays */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${bg} 0%, transparent 40%, transparent 70%, ${bg}90 100%)` }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${bg}cc 0%, transparent 30%, transparent 70%, ${bg}cc 100%)` }} />
          {/* Accent gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1 ws-gradient-bar z-20" />
          {/* Content — bottom-left */}
          <div className="relative z-10 w-full h-full flex flex-col justify-end p-12">
            <div className="ws-info" style={{ animationDelay: '0.2s' }}>
              {effectiveLogo ? (
                <img src={effectiveLogo} alt={movie?.title || ''} className="max-w-[350px] max-h-[120px] object-contain mb-6 drop-shadow-2xl" />
              ) : movie?.title ? (
                <h1 className="text-6xl font-bold mb-2 tracking-tight" style={{ color: txt, textShadow: '0 4px 30px rgba(0,0,0,0.8)' }}>
                  {movie.title}
                  {movie.year && <span className="ml-4 text-3xl font-light opacity-60">({movie.year})</span>}
                </h1>
              ) : null}
            </div>
            {hasComp('tagline') && movie?.tagline && (
              <div className="ws-info text-xl italic opacity-70 mb-6" style={{ animationDelay: '0.4s', color: txt }}>{movie.tagline}</div>
            )}
            <div className="ws-info flex items-center gap-6 mb-8" style={{ animationDelay: '0.6s' }}>
              {hasComp('metadata') && movie?.runtime_minutes && (
                <span className="text-lg opacity-80" style={{ color: txt }}>{Math.floor(movie.runtime_minutes / 60)}h{String(movie.runtime_minutes % 60).padStart(2, '0')}</span>
              )}
              {hasComp('metadata') && movie?.rating && (
                <span className="flex items-center gap-1.5 text-lg"><span style={{ color: accent }}>★</span><span className="opacity-90" style={{ color: txt }}>{movie.rating.toFixed(1)}</span></span>
              )}
              {hasComp('genres') && movie?.genres?.slice(0, 3).map((g, i) => (
                <span key={i} className="px-3 py-1 rounded-full text-sm border" style={{ borderColor: `${accent}40`, color: txt, backgroundColor: `${accent}15` }}>{g}</span>
              ))}
            </div>
            {hasComp('session_info') && session?.name && (
              <div className="ws-info mt-2 text-sm uppercase tracking-[0.3em] opacity-50" style={{ animationDelay: '0.8s', color: txt }}>{session.name}</div>
            )}
            {/* Sequence countdown */}
            {sequenceRemaining !== null && sequenceRemaining > 0 && (
              <div className="ws-info mt-4 flex items-center gap-3" style={{ animationDelay: '1s' }}>
                <span className="text-3xl font-extralight tracking-wider opacity-60" style={{ color: txt }}>
                  {formatSeqCountdown(sequenceRemaining)}
                </span>
                {sequenceProgress !== null && (
                  <div className="w-32 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: `${accent}20` }}>
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${sequenceProgress * 100}%`, backgroundColor: `${accent}60` }} />
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Small poster in corner */}
          {hasComp('poster') && effectivePoster && (
            <div className="absolute top-8 right-8 z-20 ws-info" style={{ animationDelay: '1s' }}>
              <img src={effectivePoster} alt={movie?.title || ''} className="w-32 rounded-lg shadow-2xl" style={{ boxShadow: `0 25px 50px -12px ${palette?.primary || '#000'}80` }} />
            </div>
          )}
        </div>
      );
    }

    // ======================== FEEDBACK-CLASSIC ========================
    if (layoutStyle === 'feedback-classic') {
      // Build feedback data from feedback_info or fall back to movie/session data
      const posterUrl = feedback_info?.movie_poster_url || movie?.poster_url || null;
      const movieTitle = feedback_info?.movie_title || movie?.title || null;
      const sessionName = feedback_info?.session_name || session?.name || '';
      const feedbackUrl = feedback_info?.feedback_url || '';

      const accent = (config as any)?.accent_color || palette?.primary || '#f59e0b';
      const txt = palette?.text || '#ffffff';
      const bg = palette?.background || '#0a0a0f';
      const msgFr = (config as any)?.message_fr || 'Donnez-nous votre avis !';
      const subtitleFr = (config as any)?.subtitle_fr || 'Scannez le QR code ou rendez-vous sur le portail';

      return (
        <div className="relative w-full h-full overflow-hidden flex" style={{ backgroundColor: bg, ...cssVars as React.CSSProperties }}>
          {hasAnimations && <style>{animationStyles}</style>}

          {/* Blurred poster background */}
          {posterUrl && (
            <div className="absolute inset-0 z-0">
              <img
                src={posterUrl}
                alt=""
                className="w-full h-full object-cover blur-3xl scale-110 opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
            </div>
          )}

          {/* Left side — poster + movie info */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12 gap-8">
            {posterUrl && (
              <div className="ws-info" style={{ animationDelay: '0.1s' }}>
                <img
                  src={posterUrl}
                  alt={movieTitle || ''}
                  className="w-64 rounded-2xl shadow-2xl"
                  style={{ boxShadow: `0 25px 60px -12px ${accent}40` }}
                />
              </div>
            )}
            {movieTitle && (
              <h2 className="ws-info text-3xl font-bold text-center" style={{ color: txt, animationDelay: '0.2s' }}>
                {movieTitle}
              </h2>
            )}
            <div className="ws-info text-lg uppercase tracking-[0.2em] opacity-50" style={{ color: txt, animationDelay: '0.3s' }}>
              {sessionName}
            </div>
          </div>

          {/* Right side — CTA + QR code */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-12 gap-8">
            <h1 className="ws-info text-5xl font-black text-center leading-tight" style={{ color: accent, animationDelay: '0.4s' }}>
              {msgFr}
            </h1>
            <div className="ws-info flex flex-col items-center gap-6" style={{ animationDelay: '0.6s' }}>
              {feedbackUrl && (
                <div className="bg-white p-4 rounded-2xl shadow-2xl" style={{ boxShadow: `0 20px 50px -12px ${accent}30` }}>
                  <QRCodeSVG
                    value={feedbackUrl}
                    size={220}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              )}
              <span className="text-xl text-center opacity-60" style={{ color: txt }}>
                {subtitleFr}
              </span>
            </div>
          </div>
        </div>
      );
    }

    // DEFAULT layout (fallback)
    return (
      <div className="relative w-full h-full overflow-hidden" style={baseStyles}>
        {hasAnimations && <style>{animationStyles}</style>}
        {layout.components.filter((c) => c.type === 'backdrop').map((c, i) => renderComponent(c, i))}
        {layout.components.filter((c) => ['marquee', 'blink', 'session_info'].includes(c.type)).map((c, i) => renderComponent(c, i + 100))}
        <div className="relative z-10 w-full h-full p-8 flex">
          {layout.components.filter((c) => !['backdrop', 'marquee', 'blink', 'session_info'].includes(c.type)).map((c, i) => renderComponent(c, i))}
        </div>
      </div>
    );
  }

  // Default movie info display
  if (movie) {
    return (
      <div
        className="relative w-full h-full overflow-hidden"
        style={{
          backgroundColor: palette?.background || '#0a0a0f',
          color: palette?.text || '#ffffff',
        }}
      >
        {effectiveBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${effectiveBackdrop})` }}
          />
        )}
        <div className="relative z-10 w-full h-full flex items-center">
          <MovieInfo movie={movie} palette={palette} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-white/50">
      No content to display
    </div>
  );
}

// ============================================================================
// Custom HTML Template Renderer (iframe sandboxed)
// ============================================================================

interface CustomHtmlRendererProps {
  content: string;
  styles?: string;
  script?: string;
  data: Record<string, unknown>;
  config?: TemplateConfig;
  sequenceRemaining: number | null;
  sequenceProgress: number | null;
  templateName: string;
}

function CustomHtmlRenderer({
  content,
  styles,
  script,
  data,
  config,
  sequenceRemaining,
  sequenceProgress,
  templateName,
}: CustomHtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Build the srcdoc HTML once (only changes if template code changes)
  const srcdoc = useMemo(() => {
    const bridgeScript = `<script>
window.Theatarr = {
  data: null,
  _listeners: [],
  onUpdate: function(cb) {
    this._listeners.push(cb);
    if (this.data) cb(this.data);
  }
};
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'theatarr-data') {
    window.Theatarr.data = e.data.payload;
    window.Theatarr._listeners.forEach(function(cb) {
      try { cb(e.data.payload); } catch(err) { console.error('[Theatarr] onUpdate error:', err); }
    });
  }
});
window.parent.postMessage({ type: 'theatarr-ready' }, '*');
</script>`;

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;color:#fff;font-family:system-ui,-apple-system,sans-serif}
</style>
${styles ? `<style>${styles}</style>` : ''}
${bridgeScript}
</head><body>
${content}
${script ? `<script>${script}<\/script>` : ''}
</body></html>`;
  }, [content, styles, script]);

  // Listen for iframe ready signal
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'theatarr-ready') {
        setIframeReady(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Reset ready state when srcdoc changes (template code changed)
  useEffect(() => {
    setIframeReady(false);
  }, [srcdoc]);

  // Build payload to send
  const buildPayload = useCallback(() => {
    return {
      ...data,
      config: config || {},
      countdown:
        sequenceRemaining !== null
          ? {
              remaining: sequenceRemaining,
              progress: sequenceProgress,
              formatted:
                sequenceRemaining > 0
                  ? Math.floor(sequenceRemaining / 60) > 0
                    ? `${Math.floor(sequenceRemaining / 60)}:${String(sequenceRemaining % 60).padStart(2, '0')}`
                    : `${sequenceRemaining}s`
                  : '0s',
            }
          : null,
      template: { name: templateName },
    };
  }, [data, config, sequenceRemaining, sequenceProgress, templateName]);

  // Send data to iframe whenever data changes and iframe is ready
  useEffect(() => {
    if (!iframeReady) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'theatarr-data', payload: buildPayload() }, '*');
  }, [iframeReady, buildPayload]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-scripts"
      className="w-full h-full border-0"
      style={{ background: 'transparent' }}
      title={templateName}
    />
  );
}
