/**
 * System Logs page - displays and filters backend Python logs in real-time.
 * Ghostarr-aligned: h-9/h-10 controls, rounded-md inputs, proper mobile spacing.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Search,
  AlertTriangle,
  Info,
  Bug,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../api/client';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { PageHeader, ButtonGroup } from '../components/common';

interface LogEntry {
  timestamp: string;
  level: string;
  logger_name: string;
  message: string;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type LogCategory = 'scheduler' | 'sessions' | 'vote' | 'services' | 'enrichment' | 'movies' | 'auth' | 'system';

const CATEGORY_VALUES: (LogCategory | '')[] = ['', 'scheduler', 'sessions', 'vote', 'services', 'enrichment', 'movies', 'auth', 'system'];

function getLevelIcon(level: string) {
  switch (level) {
    case 'ERROR': return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'WARNING': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
    case 'INFO': return <Info className="h-3.5 w-3.5 text-blue-400" />;
    case 'DEBUG': return <Bug className="h-3.5 w-3.5 text-gray-500" />;
    default: return <Info className="h-3.5 w-3.5 text-gray-500" />;
  }
}

function getLevelColor(level: string) {
  switch (level) {
    case 'ERROR': return 'text-red-400';
    case 'WARNING': return 'text-yellow-400';
    case 'INFO': return 'text-blue-400';
    case 'DEBUG': return 'text-gray-500';
    default: return 'text-gray-500';
  }
}

function getCategoryFromLogger(loggerName: string): string {
  if (loggerName.includes('scheduler')) return 'scheduler';
  if (loggerName.includes('sessions') || loggerName.includes('engine')) return 'sessions';
  if (loggerName.includes('vote') || loggerName.includes('portal')) return 'vote';
  if (loggerName.includes('services') || loggerName.includes('adapters')) return 'services';
  if (loggerName.includes('enrichment') || loggerName.includes('movie_sync') || loggerName.includes('movie_resolution') || loggerName.includes('palette')) return 'enrichment';
  if (loggerName.includes('movies')) return 'movies';
  if (loggerName.includes('auth') || loggerName.includes('deps')) return 'auth';
  return 'system';
}

function getCategoryBadge(loggerName: string) {
  const cat = getCategoryFromLogger(loggerName);
  const colors: Record<string, string> = {
    scheduler: 'bg-purple-500/20 text-purple-400',
    sessions: 'bg-blue-500/20 text-blue-400',
    vote: 'bg-green-500/20 text-green-400',
    services: 'bg-orange-500/20 text-orange-400',
    enrichment: 'bg-theatarr-500/20 text-theatarr-400',
    movies: 'bg-cyan-500/20 text-cyan-400',
    auth: 'bg-yellow-500/20 text-yellow-400',
    system: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-mono uppercase', colors[cat] || colors.system)}>
      {cat}
    </span>
  );
}

export function SystemLogs() {
  const { t } = useTranslation(['settings', 'common']);
  const { locale } = useLocaleFormat();
  const [level, setLevel] = useState<LogLevel | ''>('');
  const [category, setCategory] = useState<LogCategory | ''>('');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const params = new URLSearchParams();
  if (level) params.set('level', level);
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  params.set('limit', '500');

  const { data: logs, isLoading, refetch } = useQuery<LogEntry[]>({
    queryKey: ['system-logs', level, category, search],
    queryFn: () => apiClient.get(`/logs/system?${params.toString()}`),
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <PageHeader
        title={t('settings:logs.title')}
        subtitle={`${logs?.length ?? 0} ${t('settings:logs.entries')}`}
        actions={
          <div className="flex items-center gap-2">
            <span className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-yellow-400')} />
              {autoRefresh ? t('settings:logs.live') : t('settings:logs.paused')}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={clsx(
                'h-9 w-9 flex items-center justify-center rounded-md transition-colors',
                autoRefresh ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'border border-dark-border text-dark-muted hover:bg-dark-border/50'
              )}
              title={t('settings:logs.autoRefresh')}
            >
              {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => refetch()}
              className="h-9 w-9 flex items-center justify-center rounded-md border border-dark-border text-dark-muted hover:bg-dark-border/50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('settings:logs.search')}
            className="h-9 w-full pl-9 pr-3 bg-dark-bg border border-dark-border rounded-md text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-theatarr-500/50 focus:ring-2 focus:ring-theatarr-500/20"
          />
        </div>

        {/* Level filter */}
        <ButtonGroup
          options={[
            { key: '' as const, label: t('settings:logs.levels.all') },
            { key: 'DEBUG' as const, label: t('settings:logs.levels.debug') },
            { key: 'INFO' as const, label: t('settings:logs.levels.info') },
            { key: 'WARNING' as const, label: t('settings:logs.levels.warning') },
            { key: 'ERROR' as const, label: t('settings:logs.levels.error') },
          ]}
          value={level}
          onChange={(v) => setLevel(v as LogLevel | '')}
        />

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LogCategory | '')}
          className="h-9 px-3 bg-dark-bg border border-dark-border rounded-md text-sm text-dark-text focus:outline-none focus:border-theatarr-500/50"
        >
          {CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {c === '' ? t('settings:logs.categories.all') : t(`settings:logs.categories.${c}`)}
            </option>
          ))}
        </select>

        {/* Refresh interval */}
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          className="h-9 px-3 bg-dark-bg border border-dark-border rounded-md text-sm text-dark-text focus:outline-none focus:border-theatarr-500/50"
        >
          <option value={1000}>1s</option>
          <option value={3000}>3s</option>
          <option value={5000}>5s</option>
          <option value={10000}>10s</option>
          <option value={30000}>30s</option>
        </select>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg font-mono text-xs"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-dark-muted">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading...
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-dark-muted text-sm">
            {t('settings:logs.noLogs')}
          </div>
        ) : (
          <div className="p-2 space-y-px">
            {[...logs].reverse().map((entry, i) => {
              const ts = new Date(entry.timestamp);
              const time = ts.toLocaleTimeString(locale, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const ms = String(ts.getMilliseconds()).padStart(3, '0');

              return (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className={clsx(
                    'flex items-start gap-2 px-2 py-1 rounded hover:bg-dark-surface/50',
                    entry.level === 'ERROR' && 'bg-red-500/5',
                    entry.level === 'WARNING' && 'bg-yellow-500/5',
                  )}
                >
                  <span className="text-dark-muted whitespace-nowrap flex-shrink-0">
                    {time}.{ms}
                  </span>
                  <span className="flex-shrink-0">{getLevelIcon(entry.level)}</span>
                  <span className={clsx('w-12 flex-shrink-0 font-semibold', getLevelColor(entry.level))}>
                    {entry.level.substring(0, 4)}
                  </span>
                  <span className="flex-shrink-0">{getCategoryBadge(entry.logger_name)}</span>
                  <span className={clsx(
                    'flex-1 break-all',
                    entry.level === 'ERROR' ? 'text-red-300' :
                    entry.level === 'WARNING' ? 'text-yellow-300' :
                    'text-dark-text'
                  )}>
                    {entry.message}
                  </span>
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
