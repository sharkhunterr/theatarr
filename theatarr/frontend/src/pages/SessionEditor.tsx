import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Node } from 'reactflow';
import {
  ArrowLeft,
  Save,
  List,
  GitBranch,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Volume2,
  Monitor,
  Play,
  Zap,
  Calendar,
  Film,
  Search,
  X,
  Palette,
} from 'lucide-react';
import { Button, Spinner } from '../components/common';
import {
  WorkflowEditor,
  WorkflowNodeEditor,
  WorkflowData,
  WorkflowNodeData,
  createDefaultWorkflow,
  ActionType,
} from '../components/workflow';
import { ActionEditorPanel, ActionItem } from '../components/sessions/ActionEditorPanel';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  vibrant: string;
  vibrant_light: string;
  vibrant_dark: string;
  muted: string;
  muted_light: string;
  muted_dark: string;
  raw_palette?: string[];
}

interface Session {
  id: string;
  name: string;
  description?: string;
  status: string;
  scheduled_at?: string | null;
  workflow?: WorkflowData;
  movie_id?: string | null;
  movie_title?: string | null;
  movie_poster_url?: string | null;
  movie_source_id?: string | null;
  movie_source?: string | null;
  color_palette?: ColorPalette | null;
}

interface Service {
  id: string;
  name: string;
  adapter_type: string;
  category: string;
  is_enabled: boolean;
  connection_status: string;
}

type EditorMode = 'linear' | 'node';

// Serialize workflow for API - strip React Flow internal properties
function serializeWorkflow(workflow: WorkflowData): Record<string, unknown> {
  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
  };
}

// Convert workflow to linear actions (for linear mode display)
function workflowToActions(workflow: WorkflowData): ActionItem[] {
  return workflow.nodes
    .filter((n) => n.data.nodeType === 'action' && n.data.actionType)
    .map((n) => ({
      id: n.id,
      action_type: n.data.actionType!,
      command: n.data.command || '',
      parameters: (n.data.parameters || {}) as Record<string, unknown>,
      delay_ms: n.data.delay_ms || 0,
      on_failure: n.data.on_failure || 'warn',
      service_id: n.data.service_id as string | undefined,
    }));
}

// Convert linear actions to workflow (rebuilds simple linear workflow)
function actionsToWorkflow(actions: ActionItem[]): WorkflowData {
  const nodes: Node<WorkflowNodeData>[] = [
    {
      id: 'start',
      type: 'start',
      position: { x: 150, y: 50 },
      data: { label: 'Start', nodeType: 'start' },
    },
  ];

  let yPos = 120;
  const edges: WorkflowData['edges'] = [];
  let prevNodeId = 'start';

  actions.forEach((action) => {
    const nodeId = action.id;
    nodes.push({
      id: nodeId,
      type: 'action',
      position: { x: 150, y: yPos },
      data: {
        label: action.action_type,
        nodeType: 'action',
        actionType: action.action_type,
        command: action.command,
        parameters: action.parameters,
        delay_ms: action.delay_ms,
        on_failure: action.on_failure,
        service_id: action.service_id,
      },
    });
    edges.push({
      id: `e-${prevNodeId}-${nodeId}`,
      source: prevNodeId,
      target: nodeId,
    });
    prevNodeId = nodeId;
    yPos += 80;
  });

  const endNode = {
    id: 'end',
    type: 'end',
    position: { x: 150, y: yPos },
    data: { label: 'End', nodeType: 'end' as const },
  };
  nodes.push(endNode);
  edges.push({
    id: `e-${prevNodeId}-end`,
    source: prevNodeId,
    target: 'end',
  });

  return { nodes, edges };
}

// Simple UUID generator
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const actionTypeConfig: Record<ActionType, { icon: typeof Lightbulb; color: string; bgColor: string; label: { en: string; fr: string } }> = {
  lighting: { icon: Lightbulb, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: { en: 'Lighting', fr: 'Éclairage' } },
  audio: { icon: Volume2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: { en: 'Audio', fr: 'Audio' } },
  media: { icon: Play, color: 'text-green-400', bgColor: 'bg-green-500/20', label: { en: 'Media', fr: 'Média' } },
  display: { icon: Monitor, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: { en: 'Display', fr: 'Affichage' } },
  actuator: { icon: Zap, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: { en: 'Actuator', fr: 'Actionneur' } },
};

const defaultCommands: Record<ActionType, string> = {
  lighting: 'set_color',
  audio: 'play',
  media: 'play',
  display: 'show',
  actuator: 'execute',
};

export function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLayoutStore();
  const isNew = !id || id === 'new';

  const t = {
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
    notFound: language === 'fr' ? 'Session introuvable' : 'Session not found',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    save: language === 'fr' ? 'Enregistrer' : 'Save',
    saving: language === 'fr' ? 'Enregistrement...' : 'Saving...',
    sessionName: language === 'fr' ? 'Nom de la session' : 'Session Name',
    descriptionPlaceholder: language === 'fr' ? 'Description optionnelle' : 'Optional description',
    newSession: language === 'fr' ? 'Nouvelle session' : 'New Session',
    selectNode: language === 'fr' ? 'Sélectionnez un nœud pour le modifier' : 'Select a node to edit',
    linearMode: language === 'fr' ? 'Linéaire' : 'Linear',
    nodeMode: language === 'fr' ? 'Nœuds' : 'Nodes',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    noActions: language === 'fr' ? 'Aucune action. Cliquez sur un type pour commencer.' : 'No actions. Click a type to get started.',
    properties: language === 'fr' ? 'Propriétés' : 'Properties',
    selectAction: language === 'fr' ? 'Sélectionnez une action pour la modifier' : 'Select an action to edit',
    saveError: language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Failed to save',
    scheduledAt: language === 'fr' ? 'Programmée pour' : 'Scheduled for',
    scheduledAtHelp: language === 'fr' ? 'Date et heure de déclenchement automatique' : 'Automatic trigger date and time',
    selectMovie: language === 'fr' ? 'Sélectionner le film' : 'Select Movie',
    searchMovie: language === 'fr' ? 'Rechercher un film...' : 'Search for a movie...',
    noResults: language === 'fr' ? 'Aucun résultat' : 'No results',
    movieRequired: language === 'fr' ? 'Un film est requis pour créer une session' : 'A movie is required to create a session',
    changeMovie: language === 'fr' ? 'Changer' : 'Change',
    extractingPalette: language === 'fr' ? 'Extraction de la palette...' : 'Extracting palette...',
    colorPalette: language === 'fr' ? 'Palette de couleurs' : 'Color Palette',
  };

  const [session, setSession] = useState<Session | null>(
    isNew
      ? {
          id: '',
          name: t.newSession,
          description: '',
          status: 'draft',
          scheduled_at: null,
          workflow: createDefaultWorkflow(),
        }
      : null
  );
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('linear');
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [isMovieSearchOpen, setIsMovieSearchOpen] = useState(false);
  const [isExtractingPalette, setIsExtractingPalette] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'actions' | 'properties'>('actions');

  // Fetch services
  const { data: servicesData } = useQuery<{ items: Service[] }>({
    queryKey: ['services'],
    queryFn: () => apiClient.get('/services'),
  });
  const services = servicesData?.items || [];

  // Movie search query
  const { data: movieSearchResults, isLoading: isSearchingMovies } = useQuery<Array<{
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }>>({
    queryKey: ['movie-search-session', movieSearchQuery],
    queryFn: async () => {
      if (!movieSearchQuery.trim()) return [];
      return apiClient.get(`/movies/search?query=${encodeURIComponent(movieSearchQuery)}`);
    },
    enabled: movieSearchQuery.length >= 2,
  });

  useEffect(() => {
    if (!isNew && id) {
      fetchSession(id);
    }
  }, [id, isNew]);

  // Sync actions from workflow when loading
  useEffect(() => {
    if (session?.workflow) {
      setActions(workflowToActions(session.workflow));
    }
  }, [session?.workflow]);

  const fetchSession = async (sessionId: string) => {
    try {
      const data = await apiClient.get<Session>(`/sessions/${sessionId}`);
      if (!data.workflow) {
        data.workflow = createDefaultWorkflow();
      }
      setSession(data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMovie = async (movie: {
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
  }) => {
    if (!session) return;

    // Update session with movie info
    const updatedSession = {
      ...session,
      movie_title: movie.title,
      movie_poster_url: movie.poster_url || null,
      movie_source_id: movie.source_id || movie.id,
      movie_source: movie.source,
      // Auto-set session name to movie title if creating new session with default name
      name: session.name === t.newSession ? movie.title : session.name,
    };

    setSession(updatedSession);
    setMovieSearchQuery('');
    setIsMovieSearchOpen(false);

    // Extract color palette if poster exists
    if (movie.poster_url) {
      setIsExtractingPalette(true);
      try {
        const palette = await apiClient.post<ColorPalette>(
          `/sessions/extract-palette?poster_url=${encodeURIComponent(movie.poster_url)}`,
          null
        );
        setSession(prev => prev ? { ...prev, color_palette: palette } : null);
      } catch (error) {
        console.error('Failed to extract palette:', error);
      } finally {
        setIsExtractingPalette(false);
      }
    }
  };

  const handleRemoveMovie = () => {
    if (!session) return;
    setSession({
      ...session,
      movie_title: null,
      movie_poster_url: null,
      movie_source_id: null,
      movie_source: null,
      color_palette: null,
    });
  };

  const handleSave = async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      const workflowToSave = editorMode === 'linear'
        ? actionsToWorkflow(actions)
        : session.workflow || createDefaultWorkflow();

      const payload = {
        name: session.name,
        description: session.description || null,
        scheduled_at: session.scheduled_at || null,
        movie_title: session.movie_title || null,
        movie_poster_url: session.movie_poster_url || null,
        movie_source_id: session.movie_source_id || null,
        movie_source: session.movie_source || null,
        color_palette: session.color_palette || null,
        workflow: serializeWorkflow(workflowToSave),
      };

      console.log('Saving session:', JSON.stringify(payload, null, 2));

      if (isNew) {
        const created = await apiClient.post<Session>('/sessions', payload);
        navigate(`/sessions/${created.id}`);
      } else {
        await apiClient.patch(`/sessions/${id}`, payload);
        navigate(`/sessions/${id}`);
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      alert(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkflowChange = useCallback((workflow: WorkflowData) => {
    setSession((prev) => (prev ? { ...prev, workflow } : null));
  }, []);

  const handleNodeSelect = useCallback((node: Node<WorkflowNodeData> | null) => {
    setSelectedNode(node);
  }, []);

  const handleNodeUpdate = useCallback(
    (updates: Partial<WorkflowNodeData>) => {
      if (!selectedNode || !session?.workflow) return;

      const newNodes = session.workflow.nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } } : n
      );

      const newWorkflow = { ...session.workflow, nodes: newNodes };
      setSession({ ...session, workflow: newWorkflow });

      const updatedNode = newNodes.find((n) => n.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode as Node<WorkflowNodeData>);
      }
    },
    [selectedNode, session]
  );

  const handleNodeDelete = useCallback(() => {
    if (!selectedNode || !session?.workflow) return;
    if (selectedNode.type === 'start' || selectedNode.type === 'end') return;

    const newNodes = session.workflow.nodes.filter((n) => n.id !== selectedNode.id);
    const newEdges = session.workflow.edges.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    );

    setSession({ ...session, workflow: { nodes: newNodes, edges: newEdges } });
    setSelectedNode(null);
  }, [selectedNode, session]);

  // Linear mode handlers
  const addAction = (type: ActionType) => {
    const newAction: ActionItem = {
      id: generateId(),
      action_type: type,
      command: defaultCommands[type],
      parameters: {},
      delay_ms: 0,
      on_failure: 'warn',
    };
    const newActions = [...actions, newAction];
    setActions(newActions);
    setSelectedActionIndex(newActions.length - 1);
  };

  const updateAction = (index: number, updates: Partial<ActionItem>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const deleteAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    setActions(newActions);
    setSelectedActionIndex(null);
  };

  const moveAction = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= actions.length) return;
    const newActions = [...actions];
    const [moved] = newActions.splice(fromIndex, 1);
    newActions.splice(toIndex, 0, moved);
    setActions(newActions);
    setSelectedActionIndex(toIndex);
  };

  const handleModeSwitch = (mode: EditorMode) => {
    if (mode === 'node' && editorMode === 'linear') {
      const newWorkflow = actionsToWorkflow(actions);
      setSession((prev) => (prev ? { ...prev, workflow: newWorkflow } : null));
    } else if (mode === 'linear' && editorMode === 'node' && session?.workflow) {
      setActions(workflowToActions(session.workflow));
    }
    setEditorMode(mode);
    setSelectedNode(null);
    setSelectedActionIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-muted">{t.notFound}</div>
      </div>
    );
  }

  const selectedAction = selectedActionIndex !== null ? actions[selectedActionIndex] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-7rem)]">
      {/* Header - Responsive */}
      <div className="flex flex-col gap-2 mb-3 flex-shrink-0">
        {/* Top row: Back + Name + Save */}
        <div className="flex items-center gap-2">
          <Link to={isNew ? '/sessions' : `/sessions/${id || ''}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <input
            type="text"
            value={session.name}
            onChange={(e) => setSession({ ...session, name: e.target.value })}
            className="flex-1 text-base md:text-lg font-bold bg-dark-surface border border-dark-border hover:border-dark-muted focus:border-theatarr-500 focus:outline-none focus:ring-1 focus:ring-theatarr-500 rounded-lg px-3 py-1.5 text-dark-text"
            placeholder={t.sessionName}
          />
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="flex-shrink-0">
            <Save size={14} className="md:mr-1" />
            <span className="hidden md:inline">{isSaving ? t.saving : t.save}</span>
          </Button>
        </div>

        {/* Second row: Mode toggle (hidden on mobile for linear-only) + Cancel */}
        <div className="flex items-center justify-between gap-2">
          <div className="hidden md:flex rounded-lg overflow-hidden border border-dark-border">
            <button
              onClick={() => handleModeSwitch('linear')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                editorMode === 'linear'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted hover:text-dark-text'
              }`}
            >
              <List size={14} />
              {t.linearMode}
            </button>
            <button
              onClick={() => handleModeSwitch('node')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                editorMode === 'node'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted hover:text-dark-text'
              }`}
            >
              <GitBranch size={14} />
              {t.nodeMode}
            </button>
          </div>
          <div className="flex-1 md:hidden" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(isNew ? '/sessions' : `/sessions/${id || ''}`)}
          >
            {t.cancel}
          </Button>
        </div>
      </div>

      {/* Description & Schedule - Stack on mobile */}
      <div className="mb-3 flex-shrink-0 flex flex-col md:flex-row gap-2 md:gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={session.description || ''}
            onChange={(e) => setSession({ ...session, description: e.target.value })}
            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted"
            placeholder={t.descriptionPlaceholder}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-dark-muted flex-shrink-0" />
          <input
            type="datetime-local"
            value={session.scheduled_at ? session.scheduled_at.slice(0, 16) : ''}
            onChange={(e) => setSession({ ...session, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="flex-1 md:flex-none bg-dark-surface border border-dark-border rounded px-3 py-2 text-sm text-dark-text"
            title={t.scheduledAtHelp}
          />
        </div>
      </div>

      {/* Movie Selection - Responsive */}
      <div className="mb-3 flex-shrink-0 bg-dark-surface border border-dark-border rounded-lg p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Film size={16} className="text-theatarr-500" />
            <span className="text-sm font-medium text-dark-text">{t.selectMovie}</span>
          </div>

          {session.movie_title && !isMovieSearchOpen ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {session.movie_poster_url && (
                  <img
                    src={session.movie_poster_url}
                    alt={session.movie_title}
                    className="w-10 h-14 sm:w-12 sm:h-18 object-cover rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-dark-text truncate text-sm">{session.movie_title}</div>
                  {session.movie_source && (
                    <div className="text-xs text-dark-muted">via {session.movie_source}</div>
                  )}
                  {/* Palette preview on mobile */}
                  {session.color_palette && (
                    <div className="flex items-center gap-1 mt-1 sm:hidden">
                      {[session.color_palette.primary, session.color_palette.accent, session.color_palette.vibrant].filter(Boolean).slice(0, 3).map((color, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm border border-dark-border" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isExtractingPalette && (
                  <div className="flex items-center gap-2 text-xs text-dark-muted">
                    <Spinner size="sm" />
                    <span className="hidden sm:inline">{t.extractingPalette}</span>
                  </div>
                )}
                {session.color_palette && (
                  <div className="hidden sm:flex items-center gap-1">
                    <Palette size={14} className="text-dark-muted" />
                    {[session.color_palette.primary, session.color_palette.accent, session.color_palette.vibrant].filter(Boolean).slice(0, 3).map((color, i) => (
                      <div key={i} className="w-4 h-4 rounded-sm border border-dark-border" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsMovieSearchOpen(true)}
                  className="px-2 py-1 text-xs bg-dark-bg hover:bg-dark-border text-dark-text rounded"
                >
                  {t.changeMovie}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveMovie}
                  className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="text"
                  placeholder={t.searchMovie}
                  value={movieSearchQuery}
                  onChange={(e) => { setMovieSearchQuery(e.target.value); setIsMovieSearchOpen(true); }}
                  onFocus={() => setIsMovieSearchOpen(true)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-3 py-2 text-dark-text text-sm"
                />
              </div>

              {isMovieSearchOpen && movieSearchQuery.length >= 2 && (
                <div className="absolute z-30 w-full mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {isSearchingMovies ? (
                    <div className="p-4 text-center"><Spinner size="sm" /></div>
                  ) : movieSearchResults && movieSearchResults.length > 0 ? (
                    <div className="py-1">
                      {movieSearchResults.map((movie) => (
                        <button
                          key={`${movie.source}-${movie.id}`}
                          type="button"
                          onClick={() => handleSelectMovie(movie)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-dark-border/50"
                        >
                          <div className="w-8 h-12 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                            {movie.poster_url ? (
                              <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-dark-muted" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-dark-text text-sm truncate">{movie.title}</div>
                            <div className="text-xs text-dark-muted">{movie.year} • {movie.source}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-dark-muted text-sm">{t.noResults}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Linear Mode with mobile tabs */}
      {editorMode === 'linear' ? (
        <>
          {/* Mobile Tab Switcher */}
          <div className="md:hidden flex mb-2 gap-1 flex-shrink-0">
            <button
              onClick={() => setMobilePanel('actions')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                mobilePanel === 'actions'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted'
              }`}
            >
              {t.actions} ({actions.length})
            </button>
            <button
              onClick={() => setMobilePanel('properties')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                mobilePanel === 'properties'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted'
              }`}
            >
              {t.properties}
            </button>
          </div>

          {/* Desktop: Side by side | Mobile: Tab content */}
          <div className="flex flex-1 min-h-0 gap-3">
            {/* Actions List - Hidden on mobile when properties tab is active */}
            <div className={`${mobilePanel === 'properties' ? 'hidden' : 'flex'} md:flex w-full md:w-80 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex-col flex-shrink-0`}>
              <div className="p-3 border-b border-dark-border">
                <h3 className="text-sm font-medium text-dark-text mb-2 hidden md:block">{t.actions}</h3>
                {/* Add Action Buttons */}
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(actionTypeConfig) as ActionType[]).map((type) => {
                    const config = actionTypeConfig[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => { addAction(type); setMobilePanel('properties'); }}
                        className={`px-2 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${config.bgColor} ${config.color} hover:opacity-80 transition-opacity`}
                        title={language === 'fr' ? config.label.fr : config.label.en}
                      >
                        <Icon size={12} />
                        <span className="hidden sm:inline">{language === 'fr' ? config.label.fr : config.label.en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {actions.length === 0 ? (
                  <div className="text-center text-dark-muted text-xs p-6">
                    {t.noActions}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {actions.map((action, index) => {
                      const config = actionTypeConfig[action.action_type];
                      const Icon = config.icon;
                      const isSelected = selectedActionIndex === index;

                      return (
                        <div
                          key={action.id}
                          onClick={() => { setSelectedActionIndex(index); setMobilePanel('properties'); }}
                          className={`p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-theatarr-500 bg-theatarr-500/10'
                              : 'border-transparent bg-dark-bg hover:bg-dark-bg/80'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {/* Move buttons */}
                            <div className="flex flex-col">
                              <button
                                onClick={(e) => { e.stopPropagation(); moveAction(index, 'up'); }}
                                className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-0.5"
                                disabled={index === 0}
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); moveAction(index, 'down'); }}
                                className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-0.5"
                                disabled={index === actions.length - 1}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>

                            {/* Icon */}
                            <div className={`p-1.5 rounded ${config.bgColor}`}>
                              <Icon size={14} className={config.color} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-dark-text truncate">
                                {action.command}
                              </div>
                              <div className="text-[10px] text-dark-muted truncate">
                                {language === 'fr' ? config.label.fr : config.label.en}
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteAction(index); }}
                              className="p-1 text-dark-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Action Editor Panel - Hidden on mobile when actions tab is active */}
            <div className={`${mobilePanel === 'actions' ? 'hidden' : 'flex'} md:flex flex-1 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex-col`}>
              <div className="p-3 border-b border-dark-border hidden md:block">
                <h3 className="text-sm font-medium text-dark-text">{t.properties}</h3>
              </div>
              <div className="flex-1 overflow-auto p-3 md:p-4">
                {selectedAction ? (
                  <ActionEditorPanel
                    action={selectedAction}
                    services={services}
                    onChange={(updates) => updateAction(selectedActionIndex!, updates)}
                    onDelete={() => { deleteAction(selectedActionIndex!); setMobilePanel('actions'); }}
                    colorPalette={session.color_palette}
                  />
                ) : (
                  <div className="text-center text-dark-muted text-sm py-12">
                    {t.selectAction}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Node Mode - Desktop only, force linear on mobile */
        <div className="flex flex-1 min-h-0 gap-3">
          <div className="flex-1 bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            {session.workflow && (
              <WorkflowEditor
                workflow={session.workflow}
                onChange={handleWorkflowChange}
                onNodeSelect={handleNodeSelect}
                selectedNodeId={selectedNode?.id || null}
              />
            )}
          </div>

          <div className="hidden md:flex w-72 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex-col">
            <div className="p-3 border-b border-dark-border">
              <h3 className="text-sm font-medium text-dark-text">{t.properties}</h3>
            </div>
            <div className="flex-1 overflow-auto">
              {selectedNode ? (
                <WorkflowNodeEditor
                  node={selectedNode}
                  onUpdate={handleNodeUpdate}
                  onDelete={handleNodeDelete}
                />
              ) : (
                <div className="p-4 text-sm text-dark-muted text-center">{t.selectNode}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
