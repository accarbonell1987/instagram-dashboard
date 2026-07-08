import { getTranslations } from 'next-intl/server';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';
import { GlowCard } from '@/components/ui/GlowCard';

const PERSONA_ICONS = [
  // Content Creator — camera + sparkle
  <svg key="creator" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>,
  // Community Manager — users + network
  <svg key="manager" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />
  </svg>,
  // Digital Agency — building + chart
  <svg key="agency" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
  </svg>,
  // Brand/Marketing Team — megaphone + target
  <svg key="brand" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M3 11h6l4-8v18l-4-8H3zM16 5.5a6 6 0 010 13M19 2.5a9 9 0 010 19" />
  </svg>,
];

const GLOW_COLORS: Array<'pink' | 'orange' | 'purple' | 'cyan'> = [
  'pink',    // Content Creator
  'orange',  // Community Manager
  'purple',  // Digital Agency
  'cyan',    // Brand
];

const ACCENT_TINTS = [
  'from-[#E1306C]/20 to-[#E1306C]/5',       // Creator — pink
  'from-[#F77737]/20 to-[#F77737]/5',        // Manager — orange
  'from-[#FCAF45]/20 to-[#FCAF45]/5',        // Agency — amber
  'from-[#833AB4]/20 to-[#833AB4]/5',        // Brand — purple (IG brand)
];

const BADGE_TINTS = [
  'bg-[#E1306C]/10 text-[#E1306C]',
  'bg-[#F77737]/10 text-[#F77737]',
  'bg-[#FCAF45]/10 text-[#FCAF45]',
  'bg-[#833AB4]/10 text-[#833AB4]',
];

const ICON_BG_TINTS = [
  'bg-[#E1306C]/10 text-[#E1306C]',
  'bg-[#F77737]/10 text-[#F77737]',
  'bg-[#FCAF45]/10 text-[#FCAF45]',
  'bg-[#833AB4]/10 text-[#833AB4]',
];

export async function UseCases() {
  const t = await getTranslations('useCases');

  const personas = [
    { name: t('card1Name'), use: t('card1Use'), badge: t('card1Badge') },
    { name: t('card2Name'), use: t('card2Use'), badge: t('card2Badge') },
    { name: t('card3Name'), use: t('card3Use'), badge: t('card3Badge') },
    { name: t('card4Name'), use: t('card4Use'), badge: t('card4Badge') },
  ];

  return (
    <section id="use-cases" className="sec-use-cases py-[var(--spacing-section-y)]">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeUp">
          <SectionHead
            eyebrow={t('eyebrow')}
            eyebrowVariant="beam"
            heading={t('heading')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {personas.map((persona, index) => (
              <AnimatedItem key={index} index={index} variant="fadeUp">
                <GlowCard glowColor={GLOW_COLORS[index]}>
                  <div className="group relative overflow-hidden transition-all duration-300">
                    {/* Accent gradient corner glow */}
                    <div
                      className={[
                        'absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0',
                        'group-hover:opacity-20 transition-opacity duration-500',
                        `bg-gradient-to-br ${ACCENT_TINTS[index]}`,
                      ].join(' ')}
                    />

                    {/* Icon */}
                    <div
                      className={[
                        'w-fit rounded-[var(--radius-icon)] p-3 mb-4',
                        'transition-colors duration-300',
                        ICON_BG_TINTS[index],
                      ].join(' ')}
                    >
                      {PERSONA_ICONS[index]}
                    </div>

                    {/* Persona name */}
                    <h3 className="font-display text-text-default text-lg font-bold mb-2">
                      {persona.name}
                    </h3>

                    {/* Description */}
                    <p className="text-text-dim text-sm leading-relaxed mb-4">
                      {persona.use}
                    </p>

                    {/* Badge */}
                    <span
                      className={[
                        'rounded-pill inline-block px-3 py-1 font-mono text-xs font-medium',
                        BADGE_TINTS[index],
                      ].join(' ')}
                    >
                      {persona.badge}
                    </span>
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
