import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, GripVertical } from 'lucide-react';
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
import { Button, Card, CardContent, CardHeader, Input, Modal } from '../components/common';
import { SequenceEditor, Sequence } from '../components/sequences/SequenceEditor';
import { apiClient } from '../api/client';

interface Session {
  id: string;
  name: string;
  description?: string;
  status: string;
  sequences: Sequence[];
}

interface SortableSequenceItemProps {
  sequence: Sequence;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableSequenceItem({ sequence, onEdit, onDelete }: SortableSequenceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sequence.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-dark-surface border border-dark-border rounded-lg ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <button
        className="p-1 text-dark-muted hover:text-dark-text cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-dark-text">{sequence.name}</div>
        <div className="text-sm text-dark-muted">
          {sequence.duration_type === 'fixed' && sequence.duration_ms
            ? `${Math.round(sequence.duration_ms / 1000)}s`
            : sequence.duration_type}{' '}
          • {sequence.actions.length} action{sequence.actions.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

export function SessionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);

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

  useEffect(() => {
    if (isNew) {
      setSession({
        id: '',
        name: 'New Session',
        description: '',
        status: 'draft',
        sequences: [],
      });
    } else if (id) {
      fetchSession(id);
    }
  }, [id, isNew]);

  const fetchSession = async (sessionId: string) => {
    try {
      const data = await apiClient.get<Session>(`/api/v1/sessions/${sessionId}`);
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
      if (isNew) {
        const created = await apiClient.post<Session>('/api/v1/sessions', {
          name: session.name,
          description: session.description,
          sequences: session.sequences,
        });
        navigate(`/sessions/${created.id}`);
      } else {
        await apiClient.patch(`/api/v1/sessions/${id}`, {
          name: session.name,
          description: session.description,
          sequences: session.sequences,
        });
        navigate(`/sessions/${id}`);
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSequence = () => {
    const newSequence: Sequence = {
      id: crypto.randomUUID(),
      name: `Sequence ${(session?.sequences.length || 0) + 1}`,
      duration_type: 'fixed',
      duration_ms: 30000,
      duration_fallback_ms: 30000,
      transition_ms: 1000,
      actions: [],
    };
    setEditingSequence(newSequence);
  };

  const handleSaveSequence = (sequence: Sequence) => {
    if (!session) return;

    const existingIndex = session.sequences.findIndex((s) => s.id === sequence.id);
    if (existingIndex >= 0) {
      const updated = [...session.sequences];
      updated[existingIndex] = sequence;
      setSession({ ...session, sequences: updated });
    } else {
      setSession({ ...session, sequences: [...session.sequences, sequence] });
    }
    setEditingSequence(null);
  };

  const handleDeleteSequence = (sequenceId: string) => {
    if (!session) return;
    setSession({
      ...session,
      sequences: session.sequences.filter((s) => s.id !== sequenceId),
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!session) return;

    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = session.sequences.findIndex((s) => s.id === active.id);
      const newIndex = session.sequences.findIndex((s) => s.id === over.id);
      setSession({
        ...session,
        sequences: arrayMove(session.sequences, oldIndex, newIndex),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dark-muted">Session not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="border-b border-dark-border bg-dark-surface">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={isNew ? '/sessions' : `/sessions/${id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div>
              <input
                type="text"
                value={session.name}
                onChange={(e) => setSession({ ...session, name: e.target.value })}
                className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-theatarr-500 rounded px-2 py-1 text-dark-text"
                placeholder="Session name"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(isNew ? '/sessions' : `/sessions/${id}`)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save size={16} className="mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Session Details */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-dark-text">Session Details</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Description"
                value={session.description || ''}
                onChange={(e) => setSession({ ...session, description: e.target.value })}
                placeholder="Optional description for this session"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sequences */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dark-text">Sequences</h2>
            <Button size="sm" onClick={handleAddSequence}>
              <Plus size={14} className="mr-1" />
              Add Sequence
            </Button>
          </CardHeader>
          <CardContent>
            {session.sequences.length === 0 ? (
              <div className="text-center py-8 text-dark-muted">
                <p>No sequences yet.</p>
                <p className="text-sm mt-1">Click "Add Sequence" to create one.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={session.sequences.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {session.sequences.map((sequence) => (
                      <SortableSequenceItem
                        key={sequence.id}
                        sequence={sequence}
                        onEdit={() => setEditingSequence(sequence)}
                        onDelete={() => handleDeleteSequence(sequence.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sequence Editor Modal */}
      {editingSequence && (
        <Modal
          isOpen={true}
          onClose={() => setEditingSequence(null)}
          title="Edit Sequence"
          size="xl"
        >
          <div className="h-[80vh]">
            <SequenceEditor
              sequence={editingSequence}
              onSave={handleSaveSequence}
              onCancel={() => setEditingSequence(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
