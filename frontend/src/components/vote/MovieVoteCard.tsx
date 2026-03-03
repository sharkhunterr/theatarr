import { Star, Check, Film } from 'lucide-react';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  backdrop_url?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
}

interface MovieVoteCardProps {
  movie: MovieOption;
  index: number;
  isSelected: boolean;
  hasVoted: boolean;
  voteCount?: number;
  totalVotes: number;
  showResults: boolean;
  disabled: boolean;
  onClick: () => void;
}

export function MovieVoteCard({
  movie,
  index,
  isSelected,
  hasVoted,
  voteCount = 0,
  totalVotes,
  showResults,
  disabled,
  onClick,
}: MovieVoteCardProps) {
  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
        disabled
          ? 'opacity-70 cursor-default'
          : 'cursor-pointer hover:scale-[1.02] hover:shadow-xl'
      } ${
        isSelected
          ? 'ring-4 ring-indigo-500 shadow-lg shadow-indigo-500/25'
          : hasVoted
          ? 'ring-2 ring-green-500'
          : ''
      }`}
    >
      {/* Poster */}
      <div className="aspect-[2/3] bg-gray-800 relative">
        {movie.poster_url ? (
          <img
            src={movie.poster_url}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={48} className="text-gray-600" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
            <Check size={20} className="text-white" />
          </div>
        )}

        {/* Voted indicator */}
        {hasVoted && !isSelected && (
          <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <Check size={20} className="text-white" />
          </div>
        )}

        {/* Vote count badge */}
        {showResults && voteCount > 0 && (
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/70 text-white text-sm font-medium">
            {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
          </div>
        )}

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">
            {movie.title}
          </h3>

          <div className="flex items-center gap-3 text-sm text-gray-300">
            {movie.year && <span>{movie.year}</span>}
            {movie.rating && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star size={14} fill="currentColor" />
                {movie.rating.toFixed(1)}
              </span>
            )}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {movie.genres.slice(0, 2).map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results bar */}
      {showResults && (
        <div className="bg-gray-800 p-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">{percentage}%</span>
            <span className="text-gray-500">{voteCount} votes</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Overview on hover (desktop only) */}
      {movie.overview && (
        <div className="absolute inset-0 bg-black/95 opacity-0 hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col pointer-events-none">
          <h3 className="text-lg font-bold text-white mb-2">{movie.title}</h3>
          <p className="text-gray-300 text-sm line-clamp-[8] flex-1">
            {movie.overview}
          </p>
          {!disabled && (
            <div className="mt-4 text-center">
              <span className="px-4 py-2 bg-indigo-500 rounded-lg text-white text-sm font-medium">
                Click to {isSelected ? 'deselect' : 'select'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
