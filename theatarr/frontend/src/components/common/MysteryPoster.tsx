/**
 * Animated mystery movie poster with floating purple particles and "?" mark.
 * Reusable across portal cards, detail pages, and admin session lists.
 */

import clsx from 'clsx';

interface MysteryPosterProps {
  className?: string;
  /** Number of floating particles (default 8) */
  particles?: number;
  /** Size of the question mark text (default "text-4xl") */
  questionMarkSize?: string;
}

// Use a stable unique ID to avoid keyframe collisions when multiple posters render
let _styleInjected = false;

function ensureStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mysteryFloat {
      0%, 100% { transform: translateY(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 0.5; }
      100% { transform: translateY(-140px); opacity: 0; }
    }
    @keyframes mysteryPulse {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
}

export function MysteryPoster({
  className,
  particles = 8,
  questionMarkSize = 'text-4xl',
}: MysteryPosterProps) {
  ensureStyles();

  return (
    <div
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: 'linear-gradient(135deg, #2d1b69, #1a0a2e)',
        border: '2px solid rgba(168, 85, 247, 0.4)',
        boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
      }}
    >
      {/* Floating particles */}
      {Array.from({ length: particles }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${3 + (i % 3) * 2}px`,
            height: `${3 + (i % 3) * 2}px`,
            left: `${15 + (i * 10) % 70}%`,
            bottom: '-5px',
            background: `rgba(168, 85, 247, ${0.3 + (i % 3) * 0.2})`,
            animation: `mysteryFloat ${2 + (i % 3) * 1.5}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
      {/* Question mark */}
      <div className="w-full h-full flex items-center justify-center">
        <span
          className={clsx(questionMarkSize, 'font-bold')}
          style={{
            color: '#a855f7',
            textShadow: '0 0 15px rgba(168, 85, 247, 0.6)',
            animation: 'mysteryPulse 2s ease-in-out infinite',
          }}
        >
          ?
        </span>
      </div>
    </div>
  );
}
