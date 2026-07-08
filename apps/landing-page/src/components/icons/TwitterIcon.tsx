import type { IconProps } from '@/lib/types';

// Used in: Footer social links (X / Twitter)
export function TwitterIcon({ size = 24, className, 'aria-hidden': ariaHidden = true, ...props }: IconProps & React.SVGAttributes<SVGElement>) {
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
      <path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.5L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.5 6 5.2-6zm-1.1 16h1.8L7.7 4.8H5.8L16.4 19z" />
    </svg>
  );
}
