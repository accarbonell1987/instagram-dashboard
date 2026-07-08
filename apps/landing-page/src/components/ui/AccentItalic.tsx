import type { AccentItalicProps } from '@/lib/types';

export function AccentItalic({ children, className = '' }: AccentItalicProps) {
  return (
    <em className={['text-accent-light italic font-serif font-bold', className].filter(Boolean).join(' ')}>
      {children}
    </em>
  );
}
