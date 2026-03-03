import { Play, Trash2, Clock, Film, AlertCircle, Download } from 'lucide-react';
import { Button } from '../common';

interface Trailer {
  id: string;
  movie_title: string;
  movie_year?: number;
  title: string;
  duration_seconds?: number;
  file_size_mb?: number;
  quality: string;
  thumbnail_url?: string;
  status: string;
  play_count: number;
  is_ready: boolean;
  download_progress?: number;
}

interface TrailerCardProps {
  trailer: Trailer;
  onPlay?: () => void;
  onDelete: () => void;
}

export function TrailerCard({ trailer, onPlay, onDelete }: TrailerCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-500';
      case 'downloading':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all">
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-900 relative">
        {trailer.thumbnail_url ? (
          <img
            src={trailer.thumbnail_url}
            alt={trailer.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={32} className="text-gray-600" />
          </div>
        )}

        {/* Status overlay */}
        {trailer.status !== 'ready' && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            {trailer.status === 'downloading' ? (
              <div className="text-center">
                <Download size={24} className="text-blue-400 animate-bounce mx-auto mb-2" />
                <div className="text-sm text-blue-400">
                  {((trailer.download_progress || 0) * 100).toFixed(0)}%
                </div>
              </div>
            ) : trailer.status === 'error' ? (
              <AlertCircle size={32} className="text-red-400" />
            ) : (
              <Clock size={32} className="text-yellow-400" />
            )}
          </div>
        )}

        {/* Duration badge */}
        {trailer.duration_seconds && trailer.is_ready && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-xs text-white">
            {formatDuration(trailer.duration_seconds)}
          </div>
        )}

        {/* Quality badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/80 rounded text-xs text-white">
          {trailer.quality}
        </div>

        {/* Status indicator */}
        <div
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${getStatusColor(
            trailer.status
          )}`}
        />

        {/* Play overlay */}
        {trailer.is_ready && onPlay && (
          <button
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 transition-opacity"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Play size={32} className="text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-white truncate">{trailer.movie_title}</h3>
        <p className="text-sm text-gray-400 truncate">{trailer.title}</p>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          {trailer.movie_year && <span>{trailer.movie_year}</span>}
          {trailer.file_size_mb && <span>{trailer.file_size_mb.toFixed(1)} MB</span>}
          {trailer.play_count > 0 && (
            <span className="flex items-center gap-1">
              <Play size={10} />
              {trailer.play_count}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-700">
          {trailer.is_ready && onPlay && (
            <Button variant="ghost" size="sm" onClick={onPlay} className="flex-1">
              <Play size={14} />
              <span className="ml-1">Play</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
