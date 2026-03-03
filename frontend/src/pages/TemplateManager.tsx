import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Edit2, Trash2, Check, Monitor, ArrowLeft } from 'lucide-react';
import { Button, Modal, Spinner, ButtonGroup } from '../components/common';
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

interface TemplateManagerProps {
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  refreshBuiltinsTrigger?: number;
}

export function TemplateManager({ createOpen, onCreateOpenChange, refreshBuiltinsTrigger }: TemplateManagerProps = {}) {
  const { t } = useTranslation(['media', 'common']);
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
      setSuccessMessage(t('media:templates.builtinsUpdated', { count: data?.total || 0 }));
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
    if (window.confirm(t('media:templates.deleteConfirm', { name: template.name }))) {
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

  // Handle external create trigger
  useEffect(() => {
    if (createOpen) {
      handleCreate();
      onCreateOpenChange?.(false);
    }
  }, [createOpen]);

  // Handle external refresh builtins trigger
  const prevTrigger = useRef(0);
  useEffect(() => {
    if (refreshBuiltinsTrigger && refreshBuiltinsTrigger !== prevTrigger.current) {
      prevTrigger.current = refreshBuiltinsTrigger;
      initBuiltinsMutation.mutate();
    }
  }, [refreshBuiltinsTrigger]);

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
          <p className="text-red-400">{t('media:templates.errorLoading')}</p>
        </div>
      ) : filteredTemplates && filteredTemplates.length > 0 ? (
        <div className="rounded-lg border border-dark-border bg-dark-surface overflow-hidden divide-y divide-dark-border">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                isPreviewOpen && selectedTemplate?.id === template.id
                  ? 'bg-theatarr-500/10'
                  : 'hover:bg-dark-border/20'
              }`}
              onClick={() => handlePreview(template)}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                template.is_active ? 'bg-green-500/20' : 'bg-dark-bg'
              }`}>
                <Monitor size={16} className={template.is_active ? 'text-green-400' : 'text-dark-muted'} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-dark-text text-sm truncate">{template.name}</span>
                  {template.is_active && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded flex-shrink-0">
                      {t('media:templates.status.active')}
                    </span>
                  )}
                  {template.is_builtin && (
                    <span className="px-1.5 py-0.5 bg-dark-border text-dark-muted text-[10px] font-medium rounded flex-shrink-0">
                      {t('media:templates.status.builtin')}
                    </span>
                  )}
                </div>
                {/* Meta row */}
                <div className="flex items-center gap-2 mt-0.5 text-xs text-dark-muted">
                  <span className="px-1.5 py-0.5 rounded bg-dark-bg border border-dark-border text-[10px] font-medium text-theatarr-400 flex-shrink-0">
                    {template.template_type}
                  </span>
                  {template.layout?.components && (
                    <span className="flex-shrink-0">{template.layout.components.length} {t('media:templates.components')}</span>
                  )}
                  {template.description && (
                    <span className="truncate hidden sm:inline">{template.description}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {!template.is_active && (
                  <button
                    onClick={() => handleActivate(template)}
                    disabled={activateMutation.isPending}
                    className="p-1.5 rounded-lg text-dark-muted hover:text-green-400 hover:bg-green-500/10 transition-colors"
                    title={t('media:templates.activate')}
                  >
                    <Check size={14} />
                  </button>
                )}
                {!template.is_builtin && (
                  <>
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border/50 transition-colors"
                      title={t('media:templates.edit')}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t('media:templates.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Monitor size={48} className="mx-auto text-dark-muted mb-4" />
          <p className="text-dark-muted">{t('media:templates.empty.title')}</p>
          {filter === 'custom' && (
            <Button className="mt-4" onClick={handleCreate}>
              {t('media:templates.empty.createFirst')}
            </Button>
          )}
        </div>
      )}
    </>
  );

  return (
    <div>
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
          <Check size={16} />
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <ButtonGroup
          options={[
            { key: 'all' as const, label: t('media:templates.filters.all') },
            { key: 'wallmount' as const, label: t('media:templates.filters.wallmount') },
            { key: 'waiting_screen' as const, label: t('media:templates.filters.waiting_screen') },
            { key: 'quiz' as const, label: t('media:templates.filters.quiz') },
            { key: 'feedback' as const, label: t('media:templates.filters.feedback') },
            { key: 'custom' as const, label: t('media:templates.filters.custom') },
          ]}
          value={filter}
          onChange={setFilter}
        />
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
              <span>{t('media:templates.backToList')}</span>
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
        title={isCreateMode ? t('media:templates.modal.createTitle') : t('media:templates.modal.editTitle')}
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
