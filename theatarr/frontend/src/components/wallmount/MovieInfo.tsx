import { Star, Clock, Calendar } from 'lucide-react';

interface MovieInfoProps {
  movie: {
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
  palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  showPoster?: boolean;
  showOverview?: boolean;
  showCast?: boolean;
}

export function MovieInfo({
  movie,
  palette,
  showPoster = true,
  showOverview = true,
  showCast = true,
}: MovieInfoProps) {
  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="flex gap-8 p-8">
      {/* Poster */}
      {showPoster && movie.poster_url && (
        <div className="flex-shrink-0">
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-64 rounded-lg shadow-2xl"
            style={{
              boxShadow: palette?.primary
                ? `0 25px 50px -12px ${palette.primary}40`
                : undefined,
            }}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Tagline */}
        {movie.tagline && (
          <p
            className="text-lg italic mb-2 opacity-80"
            style={{ color: palette?.secondary || 'inherit' }}
          >
            "{movie.tagline}"
          </p>
        )}

        {/* Title */}
        <h1
          className="text-5xl font-bold mb-4"
          style={{ color: palette?.text || '#ffffff' }}
        >
          {movie.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-6 mb-6 text-lg">
          {movie.year && (
            <div className="flex items-center gap-2 opacity-80">
              <Calendar size={20} />
              <span>{movie.year}</span>
            </div>
          )}

          {movie.runtime_minutes && (
            <div className="flex items-center gap-2 opacity-80">
              <Clock size={20} />
              <span>{formatRuntime(movie.runtime_minutes)}</span>
            </div>
          )}

          {movie.rating && (
            <div
              className="flex items-center gap-2"
              style={{ color: palette?.accent || '#fbbf24' }}
            >
              <Star size={20} fill="currentColor" />
              <span className="font-semibold">{movie.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {movie.genres.map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: palette?.primary
                    ? `${palette.primary}30`
                    : 'rgba(255,255,255,0.1)',
                  color: palette?.text || '#ffffff',
                }}
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        {showOverview && movie.overview && (
          <p
            className="text-lg leading-relaxed mb-6 opacity-90 line-clamp-4"
            style={{ color: palette?.text || '#ffffff' }}
          >
            {movie.overview}
          </p>
        )}

        {/* Directors */}
        {movie.directors && movie.directors.length > 0 && (
          <div className="mb-4">
            <span className="opacity-60">Directed by </span>
            <span className="font-semibold">{movie.directors.join(', ')}</span>
          </div>
        )}

        {/* Cast */}
        {showCast && movie.cast && movie.cast.length > 0 && (
          <div>
            <span className="opacity-60">Starring </span>
            <span className="font-semibold">{movie.cast.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
