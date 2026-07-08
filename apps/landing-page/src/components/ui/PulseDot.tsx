import type { PulseDotProps } from '@/lib/types';

const colorClasses: Record<string, string> = {
  default: 'bg-success',
  blue: 'bg-brand-light',
  gold: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warn: 'bg-warn',
};

export function PulseDot({ color = 'default', className = '' }: PulseDotProps) {
  return (
    <span
      className={[
        'inline-block w-2 h-2 rounded-full animate-pulse-dot',
        colorClasses[color],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    />
  );
}
