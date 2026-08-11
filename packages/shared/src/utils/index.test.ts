import { describe, it, expect, vi, afterEach } from 'vitest';

import { formatDate, safeJsonParse, debounce, sleep, generateId } from './index';

describe('formatDate', () => {
  it('formats a date in the default locale', () => {
    expect(formatDate(new Date('2026-03-14T12:00:00Z'))).toBe('March 14, 2026');
  });

  it('honours an explicit locale', () => {
    expect(formatDate(new Date('2026-03-14T12:00:00Z'), 'es-PY')).toBe('14 de marzo de 2026');
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  // The point of the helper: malformed input must not throw into the caller.
  it('returns the fallback instead of throwing on malformed JSON', () => {
    expect(safeJsonParse('{nope', { a: 0 })).toEqual({ a: 0 });
  });

  it('returns the fallback for an empty string', () => {
    expect(safeJsonParse('', 'fallback')).toBe('fallback');
  });
});

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once after the delay, not once per call', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced();
    debounced();
    debounced();
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('passes the arguments of the last call through', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 50);

    debounced('first');
    debounced('last');
    vi.advanceTimersByTime(50);

    expect(spy).toHaveBeenCalledWith('last');
  });

  it('restarts the timer when called again before it elapses', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const debounced = debounce(spy, 100);

    debounced();
    vi.advanceTimersByTime(90);
    debounced();
    vi.advanceTimersByTime(90);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('sleep', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves only after the given delay', async () => {
    vi.useFakeTimers();
    const settled = vi.fn();
    const pending = sleep(200).then(settled);

    await vi.advanceTimersByTimeAsync(199);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toHaveBeenCalledOnce();
  });
});

describe('generateId', () => {
  it('defaults to twelve characters', () => {
    expect(generateId()).toHaveLength(12);
  });

  it('honours a requested length', () => {
    expect(generateId(5)).toHaveLength(5);
  });

  it('uses only lowercase alphanumerics', () => {
    expect(generateId(200)).toMatch(/^[a-z0-9]+$/);
  });

  it('returns an empty string for a length of zero', () => {
    expect(generateId(0)).toBe('');
  });
});
