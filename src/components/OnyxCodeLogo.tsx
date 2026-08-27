interface OnyxCodeLogoProps {
  size?: number;
  className?: string;
}

/**
 * Single shared brand mark: a gradient "world" with a tilted orbit ring passing
 * behind it. Fixed 0-48 viewBox so it stays crisp from titlebar (~18px) up to a
 * large hero placement (~120px+) - scale only via the `size` prop, never by
 * hand-copying/resizing the markup itself.
 */
export default function OnyxCodeLogo({ size = 32, className = '' }: OnyxCodeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Onyx Code"
    >
      <defs>
        <radialGradient id="lg-mark-sphere" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#93e2ff" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="75%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <linearGradient id="lg-mark-ring" x1="2" y1="24" x2="46" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
          <stop offset="25%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#c084fc" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <ellipse
        cx="24"
        cy="25.5"
        rx="21"
        ry="7.5"
        transform="rotate(-16 24 25.5)"
        stroke="url(#lg-mark-ring)"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="24" cy="22.5" r="11.5" fill="url(#lg-mark-sphere)" />
      <ellipse cx="19.6" cy="18" rx="3.6" ry="2.5" fill="white" opacity="0.32" />
      <circle cx="42.6" cy="19.4" r="1.7" fill="#93e2ff" />
    </svg>
  );
}
