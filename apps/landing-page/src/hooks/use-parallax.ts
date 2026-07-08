'use client';

import { useScroll, useTransform, type MotionValue } from 'motion/react';
import { useReducedMotion } from './use-reduced-motion';

interface ParallaxOptions {
  /** Speed multiplier. 0.5 = half speed, -0.5 = reverse half speed */
  speed?: number;
  /** Offset in pixels */
  offset?: number;
}

export function useParallax(
  { speed = 0.5, offset = 0 }: ParallaxOptions = {},
): MotionValue<number> {
  const reducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // Return static value if reduced motion
  if (reducedMotion) {
    return useTransform(scrollY, [0, 1], [offset, offset]);
  }

  return useTransform(scrollY, [0, 1000], [offset, offset * speed * -1]);
}
