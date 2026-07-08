import { getTranslations } from 'next-intl/server';
import { SectionHead } from '@/components/ui/SectionHead';
import { AccentItalic } from '@/components/ui/AccentItalic';
import { AnimatedSection } from '@/components/layout';

export async function Solution() {
  const t = await getTranslations('solution');

  const steps = [
    {
      number: t('step1Number'),
      title: t('step1Title'),
      description: t('step1Desc'),
      icon: (
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      number: t('step2Number'),
      title: t('step2Title'),
      description: t('step2Desc'),
      icon: (
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      ),
    },
    {
      number: t('step3Number'),
      title: t('step3Title'),
      description: t('step3Desc'),
      icon: (
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      ),
    },
    {
      number: t('step4Number'),
      title: t('step4Title'),
      description: t('step4Desc'),
      icon: (
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path d="M12 3a4 4 0 00-4 4v1a4 4 0 00-2 3.5A3.5 3.5 0 008 15v2a4 4 0 008 0v-2a3.5 3.5 0 002-3.5 4 4 0 00-2-3.5V7a4 4 0 00-4-4z" />
          <path d="M12 8v8M9 11h6" />
        </svg>
      ),
    },
  ];

  return (
    <section id="solucion" className="sec-solucion py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            heading={
              <>
                {t('heading1')}
                <br />
                {t('heading2')} <AccentItalic>{t('heading2Gold')}</AccentItalic>.
              </>
            }
            lead={t('lead')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-14">
          {/* Connector line container */}
          <div className="relative">
            {/* Horizontal connector line — hidden on mobile */}
            <div
              className="bg-border-hi absolute left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] top-[52px] hidden h-px lg:block"
              aria-hidden="true"
            />

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((step) => (
                <div key={step.number} className="flex flex-col items-center text-center">
                  {/* Number badge + icon */}
                  <div className="relative mb-5 flex flex-col items-center">
                    <div className="bg-bg-elev border-border-hi shadow-card relative z-10 flex h-[104px] w-[104px] flex-col items-center justify-center gap-1 rounded-full border">
                      <span className="text-accent font-mono text-xs font-bold tracking-widest">
                        {step.number}
                      </span>
                      <span className="text-brand-light">{step.icon}</span>
                    </div>
                  </div>
                  <h3 className="font-display text-text-default mb-2 text-lg font-bold">
                    {step.title}
                  </h3>
                  <p className="text-text-dim max-w-[220px] text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
