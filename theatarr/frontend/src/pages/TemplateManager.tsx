import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Check, Eye, RefreshCw } from 'lucide-react';
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
  const [filter, setFilter] = useState<'all' | 'builtin' | 'custom'>('all');

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

  const initBuiltinsMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/templates/init-builtins', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
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
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleDelete = async (template: Template) => {
    if (window.confirm(`Delete template "${template.name}"?`)) {
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

  const filteredTemplates = data?.items.filter((t) => {
    if (filter === 'builtin') return t.is_builtin;
    if (filter === 'custom') return !t.is_builtin;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-500">Failed to load templates</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-gray-500 mt-1">
            Manage wallmount display templates
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => initBuiltinsMutation.mutate()}
            disabled={initBuiltinsMutation.isPending}
          >
            <RefreshCw
              size={16}
              className={initBuiltinsMutation.isPending ? 'animate-spin' : ''}
            />
            <span className="ml-2">Reset Builtins</span>
          </Button>
          <Button onClick={handleCreate}>
            <Plus size={16} />
            <span className="ml-2">Create Template</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'builtin', 'custom'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates?.map((template) => (
          <Card key={template.id} className="relative overflow-hidden">
            {/* Active indicator */}
            {template.is_active && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded">
                Active
              </div>
            )}

            {/* Builtin badge */}
            {template.is_builtin && (
              <div className="absolute top-4 left-4 px-2 py-1 bg-gray-700 text-gray-300 text-xs font-medium rounded">
                Built-in
              </div>
            )}

            <div className="p-6 pt-12">
              <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
              <p className="text-gray-400 text-sm mb-4">
                {template.description || `Type: ${template.template_type}`}
              </p>

              {/* Template type badge */}
              <div className="mb-4">
                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded">
                  {template.template_type}
                </span>
              </div>

              {/* Components preview */}
              {template.layout?.components && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {template.layout.components.map((c, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded"
                    >
                      {c.type}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 border-t border-gray-700">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePreview(template)}
                >
                  <Eye size={14} />
                  <span className="ml-1">Preview</span>
                </Button>

                {!template.is_active && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleActivate(template)}
                    disabled={activateMutation.isPending}
                  >
                    <Check size={14} />
                    <span className="ml-1">Activate</span>
                  </Button>
                )}

                {!template.is_builtin && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 size={14} />
                      <span className="ml-1">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No templates found</p>
          {filter === 'custom' && (
            <Button className="mt-4" onClick={handleCreate}>
              Create Your First Template
            </Button>
          )}
        </div>
      )}

      {/* Editor Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        title={isCreateMode ? 'Create Template' : 'Edit Template'}
        size="xl"
      >
        <TemplateEditor
          template={selectedTemplate || undefined}
          onSave={handleEditorClose}
          onCancel={handleEditorClose}
        />
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Preview: ${selectedTemplate?.name}`}
        size="full"
      >
        {selectedTemplate && (
          <TemplatePreview
            template={selectedTemplate}
            onClose={() => setIsPreviewOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
