import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Lightbulb, Volume2, Monitor, Play, Zap, Plus } from 'lucide-react';
import { Button } from '../common';
import type { Action } from './SequenceEditor';

interface NodeEditorProps {
  actions: Action[];
  selectedActionId: string | null;
  onSelectAction: (id: string) => void;
  onUpdateActions: (actions: Action[]) => void;
  onDeleteAction: (id: string) => void;
}

interface ActionNodeData {
  action: Action;
  isSelected: boolean;
  onSelect: () => void;
}

const actionIcons = {
  lighting: Lightbulb,
  audio: Volume2,
  display: Monitor,
  media: Play,
  actuator: Zap,
};

const actionColors = {
  lighting: '#eab308',
  audio: '#3b82f6',
  display: '#a855f7',
  media: '#22c55e',
  actuator: '#f97316',
};

function ActionNode({ data }: { data: ActionNodeData }) {
  const { action, isSelected, onSelect } = data;
  const Icon = actionIcons[action.action_type];
  const color = actionColors[action.action_type];

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-dark-surface min-w-[150px] cursor-pointer transition-all ${
        isSelected
          ? 'border-theatarr-500 shadow-lg shadow-theatarr-500/20'
          : 'border-dark-border hover:border-dark-muted'
      }`}
      onClick={onSelect}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-dark-muted !w-3 !h-3"
      />

      <div className="flex items-center gap-2">
        <div
          className="p-1.5 rounded"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-dark-text truncate">
            {action.command}
          </div>
          <div className="text-xs text-dark-muted capitalize">
            {action.action_type}
          </div>
        </div>
      </div>

      {action.delay_ms > 0 && (
        <div className="mt-2 text-xs text-dark-muted">
          Delay: {action.delay_ms}ms
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-dark-muted !w-3 !h-3"
      />
    </div>
  );
}

function StartNode() {
  return (
    <div className="px-4 py-2 rounded-full bg-green-500/20 border-2 border-green-500 text-green-400 text-sm font-medium">
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-500 !w-3 !h-3"
      />
      Start
    </div>
  );
}

function EndNode() {
  return (
    <div className="px-4 py-2 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 text-sm font-medium">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-500 !w-3 !h-3"
      />
      End
    </div>
  );
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  start: StartNode,
  end: EndNode,
};

export function NodeEditor({
  actions,
  selectedActionId,
  onSelectAction,
  onUpdateActions,
  onDeleteAction,
}: NodeEditorProps) {
  // Convert actions to nodes
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [
      {
        id: 'start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: {},
      },
    ];

    // Position nodes in a vertical layout
    actions.forEach((action, index) => {
      nodes.push({
        id: action.id,
        type: 'action',
        position: { x: 200, y: 100 + index * 120 },
        data: {
          action,
          isSelected: action.id === selectedActionId,
          onSelect: () => onSelectAction(action.id),
        } as ActionNodeData,
      });
    });

    nodes.push({
      id: 'end',
      type: 'end',
      position: { x: 250, y: 100 + actions.length * 120 },
      data: {},
    });

    return nodes;
  }, [actions, selectedActionId, onSelectAction]);

  // Convert actions to edges
  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    if (actions.length === 0) {
      edges.push({
        id: 'start-end',
        source: 'start',
        target: 'end',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#666' },
      });
    } else {
      // Start to first action
      edges.push({
        id: `start-${actions[0].id}`,
        source: 'start',
        target: actions[0].id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#666' },
      });

      // Connect actions in sequence
      for (let i = 0; i < actions.length - 1; i++) {
        edges.push({
          id: `${actions[i].id}-${actions[i + 1].id}`,
          source: actions[i].id,
          target: actions[i + 1].id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#666' },
          label: actions[i + 1].delay_ms > 0 ? `+${actions[i + 1].delay_ms}ms` : undefined,
          labelStyle: { fill: '#888', fontSize: 10 },
          labelBgStyle: { fill: '#1a1a2e', fillOpacity: 0.8 },
        });
      }

      // Last action to end
      edges.push({
        id: `${actions[actions.length - 1].id}-end`,
        source: actions[actions.length - 1].id,
        target: 'end',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#666' },
      });
    }

    return edges;
  }, [actions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Update nodes when selection changes
  useMemo(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === 'action') {
          return {
            ...node,
            data: {
              ...node.data,
              isSelected: node.id === selectedActionId,
            },
          };
        }
        return node;
      })
    );
  }, [selectedActionId, setNodes]);

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-dark-muted">
        <p className="mb-2">No actions yet</p>
        <p className="text-sm">Add actions to see the node graph</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        className="bg-dark-bg"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
      >
        <Controls className="!bg-dark-surface !border-dark-border [&>button]:!bg-dark-surface [&>button]:!border-dark-border [&>button]:!text-dark-text [&>button:hover]:!bg-dark-bg" />
        <Background color="#333" gap={20} />
      </ReactFlow>
    </div>
  );
}
