import { Input } from '../../common';

interface MediaActionFormProps {
  command: string;
  parameters: Record<string, unknown>;
  onCommandChange: (command: string) => void;
  onParametersChange: (parameters: Record<string, unknown>) => void;
}

const mediaCommands = [
  { value: 'play', label: 'Play Media' },
  { value: 'pause', label: 'Pause' },
  { value: 'resume', label: 'Resume' },
  { value: 'stop', label: 'Stop' },
  { value: 'seek', label: 'Seek' },
  { value: 'next', label: 'Next Track/Chapter' },
  { value: 'previous', label: 'Previous Track/Chapter' },
];

export function MediaActionForm({
  command,
  parameters,
  onCommandChange,
  onParametersChange,
}: MediaActionFormProps) {
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
          {mediaCommands.map((cmd) => (
            <option key={cmd.value} value={cmd.value}>
              {cmd.label}
            </option>
          ))}
        </select>
      </div>

      {/* Media ID (for play command) */}
      {command === 'play' && (
        <>
          <Input
            label="Media ID"
            value={(parameters.media_id as string) || ''}
            onChange={(e) => onParametersChange({ ...parameters, media_id: e.target.value })}
            placeholder="e.g., plex://movie/12345 or file path"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Start Position</label>
              <input
                type="number"
                value={(parameters.position_ms as number) || 0}
                onChange={(e) =>
                  onParametersChange({
                    ...parameters,
                    position_ms: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
                min="0"
                step="1000"
                placeholder="ms"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Playback Speed</label>
              <select
                value={(parameters.speed as number) || 1}
                onChange={(e) =>
                  onParametersChange({ ...parameters, speed: parseFloat(e.target.value) })
                }
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x (Normal)</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Seek Position */}
      {command === 'seek' && (
        <div>
          <label className="block text-sm font-medium text-dark-text mb-1">Seek Position (ms)</label>
          <input
            type="number"
            value={(parameters.position_ms as number) || 0}
            onChange={(e) =>
              onParametersChange({ ...parameters, position_ms: parseInt(e.target.value) || 0 })
            }
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
            min="0"
            step="1000"
          />
        </div>
      )}

      {/* Target Player */}
      <Input
        label="Target Player"
        value={(parameters.player as string) || ''}
        onChange={(e) => onParametersChange({ ...parameters, player: e.target.value })}
        placeholder="e.g., plex, kodi, vlc (optional)"
      />

      {/* Subtitles (for play) */}
      {command === 'play' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="subtitles"
            checked={(parameters.subtitles as boolean) || false}
            onChange={(e) => onParametersChange({ ...parameters, subtitles: e.target.checked })}
            className="w-4 h-4 accent-theatarr-500"
          />
          <label htmlFor="subtitles" className="text-sm text-dark-text">
            Enable subtitles
          </label>
        </div>
      )}
    </div>
  );
}
