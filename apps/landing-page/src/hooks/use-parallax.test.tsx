import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { useParallax } from './use-parallax';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MotionConfig>{children}</MotionConfig>;
}

describe('useParallax', () => {
  it('returns a MotionValue when reduced motion is false', () => {
    const { result } = renderHook(() => useParallax(), { wrapper: Wrapper });
    // Should return a MotionValue (has get method)
    expect(result.current).toBeDefined();
    expect(typeof result.current.get).toBe('function');
  });

  it('returns a static value when reduced motion is active', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() => useParallax(), { wrapper: Wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.get).toBe('function');
    // With reduced motion, offset of 0 should give static 0
    expect(result.current.get()).toBe(0);
  });

  it('accepts custom speed and offset params', () => {
    const { result } = renderHook(
      () => useParallax({ speed: 0.3, offset: 50 }),
      { wrapper: Wrapper },
    );
    expect(result.current).toBeDefined();
    expect(typeof result.current.get).toBe('function');
  });
});
