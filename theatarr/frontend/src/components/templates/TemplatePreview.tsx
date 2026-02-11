import { useState, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Button } from '../common';
import { TemplateRenderer } from '../wallmount/TemplateRenderer';

interface Template {
  id?: string;
  name: string;
  description?: string;
  template_type: string;
  content?: string;
  styles?: string;
  script?: string;
  layout?: {
    components: Array<{
      type: string;
      position?: string;
      size?: string;
      opacity?: number;
      blur?: number;
      fields?: string[];
      limit?: number;
      max_lines?: number;
    }>;
  };
  config?: Record<string, unknown>;
}

interface TemplatePreviewProps {
  template: Template;
  onClose: () => void;
}

// Sample movie data for preview
const SAMPLE_MOVIES = [
  {
    title: 'Blade Runner 2049',
    year: 2017,
    runtime_minutes: 164,
    overview:
      'Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what\'s left of society into chaos. K\'s discovery leads him on a quest to find Rick Deckard, a former LAPD blade runner who has been missing for thirty years.',
    tagline: 'The key to the future is finally unearthed.',
    poster_url: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/sAtoMqDVhNDQBc3QJL3RF6hlhGq.jpg',
    rating: 8.0,
    genres: ['Science Fiction', 'Drama'],
    directors: ['Denis Villeneuve'],
    cast: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas', 'Sylvia Hoeks', 'Robin Wright'],
  },
  {
    title: 'Dune',
    year: 2021,
    runtime_minutes: 155,
    overview:
      'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people.',
    tagline: 'It begins.',
    poster_url: 'https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg',
    rating: 8.0,
    genres: ['Science Fiction', 'Adventure'],
    directors: ['Denis Villeneuve'],
    cast: ['Timothée Chalamet', 'Rebecca Ferguson', 'Oscar Isaac', 'Josh Brolin', 'Zendaya'],
  },
  {
    title: 'Interstellar',
    year: 2014,
    runtime_minutes: 169,
    overview:
      'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    poster_url: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop_url: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    rating: 8.6,
    genres: ['Adventure', 'Drama', 'Science Fiction'],
    directors: ['Christopher Nolan'],
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Michael Caine', 'Matt Damon'],
  },
];

const SAMPLE_PALETTES = [
  {
    primary: '#f97316',
    secondary: '#78350f',
    accent: '#fb923c',
    background: '#0c0a09',
    text: '#fafaf9',
    vibrant: '#f97316',
  },
  {
    primary: '#a855f7',
    secondary: '#3b0764',
    accent: '#c084fc',
    background: '#0a0a0f',
    text: '#f5f5f5',
    vibrant: '#a855f7',
  },
  {
    primary: '#3b82f6',
    secondary: '#1e3a8a',
    accent: '#60a5fa',
    background: '#020617',
    text: '#f8fafc',
    vibrant: '#3b82f6',
  },
];

export function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  const [movieIndex, setMovieIndex] = useState(0);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showSession, setShowSession] = useState(true);
  const [countdownMinutes, setCountdownMinutes] = useState(15);

  const movie = SAMPLE_MOVIES[movieIndex];
  const palette = SAMPLE_PALETTES[paletteIndex];

  const countdownTo = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + countdownMinutes);
    return date.toISOString();
  }, [countdownMinutes]);

  const session = showSession
    ? {
        name: 'Movie Night',
        status: 'running',
        current_sequence_index: 2,
        total_sequences: 5,
        current_sequence_name: 'Main Feature',
        current_sequence_elapsed_ms: 3600000,
        current_sequence_duration_ms: 9840000,
      }
    : undefined;

  const handleCycleMovie = () => {
    setMovieIndex((i) => (i + 1) % SAMPLE_MOVIES.length);
  };

  const handleCyclePalette = () => {
    setPaletteIndex((i) => (i + 1) % SAMPLE_PALETTES.length);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleCycleMovie} title="Changer de film">
            <RefreshCw size={14} />
            <span className="ml-1 hidden sm:inline">Film</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={handleCyclePalette} title="Changer de palette">
            <div
              className="w-3.5 h-3.5 rounded-full sm:mr-1"
              style={{ backgroundColor: palette.primary }}
            />
            <span className="hidden sm:inline">Palette</span>
          </Button>

          <label className="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showSession}
              onChange={(e) => setShowSession(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-indigo-500"
            />
            <span className="hidden sm:inline">Session</span>
            <span className="sm:hidden">Sess.</span>
          </label>

          {template.template_type === 'countdown' && (
            <select
              value={countdownMinutes}
              onChange={(e) => setCountdownMinutes(parseInt(e.target.value))}
              className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs sm:text-sm"
            >
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1h</option>
            </select>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="flex-shrink-0">
          <X size={16} />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative bg-black">
        <div className="absolute inset-2 sm:inset-4 rounded-lg overflow-hidden shadow-2xl border border-gray-800">
          <TemplateRenderer
            template={{
              name: template.name,
              template_type: template.template_type,
              content: template.content,
              styles: template.styles,
              script: template.script,
              layout: template.layout,
              config: template.config,
            }}
            data={{
              movie,
              session,
              countdown_to: template.template_type === 'countdown' ? countdownTo : undefined,
              palette,
            }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2 sm:p-3 bg-gray-900 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs sm:text-sm text-gray-400 gap-2">
          <div className="truncate">
            <span className="font-medium text-white">{template.name}</span>
            <span className="mx-1.5 hidden sm:inline">|</span>
            <span className="hidden sm:inline">{template.template_type}</span>
          </div>
          <div className="text-gray-500 flex-shrink-0">
            {movie.title}
          </div>
        </div>
      </div>
    </div>
  );
}
