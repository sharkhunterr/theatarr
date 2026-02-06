import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Download,
  Trash2,
  Play,
  Settings,
  Film,
  HardDrive,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Button, Card, Modal, Spinner, Input } from '../components/common';
import { TrailerCard } from '../components/trailers/TrailerCard';
import { TrailerRuleForm } from '../components/trailers/TrailerRuleForm';
import { StorageStats } from '../components/trailers/StorageStats';
import { apiClient } from '../api/client';

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

export function TrailersManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'library' | 'rules'>('library');
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<TrailerRule | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadTitle, setDownloadTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending' | 'error'>('all');

  // Fetch trailers
  const { data: trailersData, isLoading: trailersLoading } = useQuery({
    queryKey: ['trailers', filter],
    queryFn: async () => {
      const params = filter !== 'all' ? `?status_filter=${filter}` : '';
      return apiClient.get(`/trailers${params}`);
    },
    enabled: activeTab === 'library',
  });

  // Fetch rules
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['trailer-rules'],
    queryFn: async () => {
      return apiClient.get('/trailers/rules');
    },
    enabled: activeTab === 'rules',
  });

  // Fetch storage stats
  const { data: storageStats } = useQuery<StorageStatsData>({
    queryKey: ['trailer-stats'],
    queryFn: async () => {
      return apiClient.get('/trailers/stats');
    },
  });

  // Download mutation
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/trailers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
      queryClient.invalidateQueries({ queryKey: ['trailer-stats'] });
    },
  });

  // Run rule mutation
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
      downloadMutation.mutate({
        movie_title: downloadTitle,
        source_url: downloadUrl,
      });
    }
  };

  const handleDelete = async (trailer: Trailer) => {
    if (window.confirm(`Delete trailer "${trailer.title}"?`)) {
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Bandes-annonces</h1>
          <p className="text-dark-muted text-sm mt-1">Gerez votre bibliotheque de bandes-annonces et les regles de telechargement</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'library' && (
            <Button onClick={() => setIsDownloadOpen(true)}>
              <Download size={16} className="mr-1" />
              <span className="hidden sm:inline">Telecharger</span>
            </Button>
          )}
          {activeTab === 'rules' && (
            <Button onClick={() => setIsRuleFormOpen(true)}>
              <Plus size={16} className="mr-1" />
              <span className="hidden sm:inline">Creer une regle</span>
            </Button>
          )}
        </div>
      </div>

      {/* Storage Stats */}
      {storageStats && <StorageStats stats={storageStats} className="mb-6" />}

      {/* Tabs */}
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
          Bibliotheque
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
          Regles
        </button>
      </div>

      {/* Library Tab */}
      {activeTab === 'library' && (
        <>
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
                {f === 'all' ? 'Tous' : f === 'ready' ? 'Pret' : f === 'pending' ? 'En cours' : 'Erreur'}
              </button>
            ))}
          </div>

          {trailersLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : trailersData?.items?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {trailersData.items.map((trailer: Trailer) => (
                <TrailerCard
                  key={trailer.id}
                  trailer={trailer}
                  onDelete={() => handleDelete(trailer)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Film size={48} className="mx-auto text-dark-muted mb-4" />
              <p className="text-dark-muted">No trailers found</p>
              <Button className="mt-4" onClick={() => setIsDownloadOpen(true)}>
                Download Your First Trailer
              </Button>
            </div>
          )}
        </>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          {rulesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : rulesData?.items?.length > 0 ? (
            <div className="space-y-4">
              {rulesData.items.map((rule: TrailerRule) => (
                <Card key={rule.id}>
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{rule.name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              rule.is_enabled
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-gray-500/20 text-dark-muted'
                            }`}
                          >
                            {rule.is_enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        {rule.description && (
                          <p className="text-dark-muted text-sm mt-1">{rule.description}</p>
                        )}

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-dark-muted">
                          <span className="flex items-center gap-1">
                            <HardDrive size={14} />
                            {rule.storage_used_gb.toFixed(1)} / {rule.max_storage_gb} GB
                          </span>
                          <span className="flex items-center gap-1">
                            <Film size={14} />
                            {rule.trailer_count} trailers
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {rule.frequency}
                          </span>
                          {rule.genres && rule.genres.length > 0 && (
                            <span>Genres: {rule.genres.join(', ')}</span>
                          )}
                        </div>

                        {rule.last_run_at && (
                          <p className="text-xs text-dark-muted mt-2">
                            Last run: {new Date(rule.last_run_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runRuleMutation.mutate(rule.id)}
                          disabled={runRuleMutation.isPending}
                        >
                          <RefreshCw
                            size={14}
                            className={runRuleMutation.isPending ? 'animate-spin' : ''}
                          />
                          <span className="ml-1">Run Now</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRule(rule)}
                        >
                          <Settings size={14} />
                          <span className="ml-1">Edit</span>
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
              <p className="text-dark-muted">No download rules configured</p>
              <Button className="mt-4" onClick={() => setIsRuleFormOpen(true)}>
                Create Your First Rule
              </Button>
            </div>
          )}
        </>
      )}

      {/* Download Modal */}
      <Modal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        title="Download Trailer"
      >
        <div className="space-y-4">
          <Input
            label="Movie Title"
            value={downloadTitle}
            onChange={(e) => setDownloadTitle(e.target.value)}
            placeholder="Blade Runner 2049"
          />
          <Input
            label="YouTube URL"
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <div className="flex justify-end gap-4 pt-4">
            <Button variant="ghost" onClick={() => setIsDownloadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!downloadUrl || !downloadTitle || downloadMutation.isPending}
            >
              {downloadMutation.isPending ? 'Downloading...' : 'Download'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rule Form Modal */}
      <Modal
        isOpen={isRuleFormOpen}
        onClose={handleRuleFormClose}
        title={selectedRule ? 'Edit Rule' : 'Create Rule'}
        size="lg"
      >
        <TrailerRuleForm
          rule={selectedRule || undefined}
          onSave={handleRuleFormClose}
          onCancel={handleRuleFormClose}
        />
      </Modal>
    </div>
  );
}
