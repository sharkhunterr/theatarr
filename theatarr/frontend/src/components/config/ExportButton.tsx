import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Lock, Unlock, CheckSquare, Square } from 'lucide-react';
import { Button, Input } from '../common';
import { apiClient } from '../../api/client';

interface ExportOptions {
  include_sessions: boolean;
  include_services: boolean;
  include_templates: boolean;
  include_trailer_rules: boolean;
  include_settings: boolean;
  encrypt_secrets: boolean;
  encryption_password: string | null;
}

export function ExportButton() {
  const { t } = useTranslation('settings');
  const [options, setOptions] = useState<ExportOptions>({
    include_sessions: true,
    include_services: true,
    include_templates: true,
    include_trailer_rules: true,
    include_settings: true,
    encrypt_secrets: true,
    encryption_password: null,
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/config/export', {
        ...options,
        encryption_password: options.encrypt_secrets ? password : null,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `theatarr_config_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const toggleOption = (key: keyof ExportOptions) => {
    if (key === 'encrypt_secrets' || key === 'encryption_password') return;
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleExport = () => {
    if (options.encrypt_secrets) {
      if (!password) {
        setPasswordError(t('config.export.passwordRequired'));
        return;
      }
      if (password.length < 8) {
        setPasswordError(t('config.export.passwordMinLength'));
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError(t('config.export.passwordMismatch'));
        return;
      }
    }
    setPasswordError('');
    exportMutation.mutate();
  };

  const optionItems = [
    { key: 'include_sessions' as const, label: t('config.export.optionSessions'), description: t('config.export.optionSessionsDesc') },
    { key: 'include_services' as const, label: t('config.export.optionServices'), description: t('config.export.optionServicesDesc') },
    { key: 'include_templates' as const, label: t('config.export.optionTemplates'), description: t('config.export.optionTemplatesDesc') },
    { key: 'include_trailer_rules' as const, label: t('config.export.optionTrailerRules'), description: t('config.export.optionTrailerRulesDesc') },
    { key: 'include_settings' as const, label: t('config.export.optionSettings'), description: t('config.export.optionSettingsDesc') },
  ];

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">{t('config.export.includeInExport')}</h3>
        <div className="space-y-2">
          {optionItems.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleOption(item.key)}
              className="w-full flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-left"
            >
              {options[item.key] ? (
                <CheckSquare size={18} className="text-indigo-400" />
              ) : (
                <Square size={18} className="text-gray-500" />
              )}
              <div className="flex-1">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Encryption Options */}
      <div className="border-t border-gray-700 pt-6">
        <button
          onClick={() =>
            setOptions((prev) => ({ ...prev, encrypt_secrets: !prev.encrypt_secrets }))
          }
          className="w-full flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors text-left"
        >
          {options.encrypt_secrets ? (
            <Lock size={18} className="text-green-400" />
          ) : (
            <Unlock size={18} className="text-yellow-400" />
          )}
          <div className="flex-1">
            <div className="font-medium">{t('config.export.encryptSensitiveData')}</div>
            <div className="text-xs text-gray-500">
              {options.encrypt_secrets
                ? t('config.export.encryptedDesc')
                : t('config.export.unencryptedWarning')}
            </div>
          </div>
        </button>

        {options.encrypt_secrets && (
          <div className="mt-4 space-y-3 pl-4 border-l-2 border-indigo-500/50">
            <Input
              label={t('config.export.encryptionPassword')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('config.export.enterStrongPassword')}
            />
            <Input
              label={t('config.export.confirmPassword')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('config.export.confirmPasswordPlaceholder')}
            />
            {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
            <p className="text-xs text-gray-500">
              {t('config.export.passwordNote')}
            </p>
          </div>
        )}
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending}
          className="min-w-[150px]"
        >
          {exportMutation.isPending ? (
            t('config.export.exporting')
          ) : (
            <>
              <Download size={16} />
              <span className="ml-2">{t('config.export.exportConfiguration')}</span>
            </>
          )}
        </Button>
      </div>

      {exportMutation.error && (
        <div className="p-4 bg-red-500/20 rounded-lg text-red-400 text-sm">
          {t('config.export.exportFailed')}
        </div>
      )}
    </div>
  );
}
