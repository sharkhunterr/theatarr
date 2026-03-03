import { Node } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common';
import { LightingActionForm } from '../sequences/actions/LightingActionForm';
import { AudioActionForm } from '../sequences/actions/AudioActionForm';
import { MediaActionForm } from '../sequences/actions/MediaActionForm';
import { DisplayActionForm } from '../sequences/actions/DisplayActionForm';
import type { WorkflowNodeData, ActionType } from './WorkflowEditor';

interface WorkflowNodeEditorProps {
  node: Node<WorkflowNodeData>;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
}

export function WorkflowNodeEditor({ node, onUpdate, onDelete }: WorkflowNodeEditorProps) {
  const { t } = useTranslation(['sessions']);
  const data = node.data;

  const handleActionTypeChange = (actionType: ActionType) => {
    const defaultCommands: Record<ActionType, string> = {
      lighting: 'set_color',
      audio: 'play',
      display: 'show',
      media: 'play',
      actuator: 'execute',
      session: 'open_feedback',
    };
    onUpdate({
      actionType,
      command: defaultCommands[actionType],
      parameters: {},
    });
  };

  const handleParametersChange = (parameters: Record<string, unknown>) => {
    onUpdate({ parameters });
  };

  // Render based on node type
  if (data.nodeType === 'action' && data.actionType) {
    return (
      <div className="p-3 space-y-3 overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dark-text">{t('sessions:workflowNodeEditor.editNode')}</h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:actionEditor.actionType')}</label>
          <select
            value={data.actionType}
            onChange={(e) => handleActionTypeChange(e.target.value as ActionType)}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
          >
            {(['lighting', 'audio', 'display', 'media', 'actuator', 'session'] as ActionType[]).map((value) => (
              <option key={value} value={value}>
                {t(`sessions:actionTypes.${value}`)}
              </option>
            ))}
          </select>
        </div>

        {/* On Failure */}
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:actionEditor.onFailure')}</label>
          <select
            value={data.on_failure || 'warn'}
            onChange={(e) => onUpdate({ on_failure: e.target.value as 'warn' | 'skip' | 'abort' })}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
          >
            <option value="warn">{t('sessions:actionEditor.warn')}</option>
            <option value="skip">{t('sessions:actionEditor.skip')}</option>
            <option value="abort">{t('sessions:actionEditor.abort')}</option>
          </select>
        </div>

        {/* Type-specific Parameters */}
        <div className="border-t border-dark-border pt-3">
          <div className="text-xs font-medium text-dark-text mb-2">
            {t(`sessions:actionTypes.${data.actionType}`)} {t('sessions:actionEditor.parameters')}
          </div>

          {data.actionType === 'lighting' && (
            <LightingActionForm
              command={data.command || 'set_color'}
              parameters={data.parameters || {}}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {data.actionType === 'audio' && (
            <AudioActionForm
              command={data.command || 'play'}
              parameters={data.parameters || {}}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {data.actionType === 'media' && (
            <MediaActionForm
              command={data.command || 'play'}
              parameters={data.parameters || {}}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {data.actionType === 'display' && (
            <DisplayActionForm
              command={data.command || 'show'}
              parameters={data.parameters || {}}
              onCommandChange={(command) => onUpdate({ command })}
              onParametersChange={handleParametersChange}
            />
          )}
          {data.actionType === 'actuator' && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-dark-muted mb-1">{t('sessions:actionEditor.device')}</label>
                <input
                  type="text"
                  value={(data.parameters?.device as string) || ''}
                  onChange={(e) => handleParametersChange({ ...data.parameters, device: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
                  placeholder="e.g., projector"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">{t('sessions:actionEditor.command')}</label>
                <input
                  type="text"
                  value={data.command || ''}
                  onChange={(e) => onUpdate({ command: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
                  placeholder="e.g., power_on"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (data.nodeType === 'condition') {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dark-text">If/Else</h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>

        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:workflowNodeEditor.condition')}</label>
          <input
            type="text"
            value={data.condition || ''}
            onChange={(e) => onUpdate({ condition: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
            placeholder={t('sessions:workflowNodeEditor.conditionPlaceholder')}
          />
        </div>
      </div>
    );
  }

  if (data.nodeType === 'delay') {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dark-text">{t('sessions:workflowNodeEditor.delayMs')}</h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>

        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t('sessions:workflowNodeEditor.delayMs')}</label>
          <input
            type="number"
            value={data.delay_ms || 0}
            onChange={(e) => onUpdate({ delay_ms: parseInt(e.target.value) || 0 })}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
            min="0"
            step="100"
          />
        </div>
      </div>
    );
  }

  if (data.nodeType === 'parallel' || data.nodeType === 'merge') {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dark-text">
            {data.nodeType === 'parallel'
              ? t('sessions:workflowNodeEditor.parallelTitle')
              : t('sessions:workflowNodeEditor.mergeTitle')}
          </h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>
        <p className="text-xs text-dark-muted">
          {data.nodeType === 'parallel'
            ? t('sessions:workflowNodeEditor.parallelDesc')
            : t('sessions:workflowNodeEditor.mergeDesc')}
        </p>
      </div>
    );
  }

  return null;
}
