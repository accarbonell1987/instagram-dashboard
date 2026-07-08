'use client';

import { TrendingUp, BarChart3, Users, Clock } from 'lucide-react';
import type { FC, SVGProps } from 'react';
import { motion } from 'motion/react';
import { GlowCard } from '@/components/ui/GlowCard';

interface StackingCardFeature {
  title: string;
  desc: string;
  badge: string;
}

interface StackingCardsProps {
  features: readonly StackingCardFeature[];
}

const glowColors = ['pink', 'orange', 'purple', 'cyan'] as const;
const icons: FC<SVGProps<SVGSVGElement>>[] = [TrendingUp, BarChart3, Users, Clock];

export function StackingCards({ features }: StackingCardsProps) {
  const totalCards = features.length;

  return (
    <div className="relative mt-20" style={{ minHeight: '250vh' }}>
      {features.map((feature, i) => {
        const Icon = icons[i % icons.length];
        const targetScale = 1 - (totalCards - 1 - i) * 0.05;

        return (
          <div
            key={i}
            className="sticky top-24"
            style={{ zIndex: totalCards - i }}
          >
            <motion.div
              initial={{ scale: 1 }}
              style={{
                scale: targetScale,
                transformOrigin: 'top center',
              }}
            >
              <GlowCard
                glowColor={glowColors[i % glowColors.length]}
                className="p-6 sm:p-8"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h4 className="font-display text-sm font-semibold text-text-default">
                    {feature.title}
                  </h4>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-text-dim">
                  {feature.desc}
                </p>
                <span className="rounded-pill inline-block border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs font-medium text-accent">
                  {feature.badge}
                </span>
              </GlowCard>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
