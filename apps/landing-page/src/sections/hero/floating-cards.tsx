'use client';

import { motion } from 'motion/react';
import { useParallax } from '@/hooks/use-parallax';
import type { ReactNode } from 'react';

interface FloatingCardProps {
  className?: string;
  speed?: number;
  offset?: number;
  children: ReactNode;
}

export function FloatingCard({
  className,
  speed = 0.3,
  offset = 0,
  children,
}: FloatingCardProps) {
  const y = useParallax({ speed, offset });

  return (
    <motion.div className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
