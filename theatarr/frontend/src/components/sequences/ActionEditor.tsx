import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Input } from '../common';
import { LightingActionForm } from './actions/LightingActionForm';
import { AudioActionForm } from './actions/AudioActionForm';
import { MediaActionForm } from './actions/MediaActionForm';
import { DisplayActionForm } from './actions/DisplayActionForm';
import type { Action } from './SequenceEditor';

interface ActionEditorProps {
  action: Action;
  onUpdate: (updates: Partial<Action>) => void;
  onDelete: () => void;
  compact?: boolean;
}

const actionTypeKeys: Record<string, string> = {
  lighting: 'sessions:actionTypes.lighting',
  audio: 'sessions:actionTypes.audio',
  display: 'sessions:actionTypes.display',
  media: 'sessions:actionTypes.media',
  actuator: 'sessions:actionTypes.actuator',
};

const onFailureKeys: { value: string; key: string }[] = [
  { value: 'warn', key: 'sessions:actionEditor.warn' },
  { value: 'skip', key: 'sessions:actionEditor.skip' },
  { value: 'abort', key: 'sessions:actionEditor.abort' },
];

export function ActionEditor({ action, onUpdate, onDelete, compact = false }: ActionEditorProps) {
  const { t } = useTranslation(['sessions', 'common']);

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

  if (compact) {
    return (
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-dark-text">{t('sessions:actionEditor.editAction')}</span>
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
            {Object.entries(actionTypeKeys).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
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
              placeholder={t('sessions:actionEditor.delayMs')}
            />
            <select
              value={action.on_failure}
              onChange={(e) => onUpdate({ on_failure: e.target.value as Action['on_failure'] })}
              className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
            >
              {onFailureKeys.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key)}
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
        <h3 className="text-sm font-semibold text-dark-text">{t('sessions:actionEditor.editAction')}</h3>
        <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
          <Trash2 size={12} className="mr-1" />
          {t('common:actions.delete')}
        </Button>
      </div>

      {/* Basic Settings */}
      <Card>
        <CardHeader className="!py-2">
          <h4 className="text-xs font-medium text-dark-text">{t('sessions:actionEditor.basicSettings')}</h4>
        </CardHeader>
        <CardContent className="space-y-3 !p-3">
          {/* Action Type */}
          <div>
            <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:actionEditor.actionType')}</label>
            <select
              value={action.action_type}
              onChange={(e) => handleTypeChange(e.target.value as Action['action_type'])}
              className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-text"
            >
              {Object.entries(actionTypeKeys).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          </div>

          {/* Delay & On Failure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:actionEditor.delayMs')}</label>
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
              <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:actionEditor.onFailure')}</label>
              <select
                value={action.on_failure}
                onChange={(e) => onUpdate({ on_failure: e.target.value as Action['on_failure'] })}
                className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-dark-text"
              >
                {onFailureKeys.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.key)}
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
          <h4 className="text-xs font-medium text-dark-text">{t(actionTypeKeys[action.action_type])} {t('sessions:actionEditor.parameters')}</h4>
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
                label={t('sessions:actionEditor.device')}
                value={(action.parameters.device as string) || ''}
                onChange={(e) =>
                  handleParametersChange({ ...action.parameters, device: e.target.value })
                }
                placeholder="e.g., projector"
              />
              <Input
                label={t('sessions:actionEditor.command')}
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
