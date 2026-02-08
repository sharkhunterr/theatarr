import { useEffect, useMemo, useState } from 'react';
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
  style?: string;
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
}

interface TemplateRendererProps {
  template: {
    name: string;
    template_type: string;
    content?: string;
    styles?: string;
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
    };
    mystery_info?: {
      reveal_at: string | null;
      is_revealed: boolean;
      selection_mode: string;
    };
  };
}

export function TemplateRenderer({ template, data }: TemplateRendererProps) {
  const { layout, config } = template;
  const { movie, session, countdown_to, palette, vote_info, mystery_info } = data;

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

      default:
        return null;
    }
  };

  // If template has raw HTML content, render it
  if (template.content) {
    return (
      <div
        className="relative w-full h-full"
        style={cssVars as React.CSSProperties}
      >
        {template.styles && <style>{template.styles}</style>}
        <div dangerouslySetInnerHTML={{ __html: template.content }} />
      </div>
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
      backgroundColor: palette?.background || '#0a0a0f',
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
