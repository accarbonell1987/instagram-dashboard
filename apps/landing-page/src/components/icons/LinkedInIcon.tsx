import type { IconProps } from '@/lib/types';

// Used in: Footer social links
export function LinkedInIcon({ size = 24, className, 'aria-hidden': ariaHidden = true, ...props }: IconProps & React.SVGAttributes<SVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden={ariaHidden}
      {...props}
    >
      <path d="M19 3A2 2 0 0121 5v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8 17v-7H6v7h2zM7 9a1 1 0 100-2 1 1 0 000 2zm11 8v-4c0-2-1-3-3-3a3 3 0 00-2.5 1.3V10h-2v7h2v-4c0-1 .5-1.5 1.5-1.5s1.5.5 1.5 1.5v4h2.5z" />
    </svg>
  );
}
