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
  duration_ms: number;
  on_failure: 'warn' | 'skip' | 'abort';
  service_id?: string;
  block_index: number;
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

interface ActionEditorPanelProps {
  action: ActionItem;
  services: Service[];
  onChange: (updates: Partial<ActionItem>) => void;
  onDelete: () => void;
  colorPalette?: ColorPalette | null;
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

export function ActionEditorPanel({ action, services, onChange, onDelete, colorPalette }: ActionEditorPanelProps) {
  const { language } = useLayoutStore();
  const config = actionTypeConfig[action.action_type];
  const Icon = config.icon;

  const t = {
    service: language === 'fr' ? 'Service' : 'Service',
    noService: language === 'fr' ? 'Aucun (manuel)' : 'None (manual)',
    delay: language === 'fr' ? 'Délai avant exécution (ms)' : 'Delay before execution (ms)',
    duration: language === 'fr' ? 'Durée de maintien (secondes)' : 'Hold duration (seconds)',
    durationHelp: language === 'fr' ? 'Temps d\'attente après cette action avant la suivante. 0 = passage immédiat.' : 'Wait time after this action before the next one. 0 = immediate.',
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
            colorPalette={colorPalette}
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t.duration}</label>
          <input
            type="number"
            value={(action.duration_ms || 0) / 1000}
            onChange={(e) => onChange({ duration_ms: Math.round((parseFloat(e.target.value) || 0) * 1000) })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="1"
          />
          <p className="text-xs text-dark-muted mt-1">{t.durationHelp}</p>
        </div>

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
  colorPalette,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  language: string;
  colorPalette?: ColorPalette | null;
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
    moviePalette: language === 'fr' ? 'Palette du film' : 'Movie Palette',
    noPalette: language === 'fr' ? 'Sélectionnez un film pour voir sa palette' : 'Select a movie to see its palette',
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
        <div className="space-y-4">
          {/* Movie Palette Swatches */}
          {colorPalette && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">{t.moviePalette}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { color: colorPalette.primary, label: 'Primary' },
                  { color: colorPalette.secondary, label: 'Secondary' },
                  { color: colorPalette.accent, label: 'Accent' },
                  { color: colorPalette.vibrant, label: 'Vibrant' },
                  { color: colorPalette.vibrant_light, label: 'Light' },
                  { color: colorPalette.vibrant_dark, label: 'Dark' },
                  { color: colorPalette.muted, label: 'Muted' },
                ].filter(item => item.color).map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleParametersChange({ color: item.color })}
                    className="group relative w-10 h-10 rounded-lg border-2 border-dark-border hover:border-theatarr-500 transition-colors overflow-hidden"
                    style={{ backgroundColor: item.color }}
                    title={`${item.label}: ${item.color}`}
                  >
                    {(parameters.color as string) === item.color && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
                {/* Raw palette colors */}
                {colorPalette.raw_palette?.slice(0, 6).map((color, idx) => (
                  <button
                    key={`raw-${idx}`}
                    type="button"
                    onClick={() => handleParametersChange({ color })}
                    className="group relative w-8 h-8 rounded border border-dark-border hover:border-theatarr-500 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {(parameters.color as string) === color && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color picker row */}
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
interface AudioTrack {
  id: number;
  language: string;
  language_code: string;
  codec: string;
  channels: number;
  display_title: string;
  selected: boolean;
}

interface SubtitleTrack {
  id: number;
  language: string;
  language_code: string;
  codec: string;
  display_title: string;
  forced: boolean;
  selected: boolean;
}

interface MediaStreams {
  audio_tracks: AudioTrack[];
  subtitle_tracks: SubtitleTrack[];
}

const QUALITY_PRESETS = [
  { value: 'original', label: 'Original (Direct Stream)' },
  { value: '1080p-20', label: '1080p — 20 Mbps' },
  { value: '1080p-12', label: '1080p — 12 Mbps' },
  { value: '720p-4', label: '720p — 4 Mbps' },
  { value: '480p-2', label: '480p — 2 Mbps' },
];

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
    audioTrack: language === 'fr' ? 'Piste audio' : 'Audio Track',
    subtitleTrack: language === 'fr' ? 'Sous-titres' : 'Subtitles',
    videoQuality: language === 'fr' ? 'Qualité vidéo' : 'Video Quality',
    noSubtitles: language === 'fr' ? 'Aucun' : 'None',
    defaultTrack: language === 'fr' ? 'Par défaut' : 'Default',
    loadingStreams: language === 'fr' ? 'Chargement des pistes...' : 'Loading tracks...',
    noService: language === 'fr' ? 'Sélectionnez un service média pour rechercher des films' : 'Select a media service to search for movies',
    pauseAt: language === 'fr' ? 'Pause automatique à' : 'Auto-pause at',
    pauseAtHint: language === 'fr' ? 'Le film se mettra en pause à ce moment (HH:MM:SS). Le moteur passera automatiquement à la séquence suivante.' : 'The movie will pause at this time (HH:MM:SS). The engine will automatically advance to the next sequence.',
    noPause: language === 'fr' ? 'Pas de pause' : 'No pause',
    resumeHint: language === 'fr' ? 'Reprend la lecture du film là où il a été mis en pause dans une séquence précédente.' : 'Resumes movie playback from where it was paused in a previous sequence.',
  };

  const commands = [
    { value: 'play', label: language === 'fr' ? 'Lecture' : 'Play' },
    { value: 'pause', label: 'Pause' },
    { value: 'stop', label: language === 'fr' ? 'Arrêter' : 'Stop' },
    { value: 'resume', label: language === 'fr' ? 'Reprendre' : 'Resume' },
  ];

  // Fetch media streams when a movie is selected
  const mediaId = parameters.media_id as string | undefined;
  const { data: mediaStreams, isLoading: isStreamsLoading } = useQuery<MediaStreams>({
    queryKey: ['media-streams', service_id, mediaId],
    queryFn: () => apiClient.get<MediaStreams>(`/services/${service_id}/media/${mediaId}/streams`),
    enabled: !!service_id && !!mediaId && command === 'play',
  });

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

          {/* Audio / Subtitle / Quality streams */}
          {service_id && mediaId && (
            <div className="space-y-4">
              {isStreamsLoading ? (
                <div className="text-sm text-dark-muted p-2">{t.loadingStreams}</div>
              ) : (
                <>
                  {/* Audio Track */}
                  {mediaStreams && mediaStreams.audio_tracks.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">{t.audioTrack}</label>
                      <select
                        value={(parameters.audio_stream_id as number) || ''}
                        onChange={(e) => handleParametersChange({ audio_stream_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                      >
                        <option value="">{t.defaultTrack}</option>
                        {mediaStreams.audio_tracks.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.display_title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Subtitle Track */}
                  {mediaStreams && mediaStreams.subtitle_tracks.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">{t.subtitleTrack}</label>
                      <select
                        value={(parameters.subtitle_stream_id as number) || ''}
                        onChange={(e) => handleParametersChange({ subtitle_stream_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                      >
                        <option value="">{t.noSubtitles}</option>
                        {mediaStreams.subtitle_tracks.map((track) => (
                          <option key={track.id} value={track.id}>
                            {track.display_title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Video Quality */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t.videoQuality}</label>
                <select
                  value={(parameters.video_quality as string) || 'original'}
                  onChange={(e) => handleParametersChange({ video_quality: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                >
                  {QUALITY_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

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

          {/* Pause automatique — 3 inputs H / M / S pour mobile */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t.pauseAt}</label>
            {(() => {
              const ms = (parameters.pause_at_ms as number) || 0;
              const totalSec = Math.floor(ms / 1000);
              const h = Math.floor(totalSec / 3600);
              const m = Math.floor((totalSec % 3600) / 60);
              const s = totalSec % 60;

              const updatePause = (newH: number, newM: number, newS: number) => {
                const total = newH * 3600 + newM * 60 + newS;
                if (total > 0) {
                  handleParametersChange({ pause_at_ms: total * 1000 });
                } else {
                  const newParams = { ...parameters };
                  delete newParams.pause_at_ms;
                  onChange({ parameters: newParams });
                }
              };

              return (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    value={ms > 0 ? h : ''}
                    placeholder="H"
                    onChange={(e) => updatePause(parseInt(e.target.value) || 0, m, s)}
                    className="w-16 bg-dark-bg border border-dark-border rounded-lg px-2 py-2 text-dark-text text-center"
                  />
                  <span className="text-dark-muted font-bold">:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={ms > 0 ? m : ''}
                    placeholder="M"
                    onChange={(e) => updatePause(h, parseInt(e.target.value) || 0, s)}
                    className="w-16 bg-dark-bg border border-dark-border rounded-lg px-2 py-2 text-dark-text text-center"
                  />
                  <span className="text-dark-muted font-bold">:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={ms > 0 ? s : ''}
                    placeholder="S"
                    onChange={(e) => updatePause(h, m, parseInt(e.target.value) || 0)}
                    className="w-16 bg-dark-bg border border-dark-border rounded-lg px-2 py-2 text-dark-text text-center"
                  />
                  {ms > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newParams = { ...parameters };
                        delete newParams.pause_at_ms;
                        onChange({ parameters: newParams });
                      }}
                      className="ml-1 p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              );
            })()}
            <p className="text-xs text-dark-muted mt-1">{t.pauseAtHint}</p>
          </div>
        </>
      )}

      {command === 'resume' && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">{t.resumeHint}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DISPLAY FORM
// ============================================================================
interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  is_builtin: boolean;
}

interface QuizSessionListItem {
  id: string;
  name: string;
  status: string;
  question_count: number;
  template_id?: string | null;
  template_name?: string | null;
}

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

  // Fetch waiting_screen templates when content_type is waiting_screen
  const { data: templatesData } = useQuery<{ items: TemplateListItem[] }>({
    queryKey: ['templates'],
    queryFn: () => apiClient.get('/templates'),
    enabled: command === 'show',
  });

  const waitingScreenTemplates = (templatesData?.items || []).filter(
    (t) => t.template_type === 'waiting_screen'
  );

  const quizTemplates = (templatesData?.items || []).filter(
    (t) => t.template_type === 'quiz'
  );

  // Fetch quiz sessions for quiz content type
  const { data: quizSessionsData } = useQuery<{ items: QuizSessionListItem[] }>({
    queryKey: ['quiz-sessions-for-action'],
    queryFn: () => apiClient.get('/quiz-sessions'),
    enabled: command === 'show' && (parameters.content_type as string) === 'quiz',
  });

  const quizSessions = quizSessionsData?.items || [];

  const t = {
    command: language === 'fr' ? 'Commande' : 'Command',
    inputSource: language === 'fr' ? 'Source d\'entrée' : 'Input Source',
    displayMode: language === 'fr' ? 'Mode d\'affichage' : 'Display Mode',
    contentType: language === 'fr' ? 'Type de contenu' : 'Content Type',
    textContent: language === 'fr' ? 'Contenu texte' : 'Text Content',
    imageUrl: language === 'fr' ? 'URL de l\'image' : 'Image URL',
    selectTemplate: language === 'fr' ? 'Template d\'attente' : 'Waiting Screen Template',
    noTemplates: language === 'fr' ? 'Aucun template disponible. Initialisez les templates intégrés.' : 'No templates available. Initialize built-in templates.',
    quizSession: language === 'fr' ? 'Session de quiz' : 'Quiz Session',
    selectQuiz: language === 'fr' ? 'Sélectionnez un quiz' : 'Select a quiz',
    noQuizSessions: language === 'fr' ? 'Aucun quiz disponible. Créez un quiz dans la section Quiz.' : 'No quizzes available. Create one in the Quiz section.',
    quizTemplate: language === 'fr' ? 'Template d\'affichage' : 'Display Template',
    noQuizTemplate: language === 'fr' ? 'Aucun (classique par défaut)' : 'None (classic default)',
    quizInfo: language === 'fr' ? 'Le quiz sera automatiquement lancé et les participants de la session seront inscrits.' : 'The quiz will auto-start and session participants will be auto-enrolled.',
    position: language === 'fr' ? 'Position' : 'Position',
    positionX: language === 'fr' ? 'Horizontal (%)' : 'Horizontal (%)',
    positionY: language === 'fr' ? 'Vertical (%)' : 'Vertical (%)',
    fontFamily: language === 'fr' ? 'Police' : 'Font',
    fontSize: language === 'fr' ? 'Taille (px)' : 'Size (px)',
    fontWeight: language === 'fr' ? 'Graisse' : 'Weight',
    textColor: language === 'fr' ? 'Couleur' : 'Color',
    animation: language === 'fr' ? 'Animation' : 'Animation',
    animationSpeed: language === 'fr' ? 'Vitesse animation (s)' : 'Animation Speed (s)',
  };

  const commands = [
    { value: 'power_on', label: language === 'fr' ? 'Allumer' : 'Power On' },
    { value: 'power_off', label: language === 'fr' ? 'Éteindre' : 'Power Off' },
    { value: 'set_input', label: language === 'fr' ? 'Changer source' : 'Set Input' },
    { value: 'set_mode', label: language === 'fr' ? 'Changer mode' : 'Set Mode' },
    { value: 'show', label: language === 'fr' ? 'Afficher contenu' : 'Show Content' },
    { value: 'hide', label: language === 'fr' ? 'Masquer' : 'Hide' },
  ];

  const positionsH = [
    { value: 'center', label: language === 'fr' ? 'Centre' : 'Center' },
    { value: 'left', label: language === 'fr' ? 'Gauche' : 'Left' },
    { value: 'right', label: language === 'fr' ? 'Droite' : 'Right' },
    { value: 'custom', label: language === 'fr' ? 'Personnalise' : 'Custom' },
  ];
  const positionsV = [
    { value: 'center', label: language === 'fr' ? 'Centre' : 'Center' },
    { value: 'top', label: language === 'fr' ? 'Haut' : 'Top' },
    { value: 'bottom', label: language === 'fr' ? 'Bas' : 'Bottom' },
    { value: 'custom', label: language === 'fr' ? 'Personnalise' : 'Custom' },
  ];

  const textFonts = [
    { value: '', label: language === 'fr' ? 'Par defaut' : 'Default' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: "'Courier New', monospace", label: 'Courier New' },
    { value: 'Impact, sans-serif', label: 'Impact' },
    { value: "'Arial Black', sans-serif", label: 'Arial Black' },
    { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
    { value: "'Palatino Linotype', serif", label: 'Palatino' },
    { value: 'monospace', label: 'Monospace' },
  ];

  const textAnimations = [
    { value: 'none', label: language === 'fr' ? 'Aucune' : 'None' },
    { value: 'scroll-left', label: language === 'fr' ? 'Defilement gauche' : 'Scroll Left' },
    { value: 'scroll-right', label: language === 'fr' ? 'Defilement droite' : 'Scroll Right' },
    { value: 'scroll-up', label: language === 'fr' ? 'Defilement haut' : 'Scroll Up' },
    { value: 'scroll-down', label: language === 'fr' ? 'Defilement bas' : 'Scroll Down' },
    { value: 'blink', label: language === 'fr' ? 'Clignotement' : 'Blink' },
    { value: 'pulse-glow', label: language === 'fr' ? 'Pulsation' : 'Pulse Glow' },
    { value: 'fade-in', label: language === 'fr' ? 'Fondu entrant' : 'Fade In' },
    { value: 'fade-out', label: language === 'fr' ? 'Fondu sortant' : 'Fade Out' },
    { value: 'rotate', label: language === 'fr' ? 'Rotation' : 'Rotate' },
    { value: 'float', label: language === 'fr' ? 'Flottement' : 'Float' },
    { value: 'neon-flicker', label: language === 'fr' ? 'Neon clignotant' : 'Neon Flicker' },
    { value: 'shimmer', label: language === 'fr' ? 'Chatoiement' : 'Shimmer' },
  ];

  const fontSizes = [16, 24, 32, 48, 64, 72, 96, 120, 150];

  const inputSources = ['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'Component', 'USB'];
  const displayModes = ['Movie', 'Game', 'Sport', 'Standard', 'Vivid'];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  const isTemplateSelected = (tmpl: { id: string; layout?: Record<string, unknown> }) => {
    if (parameters.template_id && parameters.template_id === tmpl.id) return true;
    const paramStyle = (parameters.layout as Record<string, unknown>)?.style;
    const tmplStyle = tmpl.layout?.style;
    if (paramStyle && tmplStyle && paramStyle === tmplStyle) return true;
    return false;
  };

  const handleTemplateSelect = (templateId: string) => {
    const selected = waitingScreenTemplates.find((t) => t.id === templateId);
    if (selected) {
      handleParametersChange({
        template_id: selected.id,
        template_name: selected.name,
        mode: 'waiting_screen',
        layout: selected.layout,
        config: selected.config,
      });
    }
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
              onChange={(e) => {
                const newType = e.target.value;
                // Clear type-specific params when switching content type
                const { template_id, template_name, mode, layout, config,
                  quiz_session_id, quiz_template_id, quiz_name, total_questions,
                  ...rest } = parameters;
                if (newType === 'waiting_screen' || newType === 'quiz') {
                  // These types use layout/config, keep content_type only
                  onChange({ parameters: { ...rest, content_type: newType } });
                } else {
                  onChange({ parameters: { ...rest, content_type: newType } });
                }
              }}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="waiting_screen">{language === 'fr' ? 'Waiting Screen' : 'Waiting Screen'}</option>
              <option value="quiz">Quiz</option>
              <option value="text">{language === 'fr' ? 'Texte' : 'Text'}</option>
              <option value="image">Image</option>
              <option value="template">Template</option>
            </select>
          </div>

          {/* Waiting Screen Template Selector */}
          {(parameters.content_type as string) === 'waiting_screen' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t.selectTemplate}</label>
              {waitingScreenTemplates.length > 0 ? (
                <div className="space-y-2">
                  {waitingScreenTemplates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleTemplateSelect(tmpl.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isTemplateSelected(tmpl)
                          ? 'border-theatarr-500 bg-theatarr-500/10'
                          : 'border-dark-border bg-dark-bg hover:border-dark-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Monitor size={16} className={
                          isTemplateSelected(tmpl)
                            ? 'text-theatarr-400'
                            : 'text-dark-muted'
                        } />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-dark-text text-sm">{tmpl.name}</div>
                          {tmpl.description && (
                            <div className="text-xs text-dark-muted truncate">{tmpl.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t.noTemplates}</div>
              )}
            </div>
          )}

          {/* Quiz Session + Template Selectors */}
          {(parameters.content_type as string) === 'quiz' && (
            <div className="space-y-4">
              {/* Info banner */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-300">
                {t.quizInfo}
              </div>

              {/* Quiz Session Selector */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t.quizSession}</label>
                {quizSessions.length > 0 ? (
                  <select
                    value={(parameters.quiz_session_id as string) || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selected = quizSessions.find(q => q.id === selectedId);
                      const updates: Record<string, unknown> = {
                        quiz_session_id: selectedId || undefined,
                        quiz_name: selected?.name || undefined,
                        total_questions: selected?.question_count || 0,
                      };
                      // Auto-fill template from quiz if it has one and no template is set yet
                      if (selected?.template_id && !parameters.quiz_template_id) {
                        const tmpl = quizTemplates.find(t => t.id === selected.template_id);
                        if (tmpl) {
                          updates.quiz_template_id = tmpl.id;
                          updates.template_name = tmpl.name;
                          updates.layout = tmpl.layout || { style: 'quiz-classic', components: [] };
                          updates.config = tmpl.config || {};
                        }
                      }
                      handleParametersChange(updates);
                    }}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                  >
                    <option value="">{t.selectQuiz}</option>
                    {quizSessions.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.name} ({qs.question_count}Q) — {qs.status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t.noQuizSessions}</div>
                )}
              </div>

              {/* Quiz Template Selector */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t.quizTemplate}</label>
                {quizTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {quizTemplates.map((tmpl) => {
                      const isSelected = (parameters.quiz_template_id as string) === tmpl.id ||
                        (!parameters.quiz_template_id && (parameters.layout as Record<string, unknown>)?.style === (tmpl.layout as Record<string, unknown>)?.style);
                      return (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => {
                            handleParametersChange({
                              quiz_template_id: tmpl.id,
                              template_name: tmpl.name,
                              layout: tmpl.layout || { style: 'quiz-classic', components: [] },
                              config: tmpl.config || {},
                            });
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-500/10'
                              : 'border-dark-border bg-dark-bg hover:border-dark-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Monitor size={16} className={isSelected ? 'text-indigo-400' : 'text-dark-muted'} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-dark-text text-sm">{tmpl.name}</div>
                              {tmpl.description && (
                                <div className="text-xs text-dark-muted truncate">{tmpl.description}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">
                    {t.noQuizTemplate}
                  </div>
                )}
              </div>
            </div>
          )}

          {(parameters.content_type as string) === 'text' && (
            <div className="space-y-3">
              {/* Text content */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t.textContent}</label>
                <textarea
                  value={(parameters.content as string) || ''}
                  onChange={(e) => handleParametersChange({ content: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
                />
              </div>

              {/* Position: horizontal + vertical selects */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.positionX}</label>
                  <select
                    value={(parameters.position_h as string) || 'center'}
                    onChange={(e) => handleParametersChange({ position_h: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-dark-text text-sm"
                  >
                    {positionsH.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {(parameters.position_h as string) === 'custom' && (
                    <div className="mt-1">
                      <label className="block text-xs text-dark-muted">{(parameters.position_x as number) ?? 50}%</label>
                      <input
                        type="range" min={0} max={100}
                        value={(parameters.position_x as number) ?? 50}
                        onChange={(e) => handleParametersChange({ position_x: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.positionY}</label>
                  <select
                    value={(parameters.position_v as string) || 'center'}
                    onChange={(e) => handleParametersChange({ position_v: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 text-dark-text text-sm"
                  >
                    {positionsV.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  {(parameters.position_v as string) === 'custom' && (
                    <div className="mt-1">
                      <label className="block text-xs text-dark-muted">{(parameters.position_y as number) ?? 50}%</label>
                      <input
                        type="range" min={0} max={100}
                        value={(parameters.position_y as number) ?? 50}
                        onChange={(e) => handleParametersChange({ position_y: Number(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-dark-muted mb-1">{t.textColor}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={(parameters.text_color as string) || '#ffffff'}
                    onChange={(e) => handleParametersChange({ text_color: e.target.value })}
                    className="w-10 h-8 bg-dark-bg border border-dark-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={(parameters.text_color as string) || '#ffffff'}
                    onChange={(e) => handleParametersChange({ text_color: e.target.value })}
                    className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-2 py-1 text-dark-text text-sm font-mono"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Font + Size + Weight row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.fontFamily}</label>
                  <select
                    value={(parameters.font_family as string) || ''}
                    onChange={(e) => handleParametersChange({ font_family: e.target.value || undefined })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    {textFonts.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value || undefined }}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.fontSize}</label>
                  <select
                    value={(parameters.font_size as number) || ''}
                    onChange={(e) => handleParametersChange({ font_size: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    <option value="">{language === 'fr' ? 'Auto' : 'Auto'}</option>
                    {fontSizes.map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.fontWeight}</label>
                  <select
                    value={(parameters.font_weight as string) || ''}
                    onChange={(e) => handleParametersChange({ font_weight: e.target.value || undefined })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    <option value="">{language === 'fr' ? 'Normal' : 'Normal'}</option>
                    <option value="300">{language === 'fr' ? 'Leger' : 'Light'}</option>
                    <option value="700">{language === 'fr' ? 'Gras' : 'Bold'}</option>
                  </select>
                </div>
              </div>

              {/* Animation row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t.animation}</label>
                  <select
                    value={(parameters.animation as string) || 'none'}
                    onChange={(e) => handleParametersChange({ animation: e.target.value })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    {textAnimations.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                {(parameters.animation as string) && (parameters.animation as string) !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-dark-muted mb-1">
                      {t.animationSpeed}: {(parameters.animation_speed as number) || 10}s
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={(parameters.animation_speed as number) || 10}
                      onChange={(e) => handleParametersChange({ animation_speed: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
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

          {/* Duration is now controlled by the common "Hold duration" field in action settings */}
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
