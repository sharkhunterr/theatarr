/**
 * Action Editor Panel - Detailed editor for session actions
 * with service integration for fetching resources (lights, movies, etc.)
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Film, Lightbulb, Volume2, Monitor, Zap, X, RefreshCw } from 'lucide-react';
import { Spinner } from '../common';
import { apiClient } from '../../api/client';
import { useLayoutStore } from '../../stores/layoutStore';

// Types
export type ActionType = 'lighting' | 'audio' | 'display' | 'media' | 'actuator';

export interface ActionItem {
  id: string;
  action_type: ActionType;
  command: string;
  parameters: Record<string, unknown>;
  delay_ms: number;
  on_failure: 'warn' | 'skip' | 'abort';
  service_id?: string;
}

interface Service {
  id: string;
  name: string;
  adapter_type: string;
  category: string;
  is_enabled: boolean;
  connection_status: string;
}

interface ServiceResources {
  service_id: string;
  service_name: string;
  category: string;
  items: Array<{ id: string; name: string; [key: string]: unknown }>;
  scenes?: Array<{ id: string; name: string }>;
  libraries?: Array<{ id: string; title: string; type: string }>;
  error?: string;
}

interface ActionEditorPanelProps {
  action: ActionItem;
  services: Service[];
  onChange: (updates: Partial<ActionItem>) => void;
  onDelete: () => void;
}

// Action type configurations
const actionTypeConfig: Record<ActionType, {
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
  label: { en: string; fr: string };
  category: string;
}> = {
  lighting: { icon: Lightbulb, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: { en: 'Lighting', fr: 'Éclairage' }, category: 'lighting' },
  audio: { icon: Volume2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: { en: 'Audio', fr: 'Audio' }, category: 'player' },
  media: { icon: Film, color: 'text-green-400', bgColor: 'bg-green-500/20', label: { en: 'Media', fr: 'Média' }, category: 'media_source' },
  display: { icon: Monitor, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: { en: 'Display', fr: 'Affichage' }, category: 'player' },
  actuator: { icon: Zap, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: { en: 'Actuator', fr: 'Actionneur' }, category: 'actuator' },
};

export function ActionEditorPanel({ action, services, onChange, onDelete }: ActionEditorPanelProps) {
  const { language } = useLayoutStore();
  const config = actionTypeConfig[action.action_type];
  const Icon = config.icon;

  const t = {
    service: language === 'fr' ? 'Service' : 'Service',
    noService: language === 'fr' ? 'Aucun (manuel)' : 'None (manual)',
    delay: language === 'fr' ? 'Délai avant exécution (ms)' : 'Delay before execution (ms)',
    onFailure: language === 'fr' ? 'En cas d\'échec' : 'On Failure',
    warn: language === 'fr' ? 'Avertir et continuer' : 'Warn and continue',
    skip: language === 'fr' ? 'Ignorer' : 'Skip silently',
    abort: language === 'fr' ? 'Interrompre la session' : 'Abort session',
    deleteAction: language === 'fr' ? 'Supprimer l\'action' : 'Delete Action',
    actionSettings: language === 'fr' ? 'Paramètres de l\'action' : 'Action Settings',
  };

  // Filter services by action type category
  const availableServices = services.filter(s => {
    if (action.action_type === 'media') return s.category === 'media_source';
    if (action.action_type === 'lighting') return s.category === 'lighting';
    if (action.action_type === 'audio' || action.action_type === 'display') return s.category === 'player';
    if (action.action_type === 'actuator') return s.category === 'actuator';
    return false;
  }).filter(s => s.is_enabled);

  return (
    <div className="space-y-6">
      {/* Action Type Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-dark-border">
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon size={20} className={config.color} />
        </div>
        <div>
          <div className="font-medium text-dark-text">
            {language === 'fr' ? config.label.fr : config.label.en}
          </div>
          <div className="text-xs text-dark-muted">{action.command}</div>
        </div>
      </div>

      {/* Service Selection */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.service}</label>
        <select
          value={action.service_id || ''}
          onChange={(e) => onChange({ service_id: e.target.value || undefined })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          <option value="">{t.noService}</option>
          {availableServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} ({service.adapter_type})
            </option>
          ))}
        </select>
      </div>

      {/* Type-specific Form */}
      <div className="border-t border-dark-border pt-4">
        {action.action_type === 'lighting' && (
          <LightingForm
            action={action}
            onChange={onChange}
            language={language}
          />
        )}
        {action.action_type === 'audio' && (
          <AudioForm
            action={action}
            onChange={onChange}
            language={language}
          />
        )}
        {action.action_type === 'media' && (
          <MediaForm
            action={action}
            onChange={onChange}
            language={language}
          />
        )}
        {action.action_type === 'display' && (
          <DisplayForm
            action={action}
            onChange={onChange}
            language={language}
          />
        )}
        {action.action_type === 'actuator' && (
          <ActuatorForm
            action={action}
            onChange={onChange}
            language={language}
          />
        )}
      </div>

      {/* Common Settings */}
      <div className="border-t border-dark-border pt-4 space-y-4">
        <h4 className="text-sm font-medium text-dark-text">{t.actionSettings}</h4>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.delay}</label>
          <input
            type="number"
            value={action.delay_ms}
            onChange={(e) => onChange({ delay_ms: parseInt(e.target.value) || 0 })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.onFailure}</label>
          <select
            value={action.on_failure}
            onChange={(e) => onChange({ on_failure: e.target.value as 'warn' | 'skip' | 'abort' })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            <option value="warn">{t.warn}</option>
            <option value="skip">{t.skip}</option>
            <option value="abort">{t.abort}</option>
          </select>
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <X size={16} />
          {t.deleteAction}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// LIGHTING FORM
// ============================================================================
function LightingForm({
  action,
  onChange,
  language,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
}) {
  const { parameters, command, service_id } = action;

  // Fetch lights from service if selected
  const { data: resources, isLoading, refetch } = useQuery<ServiceResources>({
    queryKey: ['service-resources', service_id],
    queryFn: async () => {
      if (!service_id) return { service_id: '', service_name: '', category: '', items: [] };
      return apiClient.get<ServiceResources>(`/services/${service_id}/resources`);
    },
    enabled: !!service_id,
  });

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    targetLights: language === 'fr' ? 'Lumières cibles' : 'Target Lights',
    allLights: language === 'fr' ? 'Toutes les lumières' : 'All lights',
    color: language === 'fr' ? 'Couleur' : 'Color',
    brightness: language === 'fr' ? 'Luminosité' : 'Brightness',
    transition: language === 'fr' ? 'Transition (ms)' : 'Transition (ms)',
    scene: language === 'fr' ? 'Scène' : 'Scene',
    noLights: language === 'fr' ? 'Aucune lumière disponible' : 'No lights available',
    refresh: language === 'fr' ? 'Actualiser' : 'Refresh',
  };

  const commands = [
    { value: 'turn_on', label: language === 'fr' ? 'Allumer' : 'Turn On' },
    { value: 'turn_off', label: language === 'fr' ? 'Éteindre' : 'Turn Off' },
    { value: 'toggle', label: 'Toggle' },
    { value: 'set_color', label: language === 'fr' ? 'Définir couleur' : 'Set Color' },
    { value: 'set_brightness', label: language === 'fr' ? 'Définir luminosité' : 'Set Brightness' },
    { value: 'set_scene', label: language === 'fr' ? 'Activer scène' : 'Activate Scene' },
  ];

  const lights = resources?.items || [];
  const scenes = resources?.scenes || [];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      {/* Command */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.command}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {commands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>{cmd.label}</option>
          ))}
        </select>
      </div>

      {/* Target Lights */}
      {service_id && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-dark-text">{t.targetLights}</label>
            <button
              onClick={() => refetch()}
              className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {t.refresh}
            </button>
          </div>
          {isLoading ? (
            <div className="p-3 text-center"><Spinner size="sm" /></div>
          ) : lights.length > 0 ? (
            <select
              value={(parameters.target as string) || 'all'}
              onChange={(e) => handleParametersChange({ target: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="all">{t.allLights}</option>
              {lights.map((light) => (
                <option key={light.id} value={light.id}>{light.name}</option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-dark-muted p-2 bg-dark-bg rounded-lg">{t.noLights}</div>
          )}
        </div>
      )}

      {/* Color (for set_color) */}
      {(command === 'set_color' || command === 'turn_on') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.color}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(parameters.color as string) || '#ffffff'}
                onChange={(e) => handleParametersChange({ color: e.target.value })}
                className="w-10 h-10 rounded border border-dark-border cursor-pointer"
              />
              <input
                type="text"
                value={(parameters.color as string) || '#ffffff'}
                onChange={(e) => handleParametersChange({ color: e.target.value })}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.transition}</label>
            <input
              type="number"
              value={(parameters.transition_ms as number) || 0}
              onChange={(e) => handleParametersChange({ transition_ms: parseInt(e.target.value) || 0 })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

      {/* Brightness */}
      {(command === 'set_brightness' || command === 'set_color' || command === 'turn_on') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t.brightness} ({(parameters.brightness as number) || 100}%)
          </label>
          <input
            type="range"
            value={(parameters.brightness as number) || 100}
            onChange={(e) => handleParametersChange({ brightness: parseInt(e.target.value) })}
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      {/* Scene */}
      {command === 'set_scene' && service_id && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.scene}</label>
          {scenes.length > 0 ? (
            <select
              value={(parameters.scene as string) || ''}
              onChange={(e) => handleParametersChange({ scene: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="">--</option>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{scene.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={(parameters.scene as string) || ''}
              onChange={(e) => handleParametersChange({ scene: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              placeholder="scene_name"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUDIO FORM
// ============================================================================
function AudioForm({
  action,
  onChange,
  language,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
}) {
  const { parameters, command } = action;

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    source: language === 'fr' ? 'Source audio' : 'Audio Source',
    volume: language === 'fr' ? 'Volume' : 'Volume',
    fadeDuration: language === 'fr' ? 'Durée du fondu (ms)' : 'Fade Duration (ms)',
    device: language === 'fr' ? 'Appareil cible' : 'Target Device',
  };

  const commands = [
    { value: 'play', label: language === 'fr' ? 'Lecture' : 'Play' },
    { value: 'pause', label: 'Pause' },
    { value: 'stop', label: language === 'fr' ? 'Arrêter' : 'Stop' },
    { value: 'set_volume', label: language === 'fr' ? 'Régler volume' : 'Set Volume' },
    { value: 'mute', label: language === 'fr' ? 'Couper le son' : 'Mute' },
    { value: 'unmute', label: language === 'fr' ? 'Activer le son' : 'Unmute' },
  ];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.command}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {commands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>{cmd.label}</option>
          ))}
        </select>
      </div>

      {command === 'play' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.source}</label>
          <input
            type="text"
            value={(parameters.source as string) || ''}
            onChange={(e) => handleParametersChange({ source: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            placeholder="file path, URL, or source name"
          />
        </div>
      )}

      {(command === 'set_volume' || command === 'play') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t.volume} ({(parameters.volume as number) ?? 50}%)
          </label>
          <input
            type="range"
            value={(parameters.volume as number) ?? 50}
            onChange={(e) => handleParametersChange({ volume: parseInt(e.target.value) })}
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      {(command === 'set_volume' || command === 'play' || command === 'stop') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.fadeDuration}</label>
          <input
            type="number"
            value={(parameters.fade_ms as number) || 0}
            onChange={(e) => handleParametersChange({ fade_ms: parseInt(e.target.value) || 0 })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="100"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.device}</label>
        <input
          type="text"
          value={(parameters.device as string) || ''}
          onChange={(e) => handleParametersChange({ device: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          placeholder="receiver, soundbar..."
        />
      </div>
    </div>
  );
}

// ============================================================================
// MEDIA FORM
// ============================================================================
function MediaForm({
  action,
  onChange,
  language,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
}) {
  const { parameters, command, service_id } = action;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    selectMovie: language === 'fr' ? 'Sélectionner un film' : 'Select a movie',
    searchPlaceholder: language === 'fr' ? 'Rechercher un film...' : 'Search for a movie...',
    noResults: language === 'fr' ? 'Aucun film trouvé' : 'No movies found',
    selectedMovie: language === 'fr' ? 'Film sélectionné' : 'Selected Movie',
    change: language === 'fr' ? 'Changer' : 'Change',
    remove: language === 'fr' ? 'Retirer' : 'Remove',
    startPosition: language === 'fr' ? 'Position de départ (ms)' : 'Start Position (ms)',
    subtitles: language === 'fr' ? 'Activer les sous-titres' : 'Enable subtitles',
    noService: language === 'fr' ? 'Sélectionnez un service média pour rechercher des films' : 'Select a media service to search for movies',
  };

  const commands = [
    { value: 'play', label: language === 'fr' ? 'Lecture' : 'Play' },
    { value: 'pause', label: 'Pause' },
    { value: 'stop', label: language === 'fr' ? 'Arrêter' : 'Stop' },
    { value: 'resume', label: language === 'fr' ? 'Reprendre' : 'Resume' },
  ];

  // Search movies
  const { data: searchResults, isLoading: isSearchLoading } = useQuery<Array<{
    id: string;
    title: string;
    year?: number;
    poster_url?: string;
    source: string;
  }>>({
    queryKey: ['movie-search', searchQuery, service_id],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const url = service_id
        ? `/movies/search?query=${encodeURIComponent(searchQuery)}&source=${service_id}`
        : `/movies/search?query=${encodeURIComponent(searchQuery)}`;
      return apiClient.get(url);
    },
    enabled: searchQuery.length >= 2,
  });

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  const handleSelectMovie = (movie: { id: string; title: string; year?: number; poster_url?: string }) => {
    handleParametersChange({
      media_id: movie.id,
      movie_title: movie.title,
      movie_year: movie.year,
      movie_poster: movie.poster_url,
    });
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleRemoveMovie = () => {
    const newParams = { ...parameters };
    delete newParams.media_id;
    delete newParams.movie_title;
    delete newParams.movie_year;
    delete newParams.movie_poster;
    onChange({ parameters: newParams });
  };

  const selectedMovie = parameters.media_id ? {
    id: parameters.media_id as string,
    title: parameters.movie_title as string,
    year: parameters.movie_year as number | undefined,
    poster_url: parameters.movie_poster as string | undefined,
  } : null;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.command}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {commands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>{cmd.label}</option>
          ))}
        </select>
      </div>

      {command === 'play' && (
        <>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">{t.selectMovie}</label>

            {!service_id ? (
              <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t.noService}</div>
            ) : selectedMovie && !isSearchOpen ? (
              <div className="flex items-center gap-3 p-3 bg-dark-bg border border-dark-border rounded-lg">
                <div className="w-10 h-14 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                  {selectedMovie.poster_url ? (
                    <img src={selectedMovie.poster_url} alt={selectedMovie.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Film size={16} className="text-dark-muted" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-dark-text text-sm truncate">{selectedMovie.title}</div>
                  {selectedMovie.year && <div className="text-xs text-dark-muted">{selectedMovie.year}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className="px-2 py-1 text-xs bg-dark-border hover:bg-dark-muted/30 text-dark-text rounded"
                  >
                    {t.change}
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
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                    onFocus={() => setIsSearchOpen(true)}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-3 py-2 text-dark-text"
                  />
                </div>

                {isSearchOpen && searchQuery.length >= 2 && (
                  <div className="absolute z-30 w-full mt-2 bg-dark-surface border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {isSearchLoading ? (
                      <div className="p-4 text-center"><Spinner size="sm" /></div>
                    ) : searchResults && searchResults.length > 0 ? (
                      <div className="py-1">
                        {searchResults.map((movie) => (
                          <button
                            key={movie.id}
                            type="button"
                            onClick={() => handleSelectMovie(movie)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-dark-border/50"
                          >
                            <div className="w-6 h-9 bg-dark-border rounded flex-shrink-0 overflow-hidden">
                              {movie.poster_url ? (
                                <img src={movie.poster_url} alt={movie.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Film size={10} className="text-dark-muted" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-dark-text text-sm truncate">{movie.title}</div>
                              <div className="text-xs text-dark-muted">{movie.year}</div>
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

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.startPosition}</label>
            <input
              type="number"
              value={(parameters.position_ms as number) || 0}
              onChange={(e) => handleParametersChange({ position_ms: parseInt(e.target.value) || 0 })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="1000"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="subtitles"
              checked={(parameters.subtitles as boolean) || false}
              onChange={(e) => handleParametersChange({ subtitles: e.target.checked })}
              className="w-4 h-4 accent-theatarr-500"
            />
            <label htmlFor="subtitles" className="text-sm text-dark-text">{t.subtitles}</label>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// DISPLAY FORM
// ============================================================================
function DisplayForm({
  action,
  onChange,
  language,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
}) {
  const { parameters, command } = action;

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    inputSource: language === 'fr' ? 'Source d\'entrée' : 'Input Source',
    displayMode: language === 'fr' ? 'Mode d\'affichage' : 'Display Mode',
    contentType: language === 'fr' ? 'Type de contenu' : 'Content Type',
    textContent: language === 'fr' ? 'Contenu texte' : 'Text Content',
    imageUrl: language === 'fr' ? 'URL de l\'image' : 'Image URL',
    duration: language === 'fr' ? 'Durée d\'affichage (ms)' : 'Display Duration (ms)',
  };

  const commands = [
    { value: 'power_on', label: language === 'fr' ? 'Allumer' : 'Power On' },
    { value: 'power_off', label: language === 'fr' ? 'Éteindre' : 'Power Off' },
    { value: 'set_input', label: language === 'fr' ? 'Changer source' : 'Set Input' },
    { value: 'set_mode', label: language === 'fr' ? 'Changer mode' : 'Set Mode' },
    { value: 'show', label: language === 'fr' ? 'Afficher contenu' : 'Show Content' },
    { value: 'hide', label: language === 'fr' ? 'Masquer' : 'Hide' },
  ];

  const inputSources = ['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'Component', 'USB'];
  const displayModes = ['Movie', 'Game', 'Sport', 'Standard', 'Vivid'];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.command}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {commands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>{cmd.label}</option>
          ))}
        </select>
      </div>

      {command === 'set_input' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.inputSource}</label>
          <select
            value={(parameters.input as string) || 'HDMI 1'}
            onChange={(e) => handleParametersChange({ input: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            {inputSources.map((src) => (
              <option key={src} value={src.toLowerCase().replace(' ', '')}>{src}</option>
            ))}
          </select>
        </div>
      )}

      {command === 'set_mode' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.displayMode}</label>
          <select
            value={(parameters.mode as string) || 'movie'}
            onChange={(e) => handleParametersChange({ mode: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            {displayModes.map((mode) => (
              <option key={mode} value={mode.toLowerCase()}>{mode}</option>
            ))}
          </select>
        </div>
      )}

      {command === 'show' && (
        <>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.contentType}</label>
            <select
              value={(parameters.content_type as string) || 'text'}
              onChange={(e) => handleParametersChange({ content_type: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="text">{language === 'fr' ? 'Texte' : 'Text'}</option>
              <option value="image">Image</option>
              <option value="template">Template</option>
            </select>
          </div>

          {(parameters.content_type as string) === 'text' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t.textContent}</label>
              <textarea
                value={(parameters.content as string) || ''}
                onChange={(e) => handleParametersChange({ content: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
              />
            </div>
          )}

          {(parameters.content_type as string) === 'image' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t.imageUrl}</label>
              <input
                type="text"
                value={(parameters.image_url as string) || ''}
                onChange={(e) => handleParametersChange({ image_url: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.duration}</label>
            <input
              type="number"
              value={(parameters.duration_ms as number) || 5000}
              onChange={(e) => handleParametersChange({ duration_ms: parseInt(e.target.value) || 5000 })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="1000"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ACTUATOR FORM
// ============================================================================
function ActuatorForm({
  action,
  onChange,
  language,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
}) {
  const { parameters, command, service_id } = action;

  // Fetch devices from service
  const { data: resources, isLoading, refetch } = useQuery<ServiceResources>({
    queryKey: ['service-resources', service_id],
    queryFn: async () => {
      if (!service_id) return { service_id: '', service_name: '', category: '', items: [] };
      return apiClient.get<ServiceResources>(`/services/${service_id}/resources`);
    },
    enabled: !!service_id,
  });

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    device: language === 'fr' ? 'Appareil' : 'Device',
    position: language === 'fr' ? 'Position' : 'Position',
    value: language === 'fr' ? 'Valeur' : 'Value',
    refresh: language === 'fr' ? 'Actualiser' : 'Refresh',
    noDevices: language === 'fr' ? 'Aucun appareil disponible' : 'No devices available',
  };

  const commands = [
    { value: 'power_on', label: language === 'fr' ? 'Allumer' : 'Power On' },
    { value: 'power_off', label: language === 'fr' ? 'Éteindre' : 'Power Off' },
    { value: 'toggle', label: 'Toggle' },
    { value: 'open', label: language === 'fr' ? 'Ouvrir' : 'Open' },
    { value: 'close', label: language === 'fr' ? 'Fermer' : 'Close' },
    { value: 'set_position', label: language === 'fr' ? 'Définir position' : 'Set Position' },
    { value: 'execute', label: language === 'fr' ? 'Exécuter' : 'Execute' },
  ];

  const devices = resources?.items || [];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.command}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {commands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>{cmd.label}</option>
          ))}
        </select>
      </div>

      {/* Device Selection */}
      {service_id && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-dark-text">{t.device}</label>
            <button
              onClick={() => refetch()}
              className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {t.refresh}
            </button>
          </div>
          {isLoading ? (
            <div className="p-3 text-center"><Spinner size="sm" /></div>
          ) : devices.length > 0 ? (
            <select
              value={(parameters.device as string) || ''}
              onChange={(e) => handleParametersChange({ device: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="">--</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={(parameters.device as string) || ''}
              onChange={(e) => handleParametersChange({ device: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              placeholder="device_id"
            />
          )}
        </div>
      )}

      {!service_id && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t.device}</label>
          <input
            type="text"
            value={(parameters.device as string) || ''}
            onChange={(e) => handleParametersChange({ device: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            placeholder="projector, curtains..."
          />
        </div>
      )}

      {command === 'set_position' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t.position} ({(parameters.position as number) || 0}%)
          </label>
          <input
            type="range"
            value={(parameters.position as number) || 0}
            onChange={(e) => handleParametersChange({ position: parseInt(e.target.value) })}
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t.value}</label>
        <input
          type="text"
          value={(parameters.value as string) || ''}
          onChange={(e) => handleParametersChange({ value: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          placeholder={language === 'fr' ? 'Valeur optionnelle' : 'Optional value'}
        />
      </div>
    </div>
  );
}
