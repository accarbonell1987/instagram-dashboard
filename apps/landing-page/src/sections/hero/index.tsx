import { getTranslations } from 'next-intl/server';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { BrandButton } from '@/components/ui/BrandButton';
import { GradientText } from '@/components/ui/GradientText';
import { AnimatedText } from '@/components/ui/AnimatedText';
import { StarRating } from '@/components/ui/StarRating';
import { AnimatedSection } from '@/components/layout/AnimatedSection';
import { HeroDashboard } from './dashboard';
import { AuroraBackground } from './aurora-background';

export async function Hero() {
  const t = await getTranslations('hero');

  return (
    <AuroraBackground>
      <section id="hero" className="pb-[clamp(60px,8vw,100px)] pt-[clamp(60px,8vw,110px)]">
        <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)]">
          <div className="grid grid-cols-1 items-center gap-[60px] lg:grid-cols-[1.1fr_1fr]">
            {/* Left: copy column */}
            <AnimatedSection variant="fadeUp" as="div">
              <div className="flex flex-col gap-7">
                {/* Eyebrow */}
                <Eyebrow variant="beam">{t('eyebrow')}</Eyebrow>

                {/* H1 */}
                <h1 className="font-display display-grad text-[clamp(38px,4.6vw,64px)] font-extrabold leading-[1.08]">
                  {t('h1a')}
                  <br />
                  <GradientText>{t('h1b')}</GradientText>
                </h1>

                {/* Subtitle */}
                <AnimatedText
                  text={t('subtitle')}
                  as="p"
                  className="text-text-dim max-w-[50ch] text-[clamp(17px,1.5vw,20px)] leading-[1.55]"
                />

                {/* CTAs */}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <BrandButton
                    href="#pricing"
                    variant="primary"
                    size="lg"
                    className="shadow-[var(--shadow-glow-pink)] hover:shadow-[var(--shadow-glow-orange)] transition-shadow duration-500"
                  >
                    {t('ctaPrimary')}
                  </BrandButton>
                  <BrandButton
                    href="#dashboard"
                    variant="ghost"
                    size="lg"
                    className="hidden md:inline-flex"
                  >
                    {t('ctaSecondary')}
                  </BrandButton>
                </div>

                {/* Social proof */}
                <div className="border-border-default mt-[18px] flex max-w-[480px] items-center gap-3.5 border-t border-dashed pt-[22px]">
                  <StarRating rating={5} />
                  <span className="text-text-dim text-[13px]">{t('social')}</span>
                </div>
              </div>
            </AnimatedSection>

            {/* Right: dashboard visual */}
            <AnimatedSection variant="fadeLeft" delay={0.2} as="div" className="flex-shrink-0">
              <HeroDashboard />
            </AnimatedSection>
          </div>
        </div>
      </section>
    </AuroraBackground>
  );
}
