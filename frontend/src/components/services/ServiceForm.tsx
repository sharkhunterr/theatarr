import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Library, Check } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Spinner } from '../common';
import { apiClient } from '../../api/client';
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

function isSensitiveKey(key: string): boolean {
  const sensitive = ['api_key', 'token', 'password', 'secret', 'key'];
  return sensitive.some((s) => key.toLowerCase().includes(s));
}

export function ServiceForm({ service, adapters, onSubmit, onCancel }: ServiceFormProps) {
  const { t } = useTranslation('services');
  // Pre-fill config from existing service — show all values including sensitive ones
  const initialConfig: Record<string, unknown> = {};
  if (service?.config) {
    for (const [key, value] of Object.entries(service.config)) {
      initialConfig[key] = value;
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

  // Library selection for media_source services
  const isMediaSource = formData.category === 'media_source';
  const [libraries, setLibraries] = useState<Array<{ id: string; title?: string; name?: string; type: string; count?: number }>>([]);
  const [librariesLoading, setLibrariesLoading] = useState(false);
  const [librariesError, setLibrariesError] = useState<string | null>(null);

  const fetchLibraries = useCallback(async () => {
    if (!service?.id) return;
    setLibrariesLoading(true);
    setLibrariesError(null);
    try {
      const res = await apiClient.get<{ libraries?: typeof libraries }>(`/services/${service.id}/resources`);
      setLibraries(res.libraries || []);
    } catch (err) {
      setLibrariesError(t('form.librariesError'));
    } finally {
      setLibrariesLoading(false);
    }
  }, [service?.id]);

  // Auto-fetch libraries when editing a media_source service
  useEffect(() => {
    if (service?.id && isMediaSource) {
      fetchLibraries();
    }
  }, [service?.id, isMediaSource, fetchLibraries]);

  const selectedLibraries = (formData.config.selected_libraries as string[]) || [];

  const toggleLibrary = (libId: string) => {
    const current = [...selectedLibraries];
    const idx = current.indexOf(String(libId));
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(String(libId));
    }
    handleConfigChange('selected_libraries', current);
  };

  // Track if user manually changed category (not the initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Reset adapter type only when user actively changes category
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
          <h3 className="font-medium text-dark-text">{t('form.basicInfo')}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t('form.name')}
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            error={errors.name}
            placeholder="e.g., Living Room Hue"
            required
          />

          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('form.description')}</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text min-h-[80px]"
              placeholder={t('form.descriptionPlaceholder')}
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
              {t('form.enableService')}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Adapter Selection */}
      <Card>
        <CardHeader>
          <h3 className="font-medium text-dark-text">{t('form.adapterConfig')}</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-1">{t('form.category')}</label>
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
            <label className="block text-sm font-medium text-dark-text mb-1">{t('form.adapterType')}</label>
            <select
              value={formData.adapter_type}
              onChange={(e) => handleAdapterChange(e.target.value)}
              className={`w-full bg-dark-bg border rounded-lg px-3 py-2 text-dark-text ${
                errors.adapter_type ? 'border-red-500' : 'border-dark-border'
              }`}
              disabled={!!service}
            >
              <option value="">{t('form.selectAdapter')}</option>
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
                {t('form.noAdapters')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Config Fields */}
      {selectedAdapter && selectedAdapter.config_schema?.properties && (
        <Card>
          <CardHeader>
            <h3 className="font-medium text-dark-text">{selectedAdapter.display_name} — {t('form.settings')}</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(selectedAdapter.config_schema.properties).map(([key, schema]) => {
              const isRequired = selectedAdapter.config_schema.required?.includes(key);
              const error = errors[`config.${key}`];

              return (
                <Input
                  key={key}
                  label={`${key}${isRequired ? ' *' : ''}`}
                  value={(formData.config[key] as string) || ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  error={error}
                  placeholder={schema.description || `Enter ${key}`}
                  type="text"
                />
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Library Selection — only for media_source when editing */}
      {isMediaSource && service?.id && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Library size={18} className="text-theatarr-500" />
                <h3 className="font-medium text-dark-text">{t('form.libraries')}</h3>
              </div>
              <button
                type="button"
                onClick={fetchLibraries}
                disabled={librariesLoading}
                className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-border/50 transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw size={16} className={librariesLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {librariesLoading && libraries.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <Spinner size="sm" />
                <span className="ml-2 text-sm text-dark-muted">{t('form.loadingLibraries')}</span>
              </div>
            ) : librariesError ? (
              <div className="text-sm text-red-400 py-2">{librariesError}</div>
            ) : libraries.length === 0 ? (
              <p className="text-sm text-dark-muted py-2">
                {t('form.noLibraries')}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-dark-muted mb-3">
                  {t('form.librariesHelp')}
                </p>
                {libraries.map((lib) => {
                  const libId = String(lib.id);
                  const libName = lib.title || lib.name || libId;
                  const isSelected = selectedLibraries.includes(libId);
                  return (
                    <button
                      key={libId}
                      type="button"
                      onClick={() => toggleLibrary(libId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? 'border-theatarr-500 bg-theatarr-500/10'
                          : 'border-dark-border hover:border-dark-border/80 hover:bg-dark-bg/50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-theatarr-500 border-theatarr-500'
                            : 'border-dark-border'
                        }`}
                      >
                        {isSelected && <Check size={14} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-dark-text truncate">{libName}</div>
                        <div className="text-xs text-dark-muted">
                          {lib.type || 'unknown'}
                          {lib.count != null && lib.count > 0 && ` · ${lib.count} ${t('form.elements')}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('form.saving') : service ? t('form.updateService') : t('form.createService')}
        </Button>
      </div>
    </form>
  );
}
