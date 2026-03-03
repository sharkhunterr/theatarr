import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Select } from '../common';
import { apiClient } from '../../api/client';

interface TrailerRule {
  id?: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  genres?: string[];
  min_year?: number;
  max_year?: number;
  min_rating?: number;
  max_rating?: number;
  preferred_quality: string;
  min_quality: string;
  max_storage_gb: number;
  max_trailer_count?: number;
  max_downloads_per_run: number;
  frequency: string;
  rotation_enabled: boolean;
  rotation_keep_most_recent: number;
  rotation_keep_most_played: number;
}

interface TrailerRuleFormProps {
  rule?: TrailerRule;
  onSave: () => void;
  onCancel: () => void;
}

const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western',
];

const QUALITY_OPTIONS = [
  { value: '2160p', label: '4K (2160p)' },
  { value: '1080p', label: 'Full HD (1080p)' },
  { value: '720p', label: 'HD (720p)' },
  { value: '480p', label: 'SD (480p)' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual Only' },
];

export function TrailerRuleForm({ rule, onSave, onCancel }: TrailerRuleFormProps) {
  const isEditing = !!rule?.id;

  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [isEnabled, setIsEnabled] = useState(rule?.is_enabled ?? true);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(rule?.genres || []);
  const [minYear, setMinYear] = useState(rule?.min_year?.toString() || '');
  const [maxYear, setMaxYear] = useState(rule?.max_year?.toString() || '');
  const [minRating, setMinRating] = useState(rule?.min_rating?.toString() || '');
  const [preferredQuality, setPreferredQuality] = useState(rule?.preferred_quality || '1080p');
  const [minQuality, setMinQuality] = useState(rule?.min_quality || '720p');
  const [maxStorageGb, setMaxStorageGb] = useState(rule?.max_storage_gb?.toString() || '10');
  const [maxTrailerCount, setMaxTrailerCount] = useState(rule?.max_trailer_count?.toString() || '');
  const [maxDownloadsPerRun, setMaxDownloadsPerRun] = useState(
    rule?.max_downloads_per_run?.toString() || '5'
  );
  const [frequency, setFrequency] = useState(rule?.frequency || 'weekly');
  const [rotationEnabled, setRotationEnabled] = useState(rule?.rotation_enabled ?? true);
  const [keepMostRecent, setKeepMostRecent] = useState(
    rule?.rotation_keep_most_recent?.toString() || '20'
  );
  const [keepMostPlayed, setKeepMostPlayed] = useState(
    rule?.rotation_keep_most_played?.toString() || '10'
  );

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<TrailerRule>) => {
      if (isEditing) {
        await apiClient.patch(`/trailers/rules/${rule.id}`, data);
      } else {
        await apiClient.post('/trailers/rules', data);
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Partial<TrailerRule> = {
      name,
      description: description || undefined,
      is_enabled: isEnabled,
      genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      min_year: minYear ? parseInt(minYear) : undefined,
      max_year: maxYear ? parseInt(maxYear) : undefined,
      min_rating: minRating ? parseFloat(minRating) : undefined,
      preferred_quality: preferredQuality,
      min_quality: minQuality,
      max_storage_gb: parseFloat(maxStorageGb) || 10,
      max_trailer_count: maxTrailerCount ? parseInt(maxTrailerCount) : undefined,
      max_downloads_per_run: parseInt(maxDownloadsPerRun) || 5,
      frequency,
      rotation_enabled: rotationEnabled,
      rotation_keep_most_recent: parseInt(keepMostRecent) || 20,
      rotation_keep_most_played: parseInt(keepMostPlayed) || 10,
    };

    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <Input
          label="Rule Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Action Movie Trailers"
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Download trailers for popular action movies"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500"
          />
          <span className="text-sm text-gray-300">Enable this rule</span>
        </label>
      </div>

      {/* Genre Filters */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Genres (optional)</h3>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedGenres.includes(genre)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Year/Rating Filters */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Min Year"
          type="number"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
          placeholder="2020"
        />
        <Input
          label="Max Year"
          type="number"
          value={maxYear}
          onChange={(e) => setMaxYear(e.target.value)}
          placeholder="2024"
        />
        <Input
          label="Min Rating"
          type="number"
          step="0.1"
          min="0"
          max="10"
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          placeholder="6.0"
        />
        <div /> {/* Empty cell */}
      </div>

      {/* Quality Settings */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Preferred Quality"
          value={preferredQuality}
          onChange={(e) => setPreferredQuality(e.target.value)}
          options={QUALITY_OPTIONS}
        />
        <Select
          label="Minimum Quality"
          value={minQuality}
          onChange={(e) => setMinQuality(e.target.value)}
          options={QUALITY_OPTIONS}
        />
      </div>

      {/* Storage Settings */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Max Storage (GB)"
          type="number"
          step="0.1"
          min="0.1"
          value={maxStorageGb}
          onChange={(e) => setMaxStorageGb(e.target.value)}
          required
        />
        <Input
          label="Max Trailer Count"
          type="number"
          min="1"
          value={maxTrailerCount}
          onChange={(e) => setMaxTrailerCount(e.target.value)}
          placeholder="Unlimited"
        />
      </div>

      {/* Download Settings */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Run Frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          options={FREQUENCY_OPTIONS}
        />
        <Input
          label="Max Downloads Per Run"
          type="number"
          min="1"
          max="50"
          value={maxDownloadsPerRun}
          onChange={(e) => setMaxDownloadsPerRun(e.target.value)}
        />
      </div>

      {/* Rotation Settings */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={rotationEnabled}
            onChange={(e) => setRotationEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500"
          />
          <span className="text-sm text-gray-300">Enable storage rotation</span>
        </label>

        {rotationEnabled && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <Input
              label="Keep Most Recent"
              type="number"
              min="0"
              value={keepMostRecent}
              onChange={(e) => setKeepMostRecent(e.target.value)}
            />
            <Input
              label="Keep Most Played"
              type="number"
              min="0"
              value={keepMostPlayed}
              onChange={(e) => setKeepMostPlayed(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending || !name}>
          {saveMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Rule'}
        </Button>
      </div>

      {saveMutation.error && (
        <div className="text-red-500 text-sm">Failed to save rule. Please try again.</div>
      )}
    </form>
  );
}
