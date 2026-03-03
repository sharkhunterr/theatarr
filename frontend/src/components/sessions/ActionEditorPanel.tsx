/**
 * Action Editor Panel - Detailed editor for session actions
 * with service integration for fetching resources (lights, movies, etc.)
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, Film, Lightbulb, Volume2, Monitor, Zap, ClipboardCheck, X, RefreshCw, Sparkles, Star, Clapperboard } from 'lucide-react';
import { Spinner } from '../common';
import { apiClient } from '../../api/client';

// Types
export type ActionType = 'lighting' | 'audio' | 'display' | 'media' | 'actuator' | 'session';

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
  groups?: Array<{ id: string; name: string; member_count: number; members?: string[] }>;
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
  sessionId?: string;
  movieId?: string | null;
  movieSourceId?: string | null;
  movieGenres?: string[] | null;
  allActions?: ActionItem[];
}

// Action type configurations
const actionTypeConfig: Record<ActionType, {
  icon: typeof Lightbulb;
  color: string;
  bgColor: string;
  labelKey: string;
  category: string;
}> = {
  lighting: { icon: Lightbulb, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', labelKey: 'lighting', category: 'lighting' },
  audio: { icon: Volume2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', labelKey: 'audio', category: 'player' },
  media: { icon: Film, color: 'text-green-400', bgColor: 'bg-green-500/20', labelKey: 'media', category: 'media_source' },
  display: { icon: Monitor, color: 'text-purple-400', bgColor: 'bg-purple-500/20', labelKey: 'display', category: 'player' },
  actuator: { icon: Zap, color: 'text-orange-400', bgColor: 'bg-orange-500/20', labelKey: 'actuator', category: 'actuator' },
  session: { icon: ClipboardCheck, color: 'text-teal-400', bgColor: 'bg-teal-500/20', labelKey: 'session', category: '' },
};

export function ActionEditorPanel({ action, services, onChange, onDelete, colorPalette, sessionId, movieId, movieSourceId, movieGenres, allActions }: ActionEditorPanelProps) {
  const { t } = useTranslation('sessions');
  const config = actionTypeConfig[action.action_type];
  const Icon = config.icon;

  // Filter services by action type category
  const availableServices = services.filter(s => {
    if (action.action_type === 'media') return s.category === 'media_source';
    if (action.action_type === 'lighting') return s.category === 'lighting';
    if (action.action_type === 'audio' || action.action_type === 'display') return s.category === 'player';
    if (action.action_type === 'actuator') return s.category === 'actuator';
    if (action.action_type === 'session') return false;
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
            {t(`actionTypes.${config.labelKey}`)}
          </div>
          <div className="text-xs text-dark-muted">{action.command}</div>
        </div>
      </div>

      {/* Service Selection */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('actionEditor.service')}</label>
        <select
          value={action.service_id || ''}
          onChange={(e) => onChange({ service_id: e.target.value || undefined })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          <option value="">{t('actionEditor.noService')}</option>
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
            colorPalette={colorPalette}
          />
        )}
        {action.action_type === 'audio' && (
          <AudioForm
            action={action}
            onChange={onChange}
          />
        )}
        {action.action_type === 'media' && (
          <MediaForm
            action={action}
            onChange={onChange}
            sessionId={sessionId}
            movieId={movieId}
            movieSourceId={movieSourceId}
            movieGenres={movieGenres}
            allActions={allActions}
          />
        )}
        {action.action_type === 'display' && (
          <DisplayForm
            action={action}
            onChange={onChange}
          />
        )}
        {action.action_type === 'actuator' && (
          <ActuatorForm
            action={action}
            onChange={onChange}
          />
        )}
        {action.action_type === 'session' && (
          <SessionForm
            action={action}
            onChange={onChange}
          />
        )}
      </div>

      {/* Common Settings */}
      <div className="border-t border-dark-border pt-4 space-y-4">
        <h4 className="text-sm font-medium text-dark-text">{t('actionEditor.actionSettings')}</h4>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t('actionEditor.duration')}</label>
          <input
            type="number"
            value={(action.duration_ms || 0) / 1000}
            onChange={(e) => onChange({ duration_ms: Math.round((parseFloat(e.target.value) || 0) * 1000) })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="1"
          />
          <p className="text-xs text-dark-muted mt-1">{t('actionEditor.durationHelp')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t('actionEditor.delay')}</label>
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t('actionEditor.onFailure')}</label>
          <select
            value={action.on_failure}
            onChange={(e) => onChange({ on_failure: e.target.value as 'warn' | 'skip' | 'abort' })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            <option value="warn">{t('actionEditor.warn')}</option>
            <option value="skip">{t('actionEditor.skip')}</option>
            <option value="abort">{t('actionEditor.abort')}</option>
          </select>
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <X size={16} />
          {t('actionEditor.deleteAction')}
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
  colorPalette,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  colorPalette?: ColorPalette | null;
}) {
  const { t } = useTranslation('sessions');
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

  const commands = [
    { value: 'turn_on', label: t('lightingForm.turnOn') },
    { value: 'turn_off', label: t('lightingForm.turnOff') },
    { value: 'toggle', label: t('lightingForm.toggle') },
    { value: 'set_color', label: t('lightingForm.setColor') },
    { value: 'set_brightness', label: t('lightingForm.setBrightness') },
    { value: 'set_scene', label: t('lightingForm.activateScene') },
    { value: 'set_effect', label: t('lightingForm.ledEffect') },
  ];

  const lights = resources?.items || [];
  const groups = resources?.groups || [];
  const scenes = resources?.scenes || [];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      {/* Command */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('lightingForm.command')}</label>
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
            <label className="text-sm font-medium text-dark-text">{t('lightingForm.targetLights')}</label>
            <button
              onClick={() => refetch()}
              className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {t('lightingForm.refresh')}
            </button>
          </div>
          {isLoading ? (
            <div className="p-3 text-center"><Spinner size="sm" /></div>
          ) : lights.length > 0 || groups.length > 0 ? (
            <select
              value={
                Array.isArray(parameters.targets) && (parameters.targets as string[]).length > 0
                  ? (parameters.targets as string[])[0]
                  : (parameters.target as string) || 'all'
              }
              onChange={(e) => {
                const val = e.target.value;
                handleParametersChange({ targets: val === 'all' ? [] : [val], target: undefined });
              }}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="all">{t('lightingForm.allLights')}</option>
              {groups.length > 0 && (
                <optgroup label={t('lightingForm.groups')}>
                  {groups.map((group) => (
                    <option key={`group-${group.id}`} value={group.id}>
                      {group.name} ({group.member_count})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t('lightingForm.individualLights')}>
                {lights.map((light) => (
                  <option key={light.id} value={light.id}>{light.name}</option>
                ))}
              </optgroup>
            </select>
          ) : (
            <div className="text-sm text-dark-muted p-2 bg-dark-bg rounded-lg">{t('lightingForm.noLights')}</div>
          )}
        </div>
      )}

      {/* Color (for set_color) */}
      {(command === 'set_color' || command === 'turn_on') && (
        <div className="space-y-4">
          {/* Movie Palette Swatches */}
          {colorPalette && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">{t('lightingForm.moviePalette')}</label>
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
              <label className="block text-sm font-medium text-dark-text mb-1">{t('lightingForm.color')}</label>
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
              <label className="block text-sm font-medium text-dark-text mb-1">{t('lightingForm.transition')}</label>
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
            {t('lightingForm.brightness')} ({(parameters.brightness as number) || 100}%)
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t('lightingForm.scene')}</label>
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

      {/* Effect (WLED effects come as scenes via get_scenes) */}
      {command === 'set_effect' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('lightingForm.effect')}</label>
            {service_id && scenes.length > 0 ? (
              <select
                value={(parameters.effect as string) || ''}
                onChange={(e) => handleParametersChange({ effect: e.target.value })}
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
                value={(parameters.effect as string) || ''}
                onChange={(e) => handleParametersChange({ effect: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                placeholder={t('lightingFormExtra.effectNamePlaceholder')}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">
              {t('lightingForm.effectSpeed')} ({(parameters.speed as number) ?? 128})
            </label>
            <input
              type="range"
              value={(parameters.speed as number) ?? 128}
              onChange={(e) => handleParametersChange({ speed: parseInt(e.target.value) })}
              className="w-full accent-theatarr-500"
              min="0"
              max="255"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">
              {t('lightingForm.effectIntensity')} ({(parameters.intensity as number) ?? 128})
            </label>
            <input
              type="range"
              value={(parameters.intensity as number) ?? 128}
              onChange={(e) => handleParametersChange({ intensity: parseInt(e.target.value) })}
              className="w-full accent-theatarr-500"
              min="0"
              max="255"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUDIO FORM
// ============================================================================

interface SoundLibraryItem {
  id: string;
  name: string;
  duration_seconds?: number;
  bitrate?: number;
  format: string;
  tags?: string[];
}

function AudioForm({
  action,
  onChange,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
}) {
  const { t } = useTranslation('sessions');
  const { parameters, command } = action;

  const commands = [
    { value: 'play', label: t('audioForm.play') },
    { value: 'pause', label: t('audioForm.pause') },
    { value: 'resume', label: t('audioForm.resume') },
    { value: 'stop', label: t('audioForm.stop') },
    { value: 'set_volume', label: t('audioForm.setVolume') },
    { value: 'mute', label: t('audioForm.mute') },
    { value: 'unmute', label: t('audioForm.unmute') },
  ];

  const sourceType = parameters.sound_id !== undefined ? 'library' : 'url';

  // Fetch sounds from library
  const { data: soundsData } = useQuery({
    queryKey: ['sounds-library'],
    queryFn: async () => apiClient.get<{ items: SoundLibraryItem[] }>('/sounds?status_filter=ready&limit=200'),
    enabled: command === 'play',
  });

  const sounds = soundsData?.items ?? [];
  const selectedSound = sounds.find((s) => s.id === parameters.sound_id);

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  const handleSourceTypeChange = (type: string) => {
    if (type === 'library') {
      handleParametersChange({ sound_id: '', url: undefined, source: undefined });
    } else {
      handleParametersChange({ sound_id: undefined, url: '' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Command */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.command')}</label>
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

      {/* Play source */}
      {command === 'play' && (
        <>
          {/* Source type selector */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.sourceType')}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSourceTypeChange('library')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sourceType === 'library'
                    ? 'bg-theatarr-500 text-white'
                    : 'bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text'
                }`}
              >
                {t('audioForm.soundLibrary')}
              </button>
              <button
                type="button"
                onClick={() => handleSourceTypeChange('url')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sourceType === 'url'
                    ? 'bg-theatarr-500 text-white'
                    : 'bg-dark-bg border border-dark-border text-dark-muted hover:text-dark-text'
                }`}
              >
                {t('audioForm.externalUrl')}
              </button>
            </div>
          </div>

          {/* Library sound selector */}
          {sourceType === 'library' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.selectSound')}</label>
              <select
                value={(parameters.sound_id as string) || ''}
                onChange={(e) => handleParametersChange({ sound_id: e.target.value || undefined })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              >
                <option value="">-- {t('audioForm.selectSound')} --</option>
                {sounds.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.duration_seconds ? ` (${Math.floor(s.duration_seconds / 60)}:${(s.duration_seconds % 60).toString().padStart(2, '0')})` : ''}
                  </option>
                ))}
              </select>
              {selectedSound && (
                <p className="text-xs text-dark-muted mt-1">
                  {selectedSound.format.toUpperCase()}
                  {selectedSound.bitrate ? ` — ${selectedSound.bitrate} kbps` : ''}
                  {selectedSound.tags?.length ? ` — ${selectedSound.tags.join(', ')}` : ''}
                </p>
              )}
            </div>
          )}

          {/* External URL */}
          {sourceType === 'url' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.url')}</label>
              <input
                type="text"
                value={(parameters.url as string) || (parameters.source as string) || ''}
                onChange={(e) => handleParametersChange({ url: e.target.value, source: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                placeholder="https://..."
              />
            </div>
          )}
        </>
      )}

      {/* Volume */}
      {(command === 'set_volume' || command === 'play') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t('audioForm.volume')} ({(parameters.volume as number) ?? 80}%)
          </label>
          <input
            type="range"
            value={(parameters.volume as number) ?? 80}
            onChange={(e) => handleParametersChange({ volume: parseInt(e.target.value) })}
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      {/* Fade in / Fade out for play */}
      {command === 'play' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.fadeIn')}</label>
            <input
              type="number"
              value={(parameters.fade_in_ms as number) || 0}
              onChange={(e) => handleParametersChange({ fade_in_ms: parseInt(e.target.value) || 0 })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.fadeOut')}</label>
            <input
              type="number"
              value={(parameters.fade_out_ms as number) || 0}
              onChange={(e) => handleParametersChange({ fade_out_ms: parseInt(e.target.value) || 0 })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

      {/* Fade for stop/volume */}
      {(command === 'stop' || command === 'set_volume') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.fadeDuration')}</label>
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

      {/* Loop toggle for play */}
      {command === 'play' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(parameters.loop as boolean) || false}
            onChange={(e) => handleParametersChange({ loop: e.target.checked })}
            className="rounded border-dark-border bg-dark-bg text-theatarr-500 focus:ring-theatarr-500"
          />
          <span className="text-sm text-dark-text">{t('audioForm.loop')}</span>
        </label>
      )}

      {/* Target device */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('audioForm.device')}</label>
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
  sessionId,
  movieId,
  movieSourceId,
  movieGenres,
  allActions,
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
  sessionId?: string;
  movieId?: string | null;
  movieSourceId?: string | null;
  movieGenres?: string[] | null;
  allActions?: ActionItem[];
}) {
  const { t } = useTranslation('sessions');
  const { parameters, command, service_id } = action;
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [chaptersError, setChaptersError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Array<{ index: number; title: string; start_ms: number; end_ms: number }>>([]);
  const [chaptersDurationMs, setChaptersDurationMs] = useState(0);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);

  const commands = [
    { value: 'play', label: t('mediaForm.play') },
    { value: 'pause', label: t('mediaForm.pause') },
    { value: 'stop', label: t('mediaForm.stop') },
    { value: 'resume', label: t('mediaForm.resume') },
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

  const fetchChapters = async (): Promise<Array<{ index: number; title: string; start_ms: number; end_ms: number }>> => {
    if (chaptersLoaded) return chapters;
    if (!service_id || !mediaId) return [];
    setIsLoadingChapters(true);
    setChaptersError(null);
    try {
      const data = await apiClient.get<{ chapters: Array<{ index: number; title: string; start_ms: number; end_ms: number }>; duration_ms: number }>(
        `/services/${service_id}/media/${mediaId}/chapters`
      );
      const chs = data.chapters || [];
      setChapters(chs);
      setChaptersDurationMs(data.duration_ms || 0);
      setChaptersLoaded(true);
      if (chs.length < 2) {
        setChaptersError(t('mediaForm.noChapters'));
      }
      return chs;
    } catch {
      setChaptersError(t('mediaForm.noChapters'));
      setChaptersLoaded(true);
      return [];
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const handleSmartIntermission = async () => {
    const chs = await fetchChapters();
    if (chs.length < 2) return;
    const mid = chaptersDurationMs / 2 || chs[chs.length - 1].end_ms / 2;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < chs.length - 1; i++) {
      const dist = Math.abs(chs[i].end_ms - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const bestChapter = chs[bestIdx];
    handleParametersChange({ pause_at_ms: bestChapter.end_ms });
    setChaptersError(`${t('mediaForm.chapterSet')} "${bestChapter.title}"`);
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
        <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.command')}</label>
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
          {/* Media Source Selector */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              {t('mediaSource.source')}
            </label>
            <div className="flex gap-2">
              {([
                { value: 'service', label: t('mediaSource.service'), icon: <Monitor size={14} /> },
                { value: 'trailer', label: t('mediaSource.trailer'), icon: <Film size={14} /> },
                { value: 'preroll', label: t('mediaSource.preroll'), icon: <Clapperboard size={14} /> },
              ] as const).map((src) => (
                <button
                  key={src.value}
                  type="button"
                  onClick={() => {
                    const mediaSource = (parameters.media_source as string) || 'service';
                    if (mediaSource === src.value) return;
                    // Clear incompatible params when switching source
                    const cleanParams: Record<string, unknown> = { media_source: src.value };
                    onChange({ parameters: cleanParams, service_id: src.value === 'service' ? service_id : undefined });
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    ((parameters.media_source as string) || 'service') === src.value
                      ? 'border-theatarr-500 bg-theatarr-500/10 text-theatarr-400'
                      : 'border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {src.icon}
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          {/* Trailer Source Form */}
          {((parameters.media_source as string) === 'trailer') && (
            <TrailerSourceForm
              parameters={parameters}
              onChange={handleParametersChange}
              sessionId={sessionId}
              movieId={movieId}
              movieSourceId={movieSourceId}
              movieGenres={movieGenres}
              excludeTmdbIds={
                (allActions || [])
                  .filter(a => a.id !== action.id && a.parameters?._preview_tmdb_id)
                  .map(a => a.parameters._preview_tmdb_id as string)
              }
            />
          )}

          {/* PreRoll Source Form */}
          {((parameters.media_source as string) === 'preroll') && (
            <PreRollSourceForm parameters={parameters} onChange={handleParametersChange} />
          )}

          {/* Service source (existing behavior) */}
          {((parameters.media_source as string) || 'service') === 'service' && (
          <>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">{t('mediaForm.selectMovie')}</label>

            {!service_id ? (
              <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t('mediaForm.noService')}</div>
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
                    {t('mediaForm.change')}
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
                    placeholder={t('mediaForm.searchPlaceholder')}
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
                      <div className="p-4 text-center text-dark-muted text-sm">{t('mediaForm.noResults')}</div>
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
                <div className="text-sm text-dark-muted p-2">{t('mediaForm.loadingStreams')}</div>
              ) : (
                <>
                  {/* Audio Track */}
                  {mediaStreams && mediaStreams.audio_tracks.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.audioTrack')}</label>
                      <select
                        value={(parameters.audio_stream_id as number) || ''}
                        onChange={(e) => handleParametersChange({ audio_stream_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                      >
                        <option value="">{t('mediaForm.defaultTrack')}</option>
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
                      <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.subtitleTrack')}</label>
                      <select
                        value={(parameters.subtitle_stream_id as number) || ''}
                        onChange={(e) => handleParametersChange({ subtitle_stream_id: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                      >
                        <option value="">{t('mediaForm.noSubtitles')}</option>
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
                <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.videoQuality')}</label>
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
            <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.startPosition')}</label>
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
            <label className="block text-sm font-medium text-dark-text mb-1">{t('mediaForm.pauseAt')}</label>
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
            <p className="text-xs text-dark-muted mt-1">{t('mediaForm.pauseAtHint')}</p>
          </div>

          {/* Smart Intermission + Chapter selector */}
          {service_id && mediaId && (() => {
            const noChaptersAvailable = chaptersLoaded && chapters.length < 2;
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSmartIntermission}
                    disabled={isLoadingChapters || noChaptersAvailable}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors flex-shrink-0 ${
                      noChaptersAvailable
                        ? 'bg-dark-bg border-dark-border text-dark-muted cursor-not-allowed opacity-50'
                        : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300 disabled:opacity-50'
                    }`}
                  >
                    {isLoadingChapters ? <Spinner size="sm" /> : <Sparkles size={14} />}
                    {t('mediaForm.smartIntermission')}
                  </button>
                  {chapters.length >= 2 ? (
                    <select
                      value={(() => {
                        const pauseMs = (parameters.pause_at_ms as number) || 0;
                        if (!pauseMs) return '';
                        const match = chapters.find(ch => ch.end_ms === pauseMs);
                        return match ? String(match.index) : '';
                      })()}
                      onChange={(e) => {
                        const idx = e.target.value;
                        if (!idx) {
                          const newParams = { ...parameters };
                          delete newParams.pause_at_ms;
                          onChange({ parameters: newParams });
                          setChaptersError(null);
                        } else {
                          const ch = chapters.find(c => String(c.index) === idx);
                          if (ch) {
                            handleParametersChange({ pause_at_ms: ch.end_ms });
                            setChaptersError(`${t('mediaForm.chapterSet')} "${ch.title}"`);
                          }
                        }
                      }}
                      className="flex-1 min-w-0 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text text-sm"
                    >
                      <option value="">{t('mediaForm.chapterSelect')}</option>
                      {chapters.slice(0, -1).map((ch) => {
                        const sec = Math.floor(ch.end_ms / 1000);
                        const hh = Math.floor(sec / 3600);
                        const mm = Math.floor((sec % 3600) / 60);
                        const ss = sec % 60;
                        const ts = hh > 0
                          ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
                          : `${mm}:${String(ss).padStart(2, '0')}`;
                        return (
                          <option key={ch.index} value={ch.index}>
                            {ch.title} ({ts})
                          </option>
                        );
                      })}
                    </select>
                  ) : noChaptersAvailable ? (
                    <span className="text-xs text-dark-muted italic">
                      {t('mediaSource.chaptersUnavailable')}
                    </span>
                  ) : !chaptersLoaded && !isLoadingChapters ? (
                    <button
                      type="button"
                      onClick={fetchChapters}
                      className="text-xs text-dark-muted hover:text-dark-text transition-colors"
                    >
                      {t('mediaSource.loadChapters')}
                    </button>
                  ) : null}
                </div>
                {!noChaptersAvailable && (
                  <p className="text-xs text-dark-muted">{t('mediaForm.smartIntermissionHint')}</p>
                )}
                {chaptersError && (
                  <p className={`text-xs ${chaptersError.startsWith(t('mediaForm.chapterSet')) ? 'text-green-400' : 'text-amber-400'}`}>
                    {chaptersError}
                  </p>
                )}
              </div>
            );
          })()}
          </>
          )}
        </>
      )}

      {command === 'resume' && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">{t('mediaForm.resumeHint')}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRAILER SOURCE FORM
// ============================================================================

function TrailerSourceForm({
  parameters,
  onChange,
  sessionId: _sessionId,
  movieId,
  movieSourceId: _movieSourceId,
  movieGenres,
  excludeTmdbIds,
}: {
  parameters: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  sessionId?: string;
  movieId?: string | null;
  movieSourceId?: string | null;
  movieGenres?: string[] | null;
  excludeTmdbIds?: string[];
}) {
  const { t } = useTranslation('sessions');
  const trailerMode = (parameters.trailer_mode as string) || 'manual';
  const [isSearching, setIsSearching] = useState(false);

  const { data: trailersData } = useQuery<{ items: Array<{ id: string; movie_title: string; title: string; duration_seconds?: number; status: string; is_ready: boolean }> }>({
    queryKey: ['trailers-ready'],
    queryFn: () => apiClient.get('/trailers?status_filter=ready'),
    enabled: trailerMode === 'manual',
  });

  const { data: rulesData } = useQuery<{ items: Array<{ id: string; name: string; description?: string; trailer_count: number }> }>({
    queryKey: ['trailer-rules'],
    queryFn: () => apiClient.get('/trailers/rules'),
    enabled: trailerMode === 'rule',
  });

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-2">
          {t('trailerSource.selectionMode')}
        </label>
        <div className="flex gap-2">
          {([
            { value: 'manual', label: t('trailerSource.manual') },
            { value: 'auto', label: t('trailerSource.auto') },
            { value: 'rule', label: t('trailerSource.rule') },
          ] as const).map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange({ trailer_mode: m.value, trailer_id: undefined, trailer_rule_id: undefined })}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                trailerMode === m.value
                  ? 'border-theatarr-500 bg-theatarr-500/10 text-theatarr-400'
                  : 'border-dark-border bg-dark-surface text-dark-muted hover:text-dark-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual: trailer dropdown */}
      {trailerMode === 'manual' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t('trailerSource.trailer')}
          </label>
          <select
            value={(parameters.trailer_id as string) || ''}
            onChange={(e) => onChange({ trailer_id: e.target.value || undefined })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            <option value="">{t('trailerSource.select')}</option>
            {trailersData?.items?.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.movie_title} — {tr.title}
                {tr.duration_seconds ? ` (${formatDuration(tr.duration_seconds)})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Auto: resolved/preview trailer name or idle state */}
      {trailerMode === 'auto' && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-2">
          {parameters._resolved_trailer_id ? (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-300 truncate">
                {(parameters._resolved_trailer_name as string) || t('trailerSource.resolvedTrailer')}
              </span>
              {typeof parameters._resolved_duration_ms === 'number' && (
                <span className="text-xs text-dark-muted shrink-0">
                  {formatDuration(Math.round(parameters._resolved_duration_ms / 1000))}
                </span>
              )}
            </div>
          ) : parameters._preview_trailer_name ? (
            <div className="flex items-center gap-2">
              <Film size={14} className="text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300 truncate">
                {parameters._preview_trailer_name as string}
              </span>
              <span className="text-xs text-dark-muted shrink-0">
                {t('trailerSource.pendingDownload')}
              </span>
            </div>
          ) : isSearching ? (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-blue-300">
                {t('trailerSource.searching')}
              </span>
            </div>
          ) : (
            <p className="text-sm text-dark-muted">
              {t('trailerSource.noTrailerSelected')}
            </p>
          )}
          <p className="text-xs text-dark-muted">
            {t('trailerSource.autoDescription')}
          </p>
          <button
            type="button"
            disabled={isSearching}
            onClick={async () => {
              setIsSearching(true);
              try {
                const queryParams = new URLSearchParams({ count: '1' });
                // Exclude other actions' trailers + current action's trailer
                const allExclude = [...(excludeTmdbIds || [])];
                const currentPreview = parameters._preview_tmdb_id as string | undefined;
                if (currentPreview) allExclude.push(currentPreview);
                if (allExclude.length > 0) {
                  queryParams.set('exclude_tmdb_ids', allExclude.join(','));
                }
                if (movieId) {
                  queryParams.set('movie_id', movieId);
                } else if (movieGenres && movieGenres.length > 0) {
                  // Pass genres directly — works before save (no movie_id yet)
                  queryParams.set('genres', movieGenres.join(','));
                }
                const results = await apiClient.post<Array<{ tmdb_id: string; movie_title: string; trailer_title: string }>>(`/trailers/auto-preview?${queryParams}`, {});
                if (results && results.length > 0) {
                  const pick = results[0];
                  onChange({
                    _preview_tmdb_id: pick.tmdb_id,
                    _preview_trailer_name: `${pick.movie_title} — ${pick.trailer_title}`,
                    _resolved_trailer_id: undefined,
                    _resolved_trailer_name: undefined,
                    _resolved_duration_ms: undefined,
                  });
                }
              } catch (e) {
                console.error('Failed to preview trailer:', e);
              } finally {
                setIsSearching(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 text-blue-300 text-xs hover:bg-blue-500/15 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('trailerSource.searchingShort')}
              </>
            ) : (
              <>
                <Search size={12} />
                {parameters._resolved_trailer_id || parameters._preview_trailer_name
                  ? t('trailerSource.changeTrailer')
                  : t('trailerSource.searchTrailer')}
              </>
            )}
          </button>
        </div>
      )}

      {/* Rule: rule dropdown */}
      {trailerMode === 'rule' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            {t('trailerSource.rule')}
          </label>
          <select
            value={(parameters.trailer_rule_id as string) || ''}
            onChange={(e) => onChange({ trailer_rule_id: e.target.value || undefined })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            <option value="">{t('trailerSource.select')}</option>
            {rulesData?.items?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.trailer_count} {t('trailerSource.trailers')})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PREROLL SOURCE FORM
// ============================================================================

function PreRollSourceForm({
  parameters,
  onChange,
}: {
  parameters: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation('sessions');
  const { data: prerollsData } = useQuery<{ items: Array<{ id: string; name: string; duration_seconds?: number | null; format: string; is_ready: boolean }> }>({
    queryKey: ['prerolls-ready'],
    queryFn: () => apiClient.get('/prerolls?status_filter=ready'),
  });

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div>
      <label className="block text-sm font-medium text-dark-text mb-1">
        {t('prerollSource.preroll')}
      </label>
      <select
        value={(parameters.preroll_id as string) || ''}
        onChange={(e) => onChange({ preroll_id: e.target.value || undefined })}
        className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
      >
        <option value="">{t('prerollSource.select')}</option>
        {prerollsData?.items?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.duration_seconds ? ` (${formatDuration(p.duration_seconds)})` : ''}
          </option>
        ))}
      </select>
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
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
}) {
  const { t } = useTranslation('sessions');
  const { parameters, command } = action;

  // Fetch waiting_screen templates when content_type is waiting_screen
  const { data: templatesData } = useQuery<{ items: TemplateListItem[] }>({
    queryKey: ['templates'],
    queryFn: () => apiClient.get('/templates'),
    enabled: command === 'show',
  });

  const waitingScreenTemplates = (templatesData?.items || []).filter(
    (tmpl) => tmpl.template_type === 'waiting_screen'
  );

  const quizTemplates = (templatesData?.items || []).filter(
    (tmpl) => tmpl.template_type === 'quiz'
  );

  const feedbackTemplates = (templatesData?.items || []).filter(
    (tmpl) => tmpl.template_type === 'feedback'
  );

  // Fetch quiz sessions for quiz content type
  const { data: quizSessionsData } = useQuery<{ items: QuizSessionListItem[] }>({
    queryKey: ['quiz-sessions-for-action'],
    queryFn: () => apiClient.get('/quiz-sessions'),
    enabled: command === 'show' && (parameters.content_type as string) === 'quiz',
  });

  const quizSessions = quizSessionsData?.items || [];

  const commands = [
    { value: 'power_on', label: t('displayForm.powerOn') },
    { value: 'power_off', label: t('displayForm.powerOff') },
    { value: 'set_input', label: t('displayForm.setInput') },
    { value: 'set_mode', label: t('displayForm.setMode') },
    { value: 'show', label: t('displayForm.showContent') },
    { value: 'hide', label: t('displayForm.hide') },
  ];

  const positionsH = [
    { value: 'center', label: t('displayForm.center') },
    { value: 'left', label: t('displayForm.left') },
    { value: 'right', label: t('displayForm.right') },
    { value: 'custom', label: t('displayForm.custom') },
  ];
  const positionsV = [
    { value: 'center', label: t('displayForm.center') },
    { value: 'top', label: t('displayFormExtra.top') },
    { value: 'bottom', label: t('displayFormExtra.bottom') },
    { value: 'custom', label: t('displayForm.custom') },
  ];

  const textFonts = [
    { value: '', label: t('displayFormExtra.defaultFont') },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: "'Courier New', monospace", label: 'Courier New' },
    { value: 'Impact, sans-serif', label: 'Impact' },
    { value: "'Arial Black', sans-serif", label: 'Arial Black' },
    { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
    { value: "'Palatino Linotype', serif", label: 'Palatino' },
    { value: 'monospace', label: 'Monospace' },
  ];

  const textAnimations = [
    { value: 'none', label: t('displayFormExtra.noAnimation') },
    { value: 'scroll-left', label: t('displayFormExtra.scrollLeft') },
    { value: 'scroll-right', label: t('displayFormExtra.scrollRight') },
    { value: 'scroll-up', label: t('displayFormExtra.scrollUp') },
    { value: 'scroll-down', label: t('displayFormExtra.scrollDown') },
    { value: 'blink', label: t('displayFormExtra.blink') },
    { value: 'pulse-glow', label: t('displayFormExtra.pulseGlow') },
    { value: 'fade-in', label: t('displayFormExtra.fadeIn') },
    { value: 'fade-out', label: t('displayFormExtra.fadeOut') },
    { value: 'rotate', label: t('displayFormExtra.rotate') },
    { value: 'float', label: t('displayFormExtra.float') },
    { value: 'neon-flicker', label: t('displayFormExtra.neonFlicker') },
    { value: 'shimmer', label: t('displayFormExtra.shimmer') },
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
    const selected = waitingScreenTemplates.find((tmpl) => tmpl.id === templateId);
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
        <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.command')}</label>
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.inputSource')}</label>
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.displayMode')}</label>
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
            <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.contentType')}</label>
            <select
              value={(parameters.content_type as string) || 'text'}
              onChange={(e) => {
                const newType = e.target.value;
                // Clear type-specific params when switching content type
                const { template_id, template_name, mode, layout, config,
                  quiz_session_id, quiz_template_id, quiz_name, total_questions,
                  ...rest } = parameters;
                onChange({ parameters: { ...rest, content_type: newType } });
              }}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="waiting_screen">{t('displayFormExtra.waitingScreen')}</option>
              <option value="quiz">Quiz</option>
              <option value="feedback">Feedback</option>
              <option value="text">{t('displayFormExtra.text')}</option>
              <option value="image">Image</option>
              <option value="template">Template</option>
            </select>
          </div>

          {/* Waiting Screen Template Selector */}
          {(parameters.content_type as string) === 'waiting_screen' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.selectTemplate')}</label>
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
                <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t('displayForm.noTemplates')}</div>
              )}
            </div>
          )}

          {/* Quiz Session + Template Selectors */}
          {(parameters.content_type as string) === 'quiz' && (
            <div className="space-y-4">
              {/* Info banner */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-300">
                {t('displayForm.quizInfo')}
              </div>

              {/* Quiz Session Selector */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.quizSession')}</label>
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
                        const tmpl = quizTemplates.find(qt => qt.id === selected.template_id);
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
                    <option value="">{t('displayForm.selectQuiz')}</option>
                    {quizSessions.map((qs) => (
                      <option key={qs.id} value={qs.id}>
                        {qs.name} ({qs.question_count}Q) — {qs.status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-dark-muted p-3 bg-dark-bg rounded-lg">{t('displayForm.noQuizSessions')}</div>
                )}
              </div>

              {/* Quiz Template Selector */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.quizTemplate')}</label>
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
                    {t('displayForm.noQuizTemplate')}
                  </div>
                )}
              </div>
            </div>
          )}

          {(parameters.content_type as string) === 'feedback' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">{t('displayFormExtra.feedbackTemplate')}</label>
              {feedbackTemplates.length > 0 ? (
                <div className="space-y-2">
                  {feedbackTemplates.map((tmpl) => {
                    const isSelected = (parameters.template_id as string) === tmpl.id ||
                      (!parameters.template_id && (parameters.layout as Record<string, unknown>)?.style === (tmpl.layout as Record<string, unknown>)?.style);
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          handleParametersChange({
                            template_id: tmpl.id,
                            template_name: tmpl.name,
                            layout: tmpl.layout || { style: 'feedback-classic', components: [] },
                            config: tmpl.config || {},
                          });
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-dark-border bg-dark-bg hover:border-dark-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Star size={16} className={isSelected ? 'text-amber-400' : 'text-dark-muted'} />
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
                  {t('displayFormExtra.noFeedbackTemplates')}
                </div>
              )}
            </div>
          )}

          {(parameters.content_type as string) === 'text' && (
            <div className="space-y-3">
              {/* Text content */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.textContent')}</label>
                <textarea
                  value={(parameters.content as string) || ''}
                  onChange={(e) => handleParametersChange({ content: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
                />
              </div>

              {/* Position: horizontal + vertical selects */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.positionX')}</label>
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
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.positionY')}</label>
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
                <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.textColor')}</label>
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
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.fontFamily')}</label>
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
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.fontSize')}</label>
                  <select
                    value={(parameters.font_size as number) || ''}
                    onChange={(e) => handleParametersChange({ font_size: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    <option value="">{t('displayFormExtra.auto')}</option>
                    {fontSizes.map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.fontWeight')}</label>
                  <select
                    value={(parameters.font_weight as string) || ''}
                    onChange={(e) => handleParametersChange({ font_weight: e.target.value || undefined })}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2 py-1.5 text-dark-text text-sm"
                  >
                    <option value="">{t('displayFormExtra.normal')}</option>
                    <option value="300">{t('displayFormExtra.light')}</option>
                    <option value="700">{t('displayFormExtra.bold')}</option>
                  </select>
                </div>
              </div>

              {/* Animation row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-dark-muted mb-1">{t('displayForm.animation')}</label>
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
                      {t('displayForm.animationSpeed')}: {(parameters.animation_speed as number) || 10}s
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
              <label className="block text-sm font-medium text-dark-text mb-1">{t('displayForm.imageUrl')}</label>
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
}: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
}) {
  const { t } = useTranslation('sessions');
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

  const commands = [
    { value: 'power_on', label: t('actuatorForm.powerOn') },
    { value: 'power_off', label: t('actuatorForm.powerOff') },
    { value: 'toggle', label: t('actuatorForm.toggle') },
    { value: 'open', label: t('actuatorForm.open') },
    { value: 'close', label: t('actuatorForm.close') },
    { value: 'set_position', label: t('actuatorForm.setPosition') },
    { value: 'execute', label: t('actuatorForm.execute') },
  ];

  const devices = resources?.items || [];

  const handleParametersChange = (updates: Record<string, unknown>) => {
    onChange({ parameters: { ...parameters, ...updates } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('actuatorForm.command')}</label>
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
            <label className="text-sm font-medium text-dark-text">{t('actuatorForm.device')}</label>
            <button
              onClick={() => refetch()}
              className="text-xs text-dark-muted hover:text-dark-text flex items-center gap-1"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              {t('actuatorForm.refresh')}
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
          <label className="block text-sm font-medium text-dark-text mb-1">{t('actuatorForm.device')}</label>
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
            {t('actuatorForm.position')} ({(parameters.position as number) || 0}%)
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
        <label className="block text-sm font-medium text-dark-text mb-1">{t('actuatorForm.value')}</label>
        <input
          type="text"
          value={(parameters.value as string) || ''}
          onChange={(e) => handleParametersChange({ value: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          placeholder={t('actuatorFormExtra.optionalValue')}
        />
      </div>
    </div>
  );
}


// ============================================================================
// Session Action Form
// ============================================================================

function SessionForm({ action, onChange }: {
  action: ActionItem;
  onChange: (updates: Partial<ActionItem>) => void;
}) {
  const { t } = useTranslation('sessions');
  const command = action.command;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">{t('sessionForm.command')}</label>
        <select
          value={command}
          onChange={(e) => onChange({ command: e.target.value })}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          <option value="open_feedback">
            {t('sessionForm.openFeedback')}
          </option>
        </select>
      </div>

      {command === 'open_feedback' && (
        <div className="text-sm text-dark-muted bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
          <ClipboardCheck size={14} className="inline mr-1 text-teal-400" />
          {t('sessionForm.feedbackDescription')}
        </div>
      )}
    </div>
  );
}
