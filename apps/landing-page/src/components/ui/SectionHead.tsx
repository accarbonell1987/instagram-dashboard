import type { SectionHeadProps } from '@/lib/types';
import { Eyebrow } from './Eyebrow';

export function SectionHead({
  eyebrow,
  eyebrowVariant = 'beam',
  eyebrowDisplay = 'beam',
  heading,
  lead,
  align = 'left',
  className = '',
}: SectionHeadProps) {
  const isCenter = align === 'center';

  return (
    <div
      className={['flex flex-col', isCenter ? 'items-center text-center' : 'items-start', className]
        .filter(Boolean)
        .join(' ')}
    >
      {eyebrow && (
        <Eyebrow variant={eyebrowVariant} display={eyebrowDisplay}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={[
          'mt-4',
          'font-display font-bold',
          'text-[clamp(34px,4.4vw,58px)] leading-[1.02] tracking-[-0.03em]',
          'display-grad',
        ].join(' ')}
      >
        {heading}
      </h2>
      {lead && (
        <p
          className={[
            'mt-5',
            'text-text-dim max-w-2xl text-[clamp(16px,1.35vw,19px)] leading-relaxed',
            isCenter ? 'mx-auto' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {lead}
        </p>
      )}
    </div>
  );
}
