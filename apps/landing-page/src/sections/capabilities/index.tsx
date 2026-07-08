import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';

export async function Capabilities() {
  const t = await getTranslations('capabilities');

  const features = [
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M9 7V4h6v3M9 13h6M9 17h3" />
          <circle cx="8" cy="2" r="1" fill="currentColor" />
          <circle cx="16" cy="2" r="1" fill="currentColor" />
        </svg>
      ),
      title: t('card1Title'),
      description: t('card1Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 20h4v-8H3zM10 20h4V4h-4zM17 20h4v-12h-4z" />
        </svg>
      ),
      title: t('card2Title'),
      description: t('card2Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M21 5L2 12l7 2 2 7 10-16z" />
          <path d="M9 14l5-5" />
        </svg>
      ),
      title: t('card3Title'),
      description: t('card3Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 7h10l4-4M3 7l4 4M13 7l-3 3M21 17H11l-4 4M21 17l-4-4M11 17l3-3" />
        </svg>
      ),
      title: t('card4Title'),
      description: t('card4Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" />
        </svg>
      ),
      title: t('card5Title'),
      description: t('card5Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 17l6-6 4 4 8-9" />
          <path d="M14 6h7v7" />
        </svg>
      ),
      title: t('card6Title'),
      description: t('card6Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M12 3a4 4 0 00-4 4 3.5 3.5 0 00-2 3.2A3.5 3.5 0 008 14v2a4 4 0 008 0v-2a3.5 3.5 0 002-3.8A3.5 3.5 0 0016 7a4 4 0 00-4-4z" />
          <path d="M12 7v10M9 10l3 2 3-2" />
        </svg>
      ),
      title: t('card7Title'),
      description: t('card7Desc'),
    },
    {
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M10 14l-3 3a4 4 0 01-6-6l3-3M14 10l3-3a4 4 0 016 6l-3 3M9 15l6-6" />
        </svg>
      ),
      title: t('card8Title'),
      description: t('card8Desc'),
    },
  ];

  return (
    <section id="capacidades" className="sec-capacidades py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            eyebrowVariant="beam"
            heading={t('heading')}
            lead={t('lead')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div className="mx-auto max-w-4xl space-y-0">
            {features.map((feature, index) => {
              const isLast = index === features.length - 1;
              return (
                <AnimatedItem key={index} index={index} variant="fadeUp">
                  <Card
                    className={[
                      'rounded-none border-0 bg-transparent',
                      !isLast && 'border-b border-white/[0.06]',
                    ].join(' ')}
                  >
                    <article className="flex flex-col gap-4 py-8 sm:flex-row sm:gap-12 sm:py-10 md:py-12">
                      <span className="font-display shrink-0 text-[clamp(3rem,10vw,140px)] font-black leading-none text-white/[0.04]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col gap-2">
                        <div className="mb-2 flex items-center gap-3">
                          <div className="text-brand-light">
                            {feature.icon}
                          </div>
                          <h3 className="font-display text-text-default text-base font-semibold">
                            {feature.title}
                          </h3>
                        </div>
                        <p className="text-text-dim max-w-2xl text-base leading-relaxed opacity-60 sm:text-lg">
                          {feature.description}
                        </p>
                      </div>
                    </article>
                  </Card>
                </AnimatedItem>
              );
            })}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
