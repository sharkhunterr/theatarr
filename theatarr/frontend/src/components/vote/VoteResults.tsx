import { Trophy, Film } from 'lucide-react';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
}

interface VoteResultsProps {
  movieOptions: MovieOption[];
  voteCounts: Record<number, number>;
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
    <div className="space-y-4 max-w-2xl mx-auto">
      {sortedResults.map((result, rank) => {
        const isWinner = result.index === winnerIndex;
        const isLeading = result.votes === maxVotes && result.votes > 0;

        return (
          <div
            key={result.index}
            className={`relative rounded-lg overflow-hidden ${
              isWinner
                ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30'
                : 'bg-gray-800/50'
            }`}
          >
            <div className="flex items-center gap-4 p-4">
              {/* Rank */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  rank === 0
                    ? 'bg-yellow-500 text-black'
                    : rank === 1
                    ? 'bg-gray-400 text-black'
                    : rank === 2
                    ? 'bg-amber-700 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {rank + 1}
              </div>

              {/* Poster thumbnail */}
              <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-700">
                {result.movie.poster_url ? (
                  <img
                    src={result.movie.poster_url}
                    alt={result.movie.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film size={20} className="text-gray-600" />
                  </div>
                )}
              </div>

              {/* Movie info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">
                    {result.movie.title}
                  </h3>
                  {isWinner && <Trophy size={16} className="text-yellow-500" />}
                  {isLeading && !isWinner && (
                    <span className="text-xs text-green-400 font-medium">Leading</span>
                  )}
                </div>
                {result.movie.year && (
                  <p className="text-sm text-gray-500">{result.movie.year}</p>
                )}
              </div>

              {/* Vote count */}
              <div className="text-right">
                <div className="text-xl font-bold text-white">{result.votes}</div>
                <div className="text-sm text-gray-500">
                  {result.percentage.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-700">
              <div
                className={`h-full transition-all duration-700 ease-out ${
                  isWinner
                    ? 'bg-yellow-500'
                    : isLeading
                    ? 'bg-green-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Total votes */}
      <div className="text-center text-gray-500 text-sm pt-4">
        Total votes: {totalVotes}
      </div>
    </div>
  );
}
