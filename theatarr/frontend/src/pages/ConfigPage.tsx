import { useState } from 'react';
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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Configuration</h1>
          <p className="text-gray-500 mt-1">
            Manage application settings and backup/restore configuration
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <SettingsIcon size={16} className="inline mr-2" />
          Settings
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'export'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Download size={16} className="inline mr-2" />
          Export
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'import'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-gray-400 hover:text-white'
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
            />
          )}
        </>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Export Configuration</h2>
              <p className="text-gray-400 mb-6">
                Export your Theatarr configuration including sessions, services, templates, and
                settings. Sensitive data like API keys can be encrypted with a password.
              </p>

              <ExportButton />
            </div>
          </Card>

          {/* Export Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <Database size={20} className="text-indigo-400 mb-2" />
              <div className="text-sm font-medium">Sessions</div>
              <div className="text-xs text-gray-500">Session configurations with sequences</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <Shield size={20} className="text-green-400 mb-2" />
              <div className="text-sm font-medium">Services</div>
              <div className="text-xs text-gray-500">Connected service configurations</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <Palette size={20} className="text-purple-400 mb-2" />
              <div className="text-sm font-medium">Templates</div>
              <div className="text-xs text-gray-500">Custom wallmount templates</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <Film size={20} className="text-yellow-400 mb-2" />
              <div className="text-sm font-medium">Trailer Rules</div>
              <div className="text-xs text-gray-500">Auto-download configurations</div>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Import Configuration</h2>
              <p className="text-gray-400 mb-6">
                Restore configuration from a previously exported backup. You can preview changes
                before applying and resolve any conflicts.
              </p>

              <Button onClick={() => setIsImportOpen(true)}>
                <Upload size={16} />
                <span className="ml-2">Start Import</span>
              </Button>
            </div>
          </Card>

          {/* Import Info */}
          <Card>
            <div className="p-6">
              <h3 className="font-medium mb-4">Import Process</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-medium">1. Select File</div>
                    <div className="text-sm text-gray-500">
                      Choose a previously exported configuration file
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={16} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-medium">2. Preview Changes</div>
                    <div className="text-sm text-gray-500">
                      Review what will be created, updated, or skipped
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-medium">3. Resolve Conflicts</div>
                    <div className="text-sm text-gray-500">
                      Choose how to handle existing items that would be overwritten
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Save size={16} className="text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium">4. Apply Import</div>
                    <div className="text-sm text-gray-500">
                      Configuration is imported with your chosen settings
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
