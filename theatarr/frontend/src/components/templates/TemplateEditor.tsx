import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Input, Select } from '../common';
import { apiClient } from '../../api/client';

interface TemplateComponent {
  type: string;
  position?: string;
  size?: string;
  opacity?: number;
  blur?: number;
  fields?: string[];
  limit?: number;
  max_lines?: number;
}

interface Template {
  id?: string;
  name: string;
  description?: string;
  template_type: string;
  content?: string;
  styles?: string;
  script?: string;
  layout?: {
    components: TemplateComponent[];
  };
  config?: Record<string, unknown>;
}

interface TemplateEditorProps {
  template?: Template;
  onSave: () => void;
  onCancel: () => void;
}

const COMPONENT_TYPES = [
  { value: 'backdrop', label: 'Backdrop' },
  { value: 'poster', label: 'Poster' },
  { value: 'title', label: 'Title' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'overview', label: 'Overview' },
  { value: 'cast', label: 'Cast' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'session_progress', label: 'Session Progress' },
  { value: 'current_sequence', label: 'Current Sequence' },
];

const TEMPLATE_TYPES = [
  { value: 'movie_info', label: 'Movie Info' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'session_status', label: 'Session Status' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'custom', label: 'Custom' },
];

const POSITIONS = [
  { value: '', label: 'Default' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'center', label: 'Center' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const SIZES = [
  { value: '', label: 'Default' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const isEditing = !!template?.id;

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateType, setTemplateType] = useState(template?.template_type || 'custom');
  const [components, setComponents] = useState<TemplateComponent[]>(
    template?.layout?.components || []
  );
  const [config, setConfig] = useState<Record<string, boolean>>({
    show_rating: (template?.config?.show_rating as boolean) ?? true,
    show_genres: (template?.config?.show_genres as boolean) ?? true,
    animate_entry: (template?.config?.animate_entry as boolean) ?? true,
    show_seconds: (template?.config?.show_seconds as boolean) ?? true,
    animate_numbers: (template?.config?.animate_numbers as boolean) ?? true,
    show_elapsed_time: (template?.config?.show_elapsed_time as boolean) ?? false,
    show_remaining_time: (template?.config?.show_remaining_time as boolean) ?? false,
    use_palette_colors: (template?.config?.use_palette_colors as boolean) ?? true,
  });
  const [expandedComponent, setExpandedComponent] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Template>) => {
      if (isEditing) {
        await apiClient.patch(`/templates/${template.id}`, data);
      } else {
        await apiClient.post('/templates', data);
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleAddComponent = () => {
    setComponents([...components, { type: 'title' }]);
    setExpandedComponent(components.length);
  };

  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
    if (expandedComponent === index) {
      setExpandedComponent(null);
    }
  };

  const handleUpdateComponent = (index: number, updates: Partial<TemplateComponent>) => {
    setComponents(
      components.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const handleMoveComponent = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= components.length) return;

    const newComponents = [...components];
    [newComponents[index], newComponents[newIndex]] = [
      newComponents[newIndex],
      newComponents[index],
    ];
    setComponents(newComponents);

    if (expandedComponent === index) {
      setExpandedComponent(newIndex);
    } else if (expandedComponent === newIndex) {
      setExpandedComponent(index);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Partial<Template> = {
      name,
      description: description || undefined,
      template_type: templateType,
      layout: { components },
      config,
    };

    saveMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="My Custom Template"
        />

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the template"
        />

        <Select
          label="Template Type"
          value={templateType}
          onChange={(e) => setTemplateType(e.target.value)}
          options={TEMPLATE_TYPES}
        />
      </div>

      {/* Components */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Components</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleAddComponent}>
            <Plus size={14} />
            <span className="ml-1">Add Component</span>
          </Button>
        </div>

        <div className="space-y-2">
          {components.map((component, index) => (
            <div
              key={index}
              className="border border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 cursor-pointer"
                onClick={() =>
                  setExpandedComponent(expandedComponent === index ? null : index)
                }
              >
                <GripVertical size={16} className="text-gray-500" />

                <span className="font-medium flex-1 capitalize">
                  {component.type.replace('_', ' ')}
                </span>

                {component.position && (
                  <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-700 rounded">
                    {component.position}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveComponent(index, 'up');
                    }}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveComponent(index, 'down');
                    }}
                    disabled={index === components.length - 1}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveComponent(index);
                    }}
                    className="p-1 hover:bg-gray-700 rounded text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedComponent === index && (
                <div className="p-4 space-y-4 bg-gray-800/50">
                  <Select
                    label="Type"
                    value={component.type}
                    onChange={(e) =>
                      handleUpdateComponent(index, { type: e.target.value })
                    }
                    options={COMPONENT_TYPES}
                  />

                  <Select
                    label="Position"
                    value={component.position || ''}
                    onChange={(e) =>
                      handleUpdateComponent(index, {
                        position: e.target.value || undefined,
                      })
                    }
                    options={POSITIONS}
                  />

                  {['poster', 'backdrop'].includes(component.type) && (
                    <Select
                      label="Size"
                      value={component.size || ''}
                      onChange={(e) =>
                        handleUpdateComponent(index, {
                          size: e.target.value || undefined,
                        })
                      }
                      options={SIZES}
                    />
                  )}

                  {component.type === 'backdrop' && (
                    <>
                      <Input
                        label="Opacity"
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={component.opacity ?? 0.3}
                        onChange={(e) =>
                          handleUpdateComponent(index, {
                            opacity: parseFloat(e.target.value),
                          })
                        }
                      />
                      <Input
                        label="Blur (px)"
                        type="number"
                        min={0}
                        max={50}
                        value={component.blur ?? 0}
                        onChange={(e) =>
                          handleUpdateComponent(index, {
                            blur: parseInt(e.target.value) || undefined,
                          })
                        }
                      />
                    </>
                  )}

                  {component.type === 'overview' && (
                    <Input
                      label="Max Lines"
                      type="number"
                      min={1}
                      max={10}
                      value={component.max_lines ?? 4}
                      onChange={(e) =>
                        handleUpdateComponent(index, {
                          max_lines: parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  )}

                  {component.type === 'cast' && (
                    <Input
                      label="Limit"
                      type="number"
                      min={1}
                      max={20}
                      value={component.limit ?? 5}
                      onChange={(e) =>
                        handleUpdateComponent(index, {
                          limit: parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {components.length === 0 && (
            <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
              No components added. Click "Add Component" to get started.
            </div>
          )}
        </div>
      </div>

      {/* Config Options */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Options</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(config).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) =>
                  setConfig({ ...config, [key]: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm capitalize">
                {key.replace(/_/g, ' ')}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4 border-t border-gray-700">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending || !name}>
          {saveMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>

      {saveMutation.error && (
        <div className="text-red-500 text-sm">
          Failed to save template. Please try again.
        </div>
      )}
    </form>
  );
}
