import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Node } from 'reactflow';
import {
  ArrowLeft,
  Save,
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
  Vote,
  ScreenShare,
  Shuffle,
  Info,
  Users,
  Sparkles,
  Layers,
  Plus,
  GripVertical,
  ClipboardCheck,
} from 'lucide-react';
import clsx from 'clsx';
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
import { VoteModeConfig } from '../components/sessions/VoteModeConfig';
import { MysteryModeConfig } from '../components/sessions/MysteryModeConfig';
import { ParticipantsSelector } from '../components/sessions/ParticipantsSelector';
import { TemplateSelector } from '../components/sessions/TemplateSelector';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';
import type { MovieSelectionMode, MysteryConfig } from '../stores/sessionStore';

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

interface VoteSessionConfig {
  name?: string;
  description?: string;
  movie_options: Array<{
    title: string;
    year?: number;
    poster_url?: string;
    movie_id?: string;
    source?: string;
    source_id?: string;
  }>;
  max_votes_per_user: number;
  allow_multiple_votes: boolean;
  require_token: boolean;
  show_results_during_voting: boolean;
  anonymous_voting: boolean;
  opens_at?: string;
  closes_at?: string;
  open_immediately?: boolean;
  close_when_all_voted?: boolean;
}

interface LinkedVoteSession {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  total_votes: number;
  is_open: boolean;
  movie_options?: Array<{
    title: string;
    year?: number;
    poster_url?: string;
    backdrop_url?: string;
    overview?: string;
    rating?: number;
    runtime_minutes?: number;
    genres?: string[];
    directors?: string[];
    cast?: string[];
    movie_id?: string;
    source?: string;
    source_id?: string;
    vote_count?: number;
  }>;
  max_votes_per_user: number;
  allow_multiple_votes: boolean;
  require_token: boolean;
  show_results_during_voting: boolean;
  anonymous_voting: boolean;
  close_when_all_voted: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
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
  movie_genres?: string[] | null;
  color_palette?: ColorPalette | null;
  // Movie selection mode fields
  movie_selection_mode?: MovieSelectionMode;
  linked_vote_session_id?: string | null;
  linked_vote_session?: LinkedVoteSession | null;
  vote_reveal_at?: string | null;
  mystery_reveal_at?: string | null;
  mystery_config?: MysteryConfig | null;
  // Template override
  template_id?: string | null;
  // Enrichment options
  enrichment_options?: Record<string, boolean> | null;
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
type MainTab = 'general' | 'movie' | 'participants' | 'actions';

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
    .map((n, i) => ({
      id: n.id,
      action_type: n.data.actionType!,
      command: n.data.command || '',
      parameters: (n.data.parameters || {}) as Record<string, unknown>,
      delay_ms: n.data.delay_ms || 0,
      duration_ms: n.data.duration_ms || 0,
      on_failure: n.data.on_failure || 'warn',
      service_id: n.data.service_id as string | undefined,
      block_index: n.data.block_index ?? i,
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
        duration_ms: action.duration_ms,
        on_failure: action.on_failure,
        service_id: action.service_id,
        block_index: action.block_index,
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
  session: { icon: ClipboardCheck, color: 'text-teal-400', bgColor: 'bg-teal-500/20', label: { en: 'Session', fr: 'Session' } },
};

const defaultCommands: Record<ActionType, string> = {
  lighting: 'set_color',
  audio: 'play',
  media: 'play',
  display: 'show',
  actuator: 'execute',
  session: 'open_feedback',
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
    selectionMode: language === 'fr' ? 'Mode de sélection du film' : 'Movie Selection Mode',
    fixed: language === 'fr' ? 'Fixe' : 'Fixed',
    fixedDesc: language === 'fr' ? 'Film choisi directement' : 'Directly chosen movie',
    vote: language === 'fr' ? 'Vote' : 'Vote',
    voteDesc: language === 'fr' ? 'Film déterminé par vote' : 'Movie determined by vote',
    mystery: language === 'fr' ? 'Mystère' : 'Mystery',
    mysteryDesc: language === 'fr' ? 'Film révélé plus tard' : 'Movie revealed later',
    // Tab labels
    tabGeneral: language === 'fr' ? 'Général' : 'General',
    tabMovie: language === 'fr' ? 'Film' : 'Movie',
    tabUsers: language === 'fr' ? 'Utilisateurs' : 'Users',
    tabActions: language === 'fr' ? 'Actions' : 'Actions',
    // General tab
    generalInfo: language === 'fr' ? 'Informations générales' : 'General Information',
    name: language === 'fr' ? 'Nom' : 'Name',
    description: language === 'fr' ? 'Description' : 'Description',
    schedule: language === 'fr' ? 'Planification' : 'Schedule',
    // Display options
    displayOptions: language === 'fr' ? 'Options d\'affichage' : 'Display Options',
    pauseOnDisplayDisconnect: language === 'fr' ? 'Pause si display déconnecté' : 'Pause on display disconnect',
    pauseOnDisplayDisconnectHelp: language === 'fr'
      ? 'Met la session en pause automatiquement si la page d\'affichage est fermée, et reprend quand elle se reconnecte'
      : 'Automatically pauses the session if the display page is closed, and resumes when it reconnects',
    // Template
    wallmountTemplate: language === 'fr' ? 'Template Wallmount' : 'Wallmount Template',
    activeTemplateLabel: language === 'fr' ? 'Template actif (global)' : 'Active template (global)',
    noActiveTemplate: language === 'fr' ? 'Aucun template actif' : 'No active template',
    manageTemplates: language === 'fr' ? 'Gérer les templates' : 'Manage templates',
    templateHelp: language === 'fr' ? 'Par défaut, le template actif global est utilisé. Vous pouvez choisir un template spécifique pour cette session.' : 'By default, the global active template is used. You can choose a specific template for this session.',
    useGlobalTemplate: language === 'fr' ? 'Utiliser le template global actif' : 'Use global active template',
    selectTemplate: language === 'fr' ? 'Choisir un template' : 'Select template',
    customTemplate: language === 'fr' ? 'Template personnalisé' : 'Custom template',
    // Blocks
    block: language === 'fr' ? 'Bloc' : 'Block',
    parallelActions: language === 'fr' ? 'Actions parallèles' : 'Parallel actions',
    addToBlock: language === 'fr' ? 'Ajouter au bloc' : 'Add to block',
    newBlock: language === 'fr' ? 'Nouveau bloc' : 'New block',
    deleteBlock: language === 'fr' ? 'Supprimer le bloc' : 'Delete block',
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
          movie_selection_mode: 'fixed',
        }
      : null
  );

  // Main tab state
  const [activeTab, setActiveTab] = useState<MainTab>('general');

  // Vote mode config state (for inline vote session creation)
  const [voteConfig, setVoteConfig] = useState<VoteSessionConfig>({
    movie_options: [],
    max_votes_per_user: 1,
    allow_multiple_votes: false,
    require_token: true,
    show_results_during_voting: false,
    anonymous_voting: true,
    open_immediately: true, // Default to open vote immediately
    close_when_all_voted: true, // Default to close when all voted
  });

  // Mystery mode config state
  const [mysteryConfig, setMysteryConfig] = useState<MysteryConfig>({
    source: 'random',
  });
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode] = useState<EditorMode>('linear');
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [isMovieSearchOpen, setIsMovieSearchOpen] = useState(false);
  const [isExtractingPalette, setIsExtractingPalette] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'actions' | 'properties'>('actions');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [enrichmentOptions, setEnrichmentOptions] = useState<Record<string, boolean>>({ tmdb: false, fanart: false });
  const [enrichmentErrors, setEnrichmentErrors] = useState<Record<string, string>>({});
  const [enrichedSources, setEnrichedSources] = useState<string[]>([]);

  // Fetch enrichment status (which services are configured)
  const { data: enrichmentStatus } = useQuery<{
    tmdb: { available: boolean; service_id: string | null };
    fanart: { available: boolean; service_id: string | null };
  }>({
    queryKey: ['enrichment-status'],
    queryFn: () => apiClient.get('/movies/enrichment-status'),
  });

  // Fetch movie enrichment state when movie_id changes (for green badge display)
  useEffect(() => {
    if (session?.movie_id) {
      apiClient.get<{ enrichment_sources?: string[]; genres?: string[] }>(`/movies/${session.movie_id}`)
        .then((movie) => {
          const sources = movie.enrichment_sources || [];
          setEnrichedSources(sources);
          // Store genres from DB movie for auto-trailer matching
          if (movie.genres && movie.genres.length > 0 && !session.movie_genres) {
            setSession(prev => prev ? { ...prev, movie_genres: movie.genres } : prev);
          }
          // Only init enrichment options from movie if no session-level options are set
          if (!session.enrichment_options) {
            setEnrichmentOptions({
              tmdb: sources.includes('tmdb'),
              fanart: sources.includes('fanart'),
            });
          }
        })
        .catch(() => {});
    } else {
      setEnrichedSources([]);
    }
  }, [session?.movie_id]);

  // Fetch services
  const { data: servicesData } = useQuery<{ items: Service[] }>({
    queryKey: ['services'],
    queryFn: () => apiClient.get('/services'),
  });
  const services = servicesData?.items || [];

  // Fetch existing participants when editing
  const { data: existingParticipants } = useQuery<{ items: Array<{ user_id: string }> }>({
    queryKey: ['session-participants', id],
    queryFn: () => apiClient.get(`/sessions/${id}/participants`),
    enabled: !isNew && !!id,
  });

  // Load existing participants into state when data is fetched
  useEffect(() => {
    if (existingParticipants?.items) {
      setSelectedParticipantIds(existingParticipants.items.map(p => p.user_id));
    }
  }, [existingParticipants]);

  // Movie search query
  const { data: movieSearchResults, isLoading: isSearchingMovies } = useQuery<Array<{
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
    source_id?: string;
    genres?: string[];
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

  // Auto-refresh when trailers are being prepared in background
  useEffect(() => {
    if (!id || isNew || !(session?.preparing_trailers)) return;
    const interval = setInterval(() => fetchSession(id), 5000);
    return () => clearInterval(interval);
  }, [id, isNew, session?.preparing_trailers]);

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

      // Load vote config from linked vote session (for vote mode editing)
      if (data.linked_vote_session) {
        const vs = data.linked_vote_session;
        setVoteConfig({
          name: vs.name,
          description: vs.description || undefined,
          movie_options: vs.movie_options || [],
          max_votes_per_user: vs.max_votes_per_user,
          allow_multiple_votes: vs.allow_multiple_votes,
          require_token: vs.require_token,
          show_results_during_voting: vs.show_results_during_voting,
          anonymous_voting: vs.anonymous_voting,
          open_immediately: vs.is_open || vs.status === 'open',
          close_when_all_voted: vs.close_when_all_voted,
          opens_at: vs.opens_at || undefined,
          closes_at: vs.closes_at || undefined,
        });
      }

      // Load mystery config from session (for mystery mode editing)
      if (data.mystery_config) {
        setMysteryConfig(data.mystery_config);
      }

      // Load enrichment options from session (for vote/mystery deferred enrichment)
      if (data.enrichment_options) {
        setEnrichmentOptions({
          tmdb: !!data.enrichment_options.tmdb,
          fanart: !!data.enrichment_options.fanart,
        });
      }

      // Load enrichment state from movie (to show already-enriched badges)
      if (data.movie_id) {
        try {
          const movie = await apiClient.get<{ enrichment_sources?: string[] }>(`/movies/${data.movie_id}`);
          const sources = movie.enrichment_sources || [];
          setEnrichedSources(sources);
          // If no session-level options, init from movie's enriched sources
          if (!data.enrichment_options) {
            setEnrichmentOptions({
              tmdb: sources.includes('tmdb'),
              fanart: sources.includes('fanart'),
            });
          }
        } catch {
          // Movie fetch failed, keep defaults
        }
      }
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
    genres?: string[];
  }) => {
    if (!session) return;

    // Update session with movie info
    const updatedSession = {
      ...session,
      movie_title: movie.title,
      movie_poster_url: movie.poster_url || null,
      movie_source_id: movie.source_id || movie.id,
      movie_source: movie.source,
      movie_genres: movie.genres || null,
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

  const toggleEnrichment = (source: 'tmdb' | 'fanart') => {
    setEnrichmentOptions((prev) => ({ ...prev, [source]: !prev[source] }));
    setEnrichmentErrors((prev) => ({ ...prev, [source]: '' }));
  };

  const handleSave = async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      const workflowToSave = editorMode === 'linear'
        ? actionsToWorkflow(actions)
        : session.workflow || createDefaultWorkflow();

      const mode = session.movie_selection_mode || 'fixed';

      // Build enrichment_options from toggle states
      const enrichOpts: Record<string, boolean> = {};
      if (enrichmentOptions.tmdb) enrichOpts.tmdb = true;
      if (enrichmentOptions.fanart) enrichOpts.fanart = true;
      // Include palette for deferred enrichment (vote/mystery modes)
      if (mode !== 'fixed' && (enrichOpts.tmdb || enrichOpts.fanart)) {
        enrichOpts.palette = true;
      }

      const payload: Record<string, unknown> = {
        name: session.name,
        description: session.description || null,
        scheduled_at: session.scheduled_at || null,
        workflow: serializeWorkflow(workflowToSave),
        movie_selection_mode: mode,
        template_id: session.template_id || null,
        enrichment_options: Object.keys(enrichOpts).length > 0 ? enrichOpts : null,
        pause_on_display_disconnect: session.pause_on_display_disconnect || false,
      };

      // Mode-specific fields
      if (mode === 'fixed') {
        payload.movie_title = session.movie_title || null;
        payload.movie_poster_url = session.movie_poster_url || null;
        payload.movie_source_id = session.movie_source_id || null;
        payload.movie_source = session.movie_source || null;
        payload.color_palette = session.color_palette || null;
      } else if (mode === 'vote') {
        payload.vote_reveal_at = session.vote_reveal_at || null;
        if (session.linked_vote_session_id) {
          payload.linked_vote_session_id = session.linked_vote_session_id;
        }
        // Always send vote_session_config to create or update the vote session
        if (voteConfig.movie_options.length >= 2) {
          payload.vote_session_config = {
            name: voteConfig.name || session.name,
            movie_options: voteConfig.movie_options,
            max_votes_per_user: voteConfig.max_votes_per_user,
            allow_multiple_votes: voteConfig.allow_multiple_votes,
            require_token: voteConfig.require_token,
            show_results_during_voting: voteConfig.show_results_during_voting,
            anonymous_voting: voteConfig.anonymous_voting,
            open_immediately: voteConfig.open_immediately,
            close_when_all_voted: voteConfig.close_when_all_voted,
            closes_at: voteConfig.closes_at || undefined,
          };
        }
      } else if (mode === 'mystery') {
        payload.mystery_reveal_at = session.mystery_reveal_at || null;
        payload.mystery_config = mysteryConfig;
      }

      console.log('Saving session:', JSON.stringify(payload, null, 2));

      let sessionId = id;
      if (isNew) {
        const created = await apiClient.post<Session>('/sessions', payload);
        sessionId = created.id;
      } else {
        await apiClient.patch(`/sessions/${id}`, payload);
      }

      // Save participants if any selected
      if (selectedParticipantIds.length > 0 && sessionId) {
        try {
          await apiClient.post(`/sessions/${sessionId}/participants`, selectedParticipantIds);
        } catch (error) {
          console.error('Failed to add participants:', error);
        }
      }

      // Enrich movie if options toggled on and not already enriched
      if (sessionId && mode === 'fixed') {
        // Refetch session to get movie_id
        const savedSession = await apiClient.get<Session>(`/sessions/${sessionId}`);
        const movieId = savedSession.movie_id;
        if (movieId) {
          for (const source of ['tmdb', 'fanart'] as const) {
            if (enrichmentOptions[source] && !enrichedSources.includes(source)) {
              try {
                await apiClient.post(`/movies/${movieId}/enrich?sources=${source}`, {});
              } catch (error) {
                console.error(`Failed to enrich from ${source}:`, error);
              }
            }
          }
        }
      }

      navigate('/sessions');
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
  const nextBlockIndex = useMemo(() => {
    if (actions.length === 0) return 0;
    return Math.max(...actions.map(a => a.block_index)) + 1;
  }, [actions]);

  const addAction = (type: ActionType, targetBlockIndex?: number) => {
    const bi = targetBlockIndex ?? nextBlockIndex;
    // session actions are instant — default to 1s to avoid becoming MANUAL (infinite wait)
    const defaultDuration = type === 'session' ? 1000 : 0;
    const newAction: ActionItem = {
      id: generateId(),
      action_type: type,
      command: defaultCommands[type],
      parameters: {},
      delay_ms: 0,
      duration_ms: defaultDuration,
      on_failure: 'warn',
      block_index: bi,
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

  // Group actions into blocks by block_index
  const actionBlocks = useMemo(() => {
    const blocks = new Map<number, ActionItem[]>();
    for (const action of actions) {
      const bi = action.block_index ?? 0;
      if (!blocks.has(bi)) blocks.set(bi, []);
      blocks.get(bi)!.push(action);
    }
    return Array.from(blocks.entries()).sort((a, b) => a[0] - b[0]);
  }, [actions]);

  const moveBlock = (blockIndex: number, direction: 'up' | 'down') => {
    const blockOrder = actionBlocks.map(([bi]) => bi);
    const pos = blockOrder.indexOf(blockIndex);
    const targetPos = direction === 'up' ? pos - 1 : pos + 1;
    if (targetPos < 0 || targetPos >= blockOrder.length) return;
    const targetBlockIndex = blockOrder[targetPos];
    // Swap block_index values between the two blocks
    const newActions = actions.map(a => {
      if (a.block_index === blockIndex) return { ...a, block_index: targetBlockIndex };
      if (a.block_index === targetBlockIndex) return { ...a, block_index: blockIndex };
      return a;
    });
    setActions(newActions);
  };

  const deleteBlock = (blockIndex: number) => {
    const newActions = actions.filter(a => a.block_index !== blockIndex);
    setActions(newActions);
    setSelectedActionIndex(null);
  };

  const removeActionFromBlock = (actionIndex: number) => {
    // Move action to its own new block
    const newActions = [...actions];
    newActions[actionIndex] = { ...newActions[actionIndex], block_index: nextBlockIndex };
    setActions(newActions);
  };

  // Smart preset: adds a complete sequence of 4 blocks
  const addSmartActions = () => {
    const base = nextBlockIndex;
    const smartActions: ActionItem[] = [
      // ── Block 1: Accueil — display (attente ambiance) + audio + lighting ──
      {
        id: generateId(),
        action_type: 'display',
        command: 'show',
        parameters: {
          content_type: 'waiting_screen',
          template_name: 'Attente Ambiance',
          mode: 'waiting_screen',
          layout: {
            style: 'waiting-ambient',
            components: [
              { type: 'backdrop', opacity: 0.4, blur: 20 },
              { type: 'poster', position: 'left', size: 'large' },
              { type: 'title', size: 'xlarge' },
              { type: 'tagline', style: 'italic' },
              { type: 'genres', style: 'pills' },
              { type: 'metadata', fields: ['year', 'runtime', 'rating'] },
              { type: 'session_info', position: 'bottom', fields: ['name'] },
            ],
          },
          config: { theme: 'dark', use_palette_colors: true, show_genres: true, show_rating: true },
          action_duration_ms: 30000,
        },
        delay_ms: 0,
        duration_ms: 30000,
        on_failure: 'warn',
        block_index: base,
      },
      {
        id: generateId(),
        action_type: 'audio',
        command: 'play',
        parameters: { sound_id: '', fade_out_ms: 0, action_duration_ms: 30000 },
        delay_ms: 0,
        duration_ms: 30000,
        on_failure: 'warn',
        block_index: base,
      },
      {
        id: generateId(),
        action_type: 'lighting',
        command: 'set_color',
        parameters: { targets: [], color: '#09494c', transition_ms: 50, action_duration_ms: 10000 },
        delay_ms: 0,
        duration_ms: 10000,
        on_failure: 'warn',
        block_index: base,
      },

      // ── Block 2: Film partie 1 — media:play + lighting:turn_off ──
      {
        id: generateId(),
        action_type: 'media',
        command: 'play',
        parameters: {},
        delay_ms: 0,
        duration_ms: 0,
        on_failure: 'warn',
        block_index: base + 1,
      },
      {
        id: generateId(),
        action_type: 'lighting',
        command: 'turn_off',
        parameters: { targets: [], action_duration_ms: 10000 },
        delay_ms: 0,
        duration_ms: 10000,
        on_failure: 'warn',
        block_index: base + 1,
      },

      // ── Block 3: Entracte — display (entracte) + lighting:turn_on ──
      {
        id: generateId(),
        action_type: 'display',
        command: 'show',
        parameters: {
          content_type: 'waiting_screen',
          template_name: 'Entracte',
          mode: 'waiting_screen',
          layout: {
            style: 'waiting-intermission',
            components: [
              { type: 'custom_text', text: 'Entracte', position: 'center', style: 'elegant-title' },
              { type: 'session_info', position: 'bottom-center', fields: ['name'] },
            ],
          },
          config: { theme: 'elegant', show_countdown: true },
          action_duration_ms: 60000,
        },
        delay_ms: 0,
        duration_ms: 60000,
        on_failure: 'warn',
        block_index: base + 2,
      },
      {
        id: generateId(),
        action_type: 'lighting',
        command: 'turn_on',
        parameters: { color: '#d4cbc4', transition_ms: 100, action_duration_ms: 10000 },
        delay_ms: 0,
        duration_ms: 10000,
        on_failure: 'warn',
        block_index: base + 2,
      },

      // ── Block 4: Quiz / Animation — display (quiz) + audio + lighting ──
      {
        id: generateId(),
        action_type: 'display',
        command: 'show',
        parameters: {
          content_type: 'quiz',
          quiz_session_id: '',
          template_name: 'Quiz Gameshow',
          layout: {
            style: 'quiz-gameshow',
            components: [
              { type: 'quiz_header' },
              { type: 'quiz_question' },
              { type: 'quiz_choices' },
              { type: 'quiz_timer', style: 'circular' },
              { type: 'quiz_scoreboard', position: 'right', limit: 5 },
              { type: 'quiz_qrcode', position: 'bottom-right' },
              { type: 'quiz_feedback' },
              { type: 'quiz_podium' },
              { type: 'quiz_participant_count' },
              { type: 'quiz_join_message' },
            ],
          },
          config: {
            theme: 'gameshow',
            accent_color: '#f59e0b',
            secondary_color: '#8b5cf6',
            show_scoreboard_during_question: true,
            show_qr_during_waiting: true,
            show_answer_distribution: true,
            feedback_duration_seconds: 5,
            podium_animation: true,
            choice_colors: ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'],
          },
          action_duration_ms: 70000,
        },
        delay_ms: 0,
        duration_ms: 70000,
        on_failure: 'warn',
        block_index: base + 3,
      },
      {
        id: generateId(),
        action_type: 'audio',
        command: 'play',
        parameters: { sound_id: '', fade_out_ms: 50, fade_in_ms: 50, action_duration_ms: 60000 },
        delay_ms: 0,
        duration_ms: 60000,
        on_failure: 'warn',
        block_index: base + 3,
      },
      {
        id: generateId(),
        action_type: 'lighting',
        command: 'set_color',
        parameters: { targets: [], color: '#13a3af', transition_ms: 100, brightness: 26, action_duration_ms: 10000 },
        delay_ms: 0,
        duration_ms: 10000,
        on_failure: 'warn',
        block_index: base + 3,
      },

      // ── Block 5: Rappel avant reprise — display (attente ambiance) ──
      {
        id: generateId(),
        action_type: 'display',
        command: 'show',
        parameters: {
          content_type: 'waiting_screen',
          template_name: 'Attente Ambiance',
          mode: 'waiting_screen',
          layout: {
            style: 'waiting-ambient',
            components: [
              { type: 'backdrop', opacity: 0.4, blur: 20 },
              { type: 'poster', position: 'left', size: 'large' },
              { type: 'title', size: 'xlarge' },
              { type: 'tagline', style: 'italic' },
              { type: 'genres', style: 'pills' },
              { type: 'metadata', fields: ['year', 'runtime', 'rating'] },
              { type: 'session_info', position: 'bottom', fields: ['name'] },
            ],
          },
          config: { theme: 'dark', use_palette_colors: true, show_genres: true, show_rating: true },
          action_duration_ms: 20000,
        },
        delay_ms: 0,
        duration_ms: 20000,
        on_failure: 'warn',
        block_index: base + 4,
      },

      // ── Block 6: Reprise du film — media:resume + lighting:turn_off ──
      {
        id: generateId(),
        action_type: 'media',
        command: 'resume',
        parameters: {},
        delay_ms: 0,
        duration_ms: 0,
        on_failure: 'warn',
        block_index: base + 5,
      },
      {
        id: generateId(),
        action_type: 'lighting',
        command: 'turn_off',
        parameters: { targets: [], action_duration_ms: 10000 },
        delay_ms: 0,
        duration_ms: 10000,
        on_failure: 'warn',
        block_index: base + 5,
      },
    ];
    const newActions = [...actions, ...smartActions];
    setActions(newActions);
    setSelectedActionIndex(newActions.length - smartActions.length);
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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/sessions">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-dark-text">
              {isNew ? t.newSession : session.name}
            </h1>
            <p className="text-dark-muted text-sm mt-1">
              {session.description || (language === 'fr' ? 'Configurez votre session cinéma' : 'Configure your cinema session')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/sessions')}
          >
            {t.cancel}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save size={16} className="mr-1" />
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      </div>

      {/* Tabs - Same style as ConfigPage */}
      <div className="flex gap-4 mb-6 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('general')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'general'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Info size={16} className="inline mr-2" />
          {t.tabGeneral}
        </button>
        <button
          onClick={() => setActiveTab('movie')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'movie'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Film size={16} className="inline mr-2" />
          {t.tabMovie}
        </button>
        <button
          onClick={() => setActiveTab('participants')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'participants'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Users size={16} className="inline mr-2" />
          {t.tabUsers}
          {selectedParticipantIds.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-theatarr-500/20 text-theatarr-400">
              {selectedParticipantIds.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'actions'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Zap size={16} className="inline mr-2" />
          {t.tabActions}
          {actions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-theatarr-500/20 text-theatarr-400">
              {actions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Name */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <label className="text-sm font-medium text-dark-text block mb-2">{t.name}</label>
              <input
                type="text"
                value={session.name}
                onChange={(e) => setSession({ ...session, name: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted"
                placeholder={t.sessionName}
              />
            </div>

            {/* Description */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <label className="text-sm font-medium text-dark-text block mb-2">{t.description}</label>
              <textarea
                value={session.description || ''}
                onChange={(e) => setSession({ ...session, description: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted resize-none"
                placeholder={t.descriptionPlaceholder}
                rows={3}
              />
            </div>

            {/* Schedule */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <label className="text-sm font-medium text-dark-text block mb-2">{t.schedule}</label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-dark-muted flex-shrink-0" />
                <input
                  type="datetime-local"
                  value={session.scheduled_at ? session.scheduled_at.slice(0, 16) : ''}
                  onChange={(e) => setSession({ ...session, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text"
                  title={t.scheduledAtHelp}
                />
              </div>
              <p className="text-xs text-dark-muted mt-2">{t.scheduledAtHelp}</p>
            </div>

            {/* Display Options */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <label className="text-sm font-medium text-dark-text flex items-center gap-2 mb-3">
                <ScreenShare size={16} className="text-theatarr-500" />
                {t.displayOptions}
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={session.pause_on_display_disconnect || false}
                  onChange={(e) => setSession({ ...session, pause_on_display_disconnect: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-dark-border bg-dark-bg text-theatarr-500 focus:ring-theatarr-500 focus:ring-offset-0"
                />
                <div>
                  <span className="text-sm text-dark-text">{t.pauseOnDisplayDisconnect}</span>
                  <p className="text-xs text-dark-muted mt-0.5">{t.pauseOnDisplayDisconnectHelp}</p>
                </div>
              </label>
            </div>

            {/* Wallmount Template */}
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-dark-text flex items-center gap-2">
                  <Monitor size={16} className="text-theatarr-500" />
                  {t.wallmountTemplate}
                </label>
                <Link
                  to="/templates"
                  className="text-xs text-theatarr-400 hover:text-theatarr-300 transition-colors"
                >
                  {t.manageTemplates}
                </Link>
              </div>

              <TemplateSelector
                selectedTemplateId={session.template_id || null}
                onChange={(templateId) => setSession({ ...session, template_id: templateId })}
              />
            </div>
          </div>
        )}

        {/* MOVIE TAB */}
        {activeTab === 'movie' && (
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            {/* Mode Selector */}
            <div className="mb-4">
              <label className="text-sm font-medium text-dark-text mb-2 block">{t.selectionMode}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSession({ ...session, movie_selection_mode: 'fixed' })}
                  className={clsx(
                    'p-3 rounded-lg border text-center transition-colors',
                    session.movie_selection_mode === 'fixed' || !session.movie_selection_mode
                      ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                      : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
                  )}
                >
                  <Film size={20} className="mx-auto mb-1" />
                  <div className="text-sm font-medium">{t.fixed}</div>
                  <div className="text-xs opacity-70 hidden sm:block">{t.fixedDesc}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSession({ ...session, movie_selection_mode: 'vote' })}
                  className={clsx(
                    'p-3 rounded-lg border text-center transition-colors',
                    session.movie_selection_mode === 'vote'
                      ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                      : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
                  )}
                >
                  <Vote size={20} className="mx-auto mb-1" />
                  <div className="text-sm font-medium">{t.vote}</div>
                  <div className="text-xs opacity-70 hidden sm:block">{t.voteDesc}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSession({ ...session, movie_selection_mode: 'mystery' })}
                  className={clsx(
                    'p-3 rounded-lg border text-center transition-colors',
                    session.movie_selection_mode === 'mystery'
                      ? 'bg-theatarr-500/20 border-theatarr-500 text-theatarr-400'
                      : 'border-dark-border text-dark-muted hover:text-dark-text hover:border-dark-muted'
                  )}
                >
                  <Shuffle size={20} className="mx-auto mb-1" />
                  <div className="text-sm font-medium">{t.mystery}</div>
                  <div className="text-xs opacity-70 hidden sm:block">{t.mysteryDesc}</div>
                </button>
              </div>
            </div>

            {/* FIXED Mode - Direct Movie Selection */}
            {(session.movie_selection_mode === 'fixed' || !session.movie_selection_mode) && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
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
                          className="w-12 h-18 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-dark-text truncate">{session.movie_title}</div>
                        {session.movie_source && (
                          <div className="text-xs text-dark-muted">via {session.movie_source}</div>
                        )}
                        {/* Palette preview */}
                        {session.color_palette && (
                          <div className="flex items-center gap-1 mt-2">
                            <Palette size={14} className="text-dark-muted" />
                            {[session.color_palette.primary, session.color_palette.accent, session.color_palette.vibrant].filter(Boolean).slice(0, 5).map((color, i) => (
                              <div key={i} className="w-5 h-5 rounded border border-dark-border" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExtractingPalette && (
                        <div className="flex items-center gap-2 text-xs text-dark-muted">
                          <Spinner size="sm" />
                          <span>{t.extractingPalette}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsMovieSearchOpen(true)}
                        className="px-3 py-1.5 text-sm bg-dark-bg hover:bg-dark-border text-dark-text rounded-lg"
                      >
                        {t.changeMovie}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveMovie}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                      >
                        <X size={14} />
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
                                <div className="w-10 h-14 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                                  {movie.poster_url ? (
                                    <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center"><Film size={14} className="text-dark-muted" /></div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-dark-text truncate">{movie.title}</div>
                                  <div className="text-xs text-dark-muted">{movie.year} - {movie.source}</div>
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
            )}

            {/* VOTE Mode - Vote Configuration */}
            {session.movie_selection_mode === 'vote' && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <VoteModeConfig
                  sessionName={session.name}
                  config={voteConfig}
                  onChange={setVoteConfig}
                  linkedVoteSessionId={session.linked_vote_session_id || undefined}
                  onLinkVoteSession={(id) => setSession({ ...session, linked_vote_session_id: id })}
                  revealAt={session.vote_reveal_at || undefined}
                  onRevealAtChange={(revealAt) => setSession({ ...session, vote_reveal_at: revealAt })}
                />
              </div>
            )}

            {/* MYSTERY Mode - Mystery Configuration */}
            {session.movie_selection_mode === 'mystery' && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <MysteryModeConfig
                  config={mysteryConfig}
                  onChange={setMysteryConfig}
                  revealAt={session.mystery_reveal_at || undefined}
                  onRevealAtChange={(revealAt) => setSession({ ...session, mystery_reveal_at: revealAt })}
                />
              </div>
            )}

            {/* Common Enrichment Options - visible for all modes */}
            {(enrichmentStatus?.tmdb?.available || enrichmentStatus?.fanart?.available) && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-theatarr-500" />
                  <span className="text-sm font-medium text-dark-text">
                    {language === 'fr' ? "Options d'enrichissement" : 'Enrichment Options'}
                  </span>
                </div>
                <p className="text-xs text-dark-muted mb-3">
                  {session.movie_selection_mode === 'vote'
                    ? (language === 'fr'
                      ? "L'enrichissement sera appliqué automatiquement quand le film sera voté."
                      : 'Enrichment will be applied automatically when the movie is voted.')
                    : session.movie_selection_mode === 'mystery'
                      ? (language === 'fr'
                        ? "L'enrichissement sera appliqué automatiquement quand le film sera révélé."
                        : 'Enrichment will be applied automatically when the movie is revealed.')
                      : (language === 'fr'
                        ? "L'enrichissement sera appliqué à la sauvegarde."
                        : 'Enrichment will be applied on save.')}
                </p>
                <div className="flex items-center gap-3">
                  {(['tmdb', 'fanart'] as const).map((source) => {
                    const available = enrichmentStatus?.[source]?.available ?? false;
                    const isEnabled = enrichmentOptions[source] ?? false;
                    const isEnriched = enrichedSources.includes(source);
                    const error = enrichmentErrors[source];
                    const label = source === 'tmdb' ? 'TMDB' : 'Fanart.tv';
                    const tooltip = !available
                      ? (language === 'fr' ? `${label} non configuré` : `${label} not configured`)
                      : isEnriched && isEnabled
                        ? (language === 'fr' ? `Déjà enrichi via ${label}` : `Already enriched from ${label}`)
                        : isEnabled
                          ? (language === 'fr' ? `${label} activé` : `${label} enabled`)
                          : (language === 'fr' ? `Activer l'enrichissement ${label}` : `Enable ${label} enrichment`);

                    return (
                      <button
                        key={source}
                        type="button"
                        disabled={!available}
                        title={tooltip}
                        onClick={() => toggleEnrichment(source)}
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                          !available && 'opacity-40 cursor-not-allowed bg-dark-border/50 text-dark-muted',
                          isEnabled && isEnriched && 'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25',
                          isEnabled && !isEnriched && 'bg-theatarr-500/20 text-theatarr-400 border border-theatarr-500/30 hover:bg-theatarr-500/30',
                          available && !isEnabled && 'bg-dark-bg hover:bg-dark-border text-dark-muted border border-dark-border hover:border-dark-muted',
                          error && 'bg-red-500/20 text-red-400 border border-red-500/30',
                        )}
                      >
                        {isEnabled ? (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                        ) : source === 'tmdb' ? (
                          <svg viewBox="0 0 20 20" className="w-3.5 h-3.5"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2"/><text x="10" y="14" textAnchor="middle" fontSize="8" fill="currentColor">T</text></svg>
                        ) : (
                          <svg viewBox="0 0 20 20" className="w-3.5 h-3.5"><rect x="2" y="2" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/><text x="10" y="14" textAnchor="middle" fontSize="7" fill="currentColor">F</text></svg>
                        )}
                        {label}
                        {error && <span className="text-red-400 ml-0.5">!</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PARTICIPANTS TAB */}
        {activeTab === 'participants' && (
          <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
            <ParticipantsSelector
              selectedUserIds={selectedParticipantIds}
              onChange={setSelectedParticipantIds}
            />
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === 'actions' && (
          <div className="flex flex-col h-full">
            {/* Mobile panel switcher */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
              {/* Mobile tab switcher for actions/properties */}
              <div className="md:hidden flex flex-1 gap-1">
                <button
                  onClick={() => setMobilePanel('actions')}
                  className={clsx(
                    'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors',
                    mobilePanel === 'actions'
                      ? 'bg-theatarr-500 text-white'
                      : 'bg-dark-surface text-dark-muted'
                  )}
                >
                  {t.actions} ({actions.length})
                </button>
                <button
                  onClick={() => setMobilePanel('properties')}
                  className={clsx(
                    'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors',
                    mobilePanel === 'properties'
                      ? 'bg-theatarr-500 text-white'
                      : 'bg-dark-surface text-dark-muted'
                  )}
                >
                  {t.properties}
                </button>
              </div>
            </div>

            {/* Linear Mode Content */}
            {editorMode === 'linear' ? (
              <div className="flex flex-1 min-h-0 gap-3">
                {/* Actions List */}
                <div className={clsx(
                  'w-full md:w-80 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex-col flex-shrink-0',
                  mobilePanel === 'properties' ? 'hidden md:flex' : 'flex'
                )}>
                  <div className="p-3 border-b border-dark-border">
                    <h3 className="text-sm font-medium text-dark-text mb-2 hidden md:block">{t.actions}</h3>
                    {/* Add Action Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(actionTypeConfig) as ActionType[]).map((type) => {
                        const config = actionTypeConfig[type];
                        const Icon = config.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => { addAction(type); setMobilePanel('properties'); }}
                            className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${config.bgColor} ${config.color} hover:opacity-80 transition-opacity border ${config.color.replace('text-', 'border-').replace('400', '500/30')}`}
                            title={language === 'fr' ? config.label.fr : config.label.en}
                          >
                            <Icon size={16} />
                            {language === 'fr' ? config.label.fr : config.label.en}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => { addSmartActions(); setMobilePanel('properties'); }}
                        className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 hover:opacity-80 transition-opacity border border-amber-500/30"
                        title={language === 'fr' ? 'Preset Smart : séance complète' : 'Smart preset: complete session'}
                      >
                        <Sparkles size={16} />
                        Smart
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto">
                    {actions.length === 0 ? (
                      <div className="text-center text-dark-muted text-xs p-6">
                        {t.noActions}
                      </div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {actionBlocks.map(([blockIndex, blockActions], blockPos) => {
                          const isParallel = blockActions.length > 1;
                          return (
                            <div key={blockIndex} className="border border-dark-border rounded-lg bg-dark-bg/40">
                              {/* Block header */}
                              <div className="flex items-center gap-1.5 px-2 py-2 border-b border-dark-border/50">
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => moveBlock(blockIndex, 'up')}
                                    className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-1"
                                    disabled={blockPos === 0}
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveBlock(blockIndex, 'down')}
                                    className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-1"
                                    disabled={blockPos === actionBlocks.length - 1}
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                </div>
                                <GripVertical size={14} className="text-dark-muted/50" />
                                <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
                                  {t.block} {blockPos + 1}
                                </span>
                                {isParallel && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-theatarr-400 bg-theatarr-500/10 px-1.5 py-0.5 rounded">
                                    <Layers size={9} />
                                    {blockActions.length}x
                                  </span>
                                )}
                                <div className="flex-1" />
                                {/* Add action to this block - dropdown */}
                                <div className="relative group">
                                  <button
                                    className="p-1.5 text-dark-muted hover:text-theatarr-400 transition-colors rounded hover:bg-dark-bg/60"
                                    title={t.addToBlock}
                                  >
                                    <Plus size={16} />
                                  </button>
                                  <div className="hidden group-hover:block absolute right-0 top-full z-10 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-lg p-1.5 min-w-[150px]">
                                    {(Object.keys(actionTypeConfig) as ActionType[]).map((type) => {
                                      const cfg = actionTypeConfig[type];
                                      const TypeIcon = cfg.icon;
                                      return (
                                        <button
                                          key={type}
                                          onClick={() => { addAction(type, blockIndex); setMobilePanel('properties'); }}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-dark-text hover:bg-dark-bg rounded transition-colors"
                                        >
                                          <TypeIcon size={14} className={cfg.color} />
                                          {language === 'fr' ? cfg.label.fr : cfg.label.en}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <button
                                  onClick={() => deleteBlock(blockIndex)}
                                  className="p-1.5 text-dark-muted hover:text-red-400 transition-colors rounded hover:bg-dark-bg/60"
                                  title={t.deleteBlock}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Block actions */}
                              <div className="p-1.5 space-y-1">
                                {blockActions.map((action) => {
                                  const globalIndex = actions.indexOf(action);
                                  const config = actionTypeConfig[action.action_type];
                                  const Icon = config.icon;
                                  const isSelected = selectedActionIndex === globalIndex;

                                  return (
                                    <div
                                      key={action.id}
                                      onClick={() => { setSelectedActionIndex(globalIndex); setMobilePanel('properties'); }}
                                      className={clsx(
                                        'p-2 rounded-lg border cursor-pointer transition-all',
                                        isSelected
                                          ? 'border-theatarr-500 bg-theatarr-500/10'
                                          : 'border-transparent hover:bg-dark-bg/60'
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                                          <Icon size={16} className={config.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-dark-text truncate">
                                            {action.command}
                                          </div>
                                          <div className="text-xs text-dark-muted truncate">
                                            {language === 'fr' ? config.label.fr : config.label.en}
                                          </div>
                                        </div>
                                        {isParallel && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); removeActionFromBlock(globalIndex); }}
                                            className="p-1.5 text-dark-muted hover:text-amber-400 transition-colors rounded hover:bg-dark-bg/60"
                                            title={language === 'fr' ? 'Extraire du bloc' : 'Extract from block'}
                                          >
                                            <Layers size={14} />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteAction(globalIndex); }}
                                          className="p-1.5 text-dark-muted hover:text-red-400 transition-colors rounded hover:bg-dark-bg/60"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add new block button */}
                        <button
                          onClick={() => addAction('display')}
                          className="w-full py-3 px-4 border border-dashed border-dark-border rounded-lg text-dark-muted text-sm hover:border-theatarr-500/50 hover:text-theatarr-400 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          {t.newBlock}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Editor Panel */}
                <div className={clsx(
                  'flex-1 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex-col',
                  mobilePanel === 'actions' ? 'hidden md:flex' : 'flex'
                )}>
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
                        sessionId={id}
                        movieId={session.movie_id}
                        movieSourceId={session.movie_source_id}
                        movieGenres={session.movie_genres}
                        allActions={actions}
                      />
                    ) : (
                      <div className="text-center text-dark-muted text-sm py-12">
                        {t.selectAction}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Node Mode */
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
        )}
      </div>
    </div>
  );
}
