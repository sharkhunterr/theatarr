import { Trophy, Film } from 'lucide-react';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
}

interface VoteResultsProps {
  movieOptions: MovieOption[];
  voteCounts: Record<number | string, number>;
  winnerIndex?: number;
}

export function VoteResults({
  movieOptions,
  voteCounts,
  winnerIndex,
}: VoteResultsProps) {
  const totalVotes = Object.values(voteCounts).reduce((sum, count) => sum + count, 0);

  // Sort by vote count
  const sortedResults = movieOptions
    .map((movie, index) => ({
      movie,
      index,
      votes: voteCounts[index] || 0,
      percentage: totalVotes > 0 ? ((voteCounts[index] || 0) / totalVotes) * 100 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const maxVotes = Math.max(...sortedResults.map((r) => r.votes));

  return (
    <div className="space-y-3">
      {sortedResults.map((result, rank) => {
        const isWinner = result.index === winnerIndex;
        const isLeading = result.votes === maxVotes && result.votes > 0;

        return (
          <div
            key={result.index}
            className={`relative rounded-lg overflow-hidden ${
              isWinner
                ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30'
                : 'bg-dark-surface border border-dark-border'
            }`}
          >
            <div className="flex items-center gap-3 p-3 sm:p-4">
              {/* Rank */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  rank === 0
                    ? 'bg-yellow-500 text-black'
                    : rank === 1
                    ? 'bg-gray-400 text-black'
                    : rank === 2
                    ? 'bg-amber-700 text-white'
                    : 'bg-dark-border text-dark-muted'
                }`}
              >
                {rank + 1}
              </div>

              {/* Poster thumbnail */}
              <div className="w-10 h-14 sm:w-12 sm:h-16 rounded overflow-hidden flex-shrink-0 bg-dark-border">
                {result.movie.poster_url ? (
                  <img
                    src={result.movie.poster_url}
                    alt={result.movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={18} className="text-dark-muted" />
                  </div>
                )}
              </div>

              {/* Movie info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-dark-text truncate text-sm sm:text-base">
                    {result.movie.title}
                  </h3>
                  {isWinner && <Trophy size={16} className="text-yellow-500 flex-shrink-0" />}
                  {isLeading && !isWinner && (
                    <span className="text-xs text-green-400 font-medium flex-shrink-0">En tête</span>
                  )}
                </div>
                {result.movie.year && (
                  <p className="text-xs sm:text-sm text-dark-muted">{result.movie.year}</p>
                )}
              </div>

              {/* Vote count */}
              <div className="text-right flex-shrink-0">
                <div className="text-lg sm:text-xl font-bold text-dark-text">{result.votes}</div>
                <div className="text-xs sm:text-sm text-dark-muted">
                  {result.percentage.toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-dark-border">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  isWinner
                    ? 'bg-yellow-500'
                    : isLeading
                    ? 'bg-green-500'
                    : 'bg-theatarr-500'
                }`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
