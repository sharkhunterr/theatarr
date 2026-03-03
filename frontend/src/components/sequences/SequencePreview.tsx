import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { Button } from '../common';
import type { Action, Sequence } from './SequenceEditor';

interface SequencePreviewProps {
  sequence: Sequence;
}

interface ActionPreviewState {
  actionId: string;
  status: 'pending' | 'executing' | 'completed';
  startTime?: number;
}

export function SequencePreview({ sequence }: SequencePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setCurrentActionIndex] = useState(-1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [actionStates, setActionStates] = useState<ActionPreviewState[]>([]);
  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const totalDurationMs = sequence.duration_type === 'fixed'
    ? sequence.duration_ms || 0
    : sequence.actions.reduce((acc, action) => acc + action.delay_ms, 0) + 5000;

  useEffect(() => {
    // Initialize action states
    setActionStates(
      sequence.actions.map((action) => ({
        actionId: action.id,
        status: 'pending',
      }))
    );
  }, [sequence.actions]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now() - elapsedMs;
      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        // Update action states based on elapsed time
        let accumulatedDelay = 0;
        const newStates: ActionPreviewState[] = [];

        for (let i = 0; i < sequence.actions.length; i++) {
          const action = sequence.actions[i];
          accumulatedDelay += action.delay_ms;

          if (elapsed >= accumulatedDelay + 500) {
            newStates.push({ actionId: action.id, status: 'completed' });
          } else if (elapsed >= accumulatedDelay) {
            newStates.push({ actionId: action.id, status: 'executing', startTime: accumulatedDelay });
            setCurrentActionIndex(i);
          } else {
            newStates.push({ actionId: action.id, status: 'pending' });
          }
        }

        setActionStates(newStates);

        // Stop when sequence completes
        if (elapsed >= totalDurationMs) {
          setIsPlaying(false);
          setCurrentActionIndex(-1);
        }
      }, 50);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, sequence.actions, totalDurationMs]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setElapsedMs(0);
    setCurrentActionIndex(-1);
    setActionStates(
      sequence.actions.map((action) => ({
        actionId: action.id,
        status: 'pending',
      }))
    );
  };

  const handleReset = () => {
    handleStop();
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const remainingMs = Math.floor((ms % 1000) / 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs}`;
  };

  const getActionColor = (action: Action) => {
    const colors = {
      lighting: 'bg-yellow-500',
      audio: 'bg-blue-500',
      display: 'bg-purple-500',
      media: 'bg-green-500',
      actuator: 'bg-orange-500',
    };
    return colors[action.action_type] || 'bg-gray-500';
  };

  const progress = totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-dark-text">Preview</h3>
        <div className="text-sm text-dark-muted">
          {formatTime(elapsedMs)} / {formatTime(totalDurationMs)}
        </div>
      </div>

      {/* Timeline Progress */}
      <div className="relative h-8 bg-dark-bg rounded-lg overflow-hidden">
        {/* Progress bar */}
        <div
          className="absolute inset-y-0 left-0 bg-theatarr-500/30 transition-all duration-50"
          style={{ width: `${progress}%` }}
        />

        {/* Action markers */}
        {sequence.actions.map((action, index) => {
          const accumulatedDelay = sequence.actions
            .slice(0, index + 1)
            .reduce((acc, a) => acc + a.delay_ms, 0);
          const position = totalDurationMs > 0 ? (accumulatedDelay / totalDurationMs) * 100 : 0;
          const state = actionStates.find((s) => s.actionId === action.id);

          return (
            <div
              key={action.id}
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-dark-surface ${getActionColor(
                action
              )} ${state?.status === 'executing' ? 'ring-2 ring-white ring-opacity-50 scale-125' : ''} transition-transform`}
              style={{ left: `calc(${position}% - 6px)` }}
              title={`${action.action_type}: ${action.command}`}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-all duration-50"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {isPlaying ? (
          <Button size="sm" onClick={handlePause}>
            <Pause size={16} />
          </Button>
        ) : (
          <Button size="sm" onClick={handlePlay}>
            <Play size={16} />
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={handleStop}>
          <Square size={16} />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleReset}>
          <RotateCcw size={16} />
        </Button>
      </div>

      {/* Actions Timeline List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sequence.actions.map((action, index) => {
          const state = actionStates.find((s) => s.actionId === action.id);
          const accumulatedDelay = sequence.actions
            .slice(0, index + 1)
            .reduce((acc, a) => acc + a.delay_ms, 0);

          return (
            <div
              key={action.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                state?.status === 'executing'
                  ? 'bg-theatarr-500/20 border border-theatarr-500'
                  : state?.status === 'completed'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-dark-bg'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${getActionColor(action)}`} />
              <div className="flex-1">
                <span className="text-dark-text">{action.command}</span>
                <span className="text-dark-muted ml-2">({action.action_type})</span>
              </div>
              <div className="text-dark-muted text-xs">
                {formatTime(accumulatedDelay)}
              </div>
            </div>
          );
        })}
      </div>

      {sequence.actions.length === 0 && (
        <div className="text-center py-4 text-dark-muted text-sm">
          Add actions to preview the sequence timeline
        </div>
      )}
    </div>
  );
}
