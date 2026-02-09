/**
 * 2x2 collage of movie posters for vote sessions.
 */

import { Film } from 'lucide-react';

interface VotePosterCollageProps {
  posters: string[];
  className?: string;
}

export function VotePosterCollage({ posters, className = '' }: VotePosterCollageProps) {
  // Take up to 4 posters for the 2x2 grid
  const display = posters.slice(0, 4);

  return (
    <div
      className={`grid grid-cols-2 grid-rows-2 overflow-hidden ${className}`}
      style={{ backgroundColor: '#0a1628' }}
    >
      {display.map((url, i) => (
        <img
          key={i}
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      ))}
      {/* Fill remaining cells if fewer than 4 posters */}
      {Array.from({ length: Math.max(0, 4 - display.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="w-full h-full flex items-center justify-center bg-dark-border"
        >
          <Film size={12} className="text-dark-muted" />
        </div>
      ))}
    </div>
  );
}
