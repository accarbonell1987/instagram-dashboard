'use client';

export function useReducedMotion(): boolean {
  // Check for prefers-reduced-motion
  const prefersReduced =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  // Check for mobile (disable heavy animations)
  const isMobile =
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false;

  return prefersReduced || isMobile;
}
