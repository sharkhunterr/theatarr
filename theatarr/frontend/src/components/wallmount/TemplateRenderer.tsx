import { useMemo } from 'react';
import { MovieInfo } from './MovieInfo';
import { CountdownTimer } from './CountdownTimer';

// Helper function to format countdown as short string
function formatCountdownShort(targetDate: string): string {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return 'NOW';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

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
`;

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
      rating?: number;
      genres?: string[];
      directors?: string[];
      cast?: string[];
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
  };
}

export function TemplateRenderer({ template, data }: TemplateRendererProps) {
  const { layout, config } = template;
  const { movie, session, countdown_to, palette, vote_info } = data;

  // Apply CSS variables from palette
  const cssVars = useMemo(() => {
    if (!palette?.css_vars) return {};
    return palette.css_vars;
  }, [palette]);

  const renderComponent = (component: TemplateLayout['components'][0], index: number) => {
    switch (component.type) {
      case 'backdrop':
        if (!movie?.backdrop_url && !movie?.poster_url) return null;
        const bgImage = movie?.backdrop_url || movie?.poster_url;
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

      case 'poster':
        return movie?.poster_url ? (
          <div
            key={index}
            className={`flex-shrink-0 ${
              component.position === 'left' ? 'order-first' :
              component.position === 'right' ? 'order-last' :
              component.position === 'center' ? 'mx-auto' : ''
            } ${component.size === 'full-height' ? 'h-full flex items-center' : ''}`}
          >
            <img
              src={movie.poster_url}
              alt={movie.title}
              className={`rounded-lg ${
                component.size === 'large' ? 'w-80' :
                component.size === 'small' ? 'w-48' :
                component.size === 'full-height' ? 'h-full w-auto max-w-[45vw] object-contain' :
                'w-64'
              }`}
              style={{
                boxShadow: component.shadow || palette?.primary
                  ? `0 25px 50px -12px ${palette?.primary || '#000000'}60, 0 10px 20px -5px rgba(0,0,0,0.5)`
                  : undefined,
              }}
            />
          </div>
        ) : null;

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

      case 'title':
        return movie ? (
          <h1
            key={index}
            className={`mb-4 ${
              component.size === 'xlarge' ? 'text-7xl' :
              component.size === 'large' ? 'text-6xl' :
              component.size === 'small' ? 'text-3xl' :
              'text-5xl'
            } ${component.weight === 'bold' ? 'font-bold' : 'font-semibold'}`}
            style={{
              color: palette?.text || '#ffffff',
              textShadow: config?.text_shadow ? '0 4px 8px rgba(0,0,0,0.5)' : undefined,
            }}
          >
            {movie.title}
            {movie.year && <span className="opacity-60 ml-3">({movie.year})</span>}
          </h1>
        ) : null;

      case 'metadata':
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

    // POSTER FULLSCREEN - Full screen poster with overlay
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
        {movie.backdrop_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${movie.backdrop_url})` }}
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
