import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';

export async function Roi() {
  const t = await getTranslations('roi');

  const roiMetrics = [
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
        </svg>
      ),
      value: t('metric1Value'),
      description: t('metric1Desc'),
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
          <path d="M3 7l7 7 4-4 7 7" />
          <path d="M14 17h7v-7" />
        </svg>
      ),
      value: t('metric2Value'),
      description: t('metric2Desc'),
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
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      ),
      value: t('metric3Value'),
      description: t('metric3Desc'),
    },
  ];

  return (
    <section id="roi" className="sec-roi py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            eyebrowVariant="beam"
            heading={
              <>
                {t('heading1')}
                <br />
                {t('heading2')}
              </>
            }
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {roiMetrics.map((metric, index) => (
              <AnimatedItem key={index} index={index} variant="fadeUp">
                <Card
                  className="bg-surface border-border-default rounded-card card-hover flex flex-col gap-4 border p-6"
                >
                  <div className="text-accent bg-accent/10 w-fit rounded-[var(--radius-icon)] p-2">
                    {metric.icon}
                  </div>
                  <div className="font-display text-text-default text-[clamp(20px,2.2vw,28px)] leading-tight font-bold">
                    {metric.value}
                  </div>
                  <p className="text-text-dim text-sm leading-relaxed">{metric.description}</p>
                </Card>
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-10">
            <Card className="bg-surface border-border-default rounded-card border-l-accent border border-l-2 p-6 sm:p-8">
            <p className="text-text-default mb-4 text-[clamp(15px,1.3vw,18px)] leading-relaxed italic">
              {t('quoteBody')}
            </p>
            <cite className="text-text-mute font-mono text-sm not-italic">{t('quoteAuthor')}</cite>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}
