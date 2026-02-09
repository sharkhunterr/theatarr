import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Zap, Eye, EyeOff, UserCheck, Lock, Users, Vote, Clock, Calendar } from 'lucide-react';
import clsx from 'clsx';
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
  const [allowMultipleVotes] = useState(false);
  const [showResultsDuringVoting, setShowResultsDuringVoting] = useState(false);
  const [anonymousVoting, setAnonymousVoting] = useState(true);
  const [requireToken, setRequireToken] = useState(true);
  const [openImmediately, setOpenImmediately] = useState(true);
  const [closeWhenAllVoted, setCloseWhenAllVoted] = useState(false);
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
      const message = error?.message || 'Erreur lors de la création du vote';
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
      require_token: requireToken,
      anonymous_voting: anonymousVoting,
      open_immediately: openImmediately,
      close_when_all_voted: closeWhenAllVoted,
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
        <h3 className="text-lg font-semibold text-dark-text mb-4">Parametres</h3>

        {/* Options grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Open Immediately */}
          <button
            type="button"
            onClick={() => setOpenImmediately(!openImmediately)}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              openImmediately
                ? 'bg-green-500/10 border-green-500/50'
                : 'bg-dark-bg border-dark-border hover:border-dark-muted'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <Zap size={16} className={openImmediately ? 'text-green-400' : 'text-dark-muted'} />
              <div className={clsx(
                'w-8 h-4 rounded-full transition-colors relative',
                openImmediately ? 'bg-green-500' : 'bg-dark-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                  openImmediately ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <div className="text-xs font-medium text-dark-text">Ouvrir immediatement</div>
            <div className="text-[10px] text-dark-muted">Le vote demarre des la creation</div>
          </button>

          {/* Show Results */}
          <button
            type="button"
            onClick={() => setShowResultsDuringVoting(!showResultsDuringVoting)}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              showResultsDuringVoting
                ? 'bg-purple-500/10 border-purple-500/50'
                : 'bg-dark-bg border-dark-border hover:border-dark-muted'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              {showResultsDuringVoting ? (
                <Eye size={16} className="text-purple-400" />
              ) : (
                <EyeOff size={16} className="text-dark-muted" />
              )}
              <div className={clsx(
                'w-8 h-4 rounded-full transition-colors relative',
                showResultsDuringVoting ? 'bg-purple-500' : 'bg-dark-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                  showResultsDuringVoting ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <div className="text-xs font-medium text-dark-text">Resultats visibles</div>
            <div className="text-[10px] text-dark-muted">Afficher pendant le vote</div>
          </button>

          {/* Anonymous */}
          <button
            type="button"
            onClick={() => setAnonymousVoting(!anonymousVoting)}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              anonymousVoting
                ? 'bg-yellow-500/10 border-yellow-500/50'
                : 'bg-dark-bg border-dark-border hover:border-dark-muted'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <UserCheck size={16} className={anonymousVoting ? 'text-yellow-400' : 'text-dark-muted'} />
              <div className={clsx(
                'w-8 h-4 rounded-full transition-colors relative',
                anonymousVoting ? 'bg-yellow-500' : 'bg-dark-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                  anonymousVoting ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <div className="text-xs font-medium text-dark-text">Vote anonyme</div>
            <div className="text-[10px] text-dark-muted">Les votes sont anonymises</div>
          </button>

          {/* Require Token */}
          <button
            type="button"
            onClick={() => setRequireToken(!requireToken)}
            className={clsx(
              'p-3 rounded-lg border text-left transition-all',
              requireToken
                ? 'bg-theatarr-500/10 border-theatarr-500/50'
                : 'bg-dark-bg border-dark-border hover:border-dark-muted'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <Lock size={16} className={requireToken ? 'text-theatarr-400' : 'text-dark-muted'} />
              <div className={clsx(
                'w-8 h-4 rounded-full transition-colors relative',
                requireToken ? 'bg-theatarr-500' : 'bg-dark-border'
              )}>
                <div className={clsx(
                  'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
                  requireToken ? 'left-4' : 'left-0.5'
                )} />
              </div>
            </div>
            <div className="text-xs font-medium text-dark-text">Acces restreint</div>
            <div className="text-[10px] text-dark-muted">Les votants doivent etre invites</div>
          </button>

          {/* Max Votes */}
          <div className="p-3 rounded-lg border bg-dark-bg border-dark-border">
            <div className="flex items-center justify-between mb-1">
              <Vote size={16} className="text-dark-muted" />
              <input
                type="number"
                min={1}
                max={10}
                value={maxVotesPerUser}
                onChange={(e) => setMaxVotesPerUser(parseInt(e.target.value) || 1)}
                className="w-12 bg-dark-surface border border-dark-border rounded px-2 py-0.5 text-xs text-dark-text text-center"
              />
            </div>
            <div className="text-xs font-medium text-dark-text">Votes max</div>
            <div className="text-[10px] text-dark-muted">Par participant</div>
          </div>
        </div>
      </div>

      {/* Cloture */}
      <div className="border-t border-dark-border pt-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-dark-text mb-4">
          <Clock size={16} />
          Cloture
        </h3>

        {/* Close when all voted */}
        <button
          type="button"
          onClick={() => setCloseWhenAllVoted(!closeWhenAllVoted)}
          className={clsx(
            'w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3 mb-3',
            closeWhenAllVoted
              ? 'bg-blue-500/10 border-blue-500/50'
              : 'bg-dark-bg border-dark-border hover:border-dark-muted'
          )}
        >
          <Users size={16} className={closeWhenAllVoted ? 'text-blue-400 flex-shrink-0' : 'text-dark-muted flex-shrink-0'} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-dark-text">Cloture automatique</div>
            <div className="text-[10px] text-dark-muted">Fermer quand tous ont vote</div>
          </div>
          <div className={clsx(
            'w-8 h-4 rounded-full transition-colors relative flex-shrink-0',
            closeWhenAllVoted ? 'bg-blue-500' : 'bg-dark-border'
          )}>
            <div className={clsx(
              'absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform',
              closeWhenAllVoted ? 'left-4' : 'left-0.5'
            )} />
          </div>
        </button>

        {/* Scheduled close */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-dark-muted">
            <Calendar size={12} />
            Cloture programmee
          </label>
          <Input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
          <p className="text-[10px] text-dark-muted">Cloturer le vote a cette date/heure</p>
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
          {createMutation.isPending ? 'Création...' : 'Créer le vote'}
        </Button>
      </div>
    </form>
  );
}
