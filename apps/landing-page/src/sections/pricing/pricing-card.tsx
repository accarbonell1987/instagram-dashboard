'use client';

import { CheckIcon } from 'lucide-react';
import { Button } from '@core/ui';
import { GlowCard } from '@/components/ui/GlowCard';
import { Counter } from '@/components/ui/Counter';

type Feature = string;

export interface PricingCardPlan {
  name: string;
  description: string;
  price: string;
  /** Numeric price for Counter animation (e.g. 15 for "$15"). Falls back to static price display. */
  priceValue?: number;
  period?: string | null;
  features: Feature[];
  separators?: number[]; // indices in features that are section headers
  buttonText: string;
  isPopular?: boolean;
  buttonVariant?: 'primary' | 'secondary';
  /** Tier-specific glow color */
  glowColor?: 'pink' | 'orange' | 'purple' | 'cyan';
  /** Deep-link to hub signup with this plan pre-selected */
  signupHref?: string;
}

export function PricingCard({
  name,
  description,
  price,
  priceValue,
  period,
  features,
  separators = [],
  buttonText,
  isPopular = false,
  buttonVariant = 'primary',
  glowColor = 'cyan',
  signupHref,
}: PricingCardPlan) {
  return (
    <GlowCard
      glowColor={glowColor}
      className={`flex max-w-xs flex-1 flex-col rounded-2xl bg-gradient-to-br from-black/5 to-black/0 px-7 py-8 shadow-xl backdrop-blur-[14px] transition-all duration-500 ease-out hover:shadow-2xl hover:brightness-110 dark:from-white/10 dark:to-white/5 dark:backdrop-brightness-[0.91] ${
        isPopular
          ? 'relative scale-105 ring-[3px] ring-pink-400/40 dark:ring-pink-400/50 hover:scale-110'
          : 'scale-95 hover:scale-[1.03]'
      }`}
      style={
        isPopular
          ? {
              boxShadow: 'var(--shadow-glow-pink)',
              transition: 'box-shadow var(--duration-normal) var(--ease-out-expo)',
            }
          : undefined
      }
    >
      {isPopular && (
        <div className="text-foreground absolute -top-4 right-4 rounded-full bg-pink-400 px-3 py-1 text-[12px] font-semibold dark:text-black">
          Most Popular
        </div>
      )}

      <div className="mb-3">
        <h3 className="font-display text-foreground text-[clamp(28px,5vw,48px)] leading-[1.1] font-extralight tracking-[-0.03em] break-words">
          {name}
        </h3>
        <p className="text-foreground/70 mt-1 text-[16px]">{description}</p>
      </div>

      <div className="my-6 flex items-baseline gap-2">
        {priceValue !== undefined ? (
          <Counter
            from={0}
            to={priceValue}
            prefix="$"
            duration={1.5}
            className="font-display text-foreground max-w-full text-[clamp(28px,5vw,48px)] leading-[1.1] font-extralight break-words"
          />
        ) : (
          <span className="font-display text-foreground max-w-full text-[clamp(28px,5vw,48px)] leading-[1.1] font-extralight break-words">
            {price}
          </span>
        )}
        {period && <span className="text-foreground/70 shrink-0 text-[14px]">{period}</span>}
      </div>

      <div className="card-divider mb-5 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.1)_50%,transparent)] dark:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.09)_20%,rgba(255,255,255,0.22)_50%,rgba(255,255,255,0.09)_80%,transparent)]" />

      <ul className="text-foreground/90 mb-6 flex flex-col gap-2 text-[14px]">
        {features.map((feature, i) => {
          const isSep = separators.includes(i);
          return (
            <li key={i}>
              {isSep ? (
                <span className="text-foreground/40 mt-2 mb-1 block border-t border-white/10 pt-3 text-[13px] font-semibold tracking-wide uppercase">
                  {feature}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckIcon className="h-4 w-4 shrink-0 text-cyan-400" />
                  <span className="break-words">{feature}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        variant={buttonVariant === 'primary' ? 'default' : 'secondary'}
        className={`mt-auto w-full rounded-xl py-2.5 font-sans text-[14px] font-semibold transition ${
          buttonVariant === 'primary'
            ? 'text-foreground bg-cyan-400 hover:bg-cyan-300'
            : 'text-foreground border border-black/20 bg-black/10 hover:bg-black/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
        }`}
        asChild
      >
        <a href={signupHref ?? '#'}>{buttonText}</a>
      </Button>
    </GlowCard>
  );
}
