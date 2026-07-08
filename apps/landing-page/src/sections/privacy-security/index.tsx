import { getTranslations } from 'next-intl/server';
import { Card } from '@core/ui';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection, AnimatedItem } from '@/components/layout';

const PRIVACY_ICONS: Record<string, React.ReactNode> = {
  shield: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  lock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <circle cx="12" cy="16" r="1" />
    </svg>
  ),
  server: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  eye: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  fileCheck: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M9 15l2 2 4-4" />
    </svg>
  ),
};

export async function PrivacySecurity() {
  const t = await getTranslations('privacy');

  // Select the 4 most relevant privacy layers for Instagram analytics
  const privacyLayers = [
    {
      icon: 'lock' as const,
      name: t('layer1Name'),
      description: t('layer1Desc'),
      badge: t('layer1Unit'),
    },
    {
      icon: 'shield' as const,
      name: t('layer3Name'),
      description: t('layer3Desc'),
      badge: t('layer3Unit'),
    },
    {
      icon: 'fileCheck' as const,
      name: t('layer4Name'),
      description: t('layer4Desc'),
      badge: t('layer4Unit'),
    },
    {
      icon: 'eye' as const,
      name: t('layer5Name'),
      description: t('layer5Desc'),
      badge: t('layer5Unit'),
    },
  ];

  return (
    <section id="privacy-security" className="sec-privacy-security py-[var(--spacing-section-y)]">
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
            lead={t('lead')}
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" className="mt-12">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {privacyLayers.map((layer, index) => (
              <AnimatedItem key={index} index={index} variant="fadeUp">
                <Card
                  className={[
                    'bg-surface border-border-default rounded-card border p-6',
                    'card-hover',
                    'group transition-all duration-300',
                    'hover:border-accent/30 hover:shadow-[var(--shadow-guard-hover)]',
                  ].join(' ')}
                >
                  {/* Icon with accent tint */}
                  <div className="text-accent bg-accent/10 w-fit rounded-[var(--radius-icon)] p-2.5 mb-4
                    group-hover:bg-accent/20 transition-colors duration-300">
                    {PRIVACY_ICONS[layer.icon]}
                  </div>

                  {/* Badge/tag */}
                  <span className="text-accent bg-accent/10 rounded-pill inline-block px-2.5 py-1 font-mono text-xs mb-3">
                    {layer.badge}
                  </span>

                  {/* Title */}
                  <h4 className="font-display text-text-default mb-2 text-sm font-semibold">
                    {layer.name}
                  </h4>

                  {/* Description */}
                  <p className="text-text-dim text-sm leading-relaxed">{layer.description}</p>
                </Card>
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>

        {/* Disclaimer */}
        <AnimatedSection variant="fadeUp" className="mt-8">
          <Card className="bg-surface border-border-default rounded-card flex items-start gap-4 border p-5">
            <div className="text-accent mt-0.5 shrink-0">
              {PRIVACY_ICONS.shield}
            </div>
            <p className="text-text-dim text-sm leading-relaxed">
              <strong className="text-text-default">{t('eyebrow')}</strong>
              {' — '}
              {t('disclaimer')}
            </p>
          </Card>
        </AnimatedSection>
      </div>
    </section>
  );
}
