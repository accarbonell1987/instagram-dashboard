import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from './use-reduced-motion';

function mockMatchMedia(matchesMap: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matchesMap[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    // Reset to default: no reduced motion, not mobile
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 767px)': false,
    });
  });

  it('returns false when neither reduced motion nor mobile', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when OS prefers reduced motion', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': true,
      '(max-width: 767px)': false,
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns true when viewport is mobile width', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': false,
      '(max-width: 767px)': true,
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns true when both conditions are true', () => {
    mockMatchMedia({
      '(prefers-reduced-motion: reduce)': true,
      '(max-width: 767px)': true,
    });
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
