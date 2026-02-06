import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input } from '../common';
import { MovieSelector, MovieOption } from './MovieSelector';
import { apiClient } from '../../api/client';

interface VoteSessionFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export function VoteSessionForm({ onSave, onCancel }: VoteSessionFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [movieOptions, setMovieOptions] = useState<MovieOption[]>([]);
  const [maxVotesPerUser, setMaxVotesPerUser] = useState(1);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [showResultsDuringVoting, setShowResultsDuringVoting] = useState(false);
  const [closesAt, setClosesAt] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiClient.post('/vote-sessions', data);
    },
    onSuccess: () => {
      onSave();
    },
    onError: (error: any) => {
      console.error('Create vote session error:', error);
      const message = error?.message || 'Erreur lors de la création de la session de vote';
      setErrorMessage(message);
    },
  });

  const handleAddMovie = (movie: MovieOption) => {
    if (movieOptions.length < 10) {
      setMovieOptions([...movieOptions, movie]);
    }
  };

  const handleRemoveMovie = (index: number) => {
    setMovieOptions(movieOptions.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Le nom de la session est requis');
      return;
    }

    if (movieOptions.length < 2) {
      setErrorMessage('Veuillez ajouter au moins 2 films');
      return;
    }

    createMutation.mutate({
      name,
      description: description || undefined,
      movie_options: movieOptions,
      max_votes_per_user: maxVotesPerUser,
      allow_multiple_votes: allowMultipleVotes,
      show_results_during_voting: showResultsDuringVoting,
      require_token: true,
      anonymous_voting: true,
      closes_at: closesAt || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Scrollable content */}
      <div className="space-y-6">
        {/* Error Message */}
        {(createMutation.error || errorMessage) && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {errorMessage || 'Erreur lors de la création. Veuillez réessayer.'}
          </div>
        )}

      {/* Basic Info */}
      <div className="space-y-4">
        <Input
          label="Nom de la session"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Ex: Soirée film du samedi"
        />

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            Description (optionnel)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quel film voulez-vous regarder ce soir ?"
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-theatarr-500 focus:border-transparent"
            rows={2}
          />
        </div>
      </div>

      {/* Movie Selection */}
      <div>
        <h3 className="text-lg font-semibold text-dark-text mb-4">Films</h3>
        <MovieSelector
          selectedMovies={movieOptions}
          onSelect={handleAddMovie}
          onRemove={handleRemoveMovie}
          maxSelections={10}
        />
      </div>

      {/* Voting Options */}
      <div className="border-t border-dark-border pt-6">
        <h3 className="text-lg font-semibold text-dark-text mb-4">Options de vote</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-dark-surface rounded-lg">
            <div>
              <label className="text-sm font-medium text-dark-text">
                Votes max par utilisateur
              </label>
              <p className="text-xs text-dark-muted">
                Combien de films chaque personne peut voter
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxVotesPerUser}
              onChange={(e) => setMaxVotesPerUser(parseInt(e.target.value) || 1)}
              className="w-20 text-center"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-dark-surface rounded-lg cursor-pointer hover:bg-dark-border/30 transition-colors">
            <input
              type="checkbox"
              checked={allowMultipleVotes}
              onChange={(e) => setAllowMultipleVotes(e.target.checked)}
              className="w-5 h-5 rounded border-dark-border bg-dark-bg text-theatarr-500 focus:ring-theatarr-500"
            />
            <div>
              <span className="text-sm font-medium text-dark-text">
                Autoriser les votes multiples
              </span>
              <p className="text-xs text-dark-muted">
                Les utilisateurs peuvent voter pour plusieurs films différents
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-dark-surface rounded-lg cursor-pointer hover:bg-dark-border/30 transition-colors">
            <input
              type="checkbox"
              checked={showResultsDuringVoting}
              onChange={(e) => setShowResultsDuringVoting(e.target.checked)}
              className="w-5 h-5 rounded border-dark-border bg-dark-bg text-theatarr-500 focus:ring-theatarr-500"
            />
            <div>
              <span className="text-sm font-medium text-dark-text">
                Afficher les résultats en temps réel
              </span>
              <p className="text-xs text-dark-muted">
                Les votants peuvent voir les résultats actuels
              </p>
            </div>
          </label>

          <div className="p-3 bg-dark-surface rounded-lg">
            <label className="block text-sm font-medium text-dark-text mb-2">
              Date de fermeture (optionnel)
            </label>
            <Input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      </div>

      {/* Actions - Sticky at bottom */}
      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 mt-6 border-t border-dark-border bg-dark-surface sticky bottom-0">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || !name || movieOptions.length < 2}
        >
          {createMutation.isPending ? 'Création...' : 'Créer la session de vote'}
        </Button>
      </div>
    </form>
  );
}
