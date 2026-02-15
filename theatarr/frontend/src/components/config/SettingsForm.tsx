import { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Button, Input, Card } from '../common';

interface SettingsFormProps {
  settings: Record<string, unknown>;
  onSave: (settings: Record<string, unknown>) => void;
  isSaving: boolean;
  onHasChangesChange?: (hasChanges: boolean) => void;
  renderActions?: (props: { hasChanges: boolean; onSave: () => void; onReset: () => void }) => React.ReactNode;
}

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'select';
  defaultValue?: unknown;
  category: string;
  options?: { value: string; label: string }[];
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
    key: 'site.frontend_url',
    label: 'URL du site',
    description: 'URL publique de l\'application (pour QR codes, liens portail). Ex: http://192.168.1.10:2173 ou https://theatarr.mondomaine.fr',
    type: 'string',
    defaultValue: '',
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
  {
    key: 'voting.poster_display',
    label: 'Affichage film en vote',
    description: 'Style d\'affichage quand le vote est en attente',
    type: 'select',
    defaultValue: 'animation',
    category: 'Voting',
    options: [
      { value: 'animation', label: 'Animation VotePoster' },
      { value: 'posters', label: 'Collage des affiches' },
    ],
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

export function SettingsForm({ settings, onSave, isSaving, onHasChangesChange, renderActions }: SettingsFormProps) {
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

  // Notify parent of hasChanges state
  useEffect(() => {
    onHasChangesChange?.(hasChanges);
  }, [hasChanges, onHasChangesChange]);

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
              className="w-4 h-4 rounded border-dark-border bg-dark-bg text-theatarr-500"
            />
            <span className="text-sm text-dark-text">Enabled</span>
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
      case 'select':
        return (
          <select
            value={String(value ?? def.defaultValue ?? '')}
            onChange={(e) => updateSetting(def.key, e.target.value)}
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text focus:outline-none focus:ring-2 focus:ring-theatarr-500 text-sm"
          >
            {def.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-dark-text placeholder-dark-muted focus:outline-none focus:ring-2 focus:ring-theatarr-500 font-mono text-sm"
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
                    <label className="block text-sm font-medium text-dark-text">{def.label}</label>
                    <p className="text-xs text-dark-muted mt-0.5">{def.description}</p>
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
            <h2 className="text-lg font-semibold text-dark-text">Parametres personnalises</h2>
            <Button variant="ghost" size="sm" onClick={addCustomSetting}>
              <Plus size={14} />
              <span className="ml-1">Ajouter</span>
            </Button>
          </div>

          {customSettings.length === 0 ? (
            <p className="text-dark-muted text-sm">Aucun parametre personnalise. Cliquez sur "Ajouter" pour en creer un.</p>
          ) : (
            <div className="space-y-3">
              {customSettings.map((setting, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Input
                    value={setting.key}
                    onChange={(e) => updateCustomSetting(index, 'key', e.target.value)}
                    placeholder="Cle du parametre"
                    className="flex-1"
                  />
                  <Input
                    value={setting.value}
                    onChange={(e) => updateCustomSetting(index, 'value', e.target.value)}
                    placeholder="Valeur (JSON ou texte)"
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

      {/* Actions - render via prop or default footer */}
      {renderActions ? (
        renderActions({ hasChanges, onSave: handleSave, onReset: handleReset })
      ) : (
        <div className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-lg sticky bottom-4">
          <div className="text-sm text-dark-muted">
            {hasChanges ? 'Modifications non enregistrees' : 'Tous les changements sont enregistres'}
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={handleReset} disabled={!hasChanges}>
              <RefreshCw size={14} />
              <span className="ml-1">Reinitialiser</span>
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                'Enregistrement...'
              ) : (
                <>
                  <Save size={14} />
                  <span className="ml-1">Enregistrer</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
