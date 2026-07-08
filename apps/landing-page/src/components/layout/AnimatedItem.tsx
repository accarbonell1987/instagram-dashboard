'use client';

import { motion, type Variants } from 'motion/react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import type { ReactNode } from 'react';

type ItemVariant = 'fadeUp' | 'fadeLeft' | 'fadeRight' | 'fadeScale';

interface AnimatedItemProps {
  children: ReactNode;
  variant?: ItemVariant;
  index?: number;
  className?: string;
}

const itemVariants: Record<ItemVariant, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0 },
  },
  fadeRight: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0 },
  },
  fadeScale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
  },
};

export function AnimatedItem({
  children,
  variant = 'fadeUp',
  index = 0,
  className,
}: AnimatedItemProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      variants={itemVariants[variant]}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.19, 1, 0.22, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
