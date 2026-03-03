import { ReactNode } from 'react';
import { HardDrive, Film, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface StorageStatsData {
  total_trailers: number;
  ready_trailers: number;
  pending_trailers: number;
  error_trailers: number;
  total_size_gb: number;
  total_duration_formatted: string;
  by_quality: Record<string, number>;
}

interface StorageStatsProps {
  stats: StorageStatsData;
  className?: string;
  actions?: ReactNode;
}

export function StorageStats({ stats, className = '', actions }: StorageStatsProps) {
  return (
    <div className={`bg-dark-surface border border-dark-border rounded-xl px-4 py-2.5 ${className}`}>
      <div className="flex items-center gap-6 flex-wrap">
        {/* Storage */}
        <div className="flex items-center gap-2">
          <HardDrive size={15} className="text-indigo-400" />
          <span className="text-sm font-medium text-dark-text">{stats.total_size_gb.toFixed(1)} GB</span>
        </div>

        <div className="w-px h-4 bg-dark-border" />

        {/* Duration */}
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-purple-400" />
          <span className="text-sm text-dark-text">{stats.total_duration_formatted}</span>
        </div>

        <div className="w-px h-4 bg-dark-border" />

        {/* Total */}
        <div className="flex items-center gap-2">
          <Film size={15} className="text-blue-400" />
          <span className="text-sm text-dark-text">{stats.total_trailers}</span>
        </div>

        {/* Ready */}
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-green-400" />
          <span className="text-sm text-dark-muted">{stats.ready_trailers} prêtes</span>
        </div>

        {/* Pending */}
        {stats.pending_trailers > 0 && (
          <div className="flex items-center gap-2">
            <Loader size={14} className="text-yellow-400 animate-spin" />
            <span className="text-sm text-yellow-400">{stats.pending_trailers}</span>
          </div>
        )}

        {/* Errors */}
        {stats.error_trailers > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-400" />
            <span className="text-sm text-red-400">{stats.error_trailers}</span>
          </div>
        )}

        {/* Quality badges */}
        {Object.keys(stats.by_quality).length > 0 && (
          <>
            <div className="w-px h-4 bg-dark-border" />
            <div className="flex items-center gap-1.5">
              {Object.entries(stats.by_quality)
                .sort(([a], [b]) => {
                  const order = ['2160p', '1080p', '720p', '480p'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([quality, count]) => (
                  <span
                    key={quality}
                    className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-xs text-dark-muted"
                  >
                    {quality}: {count}
                  </span>
                ))}
            </div>
          </>
        )}

        {/* Right-aligned actions */}
        {actions && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
