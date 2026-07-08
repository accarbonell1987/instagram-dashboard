'use client';

import { type Variants, motion } from 'motion/react';
import { ArrowUpRight, Users, Zap } from 'lucide-react';
import { Counter } from '@/components/ui/Counter';

interface Metric {
  label: string;
  value: string;
  delta: string;
  description: string;
  counterTo?: number;
  counterSuffix?: string;
  counterPrefix?: string;
  counterPostfix?: string;
}

interface GlassmorphismStatsProps {
  metrics: readonly Metric[];
  ctaLabel: string;
  ctaDesc: string;
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export function GlassmorphismStats({ metrics, ctaLabel, ctaDesc }: GlassmorphismStatsProps) {
  return (
    <section id="stats" className="sec-stats relative overflow-hidden px-[var(--spacing-pad)] py-[var(--spacing-section-y)]">
      {/* Glassmorphism background blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-brand-light/10 absolute top-0 left-0 h-[380px] w-[380px] rounded-full blur-[120px]" />
        <div className="bg-accent/10 absolute top-1/2 right-0 h-[420px] w-[420px] -translate-y-1/2 rounded-full blur-[140px]" />
      </div>

      <div className="rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] bg-[#0a0a0f] -mt-10 sm:-mt-12 md:-mt-14 overflow-clip relative z-10">
        <div className="mx-auto max-w-[var(--width-content)] space-y-12 pt-12">
        {/* Stats grid */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          transition={{ staggerChildren: 0.08 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {metrics.map((metric) => (
            <motion.div key={metric.label} variants={fadeUp}>
              <div className="group border-border-default/50 bg-bg-elev/45 shadow-card relative overflow-hidden rounded-3xl border p-8 backdrop-blur-2xl transition-transform duration-300 hover:-translate-y-1">
                <div className="from-text-default/[0.04] absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
                <div className="relative z-10 space-y-5">
                  {/* Label row */}
                  <div className="flex items-center justify-between">
                    <span className="text-text-dim font-mono text-xs font-medium tracking-[0.25em] uppercase">
                      {metric.label}
                    </span>
                    <ArrowUpRight className="text-text-mute h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </div>

                  {/* Value + delta */}
                  <div className="flex items-end gap-3">
                    <span className="font-display text-text-default text-5xl font-semibold tracking-tight gradient-text">
                      {metric.counterTo !== undefined ? (
                        <Counter
                          from={0}
                          to={metric.counterTo}
                          prefix={metric.counterPrefix ?? ''}
                          suffix={metric.counterSuffix ?? ''}
                          duration={1.5}
                        />
                      ) : (
                        metric.value
                      )}
                      {metric.counterPostfix}
                    </span>
                    <span className="border-border-default/40 bg-bg-elev/60 text-text-dim rounded-full border px-2.5 py-1 font-mono text-xs font-semibold tracking-[0.2em] uppercase backdrop-blur">
                      {metric.delta}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-text-dim text-sm leading-relaxed">{metric.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA bar */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="border-border-default/50 bg-bg-elev/40 flex flex-wrap items-center justify-between gap-6 rounded-3xl border px-6 py-6 backdrop-blur-xl md:px-8"
        >
          <div className="flex items-center gap-4">
            <div className="border-border-default/40 bg-bg-elev/70 text-text-dim flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_15px_40px_rgba(6,13,26,0.5)]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-text-dim font-mono text-sm tracking-[0.25em] uppercase">
                {ctaLabel}
              </p>
              <p className="text-text-dim/80 text-base">{ctaDesc}</p>
            </div>
          </div>
          <a
            href="#demo"
            className="border-border-default/40 bg-bg-elev/70 text-text-dim hover:text-text-default inline-flex h-11 cursor-pointer items-center rounded-full border px-6 font-mono text-sm tracking-[0.2em] uppercase backdrop-blur transition-colors"
          >
            <Zap className="mr-2 h-4 w-4" />
            {ctaLabel}
          </a>
        </motion.div>
      </div>
      </div>
    </section>
  );
}
