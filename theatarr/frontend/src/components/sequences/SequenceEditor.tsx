import { useState } from 'react';
import { Layers, GitBranch, Plus, Save } from 'lucide-react';
import { Button } from '../common';
import { LinearEditor } from './LinearEditor';
import { NodeEditor } from './NodeEditor';
import { ActionEditor } from './ActionEditor';
import { useLayoutStore } from '../../stores/layoutStore';

// Simple UUID generator for browser compatibility
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface Action {
  id: string;
  action_type: 'lighting' | 'audio' | 'display' | 'media' | 'actuator';
  command: string;
  parameters: Record<string, unknown>;
  delay_ms: number;
  on_failure: 'warn' | 'skip' | 'abort';
  service_id?: string;
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  duration_type: 'fixed' | 'dynamic' | 'manual';
  duration_ms?: number;
  duration_fallback_ms: number;
  transition_ms: number;
  actions: Action[];
}

interface SequenceEditorProps {
  sequence: Sequence;
  onSave: (sequence: Sequence) => void;
  onCancel: () => void;
}

type EditorMode = 'linear' | 'node';

export function SequenceEditor({ sequence, onSave, onCancel }: SequenceEditorProps) {
  const { language } = useLayoutStore();
  const [editedSequence, setEditedSequence] = useState<Sequence>(sequence);
  const [editorMode, setEditorMode] = useState<EditorMode>('linear');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const t = {
    duration: language === 'fr' ? 'Durée' : 'Duration',
    transition: language === 'fr' ? 'Transition' : 'Transition',
    fixed: language === 'fr' ? 'Fixe' : 'Fixed',
    dynamic: language === 'fr' ? 'Dynamique' : 'Dynamic',
    manual: language === 'fr' ? 'Manuel' : 'Manual',
    seconds: language === 'fr' ? 's' : 's',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    add: language === 'fr' ? 'Ajouter' : 'Add',
    save: language === 'fr' ? 'Enregistrer' : 'Save',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    linear: language === 'fr' ? 'Linéaire' : 'Linear',
    node: language === 'fr' ? 'Nœuds' : 'Node',
    noActions: language === 'fr' ? 'Cliquez sur "Ajouter" pour créer une action' : 'Click "Add" to create an action',
    selectAction: language === 'fr' ? 'Sélectionnez une action' : 'Select an action',
    actionBlocks: language === 'fr' ? 'Blocs d\'actions' : 'Action Blocks',
    dragToAdd: language === 'fr' ? 'Glissez pour ajouter' : 'Drag to add',
  };

  const handleNameChange = (name: string) => {
    setEditedSequence({ ...editedSequence, name });
  };

  const handleDurationChange = (duration_ms: number) => {
    setEditedSequence({ ...editedSequence, duration_ms });
  };

  const handleAddAction = (actionType?: Action['action_type']) => {
    const newAction: Action = {
      id: generateId(),
      action_type: actionType || 'lighting',
      command: actionType === 'media' ? 'play' : actionType === 'audio' ? 'play' : 'set_color',
      parameters: {},
      delay_ms: 0,
      on_failure: 'warn',
    };
    setEditedSequence({
      ...editedSequence,
      actions: [...editedSequence.actions, newAction],
    });
    setSelectedActionId(newAction.id);
  };

  const handleUpdateAction = (actionId: string, updates: Partial<Action>) => {
    setEditedSequence({
      ...editedSequence,
      actions: editedSequence.actions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    });
  };

  const handleDeleteAction = (actionId: string) => {
    setEditedSequence({
      ...editedSequence,
      actions: editedSequence.actions.filter((a) => a.id !== actionId),
    });
    if (selectedActionId === actionId) {
      setSelectedActionId(null);
    }
  };

  const handleReorderActions = (actions: Action[]) => {
    setEditedSequence({ ...editedSequence, actions });
  };

  const handleSave = () => {
    onSave(editedSequence);
  };

  const selectedAction = editedSequence.actions.find((a) => a.id === selectedActionId);

  const actionTypes: { type: Action['action_type']; label: string; color: string }[] = [
    { type: 'lighting', label: language === 'fr' ? 'Éclairage' : 'Lighting', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { type: 'audio', label: 'Audio', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'media', label: language === 'fr' ? 'Média' : 'Media', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { type: 'display', label: language === 'fr' ? 'Affichage' : 'Display', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'actuator', label: language === 'fr' ? 'Actionneur' : 'Actuator', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  ];

  return (
    <div className="flex flex-col h-full bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-dark-border bg-dark-surface flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={editedSequence.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-theatarr-500 rounded px-2 py-1 text-dark-text min-w-0 flex-1"
            placeholder="Sequence name"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Editor Mode Toggle */}
          <div className="hidden sm:flex items-center bg-dark-bg rounded p-0.5 mr-2">
            <button
              onClick={() => setEditorMode('linear')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                editorMode === 'linear'
                  ? 'bg-dark-surface text-dark-text'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <Layers size={12} />
              {t.linear}
            </button>
            <button
              onClick={() => setEditorMode('node')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                editorMode === 'node'
                  ? 'bg-dark-surface text-dark-text'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <GitBranch size={12} />
              {t.node}
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save size={14} className="mr-1" />
            {t.save}
          </Button>
        </div>
      </div>

      {/* Settings Bar */}
      <div className="flex flex-wrap items-center gap-3 p-2 bg-dark-surface/50 border-b border-dark-border text-xs flex-shrink-0">
        <div className="flex items-center gap-1">
          <label className="text-dark-muted">{t.duration}:</label>
          <select
            value={editedSequence.duration_type}
            onChange={(e) =>
              setEditedSequence({
                ...editedSequence,
                duration_type: e.target.value as 'fixed' | 'dynamic' | 'manual',
              })
            }
            className="bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs text-dark-text"
          >
            <option value="fixed">{t.fixed}</option>
            <option value="dynamic">{t.dynamic}</option>
            <option value="manual">{t.manual}</option>
          </select>
        </div>

        {editedSequence.duration_type === 'fixed' && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={editedSequence.duration_ms ? editedSequence.duration_ms / 1000 : 0}
              onChange={(e) => handleDurationChange(parseFloat(e.target.value) * 1000)}
              className="w-14 bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs text-dark-text"
              min="0"
              step="0.5"
            />
            <span className="text-dark-muted">{t.seconds}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <label className="text-dark-muted">{t.transition}:</label>
          <input
            type="number"
            value={editedSequence.transition_ms / 1000}
            onChange={(e) =>
              setEditedSequence({
                ...editedSequence,
                transition_ms: parseFloat(e.target.value) * 1000,
              })
            }
            className="w-12 bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs text-dark-text"
            min="0"
            step="0.5"
          />
          <span className="text-dark-muted">{t.seconds}</span>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {editorMode === 'linear' ? (
          <>
            {/* Linear Mode: Actions List on left, Editor on right */}
            <div className="w-48 sm:w-56 border-r border-dark-border flex flex-col flex-shrink-0">
              <div className="p-2 border-b border-dark-border flex items-center justify-between bg-dark-surface/50">
                <h3 className="text-xs font-medium text-dark-text">{t.actions}</h3>
                <Button size="sm" onClick={() => handleAddAction()} className="!px-1.5 !py-0.5 text-xs">
                  <Plus size={12} className="mr-0.5" />
                  {t.add}
                </Button>
              </div>

              <div className="flex-1 overflow-auto p-1.5">
                <LinearEditor
                  actions={editedSequence.actions}
                  selectedActionId={selectedActionId}
                  onSelectAction={setSelectedActionId}
                  onReorderActions={handleReorderActions}
                  onDeleteAction={handleDeleteAction}
                />
              </div>
            </div>

            {/* Action Editor Panel */}
            <div className="flex-1 overflow-auto bg-dark-bg/50">
              {selectedAction ? (
                <ActionEditor
                  action={selectedAction}
                  onUpdate={(updates) => handleUpdateAction(selectedAction.id, updates)}
                  onDelete={() => handleDeleteAction(selectedAction.id)}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-dark-muted p-4 text-center text-xs">
                  {editedSequence.actions.length === 0 ? t.noActions : t.selectAction}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Node Mode: Canvas takes 3/4, Action blocks panel on right 1/4 */}
            <div className="flex-1 flex overflow-hidden">
              {/* Node Canvas - 3/4 */}
              <div className="flex-[3] overflow-hidden">
                <NodeEditor
                  actions={editedSequence.actions}
                  selectedActionId={selectedActionId}
                  onSelectAction={setSelectedActionId}
                  onUpdateActions={(actions) => setEditedSequence({ ...editedSequence, actions })}
                  onDeleteAction={handleDeleteAction}
                />
              </div>

              {/* Action Blocks Panel - 1/4 */}
              <div className="flex-1 border-l border-dark-border flex flex-col bg-dark-surface/30 min-w-[140px] max-w-[200px]">
                <div className="p-2 border-b border-dark-border">
                  <h3 className="text-xs font-medium text-dark-text">{t.actionBlocks}</h3>
                  <p className="text-[10px] text-dark-muted mt-0.5">{t.dragToAdd}</p>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1.5">
                  {actionTypes.map((at) => (
                    <button
                      key={at.type}
                      onClick={() => handleAddAction(at.type)}
                      className={`w-full px-2 py-1.5 rounded border text-xs font-medium text-left transition-colors hover:opacity-80 ${at.color}`}
                    >
                      {at.label}
                    </button>
                  ))}
                </div>

                {/* Selected Action Editor in Node mode */}
                {selectedAction && (
                  <div className="border-t border-dark-border max-h-[40%] overflow-auto">
                    <ActionEditor
                      action={selectedAction}
                      onUpdate={(updates) => handleUpdateAction(selectedAction.id, updates)}
                      onDelete={() => handleDeleteAction(selectedAction.id)}
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
