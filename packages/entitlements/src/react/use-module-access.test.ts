import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useModuleAccess } from './use-module-access.js';

const FALLBACK_ERROR_MESSAGE = 'Error al cargar permisos';

describe('useModuleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts loading with moduleIds null', () => {
    const fetcher = vi.fn().mockResolvedValue(['ig-basic-metrics']);

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.moduleIds).toBeNull();
  });

  // Regression: a product embedded in the hub gets its JWT over postMessage
  // after mounting, so fetching on mount answered 401 on every refresh and left
  // the user a Retry button for something that was only ever early.
  it('does not fetch while disabled, and stays unknown rather than errored', () => {
    const fetcher = vi.fn().mockResolvedValue(['ig-basic-metrics']);

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE, enabled: false }),
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.moduleIds).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('fetches as soon as it becomes enabled', async () => {
    const fetcher = vi.fn().mockResolvedValue(['ig-basic-metrics']);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE, enabled }),
      { initialProps: { enabled: false } },
    );
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.moduleIds).toEqual(new Set(['ig-basic-metrics']));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('resolves the granted module ids as a Set', async () => {
    const fetcher = vi.fn().mockResolvedValue(['ig-basic-metrics', 'ig-audience']);

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toEqual(new Set(['ig-basic-metrics', 'ig-audience']));
    expect(result.current.error).toBeNull();
  });

  it('resolves a real, valid empty Set for a zero-entitlement tenant', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toEqual(new Set());
    expect(result.current.error).toBeNull();
  });

  it('fails closed on fetch error — moduleIds stays null, error is set', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toBeNull();
    expect(result.current.error).toContain('Network error');
  });

  it('falls back to the caller-supplied message when the failure is not an Error', async () => {
    const fetcher = vi.fn().mockRejectedValue('not an Error instance');

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(FALLBACK_ERROR_MESSAGE);
  });

  it('refetch clears a prior error and re-resolves the granted modules', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(['ig-publications']);

    const { result } = renderHook(() =>
      useModuleAccess({ fetcher, fallbackErrorMessage: FALLBACK_ERROR_MESSAGE }),
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.moduleIds).toEqual(new Set(['ig-publications']));
  });
});
