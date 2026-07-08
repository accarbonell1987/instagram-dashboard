'use client';

import { motion, type Variants } from 'motion/react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { ReactNode } from 'react';

type AnimationVariant = 'fadeUp' | 'fadeLeft' | 'fadeRight' | 'fadeScale' | 'none';
type AllowedTag = 'div' | 'section' | 'article' | 'aside' | 'li' | 'span';

interface AnimatedSectionProps {
  children: ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  className?: string;
  as?: AllowedTag;
}

const variants: Record<AnimationVariant, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  fadeRight: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  fadeScale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
  none: {
    hidden: {},
    visible: {},
  },
};

export function AnimatedSection({
  children,
  variant = 'fadeUp',
  delay = 0,
  className,
  as: Tag = 'div',
}: AnimatedSectionProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AnyTag = Tag as any;
    return <AnyTag className={className}>{children}</AnyTag>;
  }

  return (
    <motion.div
      className={className}
      variants={variants[variant]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.19, 1, 0.22, 1], // --ease-out-expo
      }}
    >
      {children}
    </motion.div>
  );
}
