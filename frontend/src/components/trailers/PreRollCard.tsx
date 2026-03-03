import { Trash2, Clock, Clapperboard, Download, AlertCircle, Play } from 'lucide-react';
import { Button } from '../common';

interface PreRoll {
  id: string;
  name: string;
  tags?: string[] | null;
  source_type: string;
  file_size_mb?: number | null;
  format: string;
  duration_seconds?: number | null;
  status: string;
  error_message?: string | null;
  download_progress: number;
  play_count: number;
  is_ready: boolean;
}

interface PreRollCardProps {
  preroll: PreRoll;
  onDelete: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PreRollCard({ preroll, onDelete }: PreRollCardProps) {
  const statusColors: Record<string, string> = {
    ready: 'bg-green-500/20 text-green-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    downloading: 'bg-blue-500/20 text-blue-400',
    processing: 'bg-blue-500/20 text-blue-400',
    error: 'bg-red-500/20 text-red-400',
  };

  const statusLabels: Record<string, string> = {
    ready: 'Prêt',
    pending: 'En attente',
    downloading: 'Téléchargement',
    processing: 'Traitement',
    error: 'Erreur',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    downloading: <Download size={14} className="animate-bounce" />,
    error: <AlertCircle size={14} />,
  };

  return (
    <div className="bg-dark-surface border border-dark-border rounded-lg overflow-hidden hover:border-theatarr-500/50 transition-colors">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clapperboard size={18} className="text-theatarr-400 shrink-0" />
            <h3 className="font-medium text-dark-text truncate" title={preroll.name}>
              {preroll.name}
            </h3>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 flex items-center gap-1 ${statusColors[preroll.status] || 'bg-gray-500/20 text-dark-muted'}`}>
            {statusIcons[preroll.status]}
            {statusLabels[preroll.status] || preroll.status}
          </span>
        </div>

        {/* Info */}
        <div className="flex flex-wrap gap-3 text-xs text-dark-muted mb-3">
          {preroll.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(preroll.duration_seconds)}
            </span>
          )}
          {preroll.file_size_mb != null && (
            <span>{preroll.file_size_mb.toFixed(1)} MB</span>
          )}
          <span className="uppercase">{preroll.format}</span>
          <span className="text-dark-muted/60">{preroll.source_type === 'youtube' ? 'YouTube' : 'Upload'}</span>
        </div>

        {/* Tags */}
        {preroll.tags && preroll.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {preroll.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-dark-border/50 rounded text-xs text-dark-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Download progress */}
        {(preroll.status === 'downloading' || preroll.status === 'processing') && (
          <div className="mb-3">
            <div className="w-full bg-dark-border rounded-full h-1.5">
              <div
                className="bg-theatarr-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(preroll.download_progress || 0) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {preroll.error_message && (
          <p className="text-xs text-red-400 mb-3 line-clamp-2">{preroll.error_message}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-muted">
            {preroll.play_count > 0 ? (
              <span className="flex items-center gap-1">
                <Play size={10} />
                {preroll.play_count} lecture{preroll.play_count > 1 ? 's' : ''}
              </span>
            ) : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
