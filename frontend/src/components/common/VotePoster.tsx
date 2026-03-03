/**
 * Animated vote-pending poster with floating blue particles and ballot icon.
 * Reusable across portal cards, detail pages, and admin session lists.
 */

import clsx from 'clsx';

interface VotePosterProps {
  className?: string;
  /** Number of floating particles (default 8) */
  particles?: number;
  /** Size of the icon text (default "text-4xl") */
  iconSize?: string;
}

let _voteStyleInjected = false;

function ensureVoteStyles() {
  if (_voteStyleInjected) return;
  _voteStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes voteFloat {
      0%, 100% { transform: translateY(0); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 0.5; }
      100% { transform: translateY(-140px); opacity: 0; }
    }
    @keyframes votePulse {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
}

export function VotePoster({
  className,
  particles = 8,
  iconSize = 'text-4xl',
}: VotePosterProps) {
  ensureVoteStyles();

  return (
    <div
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: 'linear-gradient(135deg, #1a2744, #0a1628)',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
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
            background: `rgba(59, 130, 246, ${0.3 + (i % 3) * 0.2})`,
            animation: `voteFloat ${2 + (i % 3) * 1.5}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
      {/* Ballot icon (envelope + check) */}
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className={clsx(iconSize)}
          viewBox="0 0 48 48"
          fill="none"
          style={{
            width: '2.5em',
            height: '2.5em',
            animation: 'votePulse 2s ease-in-out infinite',
            filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.6))',
          }}
        >
          {/* Ballot box */}
          <rect
            x="8" y="18" width="32" height="24" rx="3"
            stroke="#3b82f6" strokeWidth="2.5" fill="rgba(59, 130, 246, 0.1)"
          />
          {/* Slot */}
          <rect
            x="16" y="18" width="16" height="3" rx="1"
            fill="#0a1628" stroke="#3b82f6" strokeWidth="1.5"
          />
          {/* Ballot paper going in */}
          <rect
            x="18" y="6" width="12" height="16" rx="1.5"
            fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" strokeWidth="2"
          />
          {/* Check mark on ballot */}
          <polyline
            points="21,14 23.5,17 28,11"
            stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}
