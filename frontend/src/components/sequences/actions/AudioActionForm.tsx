import { Input } from '../../common';

interface AudioActionFormProps {
  command: string;
  parameters: Record<string, unknown>;
  onCommandChange: (command: string) => void;
  onParametersChange: (parameters: Record<string, unknown>) => void;
}

const audioCommands = [
  { value: 'play', label: 'Play' },
  { value: 'pause', label: 'Pause' },
  { value: 'stop', label: 'Stop' },
  { value: 'set_volume', label: 'Set Volume' },
  { value: 'mute', label: 'Mute' },
  { value: 'unmute', label: 'Unmute' },
];

export function AudioActionForm({
  command,
  parameters,
  onCommandChange,
  onParametersChange,
}: AudioActionFormProps) {
  return (
    <div className="space-y-4">
      {/* Command Select */}
      <div>
        <label className="block text-sm font-medium text-dark-text mb-1">Command</label>
        <select
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
        >
          {audioCommands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>
              {cmd.label}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Source (for play command) */}
      {command === 'play' && (
        <Input
          label="Audio Source"
          value={(parameters.source as string) || ''}
          onChange={(e) => onParametersChange({ ...parameters, source: e.target.value })}
          placeholder="e.g., file path, URL, or source name"
        />
      )}

      {/* Volume (for set_volume or play) */}
      {(command === 'set_volume' || command === 'play') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            Volume ({(parameters.volume as number) ?? 50}%)
          </label>
          <input
            type="range"
            value={(parameters.volume as number) ?? 50}
            onChange={(e) =>
              onParametersChange({ ...parameters, volume: parseInt(e.target.value) })
            }
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      {/* Fade Duration */}
      {(command === 'set_volume' || command === 'play' || command === 'stop') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Fade Duration (ms)</label>
          <input
            type="number"
            value={(parameters.fade_ms as number) || 0}
            onChange={(e) =>
              onParametersChange({ ...parameters, fade_ms: parseInt(e.target.value) || 0 })
            }
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="100"
            placeholder="0 for instant"
          />
        </div>
      )}

      {/* Target Device */}
      <Input
        label="Target Device"
        value={(parameters.device as string) || ''}
        onChange={(e) => onParametersChange({ ...parameters, device: e.target.value })}
        placeholder="e.g., receiver, soundbar (optional)"
      />
    </div>
  );
}
