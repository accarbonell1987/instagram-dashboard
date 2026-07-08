import type { LogoProps } from '@/lib/types';

export function Logo({
  idPrefix = 'logo',
  className = '',
  width = 120,
  height = 32,
}: LogoProps & { width?: number; height?: number }) {
  const gwId = `${idPrefix}-gw`;
  const gcId = `${idPrefix}-gc`;
  const gwhId = `${idPrefix}-gwh`;

  return (
    <svg
      viewBox="0 0 60 48"
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      className={className}
      aria-label="InstaMetrics"
      role="img"
    >
      <defs>
        <linearGradient id={gwId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F77737" />
          <stop offset="50%" stopColor="#E1306C" />
          <stop offset="100%" stopColor="#C13584" />
        </linearGradient>
        <linearGradient id={gcId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#1a6ec4" />
          <stop offset="100%" stopColor="#0a3460" />
        </linearGradient>
        <linearGradient id={gwhId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cfd8ea" />
        </linearGradient>
      </defs>
      <path d="M6 44 L22 4 L30 4 L14 44 Z" fill={`url(#${gwId})`} />
      <path d="M22 4 L30 4 L42 32 L34 32 Z" fill={`url(#${gwhId})`} />
      <path d="M30 4 L38 4 L54 44 L46 44 Z" fill={`url(#${gcId})`} />
      <path d="M18 28 L46 28 L43 34 L21 34 Z" fill="#060d1a" />
      <path d="M22 31 L44 31" stroke={`url(#${gwId})`} strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="49" cy="8" r="2.2" fill="#F77737" />
      <circle
        cx="49"
        cy="8"
        r="4"
        fill="none"
        stroke="#F77737"
        strokeOpacity="0.4"
        strokeWidth="0.8"
      />
    </svg>
  );
}
