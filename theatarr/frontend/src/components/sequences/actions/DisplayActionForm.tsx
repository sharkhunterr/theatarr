import { Input } from '../../common';

interface DisplayActionFormProps {
  command: string;
  parameters: Record<string, unknown>;
  onCommandChange: (command: string) => void;
  onParametersChange: (parameters: Record<string, unknown>) => void;
}

const displayCommands = [
  { value: 'show', label: 'Show Content' },
  { value: 'hide', label: 'Hide Content' },
  { value: 'set_input', label: 'Set Input Source' },
  { value: 'power_on', label: 'Power On' },
  { value: 'power_off', label: 'Power Off' },
  { value: 'set_mode', label: 'Set Display Mode' },
];

const displayModes = [
  { value: 'movie', label: 'Movie' },
  { value: 'game', label: 'Game' },
  { value: 'sport', label: 'Sport' },
  { value: 'standard', label: 'Standard' },
  { value: 'vivid', label: 'Vivid' },
];

const inputSources = [
  { value: 'hdmi1', label: 'HDMI 1' },
  { value: 'hdmi2', label: 'HDMI 2' },
  { value: 'hdmi3', label: 'HDMI 3' },
  { value: 'hdmi4', label: 'HDMI 4' },
  { value: 'component', label: 'Component' },
  { value: 'composite', label: 'Composite' },
  { value: 'usb', label: 'USB' },
];

export function DisplayActionForm({
  command,
  parameters,
  onCommandChange,
  onParametersChange,
}: DisplayActionFormProps) {
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
          {displayCommands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>
              {cmd.label}
            </option>
          ))}
        </select>
      </div>

      {/* Input Source (for set_input) */}
      {command === 'set_input' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Input Source</label>
          <select
            value={(parameters.input as string) || 'hdmi1'}
            onChange={(e) => onParametersChange({ ...parameters, input: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            {inputSources.map((src) => (
              <option key={src.value} value={src.value}>
                {src.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Display Mode (for set_mode) */}
      {command === 'set_mode' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Display Mode</label>
          <select
            value={(parameters.mode as string) || 'movie'}
            onChange={(e) => onParametersChange({ ...parameters, mode: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
          >
            {displayModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Show Content Options */}
      {command === 'show' && (
        <>
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Content Type</label>
            <select
              value={(parameters.content_type as string) || 'text'}
              onChange={(e) => onParametersChange({ ...parameters, content_type: e.target.value })}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="template">Template</option>
            </select>
          </div>

          {(parameters.content_type as string) === 'text' && (
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Text Content</label>
              <textarea
                value={(parameters.content as string) || ''}
                onChange={(e) => onParametersChange({ ...parameters, content: e.target.value })}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
                placeholder="Enter text to display..."
              />
            </div>
          )}

          {(parameters.content_type as string) === 'image' && (
            <Input
              label="Image URL"
              value={(parameters.image_url as string) || ''}
              onChange={(e) => onParametersChange({ ...parameters, image_url: e.target.value })}
              placeholder="e.g., /images/logo.png or http://..."
            />
          )}

          {(parameters.content_type as string) === 'template' && (
            <Input
              label="Template Name"
              value={(parameters.template as string) || ''}
              onChange={(e) => onParametersChange({ ...parameters, template: e.target.value })}
              placeholder="e.g., movie_info, countdown"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">
              Display Duration (ms)
            </label>
            <input
              type="number"
              value={(parameters.duration_ms as number) || 5000}
              onChange={(e) =>
                onParametersChange({ ...parameters, duration_ms: parseInt(e.target.value) || 5000 })
              }
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              min="0"
              step="1000"
              placeholder="0 for indefinite"
            />
          </div>
        </>
      )}

      {/* Target Display */}
      <Input
        label="Target Display"
        value={(parameters.device as string) || ''}
        onChange={(e) => onParametersChange({ ...parameters, device: e.target.value })}
        placeholder="e.g., projector, tv (optional)"
      />
    </div>
  );
}
