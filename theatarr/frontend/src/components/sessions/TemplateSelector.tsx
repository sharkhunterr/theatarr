/**
 * Template selector component - shows all templates as a visual grid.
 */

import { useQuery } from '@tanstack/react-query';
import { Monitor, Check, Sparkles } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useLayoutStore } from '../../stores/layoutStore';
import { Spinner } from '../common';
import clsx from 'clsx';

interface Template {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  is_active: boolean;
  is_builtin: boolean;
}

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onChange: (templateId: string | null) => void;
}

export function TemplateSelector({ selectedTemplateId, onChange }: TemplateSelectorProps) {
  const { language } = useLayoutStore();

  const t = {
    templates: language === 'fr' ? 'Templates' : 'Templates',
    useGlobal: language === 'fr' ? 'Utiliser le template actif global' : 'Use global active template',
    globalActive: language === 'fr' ? 'Actif global' : 'Global active',
    builtin: language === 'fr' ? 'Intégré' : 'Built-in',
    noTemplates: language === 'fr' ? 'Aucun template disponible' : 'No templates available',
  };

  // Fetch all templates
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiClient.get<{ items: Template[]; total: number }>('/templates'),
  });

  const templates = templatesData?.items || [];
  const activeTemplate = templates.find(t => t.is_active);

  // Template type icons/colors
  const getTemplateStyle = (type: string) => {
    switch (type) {
      case 'countdown':
        return { color: 'text-blue-400', bg: 'bg-blue-500/20' };
      case 'movie_info':
        return { color: 'text-green-400', bg: 'bg-green-500/20' };
      case 'session_status':
        return { color: 'text-purple-400', bg: 'bg-purple-500/20' };
      default:
        return { color: 'text-theatarr-400', bg: 'bg-theatarr-500/20' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global template option */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={clsx(
          'w-full flex items-center gap-4 p-4 rounded-lg border transition-all',
          selectedTemplateId === null
            ? 'border-theatarr-500 bg-theatarr-500/10'
            : 'border-dark-border bg-dark-surface hover:border-dark-muted'
        )}
      >
        {/* Selection indicator */}
        <div className={clsx(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selectedTemplateId === null
            ? 'border-theatarr-500 bg-theatarr-500'
            : 'border-dark-muted'
        )}>
          {selectedTemplateId === null && <Check size={14} className="text-white" />}
        </div>

        {/* Icon */}
        <div className="w-12 h-12 bg-theatarr-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles size={24} className="text-theatarr-400" />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-dark-text">{t.useGlobal}</div>
          <div className="text-xs text-dark-muted">
            {activeTemplate ? activeTemplate.name : 'Aucun template actif'}
          </div>
        </div>

        {activeTemplate && selectedTemplateId === null && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex-shrink-0">
            {t.globalActive}
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-dark-border" />
        <span className="text-xs text-dark-muted">{language === 'fr' ? 'ou choisir' : 'or choose'}</span>
        <div className="flex-1 border-t border-dark-border" />
      </div>

      {/* Templates grid */}
      {templates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            const style = getTemplateStyle(template.template_type);

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChange(template.id)}
                className={clsx(
                  'flex items-start gap-3 p-4 rounded-lg border transition-all text-left',
                  isSelected
                    ? 'border-theatarr-500 bg-theatarr-500/10'
                    : 'border-dark-border bg-dark-surface hover:border-dark-muted'
                )}
              >
                {/* Selection indicator */}
                <div className={clsx(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected
                    ? 'border-theatarr-500 bg-theatarr-500'
                    : 'border-dark-muted'
                )}>
                  {isSelected && <Check size={12} className="text-white" />}
                </div>

                {/* Icon */}
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  style.bg
                )}>
                  <Monitor size={20} className={style.color} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'text-sm font-medium truncate',
                      isSelected ? 'text-theatarr-400' : 'text-dark-text'
                    )}>
                      {template.name}
                    </span>
                    {template.is_active && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded flex-shrink-0">
                        Actif
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-xs text-dark-muted mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', style.bg, style.color)}>
                      {template.template_type}
                    </span>
                    {template.is_builtin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-border text-dark-muted">
                        {t.builtin}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-dark-muted">
          <Monitor size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.noTemplates}</p>
        </div>
      )}
    </div>
  );
}
