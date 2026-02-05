import { useMemo } from 'react';
import { MovieInfo } from './MovieInfo';
import { CountdownTimer } from './CountdownTimer';

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
  };
}

export function TemplateRenderer({ template, data }: TemplateRendererProps) {
  const { layout, config } = template;
  const { movie, session, countdown_to, palette } = data;

  // Apply CSS variables from palette
  const cssVars = useMemo(() => {
    if (!palette?.css_vars) return {};
    return palette.css_vars;
  }, [palette]);

  const renderComponent = (component: TemplateLayout['components'][0], index: number) => {
    switch (component.type) {
      case 'backdrop':
        return movie?.backdrop_url ? (
          <div
            key={index}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${movie.backdrop_url})`,
              opacity: component.opacity ?? 0.3,
              filter: component.blur ? `blur(${component.blur}px)` : undefined,
            }}
          />
        ) : null;

      case 'poster':
        return movie?.poster_url ? (
          <div
            key={index}
            className={`flex-shrink-0 ${
              component.position === 'left' ? 'order-first' : 'order-last'
            }`}
          >
            <img
              src={movie.poster_url}
              alt={movie.title}
              className={`rounded-lg shadow-2xl ${
                component.size === 'large' ? 'w-80' : component.size === 'small' ? 'w-48' : 'w-64'
              }`}
              style={{
                boxShadow: palette?.primary ? `0 25px 50px -12px ${palette.primary}40` : undefined,
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
            className="text-5xl font-bold mb-4"
            style={{ color: palette?.text || '#ffffff' }}
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

  // Render structured layout
  if (layout?.components) {
    return (
      <div
        className="relative w-full h-full overflow-hidden"
        style={{
          ...cssVars as React.CSSProperties,
          backgroundColor: palette?.background || '#0a0a0f',
          color: palette?.text || '#ffffff',
        }}
      >
        {/* Backdrop (absolute positioned) */}
        {layout.components
          .filter((c) => c.type === 'backdrop')
          .map((c, i) => renderComponent(c, i))}

        {/* Content */}
        <div className="relative z-10 w-full h-full p-8 flex">
          {layout.components
            .filter((c) => c.type !== 'backdrop')
            .map((c, i) => renderComponent(c, i))}
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
