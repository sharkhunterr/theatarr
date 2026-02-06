import { Node } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { Button } from '../common';
import { LightingActionForm } from '../sequences/actions/LightingActionForm';
import { AudioActionForm } from '../sequences/actions/AudioActionForm';
import { MediaActionForm } from '../sequences/actions/MediaActionForm';
import { DisplayActionForm } from '../sequences/actions/DisplayActionForm';
import { useLayoutStore } from '../../stores/layoutStore';
import type { WorkflowNodeData, ActionType } from './WorkflowEditor';

interface WorkflowNodeEditorProps {
  node: Node<WorkflowNodeData>;
  onUpdate: (data: Partial<WorkflowNodeData>) => void;
  onDelete: () => void;
}

const actionTypeLabels: Record<ActionType, { en: string; fr: string }> = {
  lighting: { en: 'Lighting', fr: 'Éclairage' },
  audio: { en: 'Audio', fr: 'Audio' },
  display: { en: 'Display', fr: 'Affichage' },
  media: { en: 'Media', fr: 'Média' },
  actuator: { en: 'Actuator', fr: 'Actionneur' },
};

const onFailureOptions = [
  { value: 'warn', en: 'Warn and continue', fr: 'Avertir et continuer' },
  { value: 'skip', en: 'Skip silently', fr: 'Ignorer' },
  { value: 'abort', en: 'Abort workflow', fr: 'Interrompre' },
];

export function WorkflowNodeEditor({ node, onUpdate, onDelete }: WorkflowNodeEditorProps) {
  const { language } = useLayoutStore();
  const data = node.data;

  const t = {
    editNode: language === 'fr' ? 'Modifier le nœud' : 'Edit Node',
    delete: language === 'fr' ? 'Supprimer' : 'Delete',
    actionType: language === 'fr' ? 'Type d\'action' : 'Action Type',
    delay: language === 'fr' ? 'Délai (ms)' : 'Delay (ms)',
    onFailure: language === 'fr' ? 'En cas d\'échec' : 'On Failure',
    parameters: language === 'fr' ? 'Paramètres' : 'Parameters',
    condition: language === 'fr' ? 'Condition' : 'Condition',
    conditionPlaceholder: language === 'fr' ? 'ex: projector.ready == true' : 'e.g., projector.ready == true',
    device: language === 'fr' ? 'Appareil' : 'Device',
    command: language === 'fr' ? 'Commande' : 'Command',
    delayMs: language === 'fr' ? 'Délai (ms)' : 'Delay (ms)',
  };

  const handleActionTypeChange = (actionType: ActionType) => {
    const defaultCommands: Record<ActionType, string> = {
      lighting: 'set_color',
      audio: 'play',
      display: 'show',
      media: 'play',
      actuator: 'execute',
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
          <h3 className="text-xs font-semibold text-dark-text">{t.editNode}</h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t.actionType}</label>
          <select
            value={data.actionType}
            onChange={(e) => handleActionTypeChange(e.target.value as ActionType)}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
          >
            {Object.entries(actionTypeLabels).map(([value, labels]) => (
              <option key={value} value={value}>
                {language === 'fr' ? labels.fr : labels.en}
              </option>
            ))}
          </select>
        </div>

        {/* On Failure */}
        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t.onFailure}</label>
          <select
            value={data.on_failure || 'warn'}
            onChange={(e) => onUpdate({ on_failure: e.target.value as 'warn' | 'skip' | 'abort' })}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
          >
            {onFailureOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {language === 'fr' ? opt.fr : opt.en}
              </option>
            ))}
          </select>
        </div>

        {/* Type-specific Parameters */}
        <div className="border-t border-dark-border pt-3">
          <div className="text-xs font-medium text-dark-text mb-2">
            {language === 'fr' ? actionTypeLabels[data.actionType].fr : actionTypeLabels[data.actionType].en} {t.parameters}
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
                <label className="block text-xs text-dark-muted mb-1">{t.device}</label>
                <input
                  type="text"
                  value={(data.parameters?.device as string) || ''}
                  onChange={(e) => handleParametersChange({ ...data.parameters, device: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
                  placeholder="e.g., projector"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-muted mb-1">{t.command}</label>
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
          <label className="block text-xs font-medium text-dark-text mb-1">{t.condition}</label>
          <input
            type="text"
            value={data.condition || ''}
            onChange={(e) => onUpdate({ condition: e.target.value })}
            className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-dark-text"
            placeholder={t.conditionPlaceholder}
          />
        </div>
      </div>
    );
  }

  if (data.nodeType === 'delay') {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-dark-text">{t.delayMs}</h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>

        <div>
          <label className="block text-xs font-medium text-dark-text mb-1">{t.delayMs}</label>
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
              ? (language === 'fr' ? 'Parallèle' : 'Parallel')
              : (language === 'fr' ? 'Fusionner' : 'Merge')}
          </h3>
          <Button variant="danger" size="sm" onClick={onDelete} className="!px-2 !py-1 text-xs">
            <Trash2 size={12} />
          </Button>
        </div>
        <p className="text-xs text-dark-muted">
          {data.nodeType === 'parallel'
            ? (language === 'fr'
                ? 'Exécute les branches connectées en parallèle.'
                : 'Executes connected branches in parallel.')
            : (language === 'fr'
                ? 'Attend que toutes les branches soient terminées.'
                : 'Waits for all branches to complete.')}
        </p>
      </div>
    );
  }

  return null;
}
