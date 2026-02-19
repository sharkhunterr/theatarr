import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Save,
  RefreshCw,
  Shield,
  Database,
  Film,
  Palette,
  FileText,
} from 'lucide-react';
import { Button, Card, Spinner, PageHeader, ButtonGroup } from '../components/common';
import { ExportButton } from '../components/config/ExportButton';
import { ImportWizard } from '../components/config/ImportWizard';
import { SettingsForm } from '../components/config/SettingsForm';
import { apiClient } from '../api/client';

interface SettingsData {
  settings: Record<string, unknown>;
}

export function ConfigPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'settings' | 'export' | 'import'>('settings');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [settingsHasChanges, setSettingsHasChanges] = useState(false);
  const settingsActionsRef = useRef<{ onSave: () => void; onReset: () => void } | null>(null);

  // Fetch settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => apiClient.get<SettingsData>('/config/settings'),
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: Record<string, unknown>) => {
      await apiClient.post('/config/settings/batch', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const handleSaveSettings = (settings: Record<string, unknown>) => {
    saveSettingsMutation.mutate(settings);
  };

  return (
    <div>
      <PageHeader
        title="Parametres"
        subtitle="Configuration générale de l'application"
        actions={
          activeTab === 'settings' && settingsHasChanges ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => settingsActionsRef.current?.onReset()}
                className="h-9 px-3 rounded-md border border-dark-border text-sm font-medium text-dark-text hover:bg-dark-border/50 transition-colors"
              >
                <RefreshCw className="h-4 w-4 sm:mr-1.5 inline" />
                <span className="hidden sm:inline">Reinitialiser</span>
              </button>
              <button
                onClick={() => settingsActionsRef.current?.onSave()}
                disabled={saveSettingsMutation.isPending}
                className="h-9 px-3 rounded-md bg-theatarr-600 text-white text-sm font-medium hover:bg-theatarr-700 transition-colors disabled:opacity-50"
              >
                {saveSettingsMutation.isPending ? (
                  '...'
                ) : (
                  <>
                    <Save className="h-4 w-4 sm:mr-1.5 inline" />
                    <span className="hidden sm:inline">Enregistrer</span>
                  </>
                )}
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="mb-6">
        <ButtonGroup
          options={[
            { key: 'settings' as const, label: 'Parametres' },
            { key: 'export' as const, label: 'Export' },
            { key: 'import' as const, label: 'Import' },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <>
          {settingsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : (
            <SettingsForm
              settings={settingsData?.settings || {}}
              onSave={handleSaveSettings}
              isSaving={saveSettingsMutation.isPending}
              onHasChangesChange={setSettingsHasChanges}
              renderActions={({ hasChanges, onSave, onReset }) => {
                // Store actions in ref for header buttons
                settingsActionsRef.current = { onSave, onReset };
                // Return null to hide the default footer
                return null;
              }}
            />
          )}
        </>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <Card>
            <div className="p-4 sm:p-6">
              <h2 className="text-base font-semibold mb-1 text-dark-text">Exporter la configuration</h2>
              <p className="text-sm text-dark-muted mb-4">
                Exportez votre configuration incluant sessions, services, templates et parametres.
              </p>
              <ExportButton />
            </div>
          </Card>

          {/* Export Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4 flex items-center gap-3">
              <Database className="h-5 w-5 text-theatarr-400 flex-shrink-0" />
              <div className="text-sm font-medium text-dark-text">Sessions</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div className="text-sm font-medium text-dark-text">Services</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4 flex items-center gap-3">
              <Palette className="h-5 w-5 text-purple-400 flex-shrink-0" />
              <div className="text-sm font-medium text-dark-text">Templates</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4 flex items-center gap-3">
              <Film className="h-5 w-5 text-yellow-400 flex-shrink-0" />
              <div className="text-sm font-medium text-dark-text">Bandes-annonces</div>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card>
            <div className="p-4 sm:p-6">
              <h2 className="text-base font-semibold mb-1 text-dark-text">Importer la configuration</h2>
              <p className="text-sm text-dark-muted mb-4">
                Restaurez la configuration depuis une sauvegarde exportee.
              </p>
              <button
                onClick={() => setIsImportOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 bg-theatarr-600 text-white rounded-md text-sm font-medium hover:bg-theatarr-700 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Demarrer l'import
              </button>
            </div>
          </Card>

          {/* Import Info */}
          <Card>
            <div className="p-4 sm:p-6">
              <h3 className="text-sm font-medium text-dark-text mb-4">Processus d'import</h3>
              <div className="space-y-4">
                {[
                  { icon: FileText, color: 'bg-theatarr-500/20 text-theatarr-400', title: '1. Selectionner le fichier', desc: 'Fichier de configuration exporte' },
                  { icon: RefreshCw, color: 'bg-theatarr-500/20 text-theatarr-400', title: '2. Apercu des changements', desc: 'Examinez les modifications' },
                  { icon: Shield, color: 'bg-theatarr-500/20 text-theatarr-400', title: '3. Resoudre les conflits', desc: 'Gestion des elements existants' },
                  { icon: Save, color: 'bg-green-500/20 text-green-400', title: '4. Appliquer l\'import', desc: 'Configuration importee' },
                ].map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={step.title} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full ${step.color.split(' ')[0]} flex items-center justify-center flex-shrink-0`}>
                        <StepIcon className={`h-4 w-4 ${step.color.split(' ')[1]}`} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-dark-text">{step.title}</div>
                        <div className="text-xs text-dark-muted">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Import Wizard Modal */}
      <ImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onComplete={() => {
          setIsImportOpen(false);
          queryClient.invalidateQueries();
        }}
      />
    </div>
  );
}
