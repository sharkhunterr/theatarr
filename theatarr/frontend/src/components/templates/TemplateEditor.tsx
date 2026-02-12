import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { Button, Input, Select } from '../common';
import { TemplateRenderer } from '../wallmount/TemplateRenderer';
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
  { value: 'waiting_screen', label: 'Waiting Screen' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'custom', label: 'Custom' },
];

const LAYOUT_STYLES = [
  // Wallmount
  { value: '', label: '— Aucun (defaut) —', group: '' },
  { value: 'poster-fullscreen', label: 'Affiche Plein Ecran', group: 'Wallmount' },
  { value: 'split-horizontal', label: 'Ecran Divise', group: 'Wallmount' },
  { value: 'cinema-marquee', label: 'Cinema Classique', group: 'Wallmount' },
  { value: 'minimal-center', label: 'Minimal Centre', group: 'Wallmount' },
  { value: 'modern-gradient', label: 'Moderne Degrade', group: 'Wallmount' },
  { value: 'responsive-badge', label: 'Responsive Badge', group: 'Wallmount' },
  { value: 'neon-retro', label: 'Neon Retro', group: 'Wallmount' },
  { value: 'elegant-premium', label: 'Elegant Premium', group: 'Wallmount' },
  { value: 'spotlight-dramatic', label: 'Spotlight Dramatique', group: 'Wallmount' },
  { value: 'glassmorphism', label: 'Glassmorphism', group: 'Wallmount' },
  { value: 'event-board', label: 'Panneau Evenement', group: 'Wallmount' },
  { value: 'cinema-tickets', label: 'Tickets Cinema', group: 'Wallmount' },
  { value: 'minimal-focus', label: 'Minimal Focus', group: 'Wallmount' },
  { value: 'dynamic-info', label: 'Infos Dynamiques', group: 'Wallmount' },
  { value: 'social-vertical', label: 'Social Vertical', group: 'Wallmount' },
  { value: 'cinematic-immersive', label: 'Cinema Immersif', group: 'Wallmount' },
  { value: 'cinematic-mystery', label: 'Cinema Mystere', group: 'Wallmount' },
  { value: 'showcase-enriched', label: 'Showcase Enrichi', group: 'Wallmount' },
  { value: 'fanart-gallery', label: 'Galerie Fanart', group: 'Wallmount' },
  { value: 'panorama-slide', label: 'Panorama Glissant', group: 'Wallmount' },
  { value: 'modern-enriched', label: 'Moderne Enrichi', group: 'Wallmount' },
  { value: 'debug-tmdb', label: 'Debug TMDB', group: 'Wallmount' },
  // Waiting Screen - Generiques
  { value: 'waiting-cinema', label: 'Salle de Cinema', group: 'Waiting (generique)' },
  { value: 'waiting-annonce', label: 'Annonces', group: 'Waiting (generique)' },
  { value: 'waiting-trailers', label: 'Bandes-Annonces', group: 'Waiting (generique)' },
  { value: 'waiting-trailers-retro', label: 'Bandes-Annonces Retro', group: 'Waiting (generique)' },
  // Waiting Screen - Film
  { value: 'waiting-ambient', label: 'Ambiance', group: 'Waiting (film)' },
  { value: 'waiting-poster-centered', label: 'Affiche Centree', group: 'Waiting (film)' },
  { value: 'waiting-spotlight', label: 'Spotlight', group: 'Waiting (film)' },
  { value: 'waiting-panoramic', label: 'Panoramique', group: 'Waiting (film)' },
  { value: 'waiting-teaser', label: 'Teaser', group: 'Waiting (film)' },
  { value: 'waiting-minimal', label: 'Minimale', group: 'Waiting (film)' },
  // Waiting Screen - Entracte
  { value: 'waiting-intermission', label: 'Entracte', group: 'Waiting (entracte)' },
  { value: 'waiting-intermission-fun', label: 'Pause Detente', group: 'Waiting (entracte)' },
  { value: 'waiting-intermission-minimal', label: 'Pause Minimale', group: 'Waiting (entracte)' },
  // Quiz
  { value: 'quiz-classic', label: 'Quiz Classique', group: 'Quiz' },
  { value: 'quiz-gameshow', label: 'Quiz Game Show', group: 'Quiz' },
  { value: 'quiz-minimal', label: 'Quiz Minimal', group: 'Quiz' },
  // Custom HTML
  { value: 'custom-html', label: 'HTML/CSS/JS Personnalise', group: 'Custom' },
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
  const [layoutStyle, setLayoutStyle] = useState(
    template?.content ? 'custom-html' : (template?.layout as Record<string, unknown>)?.style as string || ''
  );
  const [components, setComponents] = useState<TemplateComponent[]>(
    template?.layout?.components || []
  );
  const [htmlContent, setHtmlContent] = useState(template?.content || '');
  const [cssStyles, setCssStyles] = useState(template?.styles || '');
  const [jsScript, setJsScript] = useState(template?.script || '');
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
  const [showPreview, setShowPreview] = useState(false);

  const previewData = useMemo(() => ({
    movie: {
      title: 'Blade Runner 2049',
      year: 2017,
      runtime_minutes: 164,
      overview: 'Thirty years after the events of the first film, a new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what\'s left of society into chaos.',
      tagline: 'The key to the future is finally unearthed.',
      poster_url: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/sAtoMqDVhNDQBc3QJL3RF6hlhGq.jpg',
      rating: 8.0,
      genres: ['Science Fiction', 'Drame'],
      directors: ['Denis Villeneuve'],
      cast: ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas', 'Sylvia Hoeks', 'Robin Wright'],
    },
    session: { name: 'Soiree Cinema', status: 'running' },
    palette: {
      primary: '#f97316',
      secondary: '#78350f',
      accent: '#fb923c',
      background: '#0c0a09',
      text: '#fafaf9',
      vibrant: '#f97316',
    },
  }), []);

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

  const isCustomHtml = layoutStyle === 'custom-html';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const layout: Record<string, unknown> = { components };
    if (layoutStyle && layoutStyle !== 'custom-html') {
      layout.style = layoutStyle;
    }

    const data: Partial<Template> = {
      name,
      description: description || undefined,
      template_type: templateType,
      layout: isCustomHtml ? undefined : layout as Template['layout'],
      config: isCustomHtml ? undefined : config,
      content: isCustomHtml ? htmlContent || undefined : undefined,
      styles: isCustomHtml ? cssStyles || undefined : undefined,
      script: isCustomHtml ? jsScript || undefined : undefined,
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

        {/* Layout Style - determines which visual renderer is used */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Style de rendu</label>
          <select
            value={layoutStyle}
            onChange={(e) => setLayoutStyle(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {(() => {
              let lastGroup = '';
              return LAYOUT_STYLES.map((s) => {
                const items: React.ReactNode[] = [];
                if (s.group !== lastGroup && s.group) {
                  items.push(
                    <option key={`group-${s.group}`} disabled className="text-gray-500 font-bold">
                      {'--- ' + s.group + ' ---'}
                    </option>
                  );
                  lastGroup = s.group;
                }
                items.push(
                  <option key={s.value} value={s.value}>
                    {s.group ? '  ' + s.label : s.label}
                  </option>
                );
                return items;
              });
            })()}
          </select>
          <p className="text-xs text-gray-500 mt-1">Determine le rendu visuel du template</p>
        </div>
      </div>

      {/* Custom HTML Editor */}
      {isCustomHtml ? (
        <div className="space-y-4">
          {/* Header with API Help + Preview Toggle */}
          <div className="flex items-start gap-3">
            <div className="flex-1 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-sm text-gray-300">
              <p className="font-medium text-indigo-400 mb-1">API Theatarr</p>
              <p className="text-xs text-gray-400 mb-2">
                Le template s'execute dans une iframe isolee. Utilisez <code className="bg-gray-700 px-1 rounded">Theatarr.onUpdate(data =&gt; ...)</code> pour recevoir les donnees en temps reel.
              </p>
              <details className="text-xs text-gray-400">
                <summary className="cursor-pointer text-indigo-400/80 hover:text-indigo-400">Donnees disponibles</summary>
                <pre className="mt-2 p-2 bg-gray-800 rounded text-[11px] overflow-x-auto whitespace-pre">{`data.movie    // { title, year, poster_url, backdrop_url, genres, cast, ... }
data.session  // { name, status }
data.palette  // { primary, secondary, accent, background, text }
data.vote_info // { total_votes, is_open, movie_options, ... }
data.countdown // { remaining, progress, formatted }
data.config   // { theme, ... }
data.template // { name }`}</pre>
              </details>
            </div>
            <Button
              type="button"
              variant={showPreview ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? 'Masquer l\'apercu' : 'Afficher l\'apercu'}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="ml-1.5">{showPreview ? 'Masquer' : 'Apercu'}</span>
            </Button>
          </div>

          {/* Live Preview Panel */}
          {showPreview && (
            <div className="rounded-lg overflow-hidden border border-gray-700 bg-black" style={{ height: '360px' }}>
              <TemplateRenderer
                key={htmlContent + cssStyles + jsScript}
                template={{
                  name: name || 'Preview',
                  template_type: templateType,
                  content: htmlContent || undefined,
                  styles: cssStyles || undefined,
                  script: jsScript || undefined,
                }}
                data={previewData}
              />
            </div>
          )}

          {/* HTML */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">HTML <span className="text-gray-500 font-normal">(contenu du body)</span></label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 font-mono min-h-[160px] resize-y"
              placeholder='<div id="app">&#10;  <h1 id="title">Chargement...</h1>&#10;</div>'
              spellCheck={false}
            />
          </div>

          {/* CSS */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">CSS</label>
            <textarea
              value={cssStyles}
              onChange={(e) => setCssStyles(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 font-mono min-h-[120px] resize-y"
              placeholder="h1 { font-size: 4rem; text-align: center; }"
              spellCheck={false}
            />
          </div>

          {/* JavaScript */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">JavaScript</label>
            <textarea
              value={jsScript}
              onChange={(e) => setJsScript(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 font-mono min-h-[160px] resize-y"
              placeholder={`Theatarr.onUpdate(function(data) {\n  if (data.movie) {\n    document.getElementById('title').textContent = data.movie.title;\n  }\n});`}
              spellCheck={false}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Preview toggle for structured templates */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Apercu</h3>
            <Button
              type="button"
              variant={showPreview ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              <span className="ml-1.5">{showPreview ? 'Masquer' : 'Afficher'}</span>
            </Button>
          </div>

          {showPreview && layoutStyle && (
            <div className="rounded-lg overflow-hidden border border-gray-700 bg-black" style={{ height: '360px' }}>
              <TemplateRenderer
                template={{
                  name: name || 'Preview',
                  template_type: templateType,
                  layout: { style: layoutStyle, components } as any,
                  config,
                }}
                data={previewData}
              />
            </div>
          )}

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
                  No components added. Click &quot;Add Component&quot; to get started.
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
        </>
      )}

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
