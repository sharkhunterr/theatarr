import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Search } from 'lucide-react';
import { Button, Input } from '../common';
import { apiClient } from '../../api/client';

interface MovieOption {
  title: string;
  year?: number;
  poster_url?: string;
  overview?: string;
  rating?: number;
  genres?: string[];
}

interface VoteSessionFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export function VoteSessionForm({ onSave, onCancel }: VoteSessionFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [movieOptions, setMovieOptions] = useState<MovieOption[]>([
    { title: '' },
    { title: '' },
  ]);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(1);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [showResultsDuringVoting, setShowResultsDuringVoting] = useState(false);
  const [closesAt, setClosesAt] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiClient.post('/vote-sessions', data);
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleAddMovie = () => {
    setMovieOptions([...movieOptions, { title: '' }]);
  };

  const handleRemoveMovie = (index: number) => {
    if (movieOptions.length > 2) {
      setMovieOptions(movieOptions.filter((_, i) => i !== index));
    }
  };

  const handleUpdateMovie = (index: number, updates: Partial<MovieOption>) => {
    setMovieOptions(
      movieOptions.map((opt, i) => (i === index ? { ...opt, ...updates } : opt))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty movies
    const validMovies = movieOptions.filter((m) => m.title.trim());

    if (validMovies.length < 2) {
      alert('Please add at least 2 movies');
      return;
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      movie_options: validMovies,
      max_votes_per_user: maxVotesPerUser,
      allow_multiple_votes: allowMultipleVotes,
      show_results_during_voting: showResultsDuringVoting,
      require_token: true,
      anonymous_voting: true,
      closes_at: closesAt || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <Input
          label="Session Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Movie Night Vote"
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What movie should we watch?"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
          />
        </div>
      </div>

      {/* Movie Options */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Movies</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddMovie}
            disabled={movieOptions.length >= 10}
          >
            <Plus size={14} />
            <span className="ml-1">Add Movie</span>
          </Button>
        </div>

        <div className="space-y-3">
          {movieOptions.map((movie, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-gray-800 rounded-lg"
            >
              {/* Poster preview */}
              <div className="w-16 h-24 bg-gray-700 rounded flex-shrink-0 overflow-hidden">
                {movie.poster_url && (
                  <img
                    src={movie.poster_url}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Movie inputs */}
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Movie title"
                  value={movie.title}
                  onChange={(e) =>
                    handleUpdateMovie(index, { title: e.target.value })
                  }
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Year"
                    type="number"
                    value={movie.year || ''}
                    onChange={(e) =>
                      handleUpdateMovie(index, {
                        year: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  />
                  <Input
                    placeholder="Poster URL"
                    value={movie.poster_url || ''}
                    onChange={(e) =>
                      handleUpdateMovie(index, { poster_url: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Remove button */}
              {movieOptions.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveMovie(index)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-500 mt-2">
          Add 2-10 movies for voting. You can add poster URLs from TMDB or other sources.
        </p>
      </div>

      {/* Voting Options */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Voting Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-300">
                Max Votes Per User
              </label>
              <p className="text-xs text-gray-500">
                How many movies can each person vote for
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxVotesPerUser}
              onChange={(e) => setMaxVotesPerUser(parseInt(e.target.value) || 1)}
              className="w-20"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultipleVotes}
              onChange={(e) => setAllowMultipleVotes(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-300">
                Allow Multiple Votes
              </span>
              <p className="text-xs text-gray-500">
                Users can vote for multiple different movies
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showResultsDuringVoting}
              onChange={(e) => setShowResultsDuringVoting(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-300">
                Show Results During Voting
              </span>
              <p className="text-xs text-gray-500">
                Voters can see current results in real-time
              </p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Closes At (optional)
            </label>
            <Input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || !name || movieOptions.filter((m) => m.title).length < 2}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Vote Session'}
        </Button>
      </div>

      {createMutation.error && (
        <div className="text-red-500 text-sm">
          Failed to create vote session. Please try again.
        </div>
      )}
    </form>
  );
}
