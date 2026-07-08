'use client';

import type { ReactNode } from 'react';

interface GradientBorderCardProps {
  isSelected: boolean;
  popular?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function GradientBorderCard({
  isSelected,
  popular = false,
  children,
  onClick,
  className = '',
}: GradientBorderCardProps) {
  if (!isSelected) {
    return (
      <div onClick={onClick} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      // 2px "border" via padding — gradient bleeds through as border
      className={[
        'rounded-2xl p-[2px]',
        popular ? 'scale-[1.02] shadow-xl' : '',
        '[animation:gradient-rotate_3s_linear_infinite]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        background: `conic-gradient(
          from var(--gradient-angle),
          hsl(var(--primary) / 0.15) 0%,
          hsl(var(--primary) / 0.5)  28%,
          hsl(var(--primary))        36%,
          hsl(var(--primary) / 0.85) 39%,
          hsl(var(--primary))        42%,
          hsl(var(--primary) / 0.5)  50%,
          hsl(var(--primary) / 0.15) 63%,
          hsl(var(--primary) / 0.5)  78%,
          hsl(var(--primary))        86%,
          hsl(var(--primary) / 0.85) 89%,
          hsl(var(--primary))        92%,
          hsl(var(--primary) / 0.15) 100%
        )`,
      }}
    >
      {children}
    </div>
  );
}
