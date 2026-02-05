import { Settings, Trash2, Power, PowerOff, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent } from '../common';

export interface Service {
  id: string;
  name: string;
  description?: string;
  adapter_type: string;
  category: string;
  is_enabled: boolean;
  connection_status: 'connected' | 'disconnected' | 'error' | 'unknown';
  last_seen_at?: string;
  error_message?: string;
  capabilities?: Array<{
    name: string;
    parameters: string[];
    description?: string;
  }>;
}

interface ServiceCardProps {
  service: Service;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onTest: () => void;
  isTestLoading?: boolean;
}

const categoryLabels: Record<string, string> = {
  lighting: 'Lighting',
  player: 'Media Player',
  media_source: 'Media Source',
  actuator: 'Actuator',
  metadata: 'Metadata',
};

const statusColors: Record<string, string> = {
  connected: 'bg-green-500',
  disconnected: 'bg-gray-500',
  error: 'bg-red-500',
  unknown: 'bg-yellow-500',
};

const statusLabels: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
  unknown: 'Unknown',
};

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  isTestLoading,
}: ServiceCardProps) {
  return (
    <Card
      className={`transition-all ${
        !service.is_enabled ? 'opacity-60' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${statusColors[service.connection_status]}`}
                title={statusLabels[service.connection_status]}
              />
              <h3 className="text-lg font-semibold text-dark-text truncate">
                {service.name}
              </h3>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 text-sm text-dark-muted mb-2">
              <span className="px-2 py-0.5 bg-dark-bg rounded text-xs">
                {service.adapter_type}
              </span>
              <span>{categoryLabels[service.category] || service.category}</span>
            </div>

            {/* Description */}
            {service.description && (
              <p className="text-sm text-dark-muted mb-2 line-clamp-2">
                {service.description}
              </p>
            )}

            {/* Error message */}
            {service.error_message && service.connection_status === 'error' && (
              <div className="text-sm text-red-400 bg-red-500/10 rounded px-2 py-1 mb-2">
                {service.error_message}
              </div>
            )}

            {/* Status info */}
            <div className="text-xs text-dark-muted">
              <span className={service.is_enabled ? 'text-green-400' : 'text-gray-400'}>
                {service.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
              {service.last_seen_at && (
                <span className="ml-2">
                  • Last seen: {new Date(service.last_seen_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* Capabilities count */}
            {service.capabilities && service.capabilities.length > 0 && (
              <div className="mt-2 text-xs text-dark-muted">
                {service.capabilities.length} capabilities discovered
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onTest}
              disabled={isTestLoading}
              title="Test connection"
            >
              <RefreshCw size={14} className={isTestLoading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              title={service.is_enabled ? 'Disable' : 'Enable'}
            >
              {service.is_enabled ? (
                <PowerOff size={14} className="text-red-400" />
              ) : (
                <Power size={14} className="text-green-400" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
              <Settings size={14} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
              <Trash2 size={14} className="text-red-400" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
