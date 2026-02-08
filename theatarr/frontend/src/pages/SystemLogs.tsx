/**
 * System Logs page - displays and filters backend Python logs in real-time.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Info,
  Bug,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

interface LogEntry {
  timestamp: string;
  level: string;
  logger_name: string;
  message: string;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type LogCategory = 'scheduler' | 'sessions' | 'vote' | 'services' | 'enrichment' | 'movies' | 'auth' | 'system';

const CATEGORIES: { value: LogCategory | ''; label: string; labelFr: string }[] = [
  { value: '', label: 'All', labelFr: 'Tout' },
  { value: 'scheduler', label: 'Scheduler', labelFr: 'Planificateur' },
  { value: 'sessions', label: 'Sessions', labelFr: 'Sessions' },
  { value: 'vote', label: 'Vote', labelFr: 'Vote' },
  { value: 'services', label: 'Services', labelFr: 'Services' },
  { value: 'enrichment', label: 'Enrichment', labelFr: 'Enrichissement' },
  { value: 'movies', label: 'Movies', labelFr: 'Films' },
  { value: 'auth', label: 'Auth', labelFr: 'Auth' },
  { value: 'system', label: 'System', labelFr: 'Systeme' },
];

const LEVELS: { value: LogLevel | ''; label: string; color: string }[] = [
  { value: '', label: 'All', color: '' },
  { value: 'DEBUG', label: 'DEBUG', color: 'text-gray-400' },
  { value: 'INFO', label: 'INFO', color: 'text-blue-400' },
  { value: 'WARNING', label: 'WARN', color: 'text-yellow-400' },
  { value: 'ERROR', label: 'ERROR', color: 'text-red-400' },
];

function getLevelIcon(level: string) {
  switch (level) {
    case 'ERROR': return <AlertCircle size={14} className="text-red-400" />;
    case 'WARNING': return <AlertTriangle size={14} className="text-yellow-400" />;
    case 'INFO': return <Info size={14} className="text-blue-400" />;
    case 'DEBUG': return <Bug size={14} className="text-gray-500" />;
    default: return <Info size={14} className="text-gray-500" />;
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
  const { language } = useLayoutStore();
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

  const t = language === 'fr' ? {
    title: 'Logs systeme',
    autoRefresh: 'Auto-refresh',
    search: 'Rechercher...',
    noLogs: 'Aucun log',
    paused: 'En pause',
    live: 'En direct',
  } : {
    title: 'System Logs',
    autoRefresh: 'Auto-refresh',
    search: 'Search...',
    noLogs: 'No logs',
    paused: 'Paused',
    live: 'Live',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <ScrollText size={24} className="text-theatarr-500" />
          <h1 className="text-xl font-bold text-dark-text">{t.title}</h1>
          <span className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          )}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-yellow-400')} />
            {autoRefresh ? t.live : t.paused}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              autoRefresh ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-dark-border text-dark-muted hover:bg-dark-border/80'
            )}
            title={t.autoRefresh}
          >
            {autoRefresh ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-dark-border text-dark-muted hover:bg-dark-border/80 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full pl-8 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:border-theatarr-500/50"
          />
        </div>

        {/* Level filter */}
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-dark-muted" />
          {LEVELS.map((l) => (
            <button
              key={l.value}
              onClick={() => setLevel(l.value as LogLevel | '')}
              className={clsx(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                level === l.value
                  ? 'bg-theatarr-500/20 text-theatarr-400 border border-theatarr-500/30'
                  : 'bg-dark-bg text-dark-muted border border-dark-border hover:border-dark-muted'
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as LogCategory | '')}
          className="px-2 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-dark-text focus:outline-none focus:border-theatarr-500/50"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {language === 'fr' ? c.labelFr : c.label}
            </option>
          ))}
        </select>

        {/* Refresh interval */}
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(Number(e.target.value))}
          className="px-2 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-dark-text focus:outline-none focus:border-theatarr-500/50"
        >
          <option value={1000}>1s</option>
          <option value={3000}>3s</option>
          <option value={5000}>5s</option>
          <option value={10000}>10s</option>
          <option value={30000}>30s</option>
        </select>

        {/* Log count */}
        <span className="text-xs text-dark-muted">
          {logs?.length ?? 0} entries
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-dark-bg border border-dark-border rounded-lg font-mono text-xs"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-dark-muted">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading...
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-dark-muted">
            {t.noLogs}
          </div>
        ) : (
          <div className="p-2 space-y-px">
            {[...logs].reverse().map((entry, i) => {
              const ts = new Date(entry.timestamp);
              const time = ts.toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
