import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Lightbulb,
  Volume2,
  Monitor,
  Play,
  Zap,
  GitBranch,
  GitMerge,
  Clock,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { Button } from '../common';
import { useLayoutStore } from '../../stores/layoutStore';

// Simple UUID generator
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Node types
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'action'
  | 'parallel'
  | 'merge'
  | 'condition'
  | 'delay';

export type ActionType = 'lighting' | 'audio' | 'display' | 'media' | 'actuator';

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  actionType?: ActionType;
  command?: string;
  parameters?: Record<string, unknown>;
  delay_ms?: number;
  duration_ms?: number;
  condition?: string;
  on_failure?: 'warn' | 'skip' | 'abort';
  service_id?: string;
  block_index?: number;
}

export interface WorkflowData {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

interface WorkflowEditorProps {
  workflow: WorkflowData;
  onChange: (workflow: WorkflowData) => void;
  onNodeSelect: (node: Node<WorkflowNodeData> | null) => void;
  selectedNodeId: string | null;
}

// Node component styles
const actionIcons: Record<ActionType, typeof Lightbulb> = {
  lighting: Lightbulb,
  audio: Volume2,
  display: Monitor,
  media: Play,
  actuator: Zap,
};

const actionColors: Record<ActionType, string> = {
  lighting: '#eab308',
  audio: '#3b82f6',
  display: '#a855f7',
  media: '#22c55e',
  actuator: '#f97316',
};

// Custom Node Components
function StartNode() {
  return (
    <div className="px-3 py-1.5 rounded-full bg-green-500/20 border-2 border-green-500 text-green-400 text-xs font-medium">
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-2 !h-2" />
      Start
    </div>
  );
}

function EndNode() {
  return (
    <div className="px-3 py-1.5 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 text-xs font-medium">
      <Handle type="target" position={Position.Top} className="!bg-red-500 !w-2 !h-2" />
      End
    </div>
  );
}

function ActionNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  const Icon = data.actionType ? actionIcons[data.actionType] : Zap;
  const color = data.actionType ? actionColors[data.actionType] : '#888';

  return (
    <div
      className={`px-2 py-1.5 rounded border-2 bg-dark-surface min-w-[100px] transition-all ${
        selected ? 'border-theatarr-500 shadow-md shadow-theatarr-500/20' : 'border-dark-border'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-dark-muted !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <div className="p-1 rounded" style={{ backgroundColor: `${color}20` }}>
          <Icon size={12} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-dark-text truncate">
            {data.command || data.actionType}
          </div>
          <div className="text-[10px] text-dark-muted capitalize">{data.actionType}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-dark-muted !w-2 !h-2" />
    </div>
  );
}

function ParallelNode({ selected }: { selected: boolean }) {
  return (
    <div
      className={`px-3 py-2 rounded border-2 bg-purple-500/10 min-w-[80px] transition-all ${
        selected ? 'border-theatarr-500' : 'border-purple-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 text-purple-400">
        <GitBranch size={14} />
        <span className="text-xs font-medium">Parallel</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="a"
        style={{ left: '30%' }}
        className="!bg-purple-500 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b"
        style={{ left: '70%' }}
        className="!bg-purple-500 !w-2 !h-2"
      />
    </div>
  );
}

function MergeNode({ selected }: { selected: boolean }) {
  return (
    <div
      className={`px-3 py-2 rounded border-2 bg-purple-500/10 min-w-[80px] transition-all ${
        selected ? 'border-theatarr-500' : 'border-purple-500/50'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="a"
        style={{ left: '30%' }}
        className="!bg-purple-500 !w-2 !h-2"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="b"
        style={{ left: '70%' }}
        className="!bg-purple-500 !w-2 !h-2"
      />
      <div className="flex items-center gap-1.5 text-purple-400">
        <GitMerge size={14} />
        <span className="text-xs font-medium">Merge</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-2 !h-2" />
    </div>
  );
}

function ConditionNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  return (
    <div
      className={`px-3 py-2 rounded border-2 bg-cyan-500/10 min-w-[90px] transition-all ${
        selected ? 'border-theatarr-500' : 'border-cyan-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 text-cyan-400">
        <HelpCircle size={14} />
        <span className="text-xs font-medium">If</span>
      </div>
      {data.condition && (
        <div className="text-[10px] text-dark-muted mt-1 truncate max-w-[80px]">{data.condition}</div>
      )}
      <div className="flex justify-between text-[9px] text-dark-muted mt-1">
        <span>Yes</span>
        <span>No</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: '30%' }}
        className="!bg-green-500 !w-2 !h-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: '70%' }}
        className="!bg-red-500 !w-2 !h-2"
      />
    </div>
  );
}

function DelayNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  return (
    <div
      className={`px-3 py-2 rounded border-2 bg-amber-500/10 min-w-[70px] transition-all ${
        selected ? 'border-theatarr-500' : 'border-amber-500/50'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-2 !h-2" />
      <div className="flex items-center gap-1.5 text-amber-400">
        <Clock size={14} />
        <span className="text-xs font-medium">{data.delay_ms || 0}ms</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  end: EndNode,
  action: ActionNode,
  parallel: ParallelNode,
  merge: MergeNode,
  condition: ConditionNode,
  delay: DelayNode,
};

export function WorkflowEditor({
  workflow,
  onChange,
  onNodeSelect,
  selectedNodeId,
}: WorkflowEditorProps) {
  const { language } = useLayoutStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);

  // Sync local state when parent workflow changes (e.g., from node editor panel)
  const prevWorkflowRef = useRef(workflow);
  useEffect(() => {
    // Check if this is an external change (from parent) vs internal change
    // Compare by serializing since ReactFlow creates new object references
    const prevJson = JSON.stringify(prevWorkflowRef.current);
    const newJson = JSON.stringify(workflow);
    if (prevJson !== newJson) {
      setNodes(workflow.nodes);
      setEdges(workflow.edges);
      prevWorkflowRef.current = workflow;
    }
  }, [workflow, setNodes, setEdges]);

  const t = {
    actionBlocks: language === 'fr' ? 'Blocs' : 'Blocks',
    actions: language === 'fr' ? 'Actions' : 'Actions',
    flow: language === 'fr' ? 'Flux' : 'Flow',
    lighting: language === 'fr' ? 'Éclairage' : 'Lighting',
    audio: 'Audio',
    media: language === 'fr' ? 'Média' : 'Media',
    display: language === 'fr' ? 'Affichage' : 'Display',
    actuator: language === 'fr' ? 'Actionneur' : 'Actuator',
    parallel: language === 'fr' ? 'Parallèle' : 'Parallel',
    merge: language === 'fr' ? 'Fusionner' : 'Merge',
    condition: 'If/Else',
    delay: language === 'fr' ? 'Délai' : 'Delay',
    deleteNode: language === 'fr' ? 'Supprimer' : 'Delete',
  };

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(
        {
          ...connection,
          markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
          style: { stroke: '#666' },
        },
        edges
      );
      setEdges(newEdges);
      const newWorkflow = { nodes, edges: newEdges };
      onChange(newWorkflow);
      prevWorkflowRef.current = newWorkflow;
    },
    [edges, nodes, onChange, setEdges]
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );


  const handleNodeClick = useCallback(
    (_: any, node: Node<WorkflowNodeData>) => {
      if (node.type !== 'start' && node.type !== 'end') {
        onNodeSelect(node);
      }
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // Sync position changes after dragging
  const handleNodeDragStop = useCallback(() => {
    onChange({ nodes, edges });
    prevWorkflowRef.current = { nodes, edges };
  }, [nodes, edges, onChange]);

  const addNode = useCallback(
    (type: WorkflowNodeType, actionType?: ActionType) => {
      const newNode: Node<WorkflowNodeData> = {
        id: generateId(),
        type: type === 'action' ? 'action' : type,
        position: { x: 200, y: 150 },
        data: {
          label: type,
          nodeType: type,
          actionType,
          command: actionType === 'media' ? 'play' : actionType === 'lighting' ? 'set_color' : '',
          parameters: {},
          delay_ms: type === 'delay' ? 1000 : undefined,
          on_failure: 'warn',
        },
      };
      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      const newWorkflow = { nodes: newNodes, edges };
      onChange(newWorkflow);
      prevWorkflowRef.current = newWorkflow;
      onNodeSelect(newNode);
    },
    [nodes, edges, onChange, setNodes, onNodeSelect]
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node || node.type === 'start' || node.type === 'end') return;

    const newNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const newEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(newNodes);
    setEdges(newEdges);
    const newWorkflow = { nodes: newNodes, edges: newEdges };
    onChange(newWorkflow);
    prevWorkflowRef.current = newWorkflow;
    onNodeSelect(null);
  }, [selectedNodeId, nodes, edges, setNodes, setEdges, onChange, onNodeSelect]);

  const actionBlocks: { type: ActionType; label: string; color: string }[] = [
    { type: 'lighting', label: t.lighting, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { type: 'audio', label: t.audio, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { type: 'media', label: t.media, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { type: 'display', label: t.display, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'actuator', label: t.actuator, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  ];

  const flowBlocks: { type: WorkflowNodeType; label: string; color: string }[] = [
    { type: 'parallel', label: t.parallel, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'merge', label: t.merge, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { type: 'condition', label: t.condition, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { type: 'delay', label: t.delay, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  ];

  return (
    <div className="flex h-full">
      {/* Node Canvas */}
      <div className="flex-1 bg-dark-bg">
        <ReactFlow
          nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedNodeId }))}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          defaultEdgeOptions={{
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
            style: { stroke: '#666' },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#333" />
          <Controls className="!bg-dark-surface !border-dark-border" />
        </ReactFlow>
      </div>

      {/* Side Panel - Action Blocks */}
      <div className="w-36 border-l border-dark-border flex flex-col bg-dark-surface/50">
        <div className="p-2 border-b border-dark-border">
          <h3 className="text-xs font-medium text-dark-text">{t.actionBlocks}</h3>
        </div>

        {/* Actions */}
        <div className="p-2 border-b border-dark-border">
          <div className="text-[10px] text-dark-muted mb-1.5">{t.actions}</div>
          <div className="space-y-1">
            {actionBlocks.map((block) => (
              <button
                key={block.type}
                onClick={() => addNode('action', block.type)}
                className={`w-full px-2 py-1 rounded border text-[10px] font-medium text-left transition-colors hover:opacity-80 ${block.color}`}
              >
                {block.label}
              </button>
            ))}
          </div>
        </div>

        {/* Flow Control */}
        <div className="p-2 border-b border-dark-border">
          <div className="text-[10px] text-dark-muted mb-1.5">{t.flow}</div>
          <div className="space-y-1">
            {flowBlocks.map((block) => (
              <button
                key={block.type}
                onClick={() => addNode(block.type)}
                className={`w-full px-2 py-1 rounded border text-[10px] font-medium text-left transition-colors hover:opacity-80 ${block.color}`}
              >
                {block.label}
              </button>
            ))}
          </div>
        </div>

        {/* Delete button */}
        {selectedNodeId && (
          <div className="p-2 mt-auto border-t border-dark-border">
            <Button
              variant="danger"
              size="sm"
              onClick={deleteSelectedNode}
              className="w-full text-xs !py-1"
            >
              <Trash2 size={12} className="mr-1" />
              {t.deleteNode}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Create default workflow with start and end nodes
export function createDefaultWorkflow(): WorkflowData {
  return {
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 150, y: 50 },
        data: { label: 'Start', nodeType: 'start' },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 150, y: 300 },
        data: { label: 'End', nodeType: 'end' },
      },
    ],
    edges: [],
  };
}
