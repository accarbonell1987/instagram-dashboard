import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as instagramService from '../services/instagram.service';

import { useModuleAccess } from './use-module-access';

vi.mock('../services/instagram.service');

const mockedService = vi.mocked(instagramService);

describe('useModuleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts loading with moduleIds null', () => {
    mockedService.getMyModules.mockResolvedValue(['ig-basic-metrics']);

    const { result } = renderHook(() => useModuleAccess());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.moduleIds).toBeNull();
  });

  it('resolves the granted module ids as a Set', async () => {
    mockedService.getMyModules.mockResolvedValue(['ig-basic-metrics', 'ig-audience']);

    const { result } = renderHook(() => useModuleAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toEqual(new Set(['ig-basic-metrics', 'ig-audience']));
    expect(result.current.error).toBeNull();
  });

  it('resolves a real, valid empty Set for a zero-entitlement tenant', async () => {
    mockedService.getMyModules.mockResolvedValue([]);

    const { result } = renderHook(() => useModuleAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toEqual(new Set());
    expect(result.current.error).toBeNull();
  });

  it('fails closed on fetch error — moduleIds stays null, error is set', async () => {
    mockedService.getMyModules.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useModuleAccess());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.moduleIds).toBeNull();
    expect(result.current.error).toContain('Network error');
  });

  it('refetch clears a prior error and re-resolves the granted modules', async () => {
    mockedService.getMyModules
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(['ig-publications']);

    const { result } = renderHook(() => useModuleAccess());

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
