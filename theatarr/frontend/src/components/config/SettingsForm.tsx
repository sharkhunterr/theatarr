import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Card } from '../common';

interface SettingsFormProps {
  settings: Record<string, unknown>;
  onSave: (settings: Record<string, unknown>) => void;
  isSaving: boolean;
}

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue?: unknown;
  category: string;
}

// Predefined settings schema
const SETTINGS_SCHEMA: SettingDefinition[] = [
  // General
  {
    key: 'app.name',
    label: 'Application Name',
    description: 'Display name shown in the UI',
    type: 'string',
    defaultValue: 'Theatarr',
    category: 'General',
  },
  {
    key: 'app.timezone',
    label: 'Timezone',
    description: 'Default timezone for scheduling',
    type: 'string',
    defaultValue: 'UTC',
    category: 'General',
  },
  {
    key: 'app.language',
    label: 'Language',
    description: 'Default language for the UI',
    type: 'string',
    defaultValue: 'en',
    category: 'General',
  },

  // Sessions
  {
    key: 'session.default_transition_ms',
    label: 'Default Transition Duration (ms)',
    description: 'Default transition time between sequences',
    type: 'number',
    defaultValue: 1000,
    category: 'Sessions',
  },
  {
    key: 'session.auto_resume',
    label: 'Auto Resume Sessions',
    description: 'Automatically resume interrupted sessions on startup',
    type: 'boolean',
    defaultValue: true,
    category: 'Sessions',
  },

  // Wallmount
  {
    key: 'wallmount.refresh_interval_ms',
    label: 'Wallmount Refresh Interval (ms)',
    description: 'How often the wallmount display refreshes',
    type: 'number',
    defaultValue: 5000,
    category: 'Wallmount',
  },
  {
    key: 'wallmount.show_clock',
    label: 'Show Clock',
    description: 'Display current time on wallmount',
    type: 'boolean',
    defaultValue: true,
    category: 'Wallmount',
  },
  {
    key: 'wallmount.default_template_id',
    label: 'Default Template ID',
    description: 'Template to use when none is specified',
    type: 'string',
    defaultValue: '',
    category: 'Wallmount',
  },

  // Trailers
  {
    key: 'trailers.storage_path',
    label: 'Trailer Storage Path',
    description: 'Directory where trailers are stored',
    type: 'string',
    defaultValue: '/data/trailers',
    category: 'Trailers',
  },
  {
    key: 'trailers.max_concurrent_downloads',
    label: 'Max Concurrent Downloads',
    description: 'Maximum number of trailers to download simultaneously',
    type: 'number',
    defaultValue: 2,
    category: 'Trailers',
  },
  {
    key: 'trailers.auto_delete_watched',
    label: 'Auto Delete Watched',
    description: 'Automatically delete trailers after being watched',
    type: 'boolean',
    defaultValue: false,
    category: 'Trailers',
  },

  // Voting
  {
    key: 'voting.session_timeout_hours',
    label: 'Vote Session Timeout (hours)',
    description: 'Auto-close vote sessions after this time',
    type: 'number',
    defaultValue: 24,
    category: 'Voting',
  },
  {
    key: 'voting.allow_multiple_votes',
    label: 'Allow Multiple Votes',
    description: 'Allow users to vote for multiple movies',
    type: 'boolean',
    defaultValue: false,
    category: 'Voting',
  },

  // API
  {
    key: 'api.rate_limit_per_minute',
    label: 'Rate Limit (requests/min)',
    description: 'Maximum API requests per minute per IP',
    type: 'number',
    defaultValue: 60,
    category: 'API',
  },
  {
    key: 'api.cors_origins',
    label: 'CORS Origins',
    description: 'Allowed CORS origins (comma-separated)',
    type: 'string',
    defaultValue: '*',
    category: 'API',
  },
];

export function SettingsForm({ settings, onSave, isSaving }: SettingsFormProps) {
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const [customSettings, setCustomSettings] = useState<Array<{ key: string; value: string }>>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Initialize local settings with defaults and current values
    const initial: Record<string, unknown> = {};
    SETTINGS_SCHEMA.forEach((def) => {
      initial[def.key] = settings[def.key] ?? def.defaultValue;
    });
    setLocalSettings(initial);

    // Find custom settings (not in schema)
    const schemaKeys = new Set(SETTINGS_SCHEMA.map((d) => d.key));
    const custom = Object.entries(settings)
      .filter(([key]) => !schemaKeys.has(key))
      .map(([key, value]) => ({ key, value: JSON.stringify(value) }));
    setCustomSettings(custom);

    setHasChanges(false);
  }, [settings]);

  const updateSetting = (key: string, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const addCustomSetting = () => {
    setCustomSettings((prev) => [...prev, { key: '', value: '' }]);
    setHasChanges(true);
  };

  const updateCustomSetting = (index: number, field: 'key' | 'value', value: string) => {
    setCustomSettings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const removeCustomSetting = (index: number) => {
    setCustomSettings((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = () => {
    const allSettings: Record<string, unknown> = { ...localSettings };

    // Add custom settings
    customSettings.forEach(({ key, value }) => {
      if (key.trim()) {
        try {
          allSettings[key.trim()] = JSON.parse(value);
        } catch {
          allSettings[key.trim()] = value;
        }
      }
    });

    onSave(allSettings);
  };

  const handleReset = () => {
    const initial: Record<string, unknown> = {};
    SETTINGS_SCHEMA.forEach((def) => {
      initial[def.key] = settings[def.key] ?? def.defaultValue;
    });
    setLocalSettings(initial);

    const schemaKeys = new Set(SETTINGS_SCHEMA.map((d) => d.key));
    const custom = Object.entries(settings)
      .filter(([key]) => !schemaKeys.has(key))
      .map(([key, value]) => ({ key, value: JSON.stringify(value) }));
    setCustomSettings(custom);

    setHasChanges(false);
  };

  // Group settings by category
  const categories = SETTINGS_SCHEMA.reduce(
    (acc, def) => {
      if (!acc[def.category]) {
        acc[def.category] = [];
      }
      acc[def.category].push(def);
      return acc;
    },
    {} as Record<string, SettingDefinition[]>
  );

  const renderSettingInput = (def: SettingDefinition) => {
    const value = localSettings[def.key];

    switch (def.type) {
      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => updateSetting(def.key, e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500"
            />
            <span className="text-sm text-gray-300">Enabled</span>
          </label>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={String(value ?? '')}
            onChange={(e) => updateSetting(def.key, parseFloat(e.target.value) || 0)}
          />
        );
      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                updateSetting(def.key, JSON.parse(e.target.value));
              } catch {
                updateSetting(def.key, e.target.value);
              }
            }}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
            rows={4}
          />
        );
      default:
        return (
          <Input
            value={String(value ?? '')}
            onChange={(e) => updateSetting(def.key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Settings by Category */}
      {Object.entries(categories).map(([category, defs]) => (
        <Card key={category}>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">{category}</h2>
            <div className="space-y-4">
              {defs.map((def) => (
                <div key={def.key} className="grid grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">{def.label}</label>
                    <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
                  </div>
                  <div className="col-span-2">{renderSettingInput(def)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}

      {/* Custom Settings */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Custom Settings</h2>
            <Button variant="ghost" size="sm" onClick={addCustomSetting}>
              <Plus size={14} />
              <span className="ml-1">Add Setting</span>
            </Button>
          </div>

          {customSettings.length === 0 ? (
            <p className="text-gray-500 text-sm">No custom settings. Click "Add Setting" to create one.</p>
          ) : (
            <div className="space-y-3">
              {customSettings.map((setting, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Input
                    value={setting.key}
                    onChange={(e) => updateCustomSetting(index, 'key', e.target.value)}
                    placeholder="Setting key"
                    className="flex-1"
                  />
                  <Input
                    value={setting.value}
                    onChange={(e) => updateCustomSetting(index, 'value', e.target.value)}
                    placeholder="Value (JSON or string)"
                    className="flex-[2]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCustomSetting(index)}
                    className="text-red-400"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg sticky bottom-4">
        <div className="text-sm text-gray-400">
          {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={handleReset} disabled={!hasChanges}>
            <RefreshCw size={14} />
            <span className="ml-1">Reset</span>
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save size={14} />
                <span className="ml-1">Save Settings</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
