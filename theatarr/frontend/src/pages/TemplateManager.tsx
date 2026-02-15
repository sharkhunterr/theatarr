import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Check, RefreshCw, Monitor, ArrowLeft } from 'lucide-react';
import { Button, Card, Modal, Spinner } from '../components/common';
import { TemplateEditor } from '../components/templates/TemplateEditor';
import { TemplatePreview } from '../components/templates/TemplatePreview';
import { apiClient } from '../api/client';

interface Template {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  content?: string;
  styles?: string;
  script?: string;
  layout?: {
    components: Array<{
      type: string;
      position?: string;
      size?: string;
      opacity?: number;
      blur?: number;
      fields?: string[];
      limit?: number;
      max_lines?: number;
    }>;
  };
  config?: Record<string, unknown>;
  is_builtin: boolean;
  is_active: boolean;
  preview_url?: string;
  created_at: string;
  updated_at: string;
}

interface TemplateListResponse {
  items: Template[];
  total: number;
}

export function TemplateManager() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [filter, setFilter] = useState<'all' | 'wallmount' | 'waiting_screen' | 'quiz' | 'feedback' | 'custom'>('all');

  const { data, isLoading, error } = useQuery<TemplateListResponse>({
    queryKey: ['templates'],
    queryFn: async () => {
      return await apiClient.get<TemplateListResponse>('/templates');
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiClient.post(`/templates/${templateId}/activate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      await apiClient.delete(`/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initBuiltinsMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.post<TemplateListResponse>('/templates/init-builtins', {});
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSuccessMessage(`${data?.total || 0} templates integres mis a jour`);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsCreateMode(true);
    setIsEditorOpen(true);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setIsCreateMode(false);
    setIsEditorOpen(true);
  };

  const handlePreview = (template: Template) => {
    if (isPreviewOpen && selectedTemplate?.id === template.id) {
      setIsPreviewOpen(false);
      setSelectedTemplate(null);
    } else {
      setSelectedTemplate(template);
      setIsPreviewOpen(true);
    }
  };

  const handleDelete = async (template: Template) => {
    if (window.confirm(`Supprimer le template "${template.name}" ?`)) {
      await deleteMutation.mutateAsync(template.id);
    }
  };

  const handleActivate = async (template: Template) => {
    await activateMutation.mutateAsync(template.id);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedTemplate(null);
    setIsCreateMode(false);
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  const WALLMOUNT_TYPES = ['countdown', 'movie_info', 'session_status'];

  const filteredTemplates = data?.items.filter((t) => {
    if (filter === 'wallmount') return t.is_builtin && WALLMOUNT_TYPES.includes(t.template_type);
    if (filter === 'waiting_screen') return t.is_builtin && t.template_type === 'waiting_screen';
    if (filter === 'quiz') return t.template_type === 'quiz';
    if (filter === 'feedback') return t.template_type === 'feedback';
    if (filter === 'custom') return !t.is_builtin;
    return true;
  });

  const templateList = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400">Erreur lors du chargement des templates</p>
        </div>
      ) : filteredTemplates && filteredTemplates.length > 0 ? (
        <div className="space-y-2">
          {filteredTemplates.map((template) => (
            <Card key={template.id}>
              <div
                className={`p-3 cursor-pointer transition-colors ${
                  isPreviewOpen && selectedTemplate?.id === template.id
                    ? 'ring-1 ring-theatarr-500 bg-theatarr-500/5'
                    : 'hover:bg-dark-border/20'
                }`}
                onClick={() => handlePreview(template)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      template.is_active ? 'bg-green-500/20' : 'bg-dark-border'
                    }`}>
                      <Monitor size={18} className={template.is_active ? 'text-green-400' : 'text-dark-muted'} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-dark-text text-sm">{template.name}</span>
                        {template.is_active && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded">
                            Actif
                          </span>
                        )}
                        {template.is_builtin && (
                          <span className="px-1.5 py-0.5 bg-dark-border text-dark-muted text-[10px] font-medium rounded">
                            Integre
                          </span>
                        )}
                      </div>
                      {!isPreviewOpen && template.description && (
                        <p className="text-xs text-dark-muted truncate mt-0.5">{template.description}</p>
                      )}
                    </div>

                    {/* Type badge */}
                    {!isPreviewOpen && (
                      <div className="hidden md:flex items-center gap-3 text-sm text-dark-muted">
                        <span className="px-2 py-0.5 bg-theatarr-500/20 text-theatarr-400 text-xs rounded">
                          {template.template_type}
                        </span>
                        {template.layout?.components && (
                          <span className="text-xs">{template.layout.components.length} composants</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    {!template.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleActivate(template)}
                        disabled={activateMutation.isPending}
                        title="Activer"
                      >
                        <Check size={14} />
                      </Button>
                    )}

                    {!template.is_builtin && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          title="Modifier"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template)}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Monitor size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">Aucun template trouve</p>
          {filter === 'custom' && (
            <Button className="mt-4" onClick={handleCreate}>
              Creer votre premier template
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Templates</h1>
          <p className="text-dark-muted text-sm mt-1">Gerez les templates d'affichage wallmount</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => initBuiltinsMutation.mutate()}
            disabled={initBuiltinsMutation.isPending}
            title="Mettre a jour les templates integres"
          >
            <RefreshCw
              size={16}
              className={initBuiltinsMutation.isPending ? 'animate-spin mr-2' : 'mr-2'}
            />
            <span className="hidden sm:inline">MAJ Integres</span>
          </Button>
          <Button onClick={handleCreate}>
            <Plus size={16} className="mr-1" />
            <span className="hidden sm:inline">Nouveau</span>
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {(['all', 'wallmount', 'waiting_screen', 'quiz', 'feedback', 'custom'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              filter === f
                ? 'bg-theatarr-500 text-white'
                : 'bg-dark-surface text-dark-muted hover:bg-dark-border/50 border border-dark-border'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'wallmount' ? 'Wallmount' : f === 'waiting_screen' ? 'Waiting' : f === 'quiz' ? 'Quiz' : f === 'feedback' ? 'Feedback' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Main content: list + preview split */}
      {isPreviewOpen && selectedTemplate ? (
        <>
          {/* Mobile: full-width preview only */}
          <div className="md:hidden" style={{ height: 'calc(100vh - 200px)' }}>
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="flex items-center gap-1.5 text-sm text-dark-muted hover:text-dark-text mb-3 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Retour a la liste</span>
            </button>
            <div className="h-[calc(100%-36px)] rounded-lg overflow-hidden border border-dark-border bg-black">
              <TemplatePreview
                template={selectedTemplate}
                onClose={() => setIsPreviewOpen(false)}
              />
            </div>
          </div>

          {/* Desktop: side-by-side split */}
          <div className="hidden md:flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
            <div className="w-2/5 overflow-y-auto pr-1">
              {templateList}
            </div>
            <div className="w-3/5 rounded-lg overflow-hidden border border-dark-border bg-black">
              <TemplatePreview
                template={selectedTemplate}
                onClose={() => setIsPreviewOpen(false)}
              />
            </div>
          </div>
        </>
      ) : (
        templateList
      )}

      {/* Editor Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        title={isCreateMode ? 'Creer un template' : 'Modifier le template'}
        size="xl"
      >
        <TemplateEditor
          template={selectedTemplate || undefined}
          onSave={handleEditorClose}
          onCancel={handleEditorClose}
        />
      </Modal>
    </div>
  );
}
