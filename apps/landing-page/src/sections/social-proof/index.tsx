import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { SOCIAL_PROOF_STATS } from '@/lib/constants';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';
import { Counter } from '@/components/ui/Counter';
import { GlowCard } from '@/components/ui/GlowCard';

// Numeric values for Counter animation (from SOCIAL_PROOF_STATS)
const STAT_VALUES = [10000, 50000, 2000000, 30];
const STAT_SUFFIXES = ['+', '+', '+', '+'];

const STAT_ICONS = [
  // Users icon
  <svg key="users" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
    <circle cx="18" cy="7" r="3" />
    <path d="M22 21v-1.5c0-1.5-1-2.7-2.4-3.2" />
  </svg>,
  // Analytics/accounts icon
  <svg key="analytics" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="4" y="7" width="16" height="13" rx="2" />
    <path d="M9 7V4h6v3M9 13h6M9 17h3" />
  </svg>,
  // Posts/content icon
  <svg key="posts" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 002 2z" />
    <path d="M14 2v4h4M8 12h8M8 16h5" />
  </svg>,
  // Globe/countries icon
  <svg key="globe" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>,
];

export async function SocialProof() {
  const t = await getTranslations('socialProof');

  return (
    <section id="social-proof" className="sec-social-proof py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('label')}
            eyebrowVariant="beam"
            heading={t('label')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={t('logosAriaLabel')}
          >
            {SOCIAL_PROOF_STATS.map((stat, index) => (
              <AnimatedItem key={index} index={index} variant="fadeUp">
                <GlowCard glowColor="pink">
                  <div
                    className={[
                      'relative overflow-hidden',
                      'group transition-all duration-300',
                    ].join(' ')}
                  >
                    {/* Accent gradient line on top */}
                    <div
                      className={[
                        'absolute top-0 left-0 right-0 h-px',
                        'bg-gradient-to-r from-accent via-accent-light to-transparent',
                        'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                      ].join(' ')}
                    />

                    {/* Icon */}
                    <div className="text-accent bg-accent/10 w-fit rounded-[var(--radius-icon)] p-2 mb-4">
                      {STAT_ICONS[index]}
                    </div>

                    {/* Value — animated counter */}
                    <div className="font-display text-[clamp(28px,3vw,40px)] font-bold leading-none text-text-default mb-2 tracking-[-0.02em]">
                      <Counter
                        from={0}
                        to={STAT_VALUES[index]}
                        suffix={STAT_SUFFIXES[index]}
                        duration={2}
                      />
                    </div>

                    {/* Label */}
                    <p className="text-text-dim font-display text-sm leading-snug">
                      {stat.label}
                    </p>
                  </div>
                </GlowCard>
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
