import { Play, Pause, Square, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '../common';
import { SessionStatus } from '../../stores/sessionStore';

interface SessionControlsProps {
  status: SessionStatus;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkip: () => void;
  onRestart: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SessionControls({
  status,
  onPlay,
  onPause,
  onStop,
  onSkip,
  onRestart,
  disabled = false,
  size = 'md',
}: SessionControlsProps) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;
  const canStart = status === 'draft' || status === 'scheduled' || status === 'interrupted';

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  return (
    <div className="flex items-center gap-2">
      {/* Play/Pause */}
      {isRunning ? (
        <Button
          onClick={onPause}
          disabled={disabled}
          size={size}
          variant="primary"
          title="Pause"
        >
          <Pause size={iconSize} />
        </Button>
      ) : (
        <Button
          onClick={onPlay}
          disabled={disabled || (!canStart && !isPaused)}
          size={size}
          variant="primary"
          title={isPaused ? 'Resume' : 'Start'}
        >
          <Play size={iconSize} />
        </Button>
      )}

      {/* Skip */}
      <Button
        onClick={onSkip}
        disabled={disabled || !isActive}
        size={size}
        variant="secondary"
        title="Skip to next sequence"
      >
        <SkipForward size={iconSize} />
      </Button>

      {/* Stop */}
      <Button
        onClick={onStop}
        disabled={disabled || !isActive}
        size={size}
        variant="secondary"
        title="Stop"
      >
        <Square size={iconSize} />
      </Button>

      {/* Restart */}
      <Button
        onClick={onRestart}
        disabled={disabled || status === 'draft'}
        size={size}
        variant="ghost"
        title="Restart from beginning"
      >
        <RotateCcw size={iconSize} />
      </Button>
    </div>
  );
}
