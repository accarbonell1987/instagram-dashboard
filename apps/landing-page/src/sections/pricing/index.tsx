import { getTranslations } from 'next-intl/server';
import { SectionHead } from '@/components/ui/SectionHead';
import { AnimatedSection } from '@/components/layout/AnimatedSection';
import { AnimatedItem } from '@/components/layout/AnimatedItem';
import { PricingCard, type PricingCardPlan } from './pricing-card';
import { PRICING_AMOUNTS } from '@/lib/constants';

// Hub URL for signup deep-links. Defaults to localhost:3001 in development.
// Plan IDs map: free→starter, pro→professional, business→enterprise, agency→enterprise
const HUB_URL = process.env['NEXT_PUBLIC_HUB_URL'] ?? 'http://localhost:3001';

export async function Pricing() {
  const t = await getTranslations('pricing');

  const plans: PricingCardPlan[] = [
    {
      name: t('plan1Name'),
      description: t('plan1Desc'),
      price: PRICING_AMOUNTS.free,
      priceValue: 0,
      period: t('perMonth'),
      features: [
        t('plan1Feature1'),
        t('plan1Feature2'),
        t('plan1Feature3'),
        t('plan1Feature4'),
        t('plan1Feature5'),
      ],
      separators: [],
      buttonText: t('plan1Cta'),
      buttonVariant: 'secondary',
      glowColor: 'cyan',
      signupHref: `${HUB_URL}/signup?plan=free`,
    },
    {
      name: t('plan2Name'),
      description: t('plan2Desc'),
      price: PRICING_AMOUNTS.pro,
      priceValue: 15,
      period: t('perMonth'),
      features: [
        t('plan2Separator'),
        t('plan2Feature1'),
        t('plan2Feature2'),
        t('plan2Feature3'),
        t('plan2Feature4'),
        t('plan2Feature5'),
        t('plan2Feature6'),
      ],
      separators: [0],
      buttonText: t('plan2Cta'),
      isPopular: true,
      buttonVariant: 'primary',
      glowColor: 'pink',
      signupHref: `${HUB_URL}/signup?plan=pro`,
    },
    {
      name: t('plan3Name'),
      description: t('plan3Desc'),
      price: PRICING_AMOUNTS.business,
      priceValue: 29,
      period: t('perMonth'),
      features: [
        t('plan3Separator'),
        t('plan3Feature1'),
        t('plan3Feature2'),
        t('plan3Feature3'),
        t('plan3Feature4'),
        t('plan3Feature5'),
      ],
      separators: [0],
      buttonText: t('plan3Cta'),
      buttonVariant: 'primary',
      glowColor: 'orange',
      signupHref: `${HUB_URL}/signup?plan=business`,
    },
    {
      name: t('plan4Name'),
      description: t('plan4Desc'),
      price: PRICING_AMOUNTS.agency,
      priceValue: 79,
      period: null,
      features: [
        t('plan4Feature1'),
        t('plan4Feature2'),
        t('plan4Feature3'),
        t('plan4Feature4'),
        t('plan4Feature5'),
      ],
      separators: [],
      buttonText: t('plan4Cta'),
      buttonVariant: 'primary',
      glowColor: 'purple',
      signupHref: `${HUB_URL}/signup?plan=agency`,
    },
  ];

  return (
    <section id="pricing" className="sec-precios py-[var(--spacing-section-y)]">
      <div className="rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] bg-bg -mt-10 sm:-mt-12 md:-mt-14 relative z-10">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--spacing-pad)] pt-12">
        <AnimatedSection variant="fadeUp" as="div">
          <SectionHead
            eyebrow={t('eyebrow')}
            heading={
              <>
                {t('heading1')}
                <br />
                {t('heading2')}
              </>
            }
            lead={t('lead')}
            align="center"
          />
        </AnimatedSection>

        <AnimatedSection variant="fadeUp" as="div" className="mt-12">
          <div className="flex flex-col items-center justify-center gap-8 md:flex-row md:gap-6">
            {plans.map((plan, i) => (
              <AnimatedItem key={plan.name} index={i} variant="fadeScale">
                <PricingCard {...plan} />
              </AnimatedItem>
            ))}
          </div>
        </AnimatedSection>
      </div>
      </div>
    </section>
  );
}
