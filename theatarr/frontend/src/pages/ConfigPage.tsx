import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  Upload,
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Shield,
  Database,
  Film,
  Palette,
  FileText,
} from 'lucide-react';
import { Button, Card, Modal, Input, Spinner } from '../components/common';
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
    queryFn: async () => {
      const response = await apiClient.get('/config/settings');
      return response.data;
    },
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Parametres</h1>
          <p className="text-dark-muted text-sm mt-1">
            Gerez les parametres de l'application et sauvegardez/restaurez la configuration
          </p>
        </div>
        {activeTab === 'settings' && settingsHasChanges && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => settingsActionsRef.current?.onReset()}
            >
              <RefreshCw size={16} className="mr-1" />
              <span className="hidden sm:inline">Reinitialiser</span>
            </Button>
            <Button
              onClick={() => settingsActionsRef.current?.onSave()}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                'Enregistrement...'
              ) : (
                <>
                  <Save size={16} className="mr-1" />
                  <span className="hidden sm:inline">Enregistrer</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-dark-border">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <SettingsIcon size={16} className="inline mr-2" />
          Parametres
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Download size={16} className="inline mr-2" />
          Export
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'import'
              ? 'text-theatarr-400 border-b-2 border-theatarr-400'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          <Upload size={16} className="inline mr-2" />
          Import
        </button>
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
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-dark-text">Exporter la configuration</h2>
              <p className="text-dark-muted mb-6">
                Exportez votre configuration Theatarr incluant les sessions, services, templates et
                parametres. Les donnees sensibles comme les cles API peuvent etre chiffrees.
              </p>

              <ExportButton />
            </div>
          </Card>

          {/* Export Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <Database size={20} className="text-theatarr-400 mb-2" />
              <div className="text-sm font-medium text-dark-text">Sessions</div>
              <div className="text-xs text-dark-muted">Configurations des sessions</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <Shield size={20} className="text-green-400 mb-2" />
              <div className="text-sm font-medium text-dark-text">Services</div>
              <div className="text-xs text-dark-muted">Configurations des services</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <Palette size={20} className="text-purple-400 mb-2" />
              <div className="text-sm font-medium text-dark-text">Templates</div>
              <div className="text-xs text-dark-muted">Modeles d'affichage</div>
            </div>
            <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
              <Film size={20} className="text-yellow-400 mb-2" />
              <div className="text-sm font-medium text-dark-text">Bandes-annonces</div>
              <div className="text-xs text-dark-muted">Regles de telechargement</div>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-dark-text">Importer la configuration</h2>
              <p className="text-dark-muted mb-6">
                Restaurez la configuration depuis une sauvegarde precedemment exportee. Vous pouvez
                previsualiser les changements avant de les appliquer.
              </p>

              <Button onClick={() => setIsImportOpen(true)}>
                <Upload size={16} />
                <span className="ml-2">Demarrer l'import</span>
              </Button>
            </div>
          </Card>

          {/* Import Info */}
          <Card>
            <div className="p-6">
              <h3 className="font-medium mb-4 text-dark-text">Processus d'import</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-theatarr-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">1. Selectionner le fichier</div>
                    <div className="text-sm text-dark-muted">
                      Choisissez un fichier de configuration exporte
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={16} className="text-theatarr-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">2. Apercu des changements</div>
                    <div className="text-sm text-dark-muted">
                      Examinez ce qui sera cree, mis a jour ou ignore
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-theatarr-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-theatarr-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">3. Resoudre les conflits</div>
                    <div className="text-sm text-dark-muted">
                      Choisissez comment gerer les elements existants
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Save size={16} className="text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">4. Appliquer l'import</div>
                    <div className="text-sm text-dark-muted">
                      La configuration est importee avec vos parametres
                    </div>
                  </div>
                </div>
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
