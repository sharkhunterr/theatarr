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
}

const actionTypeLabels = {
  lighting: 'Lighting',
  audio: 'Audio',
  display: 'Display',
  media: 'Media',
  actuator: 'Actuator',
};

const onFailureOptions = [
  { value: 'warn', label: 'Warn and continue' },
  { value: 'skip', label: 'Skip silently' },
  { value: 'abort', label: 'Abort session' },
];

export function ActionEditor({ action, onUpdate, onDelete }: ActionEditorProps) {
  const handleTypeChange = (action_type: Action['action_type']) => {
    // Reset command and parameters when type changes
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

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark-text">Edit Action</h3>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} className="mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <h4 className="font-medium text-dark-text">Basic Settings</h4>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Type */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Action Type</label>
            <select
              value={action.action_type}
              onChange={(e) => handleTypeChange(e.target.value as Action['action_type'])}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              {Object.entries(actionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Delay */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Delay (ms)</label>
              <input
                type="number"
                value={action.delay_ms}
                onChange={(e) => onUpdate({ delay_ms: parseInt(e.target.value) || 0 })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                min="0"
                step="100"
              />
            </div>

            {/* On Failure */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">On Failure</label>
              <select
                value={action.on_failure}
                onChange={(e) => onUpdate({ on_failure: e.target.value as Action['on_failure'] })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              >
                {onFailureOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type-specific Parameters */}
      <Card>
        <CardHeader>
          <h4 className="font-medium text-dark-text">{actionTypeLabels[action.action_type]} Parameters</h4>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-4">
              <Input
                label="Device"
                value={(action.parameters.device as string) || ''}
                onChange={(e) =>
                  handleParametersChange({ ...action.parameters, device: e.target.value })
                }
                placeholder="e.g., projector"
              />
              <Input
                label="Command"
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
