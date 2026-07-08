import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';

export async function Problem() {
  const t = await getTranslations('problem');

  const painCards = [
    {
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
          <path d="M4 20l16-16" strokeWidth="1.4" />
        </svg>
      ),
      title: t('card1Title'),
      body: t('card1Body'),
      badge: t('card1Badge'),
      variant: 'danger' as const,
    },
    {
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
          <path d="M3 3l18 18" strokeWidth="1.4" />
        </svg>
      ),
      title: t('card2Title'),
      body: t('card2Body'),
      badge: t('card2Badge'),
      variant: 'danger' as const,
    },
    {
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
          <rect x="10" y="10" width="4" height="5" rx="1" fill="currentColor" opacity=".2" />
        </svg>
      ),
      title: t('card3Title'),
      body: t('card3Body'),
      badge: t('card3Badge'),
      variant: 'warn' as const,
    },
    {
      icon: (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M3 5v14h18" />
          <path d="M6 14l4-4 3 3 5-6" />
          <path d="M18 7l3 0M18 7l0 3" />
        </svg>
      ),
      title: t('card4Title'),
      body: t('card4Body'),
      badge: t('card4Badge'),
      variant: 'warn' as const,
    },
  ];

  return (
    <section id="problema" className="sec-problema py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            eyebrowVariant="danger"
            heading={
              <>
                {t('heading1')}
                <br />
                {t('heading2')}
              </>
            }
            lead={t('lead')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {painCards.map((card, index) => (
              <AnimatedItem key={index} index={index} variant="fadeUp">
                <Card
                  className={[
                    'bg-surface border-border-default rounded-card border p-6',
                    'border-l-2',
                    card.variant === 'danger' ? 'border-l-danger' : 'border-l-warn',
                    'card-hover',
                  ].join(' ')}
                >
                  <div className="mb-4 flex items-start gap-4">
                    <div
                      className={[
                        'shrink-0 rounded-[var(--radius-icon)] p-2',
                        card.variant === 'danger'
                          ? 'text-danger bg-danger/10'
                          : 'text-warn bg-warn/10',
                      ].join(' ')}
                    >
                      {card.icon}
                    </div>
                    <h3 className="font-display text-text-default text-base leading-snug font-semibold">
                      {card.title}
                    </h3>
                  </div>
                  <p className="text-text-dim mb-4 text-sm leading-relaxed">{card.body}</p>
                  <span
                    className={[
                      'rounded-pill inline-block px-2.5 py-1 font-mono text-xs',
                      card.variant === 'danger' ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn',
                    ].join(' ')}
                  >
                    {card.badge}
                  </span>
                </Card>
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
