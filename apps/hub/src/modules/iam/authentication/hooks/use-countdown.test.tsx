import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useCountdown } from './use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts counting down from initial value when autoStart is true', () => {
    const { result } = renderHook(() => useCountdown(5));
    expect(result.current.seconds).toBe(5);
    expect(result.current.isActive).toBe(true);

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.seconds).toBe(3);
  });

  it('stops at 0', () => {
    const { result } = renderHook(() => useCountdown(3));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('does not start when autoStart is false', () => {
    const { result } = renderHook(() => useCountdown(5, { autoStart: false }));
    expect(result.current.seconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it('start() begins countdown from initial value', () => {
    const { result } = renderHook(() => useCountdown(5, { autoStart: false }));
    act(() => { result.current.start(); });
    expect(result.current.isActive).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.seconds).toBe(3);
  });

  it('reset() restarts from initial value', () => {
    const { result } = renderHook(() => useCountdown(5));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.seconds).toBe(2);
    act(() => { result.current.reset(); });
    expect(result.current.seconds).toBe(5);
    expect(result.current.isActive).toBe(true);
  });

  it('reset(newSeconds) uses new value and updates initialRef', () => {
    const { result } = renderHook(() => useCountdown(5));
    act(() => { result.current.reset(10); });
    expect(result.current.seconds).toBe(10);
    expect(result.current.isActive).toBe(true);
  });

  it('cleans up interval on unmount', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useCountdown(10));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});
