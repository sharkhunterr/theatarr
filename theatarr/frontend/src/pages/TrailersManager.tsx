import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button, Card, Modal, Spinner, Input } from '../components/common';
import { TrailerCard } from '../components/trailers/TrailerCard';
import { TrailerRuleForm } from '../components/trailers/TrailerRuleForm';
import { StorageStats } from '../components/trailers/StorageStats';
import { apiClient } from '../api/client';

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
  const [mainTab, setMainTab] = useState<'trailers' | 'sounds'>('trailers');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark-text">Média</h1>
        <p className="text-dark-muted text-sm mt-1">
          Gérez vos bandes-annonces et votre bibliothèque de sons
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-6 mb-6 border-b border-dark-border">
        <button
          onClick={() => setMainTab('trailers')}
          className={`pb-3 px-1 font-medium text-base transition-colors ${
            mainTab === 'trailers'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Film size={18} className="inline mr-2" />
          Bandes-annonces
        </button>
        <button
          onClick={() => setMainTab('sounds')}
          className={`pb-3 px-1 font-medium text-base transition-colors ${
            mainTab === 'sounds'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Music size={18} className="inline mr-2" />
          Sons
        </button>
      </div>

      {mainTab === 'trailers' && <TrailersTab />}
      {mainTab === 'sounds' && <SoundsTab />}
    </div>
  );
}

// ============================================================================
// Trailers Tab (existing content)
// ============================================================================

function TrailersTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'library' | 'rules'>('library');
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<TrailerRule | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadTitle, setDownloadTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

  const { data: trailersData, isLoading: trailersLoading } = useQuery({
    queryKey: ['trailers', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return apiClient.get(`/trailers${params}`);
    },
    enabled: activeTab === 'library',
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['trailer-rules'],
    queryFn: async () => apiClient.get('/trailers/rules'),
    enabled: activeTab === 'rules',
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
    if (window.confirm(`Supprimer "${trailer.title}" ?`)) {
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
      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {activeTab === 'library' && (
            <Button onClick={() => setIsDownloadOpen(true)}>
              <Download size={16} className="mr-1" />
              Télécharger
            </Button>
          )}
          {activeTab === 'rules' && (
            <Button onClick={() => setIsRuleFormOpen(true)}>
              <Plus size={16} className="mr-1" />
              Créer une règle
            </Button>
          )}
        </div>
      </div>

      {storageStats && <StorageStats stats={storageStats} className="mb-6" />}

      {/* Sub-tabs */}
      <div className="flex gap-4 mb-6 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('library')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'library'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Film size={16} className="inline mr-2" />
          Bibliothèque
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'rules'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Settings size={16} className="inline mr-2" />
          Règles
        </button>
      </div>

      {/* Library */}
      {activeTab === 'library' && (
        <>
          <div className="flex gap-2 mb-6">
            {(['all', 'ready', 'pending', 'error'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-theatarr-500 text-white'
                    : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'ready' ? 'Prêt' : f === 'pending' ? 'En cours' : 'Erreur'}
              </button>
            ))}
          </div>

          {trailersLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : trailersData?.items?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trailersData.items.map((trailer: Trailer) => (
                <TrailerCard key={trailer.id} trailer={trailer} onDelete={() => handleDelete(trailer)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film size={48} className="mx-auto text-dark-muted mb-4" />
              <p className="text-dark-muted">Aucune bande-annonce</p>
              <Button className="mt-4" onClick={() => setIsDownloadOpen(true)}>
                Télécharger une bande-annonce
              </Button>
            </div>
          )}
        </>
      )}

      {/* Rules */}
      {activeTab === 'rules' && (
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
                            {rule.is_enabled ? 'Active' : 'Désactivée'}
                          </span>
                        </div>
                        {rule.description && <p className="text-dark-muted text-sm mt-1">{rule.description}</p>}
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-dark-muted">
                          <span className="flex items-center gap-1"><HardDrive size={14} />{rule.storage_used_gb.toFixed(1)} / {rule.max_storage_gb} GB</span>
                          <span className="flex items-center gap-1"><Film size={14} />{rule.trailer_count} trailers</span>
                          <span className="flex items-center gap-1"><Clock size={14} />{rule.frequency}</span>
                          {rule.genres && rule.genres.length > 0 && <span>Genres: {rule.genres.join(', ')}</span>}
                        </div>
                        {rule.last_run_at && <p className="text-xs text-dark-muted mt-2">Dernière exécution: {new Date(rule.last_run_at).toLocaleString()}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => runRuleMutation.mutate(rule.id)} disabled={runRuleMutation.isPending}>
                          <RefreshCw size={14} className={runRuleMutation.isPending ? 'animate-spin' : ''} />
                          <span className="ml-1">Exécuter</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                          <Settings size={14} /><span className="ml-1">Modifier</span>
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
              <p className="text-dark-muted">Aucune règle configurée</p>
              <Button className="mt-4" onClick={() => setIsRuleFormOpen(true)}>Créer une règle</Button>
            </div>
          )}
        </>
      )}

      {/* Download Modal */}
      <Modal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} title="Télécharger une bande-annonce">
        <div className="space-y-4">
          <Input label="Titre du film" value={downloadTitle} onChange={(e) => setDownloadTitle(e.target.value)} placeholder="Blade Runner 2049" />
          <Input label="URL YouTube" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="ghost" onClick={() => setIsDownloadOpen(false)}>Annuler</Button>
            <Button onClick={handleDownload} disabled={!downloadUrl || !downloadTitle || downloadMutation.isPending}>
              {downloadMutation.isPending ? 'Téléchargement...' : 'Télécharger'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rule Form Modal */}
      <Modal isOpen={isRuleFormOpen} onClose={handleRuleFormClose} title={selectedRule ? 'Modifier la règle' : 'Créer une règle'} size="lg">
        <TrailerRuleForm rule={selectedRule || undefined} onSave={handleRuleFormClose} onCancel={handleRuleFormClose} />
      </Modal>
    </>
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

function SoundsTab() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

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
    if (window.confirm(`Supprimer "${sound.name}" ?`)) {
      await deleteMutation.mutateAsync(sound.id);
    }
  };

  const sounds = soundsData?.items ?? [];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus size={16} className="mr-1" />
          Ajouter un son
        </Button>

        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'ready', 'pending', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'ready' ? 'Prêt' : f === 'pending' ? 'En cours' : 'Erreur'}
          </button>
        ))}
        {soundsData && (
          <span className="ml-auto text-sm text-dark-muted self-center">
            {soundsData.total} son{soundsData.total !== 1 ? 's' : ''} — {soundsData.total_size_gb} GB
          </span>
        )}
      </div>

      {/* Sound Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : sounds.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sounds.map((sound) => (
            <SoundCard key={sound.id} sound={sound} onDelete={() => handleDelete(sound)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Music size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">Aucun son dans la bibliothèque</p>
          <Button className="mt-4" onClick={() => setIsAddOpen(true)}>
            Ajouter votre premier son
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
// Sound Card
// ============================================================================

function SoundCard({ sound, onDelete }: { sound: SoundItem; onDelete: () => void }) {
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

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Music size={18} className="text-theatarr-400 shrink-0" />
            <h3 className="font-medium text-dark-text truncate" title={sound.name}>
              {sound.name}
            </h3>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${statusColors[sound.status] || 'bg-gray-500/20 text-dark-muted'}`}>
            {statusLabels[sound.status] || sound.status}
          </span>
        </div>

        {/* Info row */}
        <div className="flex flex-wrap gap-3 text-xs text-dark-muted mb-3">
          {sound.duration_seconds != null && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(sound.duration_seconds)}
            </span>
          )}
          {sound.bitrate != null && (
            <span>{sound.bitrate} kbps</span>
          )}
          {sound.file_size_mb != null && (
            <span>{sound.file_size_mb.toFixed(1)} MB</span>
          )}
          <span className="uppercase">{sound.format}</span>
        </div>

        {/* Tags */}
        {sound.tags && sound.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {sound.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-dark-border/50 rounded text-xs text-dark-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Chapter info */}
        {sound.chapter_title && (
          <p className="text-xs text-dark-muted mb-3 italic">
            Chapitre : {sound.chapter_title}
          </p>
        )}

        {/* Download progress */}
        {(sound.status === 'downloading' || sound.status === 'processing') && (
          <div className="mb-3">
            <div className="w-full bg-dark-border rounded-full h-1.5">
              <div
                className="bg-theatarr-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(sound.download_progress || 0) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {sound.error_message && (
          <p className="text-xs text-red-400 mb-3 line-clamp-2">{sound.error_message}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-dark-muted">
            {sound.play_count > 0 ? `${sound.play_count} lecture${sound.play_count > 1 ? 's' : ''}` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Add Sound Modal
// ============================================================================

function AddSoundModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un son" size="lg">
      <div className="space-y-4">
        {/* Step 1: URL Input */}
        {step === 'url' && (
          <>
            <Input
              label="URL YouTube"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... ou URL de playlist"
            />
            <div className="flex justify-end gap-4 pt-2">
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button
                onClick={handleAnalyze}
                disabled={!url.trim() || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />Analyse...</>
                ) : (
                  <><Search size={16} className="mr-1" />Analyser</>
                )}
              </Button>
            </div>
            {analyzeMutation.isError && (
              <p className="text-red-400 text-sm">
                Erreur : {(analyzeMutation.error as Error)?.message || 'Impossible d\'analyser l\'URL'}
              </p>
            )}
          </>
        )}

        {/* Step 2: Selection */}
        {step === 'select' && soundInfo && (
          <>
            {/* Name */}
            <Input
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du son"
            />

            {/* Tags */}
            <Input
              label="Tags (séparés par des virgules)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="ambiance, musique, intro..."
            />

            {/* Info */}
            <div className="text-sm text-dark-muted">
              <p><strong>{soundInfo.title}</strong></p>
              {soundInfo.duration && <p>Durée : {formatDuration(Math.round(soundInfo.duration))}</p>}
            </div>

            {/* Chapters */}
            {soundInfo.chapters.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-dark-text">
                    Chapitres ({selectedChapters.size}/{soundInfo.chapters.length})
                  </label>
                  <button
                    onClick={toggleAllChapters}
                    className="text-xs text-theatarr-400 hover:text-theatarr-300"
                  >
                    {selectedChapters.size === soundInfo.chapters.length ? 'Tout désélectionner' : 'Tout sélectionner'}
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
                    Pistes ({selectedEntries.size}/{soundInfo.entries.length})
                  </label>
                  <button
                    onClick={toggleAllEntries}
                    className="text-xs text-theatarr-400 hover:text-theatarr-300"
                  >
                    {selectedEntries.size === soundInfo.entries.length ? 'Tout désélectionner' : 'Tout sélectionner'}
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
                Vidéo unique — l'audio complet sera extrait.
              </p>
            )}

            <div className="flex justify-end gap-4 pt-2">
              <Button variant="ghost" onClick={() => setStep('url')}>Retour</Button>
              <Button
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending}
              >
                {downloadMutation.isPending ? (
                  <><Loader2 size={16} className="mr-1 animate-spin" />Téléchargement...</>
                ) : (
                  <><Download size={16} className="mr-1" />Télécharger</>
                )}
              </Button>
            </div>
            {downloadMutation.isError && (
              <p className="text-red-400 text-sm">
                Erreur : {(downloadMutation.error as Error)?.message || 'Échec du téléchargement'}
              </p>
            )}
          </>
        )}

        {/* Step 3: Done */}
        {step === 'downloading' && (
          <div className="text-center py-8">
            <Music size={48} className="mx-auto text-theatarr-400 mb-4" />
            <p className="text-dark-text font-medium">Téléchargement lancé !</p>
            <p className="text-dark-muted text-sm mt-1">
              Les sons apparaîtront dans la bibliothèque une fois prêts.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
