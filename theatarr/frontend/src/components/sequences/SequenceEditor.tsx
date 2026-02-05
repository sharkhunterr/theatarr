import { useState } from 'react';
import { Layers, GitBranch, Plus, Save } from 'lucide-react';
import { Button, Card, CardContent, CardHeader } from '../common';
import { LinearEditor } from './LinearEditor';
import { NodeEditor } from './NodeEditor';
import { ActionEditor } from './ActionEditor';

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
  const [editedSequence, setEditedSequence] = useState<Sequence>(sequence);
  const [editorMode, setEditorMode] = useState<EditorMode>('linear');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const handleNameChange = (name: string) => {
    setEditedSequence({ ...editedSequence, name });
  };

  const handleDurationChange = (duration_ms: number) => {
    setEditedSequence({ ...editedSequence, duration_ms });
  };

  const handleAddAction = () => {
    const newAction: Action = {
      id: crypto.randomUUID(),
      action_type: 'lighting',
      command: 'set_color',
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={editedSequence.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-theatarr-500 rounded px-2 py-1 text-dark-text"
            placeholder="Sequence name"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Editor Mode Toggle */}
          <div className="flex items-center bg-dark-bg rounded-lg p-1">
            <button
              onClick={() => setEditorMode('linear')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                editorMode === 'linear'
                  ? 'bg-dark-surface text-dark-text'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <Layers size={16} />
              Linear
            </button>
            <button
              onClick={() => setEditorMode('node')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                editorMode === 'node'
                  ? 'bg-dark-surface text-dark-text'
                  : 'text-dark-muted hover:text-dark-text'
              }`}
            >
              <GitBranch size={16} />
              Node
            </button>
          </div>

          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save size={16} className="mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Settings Bar */}
      <div className="flex items-center gap-4 p-4 bg-dark-surface/50 border-b border-dark-border">
        <div className="flex items-center gap-2">
          <label className="text-sm text-dark-muted">Duration:</label>
          <select
            value={editedSequence.duration_type}
            onChange={(e) =>
              setEditedSequence({
                ...editedSequence,
                duration_type: e.target.value as 'fixed' | 'dynamic' | 'manual',
              })
            }
            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
          >
            <option value="fixed">Fixed</option>
            <option value="dynamic">Dynamic</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {editedSequence.duration_type === 'fixed' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={editedSequence.duration_ms ? editedSequence.duration_ms / 1000 : 0}
              onChange={(e) => handleDurationChange(parseFloat(e.target.value) * 1000)}
              className="w-20 bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
              min="0"
              step="0.5"
            />
            <span className="text-sm text-dark-muted">seconds</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-sm text-dark-muted">Transition:</label>
          <input
            type="number"
            value={editedSequence.transition_ms / 1000}
            onChange={(e) =>
              setEditedSequence({
                ...editedSequence,
                transition_ms: parseFloat(e.target.value) * 1000,
              })
            }
            className="w-16 bg-dark-bg border border-dark-border rounded px-2 py-1 text-sm text-dark-text"
            min="0"
            step="0.5"
          />
          <span className="text-sm text-dark-muted">s</span>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Actions List */}
        <div className="w-80 border-r border-dark-border flex flex-col">
          <div className="p-3 border-b border-dark-border flex items-center justify-between">
            <h3 className="font-medium text-dark-text">Actions</h3>
            <Button size="sm" onClick={handleAddAction}>
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {editorMode === 'linear' ? (
              <LinearEditor
                actions={editedSequence.actions}
                selectedActionId={selectedActionId}
                onSelectAction={setSelectedActionId}
                onReorderActions={handleReorderActions}
                onDeleteAction={handleDeleteAction}
              />
            ) : (
              <NodeEditor
                actions={editedSequence.actions}
                selectedActionId={selectedActionId}
                onSelectAction={setSelectedActionId}
                onUpdateActions={(actions) => setEditedSequence({ ...editedSequence, actions })}
                onDeleteAction={handleDeleteAction}
              />
            )}
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
            <div className="flex items-center justify-center h-full text-dark-muted">
              Select an action to edit or add a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
