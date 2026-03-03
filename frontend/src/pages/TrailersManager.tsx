import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Trash2,
  Settings,
  Film,
  HardDrive,
  Clock,
  RefreshCw,
  Music,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Clapperboard,
  Upload,
  Play,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { Button, Card, Modal, Spinner, Input, ButtonGroup } from '../components/common';
import { TrailerRuleForm } from '../components/trailers/TrailerRuleForm';

import { apiClient, API_BASE } from '../api/client';
import { TemplateManager } from './TemplateManager';

// ============================================================================
// Types
// ============================================================================

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
  error_message?: string | null;
  download_progress?: number;
  source_url?: string | null;
  play_count: number;
  is_ready: boolean;
  created_at: string;
}

interface TrailerRule {
  id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  genres?: string[];
  preferred_quality: string;
  max_storage_gb: number;
  storage_used_gb: number;
  frequency: string;
  last_run_at?: string;
  next_run_at?: string;
  total_downloads: number;
  trailer_count: number;
}

interface StorageStatsData {
  total_trailers: number;
  ready_trailers: number;
  pending_trailers: number;
  error_trailers: number;
  total_size_gb: number;
  total_duration_formatted: string;
  by_quality: Record<string, number>;
}

interface PreRollItem {
  id: string;
  name: string;
  tags?: string[] | null;
  source_type: string;
  source_url?: string | null;
  file_size_mb?: number | null;
  format: string;
  duration_seconds?: number | null;
  status: string;
  error_message?: string | null;
  download_progress: number;
  play_count: number;
  is_ready: boolean;
  created_at: string;
}

interface SoundItem {
  id: string;
  name: string;
  tags?: string[];
  source_url?: string;
  source_type: string;
  file_size_mb?: number;
  format: string;
  bitrate?: number;
  duration_seconds?: number;
  status: string;
  error_message?: string;
  download_progress: number;
  chapter_title?: string;
  play_count: number;
  is_ready: boolean;
  created_at: string;
}

interface ChapterInfo {
  title: string;
  start_time: number;
  end_time: number;
}

interface EntryInfo {
  index: number;
  id: string;
  title: string;
  duration?: number;
}

interface SoundInfo {
  title: string;
  duration?: number;
  is_playlist: boolean;
  chapters: ChapterInfo[];
  entries: EntryInfo[];
}

// ============================================================================
// Main Page
// ============================================================================

export function TrailersManager() {
  const { t } = useTranslation('media');
  const [mainTab, setMainTab] = useState<'trailers' | 'sounds' | 'prerolls' | 'templates'>('trailers');
  const [trailersSubTab, setTrailersSubTab] = useState<'library' | 'rules'>('library');
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshBuiltinsTrigger, setRefreshBuiltinsTrigger] = useState(0);

  useEffect(() => {
    setCreateOpen(false);
  }, [mainTab]);

  return (
    <div>
      {/* Main tabs + action buttons */}
      <div className="flex items-center justify-between mb-6">
        <ButtonGroup
          options={[
            { key: 'trailers' as const, label: t('media:tabs.trailers') },
            { key: 'prerolls' as const, label: t('media:tabs.prerolls') },
            { key: 'sounds' as const, label: t('media:tabs.sounds') },
            { key: 'templates' as const, label: t('media:tabs.templates') },
          ]}
          value={mainTab}
          onChange={setMainTab}
        />
        <div className="flex items-center gap-2">
          {mainTab === 'templates' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRefreshBuiltinsTrigger((n) => n + 1)}
              className="h-9"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline ml-1.5">{t('media:actions.refreshBuiltin')}</span>
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9">
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">
              {mainTab === 'trailers' && trailersSubTab === 'rules' ? t('media:actions.create') : t('media:actions.add')}
            </span>
          </Button>
        </div>
      </div>

      {mainTab === 'trailers' && (
        <TrailersTab
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          activeSubTab={trailersSubTab}
          onSubTabChange={setTrailersSubTab}
        />
      )}
      {mainTab === 'prerolls' && (
        <PreRollsTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}
      {mainTab === 'sounds' && (
        <SoundsTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
      )}
      {mainTab === 'templates' && (
        <TemplateManager
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
          refreshBuiltinsTrigger={refreshBuiltinsTrigger}
        />
      )}
    </div>
  );
}

// ============================================================================
// Trailers Tab (existing content)
// ============================================================================

interface TrailersTabProps {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  activeSubTab: 'library' | 'rules';
  onSubTabChange: (tab: 'library' | 'rules') => void;
}

function TrailersTab({ createOpen, onCreateOpenChange, activeSubTab, onSubTabChange }: TrailersTabProps) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<TrailerRule | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadTitle, setDownloadTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

  // Handle external create trigger
  useEffect(() => {
    if (createOpen) {
      if (activeSubTab === 'library') setIsDownloadOpen(true);
      else setIsRuleFormOpen(true);
      onCreateOpenChange?.(false);
    }
  }, [createOpen]);

  const { data: trailersData, isLoading: trailersLoading } = useQuery({
    queryKey: ['trailers', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return apiClient.get(`/trailers${params}`);
    },
    enabled: activeSubTab === 'library',
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['trailer-rules'],
    queryFn: async () => apiClient.get('/trailers/rules'),
    enabled: activeSubTab === 'rules',
  });

  const { data: storageStats } = useQuery<StorageStatsData>({
    queryKey: ['trailer-stats'],
    queryFn: async () => apiClient.get('/trailers/stats'),
  });

  const downloadMutation = useMutation({
    mutationFn: async (data: { movie_title: string; source_url: string }) => {
      await apiClient.post('/trailers/download', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
      queryClient.invalidateQueries({ queryKey: ['trailer-stats'] });
      setIsDownloadOpen(false);
      setDownloadUrl('');
      setDownloadTitle('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/trailers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
      queryClient.invalidateQueries({ queryKey: ['trailer-stats'] });
    },
  });

  const runRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiClient.post(`/trailers/rules/${ruleId}/run`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailer-rules'] });
    },
  });

  const handleDownload = () => {
    if (downloadUrl && downloadTitle) {
      downloadMutation.mutate({ movie_title: downloadTitle, source_url: downloadUrl });
    }
  };

  const handleDelete = async (trailer: Trailer) => {
    if (window.confirm(t('media:trailers.deleteConfirm', { title: trailer.title }))) {
      await deleteMutation.mutateAsync(trailer.id);
    }
  };

  const handleEditRule = (rule: TrailerRule) => {
    setSelectedRule(rule);
    setIsRuleFormOpen(true);
  };

  const handleRuleFormClose = () => {
    setIsRuleFormOpen(false);
    setSelectedRule(null);
    queryClient.invalidateQueries({ queryKey: ['trailer-rules'] });
  };

  return (
    <>
      {/* Sub-tabs */}
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'library' as const, label: t('media:trailers.subtabs.library') },
            { key: 'rules' as const, label: t('media:trailers.subtabs.rules') },
          ]}
          value={activeSubTab}
          onChange={onSubTabChange}
        />
      </div>

      {/* Library */}
      {activeSubTab === 'library' && (
        <>
          <div className="mb-4">
            <ButtonGroup
              options={[
                { key: 'all' as const, label: t('media:trailers.filters.all') },
                { key: 'ready' as const, label: t('media:trailers.filters.ready') },
                { key: 'pending' as const, label: t('media:trailers.filters.pending') },
                { key: 'error' as const, label: t('media:trailers.filters.error') },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>

          {trailersLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : trailersData?.items?.length > 0 ? (
            <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden divide-y divide-dark-border">
              {trailersData.items.map((trailer: Trailer) => {
                const fmtDur = (seconds: number) => {
                  const mins = Math.floor(seconds / 60);
                  const secs = seconds % 60;
                  return `${mins}:${secs.toString().padStart(2, '0')}`;
                };

                return (
                  <div key={trailer.id} className="flex items-center gap-3 p-3 hover:bg-dark-border/20 transition-colors">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg bg-dark-bg flex items-center justify-center flex-shrink-0">
                      <Film size={16} className="text-theatarr-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-dark-text text-sm truncate">
                          {trailer.movie_title}
                          {trailer.movie_year && (
                            <span className="text-dark-muted font-normal ml-1">({trailer.movie_year})</span>
                          )}
                        </span>
                        {/* Status badge */}
                        {trailer.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 flex-shrink-0">
                            <CheckCircle size={10} />
                            {t('media:trailers.status.ready')}
                          </span>
                        ) : trailer.status === 'downloading' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 flex-shrink-0">
                            <Loader2 size={10} className="animate-spin" />
                            {t('media:trailers.status.downloading', { progress: ((trailer.download_progress || 0) * 100).toFixed(0) })}
                          </span>
                        ) : trailer.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-400 flex-shrink-0">
                            <Clock size={10} />
                            {t('media:trailers.status.pending')}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 flex-shrink-0 cursor-help"
                            title={trailer.error_message || t('media:trailers.status.unknownError')}
                          >
                            <AlertCircle size={10} />
                            {t('media:trailers.status.error')}
                          </span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-dark-muted">
                        <span className="truncate max-w-[180px] sm:max-w-none">{trailer.title}</span>
                        <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-[10px] font-medium text-dark-text flex-shrink-0">
                          {trailer.quality}
                        </span>
                        {trailer.duration_seconds && (
                          <span className="hidden sm:inline flex-shrink-0">{fmtDur(trailer.duration_seconds)}</span>
                        )}
                        {trailer.file_size_mb && (
                          <span className="hidden md:inline flex-shrink-0">{trailer.file_size_mb.toFixed(0)} MB</span>
                        )}
                        {trailer.play_count > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-0.5 flex-shrink-0">
                            <Play size={10} />{trailer.play_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {trailer.source_url && (
                        <a
                          href={trailer.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border/50 transition-colors hidden sm:flex"
                          title={t('media:trailers.openYoutube')}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(trailer)}
                        className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title={t('media:trailers.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film size={48} className="mx-auto text-dark-muted mb-4" />
              <p className="text-dark-muted">{t('media:trailers.empty.title')}</p>
              <Button className="mt-4" onClick={() => setIsDownloadOpen(true)}>
                {t('media:trailers.empty.action')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Rules */}
      {activeSubTab === 'rules' && (
        <>
          {rulesLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : rulesData?.items?.length > 0 ? (
            <div className="space-y-4">
              {rulesData.items.map((rule: TrailerRule) => (
                <Card key={rule.id}>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{rule.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            rule.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-dark-muted'
                          }`}>
                            {rule.is_enabled ? t('media:trailers.rules.active') : t('media:trailers.rules.disabled')}
                          </span>
                        </div>
                        {rule.description && <p className="text-dark-muted text-sm mt-1">{rule.description}</p>}
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-dark-muted">
                          <span className="flex items-center gap-1"><HardDrive size={14} />{rule.storage_used_gb.toFixed(1)} / {rule.max_storage_gb} GB</span>
                          <span className="flex items-center gap-1"><Film size={14} />{rule.trailer_count} {t('media:trailers.rules.trailers')}</span>
                          <span className="flex items-center gap-1"><Clock size={14} />{rule.frequency}</span>
                          {rule.genres && rule.genres.length > 0 && <span>{t('media:trailers.rules.genres', { genres: rule.genres.join(', ') })}</span>}
                        </div>
                        {rule.last_run_at && <p className="text-xs text-dark-muted mt-2">{t('media:trailers.rules.lastRun', { date: new Date(rule.last_run_at).toLocaleString() })}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => runRuleMutation.mutate(rule.id)} disabled={runRuleMutation.isPending}>
                          <RefreshCw size={14} className={runRuleMutation.isPending ? 'animate-spin' : ''} />
                          <span className="ml-1">{t('media:trailers.rules.run')}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                          <Settings size={14} /><span className="ml-1">{t('media:trailers.rules.edit')}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Settings size={48} className="mx-auto text-dark-muted mb-4" />
              <p className="text-dark-muted">{t('media:trailers.rules.empty.title')}</p>
              <Button className="mt-4" onClick={() => setIsRuleFormOpen(true)}>{t('media:trailers.rules.empty.action')}</Button>
            </div>
          )}
        </>
      )}

      {/* Download Modal */}
      <Modal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} title={t('media:trailers.download.title')}>
        <div className="space-y-4">
          <Input label={t('media:trailers.download.movieTitle')} value={downloadTitle} onChange={(e) => setDownloadTitle(e.target.value)} placeholder={t('media:trailers.download.movieTitlePlaceholder')} />
          <Input label={t('media:trailers.download.youtubeUrl')} value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder={t('media:trailers.download.youtubeUrlPlaceholder')} />
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="ghost" onClick={() => setIsDownloadOpen(false)}>{t('media:trailers.download.cancel')}</Button>
            <Button onClick={handleDownload} disabled={!downloadUrl || !downloadTitle || downloadMutation.isPending}>
              {downloadMutation.isPending ? t('media:trailers.download.downloading') : t('media:trailers.download.download')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rule Form Modal */}
      <Modal isOpen={isRuleFormOpen} onClose={handleRuleFormClose} title={selectedRule ? t('media:trailers.rules.modal.editTitle') : t('media:trailers.rules.modal.createTitle')} size="lg">
        <TrailerRuleForm rule={selectedRule || undefined} onSave={handleRuleFormClose} onCancel={handleRuleFormClose} />
      </Modal>
    </>
  );
}

// ============================================================================
// Pre-Rolls Tab
// ============================================================================

interface MediaTabProps {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

function PreRollsTab({ createOpen, onCreateOpenChange }: MediaTabProps) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

  useEffect(() => {
    if (createOpen) {
      setIsAddOpen(true);
      onCreateOpenChange?.(false);
    }
  }, [createOpen]);

  const { data: prerollsData, isLoading } = useQuery({
    queryKey: ['prerolls', filter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status_filter', filter);
      if (searchQuery) params.set('search', searchQuery);
      const qs = params.toString();
      return apiClient.get<{ items: PreRollItem[]; total: number; total_size_gb: number }>(`/prerolls${qs ? '?' + qs : ''}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/prerolls/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prerolls'] });
    },
  });

  const handleDelete = async (preroll: PreRollItem) => {
    if (window.confirm(t('media:prerolls.deleteConfirm', { name: preroll.name }))) {
      await deleteMutation.mutateAsync(preroll.id);
    }
  };

  const prerolls = prerollsData?.items ?? [];

  const formatDur = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Filters */}
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'all' as const, label: t('media:prerolls.filters.all') },
            { key: 'ready' as const, label: t('media:prerolls.filters.ready') },
            { key: 'pending' as const, label: t('media:prerolls.filters.pending') },
            { key: 'error' as const, label: t('media:prerolls.filters.error') },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : prerolls.length > 0 ? (
        <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden divide-y divide-dark-border">
          {prerolls.map((preroll) => (
            <div key={preroll.id} className="flex items-center gap-3 p-3 hover:bg-dark-border/20 transition-colors">
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-dark-bg flex items-center justify-center flex-shrink-0">
                <Clapperboard size={16} className="text-theatarr-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-dark-text text-sm truncate">{preroll.name}</span>
                  {/* Status badge */}
                  {preroll.status === 'ready' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 flex-shrink-0">
                      <CheckCircle size={10} />{t('media:prerolls.status.ready')}
                    </span>
                  ) : preroll.status === 'downloading' || preroll.status === 'processing' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 flex-shrink-0">
                      <Loader2 size={10} className="animate-spin" />
                      {t('media:prerolls.status.downloading', { progress: ((preroll.download_progress || 0) * 100).toFixed(0) })}
                    </span>
                  ) : preroll.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-400 flex-shrink-0">
                      <Clock size={10} />{t('media:prerolls.status.pending')}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 flex-shrink-0 cursor-help"
                      title={preroll.error_message || t('media:prerolls.status.unknownError')}
                    >
                      <AlertCircle size={10} />{t('media:prerolls.status.error')}
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-0.5 text-xs text-dark-muted">
                  <span className="flex-shrink-0">{preroll.source_type === 'youtube' ? t('media:prerolls.sourceType.youtube') : t('media:prerolls.sourceType.upload')}</span>
                  <span className="px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-[10px] font-medium text-dark-text uppercase flex-shrink-0">
                    {preroll.format}
                  </span>
                  {preroll.duration_seconds != null && (
                    <span className="flex-shrink-0">{formatDur(preroll.duration_seconds)}</span>
                  )}
                  {preroll.file_size_mb != null && (
                    <span className="flex-shrink-0">{preroll.file_size_mb.toFixed(0)} MB</span>
                  )}
                  {preroll.play_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                      <Play size={10} />{preroll.play_count}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {preroll.tags && preroll.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {preroll.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px] text-dark-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDelete(preroll)}
                  className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={t('media:prerolls.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Clapperboard size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">{t('media:prerolls.empty.title')}</p>
          <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
            {t('media:prerolls.empty.action')}
          </Button>
        </div>
      )}

      {/* Add PreRoll Modal */}
      <AddPreRollModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          queryClient.invalidateQueries({ queryKey: ['prerolls'] });
        }}
      />
    </>
  );
}

// ============================================================================
// Add PreRoll Modal
// ============================================================================

function AddPreRollModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMode('upload');
      setName('');
      setTags('');
      setUrl('');
      setFile(null);
    }
  }, [isOpen]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !name) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      if (tags) formData.append('tags', tags);

      const token = localStorage.getItem('theatarr_token');
      const response = await fetch(`${API_BASE}/api/v1/prerolls/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prerolls'] });
      onClose();
    },
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/prerolls/download', {
        source_url: url,
        name: name || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prerolls'] });
      onClose();
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!name) {
        // Auto-fill name from filename (without extension)
        setName(selected.name.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const handleSubmit = () => {
    if (mode === 'upload') {
      uploadMutation.mutate();
    } else {
      downloadMutation.mutate();
    }
  };

  const isPending = uploadMutation.isPending || downloadMutation.isPending;
  const isValid = mode === 'upload' ? (file && name) : (url && name);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('media:prerolls.addModal.title')}>
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
              mode === 'upload'
                ? 'border-theatarr-500 bg-theatarr-500/10 text-theatarr-400'
                : 'border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text'
            }`}
          >
            <Upload size={18} />
            {t('media:prerolls.addModal.uploadFile')}
          </button>
          <button
            onClick={() => setMode('youtube')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
              mode === 'youtube'
                ? 'border-theatarr-500 bg-theatarr-500/10 text-theatarr-400'
                : 'border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text'
            }`}
          >
            <Download size={18} />
            {t('media:prerolls.addModal.youtube')}
          </button>
        </div>

        {/* Name */}
        <Input
          label={t('media:prerolls.addModal.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('media:prerolls.addModal.namePlaceholder')}
        />

        {/* Tags */}
        <Input
          label={t('media:prerolls.addModal.tags')}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t('media:prerolls.addModal.tagsPlaceholder')}
        />

        {/* Upload mode */}
        {mode === 'upload' && (
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              {t('media:prerolls.addModal.videoFile')}
            </label>
            <input
              type="file"
              accept=".mp4,.mkv,.webm,.avi,.mov,.m4v"
              onChange={handleFileChange}
              className="w-full text-sm text-dark-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-theatarr-500/20 file:text-theatarr-400 hover:file:bg-theatarr-500/30"
            />
            {file && (
              <p className="text-xs text-dark-muted mt-1">
                {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
          </div>
        )}

        {/* YouTube mode */}
        {mode === 'youtube' && (
          <Input
            label={t('media:prerolls.addModal.youtubeUrl')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('media:prerolls.addModal.youtubeUrlPlaceholder')}
          />
        )}

        {/* Error */}
        {(uploadMutation.isError || downloadMutation.isError) && (
          <p className="text-red-400 text-sm">
            {t('media:prerolls.addModal.errorPrefix')} {((uploadMutation.error || downloadMutation.error) as Error)?.message || t('media:prerolls.addModal.errorDefault')}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-2">
          <Button variant="ghost" onClick={onClose}>{t('media:prerolls.addModal.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? (
              <><Loader2 size={16} className="mr-1 animate-spin" />{mode === 'upload' ? t('media:prerolls.addModal.importing') : t('media:prerolls.addModal.downloading')}</>
            ) : (
              <>{mode === 'upload' ? <><Upload size={16} className="mr-1" />{t('media:prerolls.addModal.import')}</> : <><Download size={16} className="mr-1" />{t('media:prerolls.addModal.download')}</>}</>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Sounds Tab
// ============================================================================

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SoundsTab({ createOpen, onCreateOpenChange }: MediaTabProps) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

  useEffect(() => {
    if (createOpen) {
      setIsAddOpen(true);
      onCreateOpenChange?.(false);
    }
  }, [createOpen]);

  // Fetch sounds
  const { data: soundsData, isLoading } = useQuery({
    queryKey: ['sounds', filter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status_filter', filter);
      if (searchQuery) params.set('search', searchQuery);
      const qs = params.toString();
      return apiClient.get<{ items: SoundItem[]; total: number; total_size_gb: number }>(`/sounds${qs ? '?' + qs : ''}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/sounds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
    },
  });

  const handleDelete = async (sound: SoundItem) => {
    if (window.confirm(t('media:sounds.deleteConfirm', { name: sound.name }))) {
      await deleteMutation.mutateAsync(sound.id);
    }
  };

  const sounds = soundsData?.items ?? [];

  const formatDur = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Filters */}
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'all' as const, label: t('media:sounds.filters.all') },
            { key: 'ready' as const, label: t('media:sounds.filters.ready') },
            { key: 'pending' as const, label: t('media:sounds.filters.pending') },
            { key: 'error' as const, label: t('media:sounds.filters.error') },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : sounds.length > 0 ? (
        <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden divide-y divide-dark-border">
          {sounds.map((sound) => (
            <div key={sound.id} className="flex items-center gap-3 p-3 hover:bg-dark-border/20 transition-colors">
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-dark-bg flex items-center justify-center flex-shrink-0">
                <Music size={16} className="text-theatarr-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-dark-text text-sm truncate">{sound.name}</span>
                  {/* Status badge */}
                  {sound.status === 'ready' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-400 flex-shrink-0">
                      <CheckCircle size={10} />{t('media:sounds.status.ready')}
                    </span>
                  ) : sound.status === 'downloading' || sound.status === 'processing' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-400 flex-shrink-0">
                      <Loader2 size={10} className="animate-spin" />
                      {t('media:sounds.status.downloading', { progress: ((sound.download_progress || 0) * 100).toFixed(0) })}
                    </span>
                  ) : sound.status === 'pending' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-400 flex-shrink-0">
                      <Clock size={10} />{t('media:sounds.status.pending')}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-400 flex-shrink-0 cursor-help"
                      title={sound.error_message || t('media:sounds.status.unknownError')}
                    >
                      <AlertCircle size={10} />{t('media:sounds.status.error')}
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-2 mt-0.5 text-xs text-dark-muted">
                  {sound.chapter_title && (
                    <span className="italic truncate max-w-[150px] sm:max-w-none">{sound.chapter_title}</span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-[10px] font-medium text-dark-text uppercase flex-shrink-0">
                    {sound.format}
                  </span>
                  {sound.duration_seconds != null && (
                    <span className="flex-shrink-0">{formatDur(sound.duration_seconds)}</span>
                  )}
                  {sound.file_size_mb != null && (
                    <span className="flex-shrink-0">{sound.file_size_mb.toFixed(0)} MB</span>
                  )}
                  {sound.bitrate != null && (
                    <span className="flex-shrink-0">{sound.bitrate} kbps</span>
                  )}
                  {sound.play_count > 0 && (
                    <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                      <Play size={10} />{sound.play_count}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {sound.tags && sound.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {sound.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px] text-dark-muted">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDelete(sound)}
                  className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={t('media:sounds.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Music size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">{t('media:sounds.empty.title')}</p>
          <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
            {t('media:sounds.empty.action')}
          </Button>
        </div>
      )}

      {/* Add Sound Modal */}
      <AddSoundModal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          queryClient.invalidateQueries({ queryKey: ['sounds'] });
        }}
      />
    </>
  );
}

// ============================================================================
// Add Sound Modal
// ============================================================================

function AddSoundModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation('media');
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [soundInfo, setSoundInfo] = useState<SoundInfo | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<'url' | 'select' | 'downloading'>('url');

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setName('');
      setTags('');
      setSoundInfo(null);
      setSelectedChapters(new Set());
      setSelectedEntries(new Set());
      setStep('url');
    }
  }, [isOpen]);

  // Analyze URL
  const analyzeMutation = useMutation({
    mutationFn: async (sourceUrl: string) => {
      return apiClient.post<SoundInfo>('/sounds/info', { source_url: sourceUrl });
    },
    onSuccess: (info) => {
      setSoundInfo(info);
      setName(info.title);

      if (info.chapters.length > 0 || info.is_playlist) {
        // Pre-select all
        if (info.chapters.length > 0) {
          setSelectedChapters(new Set(info.chapters.map((_, i) => i)));
        }
        if (info.entries.length > 0) {
          setSelectedEntries(new Set(info.entries.map((_, i) => i)));
        }
        setStep('select');
      } else {
        setStep('select');
      }
    },
  });

  // Download
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        source_url: url,
        name: name || undefined,
      };

      if (soundInfo?.chapters && soundInfo.chapters.length > 0 && selectedChapters.size > 0) {
        payload.selected_chapters = Array.from(selectedChapters).sort((a, b) => a - b);
      } else if (soundInfo?.is_playlist && selectedEntries.size > 0) {
        payload.selected_entries = Array.from(selectedEntries).sort((a, b) => a - b);
      }

      return apiClient.post('/sounds/download', payload);
    },
    onSuccess: () => {
      setStep('downloading');
      queryClient.invalidateQueries({ queryKey: ['sounds'] });
      // Close after a brief delay
      setTimeout(() => onClose(), 1500);
    },
  });

  const handleAnalyze = () => {
    if (url.trim()) {
      analyzeMutation.mutate(url.trim());
    }
  };

  const toggleChapter = (idx: number) => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleEntry = (idx: number) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAllChapters = () => {
    if (!soundInfo) return;
    if (selectedChapters.size === soundInfo.chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(soundInfo.chapters.map((_, i) => i)));
    }
  };

  const toggleAllEntries = () => {
    if (!soundInfo) return;
    if (selectedEntries.size === soundInfo.entries.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(soundInfo.entries.map((_, i) => i)));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('media:sounds.addModal.title')} size="lg">
      <div className="space-y-4">
        {/* Step 1: URL Input */}
        {step === 'url' && (
          <>
            <Input
              label={t('media:sounds.addModal.youtubeUrl')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('media:sounds.addModal.youtubeUrlPlaceholder')}
            />
            <div className="flex justify-end gap-4 pt-2">
              <Button variant="ghost" onClick={onClose}>{t('media:sounds.addModal.cancel')}</Button>
              <Button
                onClick={handleAnalyze}
                disabled={!url.trim() || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />{t('media:sounds.addModal.analyzing')}</>
                ) : (
                  <><Search size={16} className="mr-1" />{t('media:sounds.addModal.analyze')}</>
                )}
              </Button>
            </div>
            {analyzeMutation.isError && (
              <p className="text-red-400 text-sm">
                {t('media:sounds.addModal.errorPrefix')} {(analyzeMutation.error as Error)?.message || t('media:sounds.addModal.analyzeError')}
              </p>
            )}
          </>
        )}

        {/* Step 2: Selection */}
        {step === 'select' && soundInfo && (
          <>
            {/* Name */}
            <Input
              label={t('media:sounds.addModal.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('media:sounds.addModal.namePlaceholder')}
            />

            {/* Tags */}
            <Input
              label={t('media:sounds.addModal.tags')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('media:sounds.addModal.tagsPlaceholder')}
            />

            {/* Info */}
            <div className="text-sm text-dark-muted">
              <p><strong>{soundInfo.title}</strong></p>
              {soundInfo.duration && <p>{t('media:sounds.addModal.duration', { duration: formatDuration(Math.round(soundInfo.duration)) })}</p>}
            </div>

            {/* Chapters */}
            {soundInfo.chapters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-text">
                    {t('media:sounds.addModal.chapters', { selected: selectedChapters.size, total: soundInfo.chapters.length })}
                  </label>
                  <button
                    onClick={toggleAllChapters}
                    className="text-xs text-theatarr-400 hover:text-theatarr-300"
                  >
                    {selectedChapters.size === soundInfo.chapters.length ? t('media:sounds.addModal.deselectAll') : t('media:sounds.addModal.selectAll')}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 border border-dark-border rounded-lg p-2">
                  {soundInfo.chapters.map((ch, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-border/30 cursor-pointer"
                    >
                      <button onClick={() => toggleChapter(idx)} className="shrink-0">
                        {selectedChapters.has(idx) ? (
                          <CheckSquare size={16} className="text-theatarr-400" />
                        ) : (
                          <Square size={16} className="text-dark-muted" />
                        )}
                      </button>
                      <span className="text-sm text-dark-text flex-1 truncate">{ch.title}</span>
                      <span className="text-xs text-dark-muted shrink-0">
                        {formatDuration(Math.round(ch.end_time - ch.start_time))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Playlist entries */}
            {soundInfo.is_playlist && soundInfo.entries.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-text">
                    {t('media:sounds.addModal.tracks', { selected: selectedEntries.size, total: soundInfo.entries.length })}
                  </label>
                  <button
                    onClick={toggleAllEntries}
                    className="text-xs text-theatarr-400 hover:text-theatarr-300"
                  >
                    {selectedEntries.size === soundInfo.entries.length ? t('media:sounds.addModal.deselectAll') : t('media:sounds.addModal.selectAll')}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 border border-dark-border rounded-lg p-2">
                  {soundInfo.entries.map((entry, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-dark-border/30 cursor-pointer"
                    >
                      <button onClick={() => toggleEntry(idx)} className="shrink-0">
                        {selectedEntries.has(idx) ? (
                          <CheckSquare size={16} className="text-theatarr-400" />
                        ) : (
                          <Square size={16} className="text-dark-muted" />
                        )}
                      </button>
                      <span className="text-sm text-dark-text flex-1 truncate">{entry.title}</span>
                      {entry.duration && (
                        <span className="text-xs text-dark-muted shrink-0">
                          {formatDuration(Math.round(entry.duration))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* No chapters/playlist — single video */}
            {soundInfo.chapters.length === 0 && !soundInfo.is_playlist && (
              <p className="text-sm text-dark-muted">
                {t('media:sounds.addModal.singleVideo')}
              </p>
            )}

            <div className="flex justify-end gap-4 pt-2">
              <Button variant="ghost" onClick={() => setStep('url')}>{t('media:sounds.addModal.back')}</Button>
              <Button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
              >
                {downloadMutation.isPending ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />{t('media:sounds.addModal.downloading')}</>
                ) : (
                  <><Download size={16} className="mr-1" />{t('media:sounds.addModal.download')}</>
                )}
              </Button>
            </div>
            {downloadMutation.isError && (
              <p className="text-red-400 text-sm">
                {t('media:sounds.addModal.errorPrefix')} {(downloadMutation.error as Error)?.message || t('media:sounds.addModal.downloadError')}
              </p>
            )}
          </>
        )}

        {/* Step 3: Done */}
        {step === 'downloading' && (
          <div className="text-center py-8">
            <Music size={48} className="mx-auto text-theatarr-400 mb-4" />
            <p className="text-dark-text font-medium">{t('media:sounds.addModal.downloadStarted')}</p>
            <p className="text-dark-muted text-sm mt-1">
              {t('media:sounds.addModal.downloadStartedHint')}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
