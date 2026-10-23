import { useId } from 'react';

// MedBridge mark: a medical cross above a suspension-bridge arch.
export default function Logo({ size = 44 }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="MedBridge logo" style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 14px rgba(34,197,94,0.45))' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id})`} />
      <rect x="21" y="8" width="6" height="16" rx="2" fill="#fff" />
      <rect x="16" y="13" width="16" height="6" rx="2" fill="#fff" />
      <path d="M6 37 C14 26 34 26 42 37" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 33v4M19 30.5v6.5M24 30v7M29 30.5v6.5M35 33v4" stroke="#fff" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 38.5h40" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
