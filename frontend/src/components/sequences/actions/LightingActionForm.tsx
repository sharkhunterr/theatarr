import { Input } from '../../common';

interface LightingActionFormProps {
  command: string;
  parameters: Record<string, unknown>;
  onCommandChange: (command: string) => void;
  onParametersChange: (parameters: Record<string, unknown>) => void;
}

const lightingCommands = [
  { value: 'set_color', label: 'Set Color' },
  { value: 'set_brightness', label: 'Set Brightness' },
  { value: 'turn_on', label: 'Turn On' },
  { value: 'turn_off', label: 'Turn Off' },
  { value: 'set_scene', label: 'Set Scene' },
];

export function LightingActionForm({
  command,
  parameters,
  onCommandChange,
  onParametersChange,
}: LightingActionFormProps) {
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
          {lightingCommands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>
              {cmd.label}
            </option>
          ))}
        </select>
      </div>

      {/* Target Lights */}
      <Input
        label="Target Lights"
        value={Array.isArray(parameters.targets) ? (parameters.targets as string[]).join(', ') : (parameters.targets as string) || ''}
        onChange={(e) => {
          const raw = e.target.value;
          const list = raw ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          onParametersChange({ ...parameters, targets: list });
        }}
        placeholder="e.g., living_room, bedroom (comma-separated or 'all')"
      />

      {/* Color (for set_color command) */}
      {command === 'set_color' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={(parameters.color as string) || '#ffffff'}
                onChange={(e) => onParametersChange({ ...parameters, color: e.target.value })}
                className="w-12 h-10 rounded border border-dark-border cursor-pointer"
              />
              <input
                type="text"
                value={(parameters.color as string) || '#ffffff'}
                onChange={(e) => onParametersChange({ ...parameters, color: e.target.value })}
                className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">
              Transition (ms)
            </label>
            <input
              type="number"
              value={(parameters.transition_ms as number) || 0}
              onChange={(e) =>
                onParametersChange({ ...parameters, transition_ms: parseInt(e.target.value) || 0 })
              }
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="100"
            />
          </div>
        </div>
      )}

      {/* Brightness (for set_brightness or set_color) */}
      {(command === 'set_brightness' || command === 'set_color') && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">
            Brightness ({(parameters.brightness as number) || 100}%)
          </label>
          <input
            type="range"
            value={(parameters.brightness as number) || 100}
            onChange={(e) =>
              onParametersChange({ ...parameters, brightness: parseInt(e.target.value) })
            }
            className="w-full accent-theatarr-500"
            min="0"
            max="100"
          />
        </div>
      )}

      {/* Scene Name (for set_scene command) */}
      {command === 'set_scene' && (
        <Input
          label="Scene Name"
          value={(parameters.scene as string) || ''}
          onChange={(e) => onParametersChange({ ...parameters, scene: e.target.value })}
          placeholder="e.g., movie, relax, bright"
        />
      )}
    </div>
  );
}
