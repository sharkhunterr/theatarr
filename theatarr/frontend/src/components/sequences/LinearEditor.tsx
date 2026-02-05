import { useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Lightbulb, Volume2, Monitor, Play, Zap } from 'lucide-react';
import type { Action } from './SequenceEditor';

interface LinearEditorProps {
  actions: Action[];
  selectedActionId: string | null;
  onSelectAction: (id: string) => void;
  onReorderActions: (actions: Action[]) => void;
  onDeleteAction: (id: string) => void;
}

const actionIcons = {
  lighting: Lightbulb,
  audio: Volume2,
  display: Monitor,
  media: Play,
  actuator: Zap,
};

const actionColors = {
  lighting: 'text-yellow-500',
  audio: 'text-blue-500',
  display: 'text-purple-500',
  media: 'text-green-500',
  actuator: 'text-orange-500',
};

interface SortableActionItemProps {
  action: Action;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableActionItem({ action, isSelected, onSelect, onDelete }: SortableActionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = actionIcons[action.action_type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
        isDragging
          ? 'bg-dark-surface/80 border-theatarr-500 opacity-50'
          : isSelected
          ? 'bg-theatarr-500/10 border-theatarr-500'
          : 'bg-dark-surface border-dark-border hover:border-dark-muted'
      }`}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <button
        className="p-1 text-dark-muted hover:text-dark-text cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {/* Icon */}
      <div className={`${actionColors[action.action_type]}`}>
        <Icon size={16} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-dark-text truncate">{action.command}</div>
        <div className="text-xs text-dark-muted truncate">
          {action.action_type}
          {action.delay_ms > 0 && ` • +${action.delay_ms}ms`}
        </div>
      </div>

      {/* Delete */}
      <button
        className="p-1 text-dark-muted hover:text-red-500 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function LinearEditor({
  actions,
  selectedActionId,
  onSelectAction,
  onReorderActions,
  onDeleteAction,
}: LinearEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const actionIds = useMemo(() => actions.map((a) => a.id), [actions]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      onReorderActions(arrayMove(actions, oldIndex, newIndex));
    }
  };

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-dark-muted text-sm">
        <p>No actions yet</p>
        <p className="text-xs">Click "Add" to create an action</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={actionIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {actions.map((action) => (
            <SortableActionItem
              key={action.id}
              action={action}
              isSelected={action.id === selectedActionId}
              onSelect={() => onSelectAction(action.id)}
              onDelete={() => onDeleteAction(action.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
