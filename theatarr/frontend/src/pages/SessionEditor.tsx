import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Node } from 'reactflow';
import {
  ArrowLeft,
  Save,
  List,
  GitBranch,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Volume2,
  Monitor,
  Play,
  Zap,
  Calendar,
} from 'lucide-react';
import { Button, Spinner } from '../components/common';
import {
  WorkflowEditor,
  WorkflowNodeEditor,
  WorkflowData,
  WorkflowNodeData,
  createDefaultWorkflow,
  ActionType,
} from '../components/workflow';
import { ActionEditorPanel, ActionItem } from '../components/sessions/ActionEditorPanel';
import { apiClient } from '../api/client';
import { useLayoutStore } from '../stores/layoutStore';

interface Session {
  id: string;
  name: string;
  description?: string;
  status: string;
  scheduled_at?: string | null;
  workflow?: WorkflowData;
}

interface Service {
  id: string;
  name: string;
  adapter_type: string;
  category: string;
  is_enabled: boolean;
  connection_status: string;
}

type EditorMode = 'linear' | 'node';

// Serialize workflow for API - strip React Flow internal properties
function serializeWorkflow(workflow: WorkflowData): Record<string, unknown> {
  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
    })),
    edges: workflow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
  };
}

// Convert workflow to linear actions (for linear mode display)
function workflowToActions(workflow: WorkflowData): ActionItem[] {
  return workflow.nodes
    .filter((n) => n.data.nodeType === 'action' && n.data.actionType)
    .map((n) => ({
      id: n.id,
      action_type: n.data.actionType!,
      command: n.data.command || '',
      parameters: (n.data.parameters || {}) as Record<string, unknown>,
      delay_ms: n.data.delay_ms || 0,
      on_failure: n.data.on_failure || 'warn',
      service_id: n.data.service_id as string | undefined,
    }));
}

// Convert linear actions to workflow (rebuilds simple linear workflow)
function actionsToWorkflow(actions: ActionItem[]): WorkflowData {
  const nodes: Node<WorkflowNodeData>[] = [
    {
      id: 'start',
      type: 'start',
      position: { x: 150, y: 50 },
      data: { label: 'Start', nodeType: 'start' },
    },
  ];

  let yPos = 120;
  const edges: WorkflowData['edges'] = [];
  let prevNodeId = 'start';

  actions.forEach((action) => {
    const nodeId = action.id;
    nodes.push({
      id: nodeId,
      type: 'action',
      position: { x: 150, y: yPos },
      data: {
        label: action.action_type,
        nodeType: 'action',
        actionType: action.action_type,
        command: action.command,
        parameters: action.parameters,
        delay_ms: action.delay_ms,
        on_failure: action.on_failure,
        service_id: action.service_id,
      },
    });
    edges.push({
      id: `e-${prevNodeId}-${nodeId}`,
      source: prevNodeId,
      target: nodeId,
    });
    prevNodeId = nodeId;
    yPos += 80;
  });

  const endNode = {
    id: 'end',
    type: 'end',
    position: { x: 150, y: yPos },
    data: { label: 'End', nodeType: 'end' as const },
  };
  nodes.push(endNode);
  edges.push({
    id: `e-${prevNodeId}-end`,
    source: prevNodeId,
    target: 'end',
  });

  return { nodes, edges };
}

// Simple UUID generator
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const actionTypeConfig: Record<ActionType, { icon: typeof Lightbulb; color: string; bgColor: string; label: { en: string; fr: string } }> = {
  lighting: { icon: Lightbulb, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', label: { en: 'Lighting', fr: 'Éclairage' } },
  audio: { icon: Volume2, color: 'text-blue-400', bgColor: 'bg-blue-500/20', label: { en: 'Audio', fr: 'Audio' } },
  media: { icon: Play, color: 'text-green-400', bgColor: 'bg-green-500/20', label: { en: 'Media', fr: 'Média' } },
  display: { icon: Monitor, color: 'text-purple-400', bgColor: 'bg-purple-500/20', label: { en: 'Display', fr: 'Affichage' } },
  actuator: { icon: Zap, color: 'text-orange-400', bgColor: 'bg-orange-500/20', label: { en: 'Actuator', fr: 'Actionneur' } },
};

const defaultCommands: Record<ActionType, string> = {
  lighting: 'set_color',
  audio: 'play',
  media: 'play',
  display: 'show',
  actuator: 'execute',
};

export function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLayoutStore();
  const isNew = !id || id === 'new';

  const t = {
    loading: language === 'fr' ? 'Chargement...' : 'Loading...',
    notFound: language === 'fr' ? 'Session introuvable' : 'Session not found',
    cancel: language === 'fr' ? 'Annuler' : 'Cancel',
    save: language === 'fr' ? 'Enregistrer' : 'Save',
    saving: language === 'fr' ? 'Enregistrement...' : 'Saving...',
    sessionName: language === 'fr' ? 'Nom de la session' : 'Session Name',
    descriptionPlaceholder: language === 'fr' ? 'Description optionnelle' : 'Optional description',
    newSession: language === 'fr' ? 'Nouvelle session' : 'New Session',
    selectNode: language === 'fr' ? 'Sélectionnez un nœud pour le modifier' : 'Select a node to edit',
    linearMode: language === 'fr' ? 'Linéaire' : 'Linear',
    nodeMode: language === 'fr' ? 'Nœuds' : 'Nodes',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    noActions: language === 'fr' ? 'Aucune action. Cliquez sur un type pour commencer.' : 'No actions. Click a type to get started.',
    properties: language === 'fr' ? 'Propriétés' : 'Properties',
    selectAction: language === 'fr' ? 'Sélectionnez une action pour la modifier' : 'Select an action to edit',
    saveError: language === 'fr' ? 'Erreur lors de la sauvegarde' : 'Failed to save',
    scheduledAt: language === 'fr' ? 'Programmée pour' : 'Scheduled for',
    scheduledAtHelp: language === 'fr' ? 'Date et heure de déclenchement automatique' : 'Automatic trigger date and time',
  };

  const [session, setSession] = useState<Session | null>(
    isNew
      ? {
          id: '',
          name: t.newSession,
          description: '',
          status: 'draft',
          scheduled_at: null,
          workflow: createDefaultWorkflow(),
        }
      : null
  );
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('linear');
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);

  // Fetch services
  const { data: servicesData } = useQuery<{ items: Service[] }>({
    queryKey: ['services'],
    queryFn: () => apiClient.get('/services'),
  });
  const services = servicesData?.items || [];

  useEffect(() => {
    if (!isNew && id) {
      fetchSession(id);
    }
  }, [id, isNew]);

  // Sync actions from workflow when loading
  useEffect(() => {
    if (session?.workflow) {
      setActions(workflowToActions(session.workflow));
    }
  }, [session?.workflow]);

  const fetchSession = async (sessionId: string) => {
    try {
      const data = await apiClient.get<Session>(`/sessions/${sessionId}`);
      if (!data.workflow) {
        data.workflow = createDefaultWorkflow();
      }
      setSession(data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      const workflowToSave = editorMode === 'linear'
        ? actionsToWorkflow(actions)
        : session.workflow || createDefaultWorkflow();

      const payload = {
        name: session.name,
        description: session.description || null,
        scheduled_at: session.scheduled_at || null,
        workflow: serializeWorkflow(workflowToSave),
      };

      console.log('Saving session:', JSON.stringify(payload, null, 2));

      if (isNew) {
        const created = await apiClient.post<Session>('/sessions', payload);
        navigate(`/sessions/${created.id}`);
      } else {
        await apiClient.patch(`/sessions/${id}`, payload);
        navigate(`/sessions/${id}`);
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      alert(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWorkflowChange = useCallback((workflow: WorkflowData) => {
    setSession((prev) => (prev ? { ...prev, workflow } : null));
  }, []);

  const handleNodeSelect = useCallback((node: Node<WorkflowNodeData> | null) => {
    setSelectedNode(node);
  }, []);

  const handleNodeUpdate = useCallback(
    (updates: Partial<WorkflowNodeData>) => {
      if (!selectedNode || !session?.workflow) return;

      const newNodes = session.workflow.nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updates } } : n
      );

      const newWorkflow = { ...session.workflow, nodes: newNodes };
      setSession({ ...session, workflow: newWorkflow });

      const updatedNode = newNodes.find((n) => n.id === selectedNode.id);
      if (updatedNode) {
        setSelectedNode(updatedNode as Node<WorkflowNodeData>);
      }
    },
    [selectedNode, session]
  );

  const handleNodeDelete = useCallback(() => {
    if (!selectedNode || !session?.workflow) return;
    if (selectedNode.type === 'start' || selectedNode.type === 'end') return;

    const newNodes = session.workflow.nodes.filter((n) => n.id !== selectedNode.id);
    const newEdges = session.workflow.edges.filter(
      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
    );

    setSession({ ...session, workflow: { nodes: newNodes, edges: newEdges } });
    setSelectedNode(null);
  }, [selectedNode, session]);

  // Linear mode handlers
  const addAction = (type: ActionType) => {
    const newAction: ActionItem = {
      id: generateId(),
      action_type: type,
      command: defaultCommands[type],
      parameters: {},
      delay_ms: 0,
      on_failure: 'warn',
    };
    const newActions = [...actions, newAction];
    setActions(newActions);
    setSelectedActionIndex(newActions.length - 1);
  };

  const updateAction = (index: number, updates: Partial<ActionItem>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const deleteAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    setActions(newActions);
    setSelectedActionIndex(null);
  };

  const moveAction = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= actions.length) return;
    const newActions = [...actions];
    const [moved] = newActions.splice(fromIndex, 1);
    newActions.splice(toIndex, 0, moved);
    setActions(newActions);
    setSelectedActionIndex(toIndex);
  };

  const handleModeSwitch = (mode: EditorMode) => {
    if (mode === 'node' && editorMode === 'linear') {
      const newWorkflow = actionsToWorkflow(actions);
      setSession((prev) => (prev ? { ...prev, workflow: newWorkflow } : null));
    } else if (mode === 'linear' && editorMode === 'node' && session?.workflow) {
      setActions(workflowToActions(session.workflow));
    }
    setEditorMode(mode);
    setSelectedNode(null);
    setSelectedActionIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-dark-muted">{t.notFound}</div>
      </div>
    );
  }

  const selectedAction = selectedActionIndex !== null ? actions[selectedActionIndex] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={isNew ? '/sessions' : `/sessions/${id || ''}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <input
            type="text"
            value={session.name}
            onChange={(e) => setSession({ ...session, name: e.target.value })}
            className="text-lg font-bold bg-dark-surface border border-dark-border hover:border-dark-muted focus:border-theatarr-500 focus:outline-none focus:ring-1 focus:ring-theatarr-500 rounded-lg px-3 py-1.5 text-dark-text min-w-[200px]"
            placeholder={t.sessionName}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-dark-border">
            <button
              onClick={() => handleModeSwitch('linear')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                editorMode === 'linear'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted hover:text-dark-text'
              }`}
            >
              <List size={14} />
              {t.linearMode}
            </button>
            <button
              onClick={() => handleModeSwitch('node')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                editorMode === 'node'
                  ? 'bg-theatarr-500 text-white'
                  : 'bg-dark-surface text-dark-muted hover:text-dark-text'
              }`}
            >
              <GitBranch size={14} />
              {t.nodeMode}
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(isNew ? '/sessions' : `/sessions/${id || ''}`)}
          >
            {t.cancel}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save size={14} className="mr-1" />
            {isSaving ? t.saving : t.save}
          </Button>
        </div>
      </div>

      {/* Description & Schedule */}
      <div className="mb-3 flex-shrink-0 flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={session.description || ''}
            onChange={(e) => setSession({ ...session, description: e.target.value })}
            className="w-full bg-dark-surface border border-dark-border rounded px-3 py-1.5 text-sm text-dark-text placeholder:text-dark-muted"
            placeholder={t.descriptionPlaceholder}
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-dark-muted" />
          <input
            type="datetime-local"
            value={session.scheduled_at ? session.scheduled_at.slice(0, 16) : ''}
            onChange={(e) => setSession({ ...session, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="bg-dark-surface border border-dark-border rounded px-3 py-1.5 text-sm text-dark-text"
            title={t.scheduledAtHelp}
          />
        </div>
      </div>

      {/* Main Content */}
      {editorMode === 'linear' ? (
        /* Linear Mode */
        <div className="flex flex-1 min-h-0 gap-3">
          {/* Actions List */}
          <div className="w-80 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-dark-border">
              <h3 className="text-sm font-medium text-dark-text mb-2">{t.actions}</h3>
              {/* Add Action Buttons */}
              <div className="flex flex-wrap gap-1">
                {(Object.keys(actionTypeConfig) as ActionType[]).map((type) => {
                  const config = actionTypeConfig[type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => addAction(type)}
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${config.bgColor} ${config.color} hover:opacity-80 transition-opacity`}
                      title={language === 'fr' ? config.label.fr : config.label.en}
                    >
                      <Icon size={12} />
                      {language === 'fr' ? config.label.fr : config.label.en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {actions.length === 0 ? (
                <div className="text-center text-dark-muted text-xs p-6">
                  {t.noActions}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {actions.map((action, index) => {
                    const config = actionTypeConfig[action.action_type];
                    const Icon = config.icon;
                    const isSelected = selectedActionIndex === index;

                    return (
                      <div
                        key={action.id}
                        onClick={() => setSelectedActionIndex(index)}
                        className={`p-2 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-theatarr-500 bg-theatarr-500/10'
                            : 'border-transparent bg-dark-bg hover:bg-dark-bg/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {/* Move buttons */}
                          <div className="flex flex-col">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveAction(index, 'up'); }}
                              className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-0.5"
                              disabled={index === 0}
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveAction(index, 'down'); }}
                              className="text-dark-muted hover:text-dark-text disabled:opacity-30 p-0.5"
                              disabled={index === actions.length - 1}
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>

                          {/* Icon */}
                          <div className={`p-1.5 rounded ${config.bgColor}`}>
                            <Icon size={14} className={config.color} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-dark-text truncate">
                              {action.command}
                            </div>
                            <div className="text-[10px] text-dark-muted truncate">
                              {language === 'fr' ? config.label.fr : config.label.en}
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAction(index); }}
                            className="p-1 text-dark-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Editor Panel */}
          <div className="flex-1 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-dark-border">
              <h3 className="text-sm font-medium text-dark-text">{t.properties}</h3>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {selectedAction ? (
                <ActionEditorPanel
                  action={selectedAction}
                  services={services}
                  onChange={(updates) => updateAction(selectedActionIndex!, updates)}
                  onDelete={() => deleteAction(selectedActionIndex!)}
                />
              ) : (
                <div className="text-center text-dark-muted text-sm py-12">
                  {t.selectAction}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Node Mode */
        <div className="flex flex-1 min-h-0 gap-3">
          <div className="flex-1 bg-dark-surface border border-dark-border rounded-lg overflow-hidden">
            {session.workflow && (
              <WorkflowEditor
                workflow={session.workflow}
                onChange={handleWorkflowChange}
                onNodeSelect={handleNodeSelect}
                selectedNodeId={selectedNode?.id || null}
              />
            )}
          </div>

          <div className="w-72 bg-dark-surface border border-dark-border rounded-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-dark-border">
              <h3 className="text-sm font-medium text-dark-text">{t.properties}</h3>
            </div>
            <div className="flex-1 overflow-auto">
              {selectedNode ? (
                <WorkflowNodeEditor
                  node={selectedNode}
                  onUpdate={handleNodeUpdate}
                  onDelete={handleNodeDelete}
                />
              ) : (
                <div className="p-4 text-sm text-dark-muted text-center">{t.selectNode}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
