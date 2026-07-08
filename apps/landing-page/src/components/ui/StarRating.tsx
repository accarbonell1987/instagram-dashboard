import type { StarRatingProps } from '@/lib/types';

export function StarRating({ rating = 5, max = 5, className = '' }: StarRatingProps) {
  return (
    <span
      className={['inline-flex gap-0.5', className].filter(Boolean).join(' ')}
      aria-label={`${rating} de ${max} estrellas`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={i < rating ? 'text-accent' : 'text-text-mute'}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}
