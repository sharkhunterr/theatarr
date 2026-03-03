import {
  Settings,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Monitor,
  Film,
  Cog,
  Database,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common';

export interface Service {
  id: string;
  name: string;
  description?: string;
  adapter_type: string;
  category: string;
  config?: Record<string, unknown>;
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

const categoryIcons: Record<string, React.ReactNode> = {
  lighting: <Lightbulb size={20} />,
  player: <Monitor size={20} />,
  media_source: <Film size={20} />,
  actuator: <Cog size={20} />,
  metadata: <Database size={20} />,
};

const categoryColors: Record<string, string> = {
  lighting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  player: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  media_source: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  actuator: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  metadata: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  connected: {
    icon: <Wifi size={14} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500',
  },
  disconnected: {
    icon: <WifiOff size={14} />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500',
  },
  error: {
    icon: <AlertCircle size={14} />,
    color: 'text-red-400',
    bgColor: 'bg-red-500',
  },
  unknown: {
    icon: <HelpCircle size={14} />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
  },
};

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggle,
  onTest,
  isTestLoading,
}: ServiceCardProps) {
  const { t } = useTranslation(['services']);
  const status = statusConfig[service.connection_status];

  const statusLabels: Record<string, string> = {
    connected: t('services:card.connected'),
    disconnected: t('services:card.disconnected'),
    error: t('services:card.error'),
    unknown: t('services:card.unknown'),
  };

  const categoryLabels: Record<string, string> = {
    lighting: t('services:card.lighting'),
    player: t('services:card.player'),
    media_source: t('services:card.media_source'),
    actuator: t('services:card.actuator'),
    metadata: t('services:card.metadata'),
  };

  return (
    <div
      className={`bg-dark-surface border border-dark-border rounded-xl overflow-hidden transition-all hover:border-dark-muted/50 ${
        !service.is_enabled ? 'opacity-60' : ''
      }`}
    >
      <div className="p-4">
        {/* Mobile: Stack layout, Desktop: Row layout */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Icon + Status indicator */}
          <div className="flex items-start gap-3 sm:gap-0">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                categoryColors[service.category] || 'bg-dark-border text-dark-muted border-dark-border'
              }`}
            >
              {categoryIcons[service.category] || <Cog size={20} />}
            </div>

            {/* Mobile: Show name next to icon */}
            <div className="flex-1 sm:hidden">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-dark-text">{service.name}</h3>
                <div className={`w-2 h-2 rounded-full ${status.bgColor}`} />
              </div>
              <span className="text-xs text-dark-muted">{service.adapter_type}</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Desktop: Name row */}
            <div className="hidden sm:flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-dark-text truncate">{service.name}</h3>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.bgColor}`} />
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="hidden sm:inline px-2 py-0.5 bg-dark-bg rounded text-xs text-dark-muted">
                {service.adapter_type}
              </span>
              <span className="px-2 py-0.5 bg-dark-bg rounded text-xs text-dark-muted">
                {categoryLabels[service.category] || service.category}
              </span>
              <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                {status.icon}
                <span className="hidden xs:inline">{statusLabels[service.connection_status]}</span>
              </span>
            </div>

            {/* Description */}
            {service.description && (
              <p className="text-sm text-dark-muted mb-2 line-clamp-1">{service.description}</p>
            )}

            {/* Error message */}
            {service.error_message && service.connection_status === 'error' && (
              <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-2 py-1.5 mb-2">
                {service.error_message}
              </div>
            )}

            {/* Status row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dark-muted">
              <span className={service.is_enabled ? 'text-green-400' : 'text-gray-400'}>
                {service.is_enabled ? t('services:card.enabled') : t('services:card.disabled')}
              </span>
              {service.last_seen_at && (
                <span>
                  {t('services:card.lastSeen')} {new Date(service.last_seen_at).toLocaleDateString()}
                </span>
              )}
              {service.capabilities && service.capabilities.length > 0 && (
                <span>
                  {service.capabilities.length} {t('services:card.capabilities')}
                </span>
              )}
            </div>
          </div>

          {/* Actions - Always visible on mobile as row, column on desktop */}
          <div className="flex items-center gap-1 sm:flex-col sm:items-end pt-2 sm:pt-0 border-t sm:border-t-0 border-dark-border mt-2 sm:mt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onTest}
              disabled={isTestLoading}
              title={t('services:card.test')}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw size={14} className={isTestLoading ? 'animate-spin' : ''} />
              <span className="ml-1 sm:hidden">{t('services:card.test')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              title={service.is_enabled ? t('services:card.disabled') : t('services:card.enabled')}
              className="flex-1 sm:flex-none"
            >
              {service.is_enabled ? (
                <PowerOff size={14} className="text-red-400" />
              ) : (
                <Power size={14} className="text-green-400" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              title={t('services:card.edit')}
              className="flex-1 sm:flex-none"
            >
              <Settings size={14} />
              <span className="ml-1 sm:hidden">{t('services:card.edit')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title={t('services:card.delete')}
              className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
