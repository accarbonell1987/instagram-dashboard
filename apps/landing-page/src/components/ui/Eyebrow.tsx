import type { EyebrowProps, EyebrowVariant } from '@/lib/types';

// Color palette — variant only affects color, not display style
const textColor: Record<EyebrowVariant, string> = {
  default: 'text-accent',
  beam: 'text-success',
  danger: 'text-danger',
  warn: 'text-warn',
  success: 'text-success',
  accent: 'text-accent',
  mono: 'text-text-mute',
};

const borderColor: Record<EyebrowVariant, string> = {
  default: 'border-accent',
  beam: 'border-success',
  danger: 'border-danger',
  warn: 'border-warn',
  success: 'border-success',
  accent: 'border-accent',
  mono: 'border-text-mute',
};

const dotColor: Record<EyebrowVariant, string> = {
  default: 'bg-accent',
  beam: 'bg-success',
  danger: 'bg-danger',
  warn: 'bg-warn',
  success: 'bg-success',
  accent: 'bg-accent',
  mono: 'bg-text-mute',
};

const baseClasses = 'font-mono text-xs uppercase tracking-widest';

export function Eyebrow({
  children,
  variant = 'default',
  display = 'beam',
  className = '',
}: EyebrowProps) {
  if (display === 'dot') {
    return (
      <span
        className={['inline-flex items-center gap-1.5', baseClasses, textColor[variant], className]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={['inline-block h-1.5 w-1.5 rounded-full', dotColor[variant]].join(' ')}
          aria-hidden="true"
        />
        {children}
      </span>
    );
  }

  // beam display (default) — vertical bar
  return (
    <span
      className={[
        `border-l-2 ${borderColor[variant]} pl-3`,
        baseClasses,
        textColor[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
