import { getTranslations } from 'next-intl/server';
import { CreditCard, Clock, Ban } from 'lucide-react';
import { BrandButton } from '@/components/ui/BrandButton';
import { GradientMesh } from '@/components/ui/GradientMesh';
import { GradientText } from '@/components/ui/GradientText';
import { AnimatedText } from '@/components/ui/AnimatedText';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection } from '@/components/layout/AnimatedSection';
import { AnimatedItem } from '@/components/layout/AnimatedItem';

export async function CtaFinal() {
  const t = await getTranslations('ctaFinal');

  const trustItems = [
    { icon: Clock, text: t('trust1') },
    { icon: CreditCard, text: t('trust2') },
    { icon: Ban, text: t('trust3') },
  ];

  return (
    <section id="cta-final" className="gradient-section sec-cta-final relative py-[var(--spacing-section-y)]">
      <GradientMesh />

      <div className="relative mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
        <AnimatedSection variant="fadeScale" className="flex flex-col items-center text-center">
          <SectionHead
            eyebrow={t('eyebrow')}
            eyebrowVariant="beam"
            heading={
              <>
                <AnimatedText text={t('heading1')} as="span" />
                <br />
                {t('heading2')} <GradientText>{t('heading2Gold')}</GradientText>
                {t('heading3')}
              </>
            }
            lead={t('lead')}
            align="center"
          />

          <div className="mt-10">
            <BrandButton
              href="#"
              variant="primary"
              size="lg"
              aria-label={t('cta')}
              className="shadow-[0_0_40px_-12px_rgba(225,48,108,0.4)] hover:shadow-[0_0_60px_-16px_rgba(225,48,108,0.55)] transition-shadow duration-500"
            >
              {t('cta')}
            </BrandButton>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            {trustItems.map((item, i) => (
              <AnimatedItem key={i} index={i} variant="fadeUp">
                <span className="text-text-dim flex items-center gap-2 text-sm">
                  <item.icon className="text-accent h-4 w-4" />
                  {item.text}
                </span>
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
