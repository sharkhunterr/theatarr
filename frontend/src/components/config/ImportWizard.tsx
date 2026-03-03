import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  FileText,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { Button, Modal, Input, Spinner } from '../common';
import { ConflictResolver } from './ConflictResolver';
import { apiClient } from '../../api/client';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface Conflict {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  conflict_type: string;
  details: string;
  existing_data: Record<string, unknown> | null;
  incoming_data: Record<string, unknown> | null;
}

interface ImportPreview {
  sessions: { create: number; update: number };
  services: { create: number; update: number };
  templates: { create: number; update: number };
  trailer_rules: { create: number; update: number };
  settings: boolean;
  conflicts: Conflict[];
  has_conflicts: boolean;
}

interface ImportResult {
  sessions_created: number;
  sessions_updated: number;
  sessions_skipped: number;
  services_created: number;
  services_updated: number;
  services_skipped: number;
  templates_created: number;
  templates_updated: number;
  templates_skipped: number;
  trailer_rules_created: number;
  trailer_rules_updated: number;
  trailer_rules_skipped: number;
  settings_updated: number;
  errors: string[];
}

type Step = 'upload' | 'preview' | 'conflicts' | 'importing' | 'complete';

export function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
  const { t } = useTranslation('settings');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.post('/config/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ImportPreview;
    },
    onSuccess: (data) => {
      setPreview(data);
      if (data.has_conflicts) {
        // Initialize all resolutions to 'overwrite'
        const initialResolutions: Record<string, string> = {};
        data.conflicts.forEach((c) => {
          initialResolutions[`${c.entity_type}:${c.entity_id}`] = 'overwrite';
        });
        setResolutions(initialResolutions);
        setStep('conflicts');
      } else {
        setStep('preview');
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      if (password) {
        formData.append('encryption_password', password);
      }
      if (Object.keys(resolutions).length > 0) {
        formData.append('conflict_resolutions', JSON.stringify(resolutions));
      }

      const response = await apiClient.post('/config/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data as ImportResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('complete');
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Read file content for validation
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setFileData(data);
        } catch {
          setFileData(null);
        }
      };
      reader.readAsText(selectedFile);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/json') {
      setFile(droppedFile);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setFileData(data);
        } catch {
          setFileData(null);
        }
      };
      reader.readAsText(droppedFile);
    }
  }, []);

  const handlePreview = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    previewMutation.mutate(formData);
  };

  const handleImport = () => {
    setStep('importing');
    importMutation.mutate();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setFileData(null);
    setPreview(null);
    setResolutions({});
    setPassword('');
    setResult(null);
    onClose();
  };

  const handleComplete = () => {
    handleClose();
    onComplete();
  };

  const hasEncryptedSecrets = fileData && 'encrypted_secrets' in fileData;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('config.import.modalTitle')} size="lg">
      <div className="min-h-[400px]">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors"
            >
              {file ? (
                <div className="space-y-2">
                  <FileText size={48} className="mx-auto text-indigo-400" />
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                  {fileData && (
                    <div className="text-sm text-green-400">{t('config.import.validFile')}</div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFile(null);
                      setFileData(null);
                    }}
                  >
                    {t('config.import.remove')}
                  </Button>
                </div>
              ) : (
                <>
                  <Upload size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="font-medium mb-2">{t('config.import.dropZone')}</div>
                  <div className="text-sm text-gray-500 mb-4">{t('config.import.or')}</div>
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                      {t('config.import.browseFiles')}
                    </span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>

            {/* Password for encrypted exports */}
            {hasEncryptedSecrets && (
              <div className="p-4 bg-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-medium">{t('config.import.encryptedConfig')}</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  {t('config.import.encryptedConfigDesc')}
                </p>
                <Input
                  label={t('config.import.decryptionPassword')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('config.import.enterExportPassword')}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button variant="ghost" onClick={handleClose}>
                {t('config.import.cancel')}
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!file || !fileData || previewMutation.isPending}
              >
                {previewMutation.isPending ? (
                  t('config.import.analyzing')
                ) : (
                  <>
                    {t('config.import.previewImport')}
                    <ChevronRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            </div>

            {previewMutation.error && (
              <div className="p-4 bg-red-500/20 rounded-lg text-red-400 text-sm">
                {t('config.import.analysisFailed')}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="p-4 bg-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <Check size={16} />
                <span className="font-medium">{t('config.import.readyToImport')}</span>
              </div>
              <p className="text-sm text-gray-400">
                {t('config.import.noConflicts')}
              </p>
            </div>

            {/* Changes Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.sessions')}</div>
                <div className="text-sm text-gray-400">
                  <div className="text-green-400">{preview.sessions.create} {t('config.import.toCreate')}</div>
                  <div className="text-yellow-400">{preview.sessions.update} {t('config.import.toUpdate')}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.services')}</div>
                <div className="text-sm text-gray-400">
                  <div className="text-green-400">{preview.services.create} {t('config.import.toCreate')}</div>
                  <div className="text-yellow-400">{preview.services.update} {t('config.import.toUpdate')}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.templates')}</div>
                <div className="text-sm text-gray-400">
                  <div className="text-green-400">{preview.templates.create} {t('config.import.toCreate')}</div>
                  <div className="text-yellow-400">{preview.templates.update} {t('config.import.toUpdate')}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.trailerRules')}</div>
                <div className="text-sm text-gray-400">
                  <div className="text-green-400">{preview.trailer_rules.create} {t('config.import.toCreate')}</div>
                  <div className="text-yellow-400">{preview.trailer_rules.update} {t('config.import.toUpdate')}</div>
                </div>
              </div>
            </div>

            {preview.settings && (
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="font-medium">{t('config.tabs.settings')}</div>
                <div className="text-sm text-gray-400">{t('config.import.settingsWillBeUpdated')}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ChevronLeft size={16} className="mr-1" />
                {t('config.import.back')}
              </Button>
              <Button onClick={handleImport}>
                {t('config.import.importConfiguration')}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Conflicts */}
        {step === 'conflicts' && preview && (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <AlertTriangle size={16} />
                <span className="font-medium">
                  {t('config.import.conflictsDetected', { count: preview.conflicts.length })}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {t('config.import.conflictsDescription')}
              </p>
            </div>

            <ConflictResolver
              conflicts={preview.conflicts}
              resolutions={resolutions}
              onResolutionChange={(key, value) =>
                setResolutions((prev) => ({ ...prev, [key]: value }))
              }
            />

            {/* Actions */}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ChevronLeft size={16} className="mr-1" />
                {t('config.import.back')}
              </Button>
              <Button onClick={handleImport}>
                {t('config.import.applyAndImport')}
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center h-64">
            <Spinner size="lg" />
            <div className="mt-4 font-medium">{t('config.import.importingConfig')}</div>
            <div className="text-sm text-gray-500">{t('config.import.importingWait')}</div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && result && (
          <div className="space-y-6">
            {result.errors.length === 0 ? (
              <div className="p-4 bg-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Check size={16} />
                  <span className="font-medium">{t('config.import.importComplete')}</span>
                </div>
                <p className="text-sm text-gray-400">
                  {t('config.import.importSuccess')}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <AlertTriangle size={16} />
                  <span className="font-medium">{t('config.import.importWithWarnings')}</span>
                </div>
                <p className="text-sm text-gray-400">
                  {t('config.import.importPartial')}
                </p>
              </div>
            )}

            {/* Results Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.sessions')}</div>
                <div className="space-y-1 text-gray-400">
                  <div>{t('config.import.results.created')} {result.sessions_created}</div>
                  <div>{t('config.import.results.updated')} {result.sessions_updated}</div>
                  <div>{t('config.import.results.skipped')} {result.sessions_skipped}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.services')}</div>
                <div className="space-y-1 text-gray-400">
                  <div>{t('config.import.results.created')} {result.services_created}</div>
                  <div>{t('config.import.results.updated')} {result.services_updated}</div>
                  <div>{t('config.import.results.skipped')} {result.services_skipped}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.templates')}</div>
                <div className="space-y-1 text-gray-400">
                  <div>{t('config.import.results.created')} {result.templates_created}</div>
                  <div>{t('config.import.results.updated')} {result.templates_updated}</div>
                  <div>{t('config.import.results.skipped')} {result.templates_skipped}</div>
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="font-medium mb-2">{t('config.import.results.trailerRules')}</div>
                <div className="space-y-1 text-gray-400">
                  <div>{t('config.import.results.created')} {result.trailer_rules_created}</div>
                  <div>{t('config.import.results.updated')} {result.trailer_rules_updated}</div>
                  <div>{t('config.import.results.skipped')} {result.trailer_rules_skipped}</div>
                </div>
              </div>
            </div>

            {result.settings_updated > 0 && (
              <div className="p-4 bg-gray-800 rounded-lg text-sm">
                <div className="font-medium">{t('config.tabs.settings')}</div>
                <div className="text-gray-400">{result.settings_updated} {t('config.import.results.settingsUpdated')}</div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="p-4 bg-red-500/20 rounded-lg">
                <div className="font-medium text-red-400 mb-2">{t('config.import.results.errors')}</div>
                <div className="space-y-1 text-sm text-gray-400">
                  {result.errors.map((error, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <X size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end">
              <Button onClick={handleComplete}>{t('config.import.results.done')}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
