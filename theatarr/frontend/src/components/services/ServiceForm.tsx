import { useState, useEffect } from 'react';
import { Button, Input, Card, CardContent, CardHeader } from '../common';
import type { Service } from './ServiceCard';

interface AdapterInfo {
  type: string;
  category: string;
  display_name: string;
  config_schema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

interface ServiceFormProps {
  service?: Service;
  adapters: AdapterInfo[];
  onSubmit: (data: ServiceFormData) => Promise<void>;
  onCancel: () => void;
}

export interface ServiceFormData {
  name: string;
  description?: string;
  adapter_type: string;
  category: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
}

const categoryLabels: Record<string, string> = {
  lighting: 'Lighting',
  player: 'Media Player',
  media_source: 'Media Source',
  actuator: 'Actuator',
  metadata: 'Metadata',
};

const MASKED_VALUE = '********';

function isSensitiveKey(key: string): boolean {
  const sensitive = ['api_key', 'token', 'password', 'secret', 'key'];
  return sensitive.some((s) => key.toLowerCase().includes(s));
}

export function ServiceForm({ service, adapters, onSubmit, onCancel }: ServiceFormProps) {
  // Pre-fill config from existing service, replacing masked values with empty string
  const initialConfig: Record<string, unknown> = {};
  if (service?.config) {
    for (const [key, value] of Object.entries(service.config)) {
      initialConfig[key] = value === MASKED_VALUE ? '' : value;
    }
  }

  const [formData, setFormData] = useState<ServiceFormData>({
    name: service?.name || '',
    description: service?.description || '',
    adapter_type: service?.adapter_type || '',
    category: service?.category || 'lighting',
    config: initialConfig,
    is_enabled: service?.is_enabled ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedAdapter = adapters.find((a) => a.type === formData.adapter_type);
  const filteredAdapters = adapters.filter((a) => a.category === formData.category);

  useEffect(() => {
    // Reset adapter type if category changes and current adapter doesn't match
    if (formData.adapter_type && selectedAdapter?.category !== formData.category) {
      setFormData((prev) => ({ ...prev, adapter_type: '', config: {} }));
    }
  }, [formData.category]);

  const handleAdapterChange = (adapterType: string) => {
    const adapter = adapters.find((a) => a.type === adapterType);
    const defaultConfig: Record<string, unknown> = {};

    // Initialize default config values
    if (adapter?.config_schema?.properties) {
      Object.keys(adapter.config_schema.properties).forEach((key) => {
        defaultConfig[key] = '';
      });
    }

    setFormData((prev) => ({
      ...prev,
      adapter_type: adapterType,
      config: defaultConfig,
    }));
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.adapter_type) {
      newErrors.adapter_type = 'Adapter type is required';
    }

    // Validate required config fields (skip sensitive fields when editing — already stored)
    if (selectedAdapter?.config_schema?.required) {
      selectedAdapter.config_schema.required.forEach((field) => {
        const isEmpty = !formData.config[field];
        const isMaskedEdit = !!service && isSensitiveKey(field);
        if (isEmpty && !isMaskedEdit) {
          newErrors[`config.${field}`] = `${field} is required`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // When editing, strip empty sensitive fields so the backend merge preserves originals
    const submitData = { ...formData };
    if (service) {
      const cleanConfig = { ...submitData.config };
      for (const key of Object.keys(cleanConfig)) {
        if (isSensitiveKey(key) && !cleanConfig[key]) {
          delete cleanConfig[key];
        }
      }
      submitData.config = cleanConfig;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(submitData);
    } catch (error) {
      console.error('Failed to submit service:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <h3 className="font-medium text-dark-text">Basic Information</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g., Living Room Hue"
            required
          />

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
              placeholder="Optional description"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_enabled"
              checked={formData.is_enabled}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, is_enabled: e.target.checked }))
              }
              className="w-4 h-4 accent-theatarr-500"
            />
            <label htmlFor="is_enabled" className="text-sm text-dark-text">
              Enable this service
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Adapter Selection */}
      <Card>
        <CardHeader>
          <h3 className="font-medium text-dark-text">Adapter Configuration</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text"
              disabled={!!service}
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Adapter Type Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">Adapter Type</label>
            <select
              value={formData.adapter_type}
              onChange={(e) => handleAdapterChange(e.target.value)}
              className={`w-full bg-dark-bg border rounded-lg px-3 py-2 text-dark-text ${
                errors.adapter_type ? 'border-red-500' : 'border-dark-border'
              }`}
              disabled={!!service}
            >
              <option value="">Select an adapter...</option>
              {filteredAdapters.map((adapter) => (
                <option key={adapter.type} value={adapter.type}>
                  {adapter.display_name}
                </option>
              ))}
            </select>
            {errors.adapter_type && (
              <p className="text-red-500 text-sm mt-1">{errors.adapter_type}</p>
            )}
            {filteredAdapters.length === 0 && (
              <p className="text-dark-muted text-sm mt-1">
                No adapters available for this category
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Config Fields */}
      {selectedAdapter && selectedAdapter.config_schema?.properties && (
        <Card>
          <CardHeader>
            <h3 className="font-medium text-dark-text">{selectedAdapter.display_name} Settings</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(selectedAdapter.config_schema.properties).map(([key, schema]) => {
              const isRequired = selectedAdapter.config_schema.required?.includes(key);
              const error = errors[`config.${key}`];
              const sensitive = isSensitiveKey(key);
              const wasMasked = !!service && sensitive;

              return (
                <Input
                  key={key}
                  label={`${key}${isRequired ? ' *' : ''}`}
                  value={(formData.config[key] as string) || ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  error={error}
                  placeholder={wasMasked ? 'Leave empty to keep current value' : (schema.description || `Enter ${key}`)}
                  type={sensitive ? 'password' : 'text'}
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  );
}
