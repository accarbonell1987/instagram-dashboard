'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'motion/react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface CounterProps {
  from?: number;
  to: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

function formatValue(value: number, decimals: number): string {
  if (decimals > 0) {
    return value.toFixed(decimals);
  }
  return Math.round(value).toLocaleString();
}

export function Counter({
  from = 0,
  to,
  duration = 2,
  suffix = '',
  prefix = '',
  decimals = 0,
  className = '',
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const reducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>(formatValue(from, decimals));

  const startAnimation = useCallback(() => {
    const controls = animate(from, to, {
      duration,
      ease: [0.19, 1, 0.22, 1],
      onUpdate: (latest: number) => {
        setDisplayValue(formatValue(latest, decimals));
      },
    });
    return controls.stop;
  }, [from, to, duration, decimals]);

  useEffect(() => {
    if (isInView && !hasAnimated && !reducedMotion) {
      const stop = startAnimation();
      setHasAnimated(true);
      return stop;
    }
  }, [isInView, hasAnimated, reducedMotion, startAnimation]);

  const shouldAnimate = isInView && !reducedMotion;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shouldAnimate && hasAnimated
        ? displayValue
        : shouldAnimate && !hasAnimated
          ? formatValue(from, decimals)
          : formatValue(to, decimals)}
      {suffix}
    </span>
  );
}
