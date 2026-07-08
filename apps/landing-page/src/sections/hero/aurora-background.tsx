'use client';

import { useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion, useMotionValue, useMotionTemplate, animate } from 'motion/react';

const ParticlesCanvas = dynamic(
  () => import('@/components/ui/ParticlesCanvas').then((m) => m.ParticlesCanvas),
  { ssr: false },
);

const COLORS_TOP = ['#E1306C', '#C026D3', '#F77737', '#7C3AED'];

interface AuroraBackgroundProps {
  children: ReactNode;
}

export function AuroraBackground({ children }: AuroraBackgroundProps) {
  const color = useMotionValue(COLORS_TOP[0]);

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: 'easeInOut',
      duration: 20,
      repeat: Infinity,
      repeatType: 'mirror',
    });
  }, []);

  const backgroundImage = useMotionTemplate`
    radial-gradient(125% 125% at 50% 0%, var(--color-bg) 50%, ${color})
  `;

  return (
    <motion.div style={{ backgroundImage }} className="relative overflow-hidden">
      {/* Atmospheric glow overlay — radial gradient for softer feel */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(225, 48, 108, 0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 60%, rgba(124, 58, 237, 0.06), transparent 60%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>

      {/* Particles — lightweight 2D canvas, client-side only */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-60">
        <ParticlesCanvas />
      </div>
    </motion.div>
  );
}
