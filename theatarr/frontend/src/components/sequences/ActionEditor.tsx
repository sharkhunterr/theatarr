import { Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Input } from '../common';
import { LightingActionForm } from './actions/LightingActionForm';
import { AudioActionForm } from './actions/AudioActionForm';
import { MediaActionForm } from './actions/MediaActionForm';
import { DisplayActionForm } from './actions/DisplayActionForm';
import { useLayoutStore } from '../../stores/layoutStore';
import type { Action } from './SequenceEditor';

interface ActionEditorProps {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  onDelete: () => void;
  compact?: boolean;
}

const actionTypeLabels = {
  lighting: { en: 'Lighting', fr: 'Éclairage' },
  audio: { en: 'Audio', fr: 'Audio' },
  display: { en: 'Display', fr: 'Affichage' },
  media: { en: 'Media', fr: 'Média' },
  actuator: { en: 'Actuator', fr: 'Actionneur' },
};

const onFailureOptions = [
  { value: 'warn', en: 'Warn and continue', fr: 'Avertir et continuer' },
  { value: 'skip', en: 'Skip silently', fr: 'Ignorer' },
  { value: 'abort', en: 'Abort session', fr: 'Interrompre' },
];

export function ActionEditor({ action, onUpdate, onDelete, compact = false }: ActionEditorProps) {
  const { language } = useLayoutStore();

  const t = {
    editAction: language === 'fr' ? 'Modifier l\'action' : 'Edit Action',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    basicSettings: language === 'fr' ? 'Paramètres de base' : 'Basic Settings',
    actionType: language === 'fr' ? 'Type d\'action' : 'Action Type',
    delay: language === 'fr' ? 'Délai (ms)' : 'Delay (ms)',
    onFailure: language === 'fr' ? 'En cas d\'échec' : 'On Failure',
    parameters: language === 'fr' ? 'Paramètres' : 'Parameters',
    device: language === 'fr' ? 'Appareil' : 'Device',
    command: language === 'fr' ? 'Commande' : 'Command',
  };

  const handleTypeChange = (action_type: Action['action_type']) => {
    const defaultCommands = {
      lighting: 'set_color',
      audio: 'play',
      display: 'show',
      media: 'play',
      actuator: 'execute',
    };
    onUpdate({
      action_type,
      command: defaultCommands[action_type],
      parameters: {},
    });
  };

  const handleParametersChange = (parameters: Record<string, unknown>) => {
    onUpdate({ parameters });
  };

  const getLabel = (type: keyof typeof actionTypeLabels) =>
    language === 'fr' ? actionTypeLabels[type].fr : actionTypeLabels[type].en;

  if (compact) {
    return (
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-dark-text">{t.editAction}</span>
          <Button variant="danger" size="sm" onClick={onDelete} className="!p-1">
            <Trash2 size={12} />
          </Button>
        </div>

        <div className="space-y-1.5">
          <select
            value={action.action_type}
            onChange={(e) => handleTypeChange(e.target.value as Action['action_type'])}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
          >
            {Object.entries(actionTypeLabels).map(([value, labels]) => (
              <option key={value} value={value}>
                {language === 'fr' ? labels.fr : labels.en}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-1">
            <input
              type="number"
              value={action.delay_ms}
              onChange={(e) => onUpdate({ delay_ms: parseInt(e.target.value) || 0 })}
              className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
              min="0"
              step="100"
              placeholder={t.delay}
            />
            <select
              value={action.on_failure}
              onChange={(e) => onUpdate({ on_failure: e.target.value as Action['on_failure'] })}
              className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
            >
              {onFailureOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {language === 'fr' ? opt.fr : opt.en}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">{t.editAction}</h3>
        <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
          <Trash2 size={12} className="mr-1" />
          {t.delete}
        </Button>
      </div>

      {/* Basic Settings */}
      <Card>
        <CardHeader className="!py-2">
          <h4 className="text-xs font-medium text-dark-text">{t.basicSettings}</h4>
        </CardHeader>
        <CardContent className="space-y-3 !p-3">
          {/* Action Type */}
          <div>
            <label className="block text-xs font-medium text-dark-text mb-1">{t.actionType}</label>
            <select
              value={action.action_type}
              onChange={(e) => handleTypeChange(e.target.value as Action['action_type'])}
              className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-text"
            >
              {Object.entries(actionTypeLabels).map(([value, labels]) => (
                <option key={value} value={value}>
                  {language === 'fr' ? labels.fr : labels.en}
                </option>
              ))}
            </select>
          </div>

          {/* Delay & On Failure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1">{t.delay}</label>
              <input
                type="number"
                value={action.delay_ms}
                onChange={(e) => onUpdate({ delay_ms: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-text"
                min="0"
                step="100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-dark-text mb-1">{t.onFailure}</label>
              <select
                value={action.on_failure}
                onChange={(e) => onUpdate({ on_failure: e.target.value as Action['on_failure'] })}
                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-text"
              >
                {onFailureOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {language === 'fr' ? opt.fr : opt.en}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type-specific Parameters */}
      <Card>
        <CardHeader className="!py-2">
          <h4 className="text-xs font-medium text-dark-text">{getLabel(action.action_type)} {t.parameters}</h4>
        </CardHeader>
        <CardContent className="!p-3">
          {action.action_type === 'lighting' && (
            <LightingActionForm
              command={action.command}
              parameters={action.parameters}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {action.action_type === 'audio' && (
            <AudioActionForm
              command={action.command}
              parameters={action.parameters}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {action.action_type === 'media' && (
            <MediaActionForm
              command={action.command}
              parameters={action.parameters}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {action.action_type === 'display' && (
            <DisplayActionForm
              command={action.command}
              parameters={action.parameters}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {action.action_type === 'actuator' && (
            <div className="space-y-3">
              <Input
                label={t.device}
                value={(action.parameters.device as string) || ''}
                onChange={(e) =>
                  handleParametersChange({ ...action.parameters, device: e.target.value })
                }
                placeholder="e.g., projector"
              />
              <Input
                label={t.command}
                value={action.command}
                onChange={(e) => onUpdate({ command: e.target.value })}
                placeholder="e.g., power_on"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
