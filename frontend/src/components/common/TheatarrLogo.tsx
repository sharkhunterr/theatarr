/**
 * Theatarr clapperboard logo component.
 * Renders an inline SVG with the brand clapperboard + play icon.
 */

interface TheatarrLogoProps {
  size?: number;
  className?: string;
}

export function TheatarrLogo({ size = 32, className }: TheatarrLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="tl-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ed8778" />
          <stop offset="100%" stopColor="#cc4030" />
        </linearGradient>
      </defs>
      {/* Clapperboard body */}
      <rect x="8" y="32" width="84" height="62" rx="8" fill="url(#tl-g)" />
      {/* Clapper arm */}
      <rect
        x="8"
        y="6"
        width="84"
        height="24"
        rx="5"
        fill="url(#tl-g)"
        transform="rotate(-5, 50, 30)"
      />
      {/* Stripes on arm */}
      <g transform="rotate(-5, 50, 30)" opacity="0.3">
        <rect x="16" y="2" width="11" height="32" fill="#0f0f0f" transform="skewX(-18)" />
        <rect x="38" y="2" width="11" height="32" fill="#0f0f0f" transform="skewX(-18)" />
        <rect x="60" y="2" width="11" height="32" fill="#0f0f0f" transform="skewX(-18)" />
        <rect x="82" y="2" width="11" height="32" fill="#0f0f0f" transform="skewX(-18)" />
      </g>
      {/* Hinge */}
      <rect x="8" y="30" width="84" height="3" rx="1.5" fill="#ab3325" />
      {/* Screen */}
      <rect x="14" y="39" width="72" height="49" rx="4" fill="#1a1a1a" />
      {/* Play button */}
      <polygon points="38,48 38,80 62,64" fill="#e5e5e5" opacity="0.95" />
    </svg>
  );
}
