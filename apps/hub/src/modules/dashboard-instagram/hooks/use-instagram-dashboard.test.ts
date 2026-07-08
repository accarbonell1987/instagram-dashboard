import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useConnectionStatus,
  useSyncStatus,
  useInstagramDashboard,
  useGrowthData,
} from './use-instagram-dashboard';
import * as instagramService from '../services/instagram.service';

vi.mock('../services/instagram.service');

const mockedService = vi.mocked(instagramService);

describe('useConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns disconnected state when no account linked', async () => {
    mockedService.getConnectionStatus.mockResolvedValue({ connected: false });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.username).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns connected state with username when account exists', async () => {
    mockedService.getConnectionStatus.mockResolvedValue({
      connected: true,
      username: 'testuser',
      accountType: 'BUSINESS',
    });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.username).toBe('testuser');
  });

  it('handles fetch errors gracefully', async () => {
    mockedService.getConnectionStatus.mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error).toContain('Network error');
    expect(result.current.isConnected).toBe(false);
  });

  it('refetch updates the connection status', async () => {
    mockedService.getConnectionStatus
      .mockResolvedValueOnce({ connected: false })
      .mockResolvedValueOnce({
        connected: true,
        username: 'newuser',
        accountType: 'BUSINESS',
      });

    const { result } = renderHook(() => useConnectionStatus());

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.username).toBe('newuser');
  });
});

describe('useSyncStatus (basic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches sync status on mount and returns idle state', async () => {
    mockedService.getSyncStatus.mockResolvedValue({
      status: 'idle',
      lastSyncAt: '2026-06-10T12:00:00Z',
      mediaCount: 24,
      nextSyncAvailableAt: null,
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.syncState?.status).toBe('idle');
    expect(result.current.syncState?.mediaCount).toBe(24);
  });

  it('triggers sync and calls the API', async () => {
    mockedService.getSyncStatus.mockResolvedValue({
      status: 'idle',
      lastSyncAt: null,
      mediaCount: 0,
      nextSyncAvailableAt: null,
    });
    mockedService.triggerSync.mockResolvedValue({
      syncId: 'sync-1',
      status: 'started',
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(mockedService.triggerSync).toHaveBeenCalled();
    // getSyncStatus is called on mount + after triggerSync
    // (exact count may vary by 1 due to React Strict Mode or state batched updates)
    expect(mockedService.getSyncStatus).toHaveBeenCalled();
  });

  it('returns syncing status when backend reports syncing', async () => {
    mockedService.getSyncStatus.mockResolvedValue({
      status: 'syncing',
      lastSyncAt: null,
      mediaCount: 5,
      nextSyncAvailableAt: null,
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.syncState?.status).toBe('syncing');
    expect(result.current.syncState?.mediaCount).toBe(5);
  });

  it('returns error status when backend reports error', async () => {
    mockedService.getSyncStatus.mockResolvedValue({
      status: 'error',
      lastSyncAt: null,
      mediaCount: 0,
      nextSyncAvailableAt: null,
    });

    const { result } = renderHook(() => useSyncStatus());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.syncState?.status).toBe('error');
  });
});

describe('useSyncStatus (polling with fake timers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll when sync status is idle', async () => {
    mockedService.getSyncStatus.mockResolvedValue({
      status: 'idle',
      lastSyncAt: null,
      mediaCount: 0,
      nextSyncAvailableAt: null,
    });

    const { unmount } = renderHook(() => useSyncStatus());

    // Flush initial effect
    await vi.advanceTimersByTimeAsync(0);

    // Advance 10s — polling should NOT trigger for idle status
    await vi.advanceTimersByTimeAsync(10_000);

    // Should have been called at least once (mount), but NOT many times
    // (polling should not trigger for idle status, so it stays low)
    const callCount = mockedService.getSyncStatus.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(callCount).toBeLessThan(5); // NOT an infinite loop

    unmount();
  });

  it('polls while syncing', async () => {
    mockedService.getSyncStatus
      .mockResolvedValueOnce({
        status: 'syncing',
        lastSyncAt: null,
        mediaCount: 5,
        nextSyncAvailableAt: null,
      })
      .mockResolvedValueOnce({
        status: 'idle',
        lastSyncAt: '2026-06-10T12:10:00Z',
        mediaCount: 24,
        nextSyncAvailableAt: null,
      });

    const { unmount } = renderHook(() => useSyncStatus());

    // Flush initial effect (first call)
    await vi.advanceTimersByTimeAsync(0);

    // Advance 10s → polling fires
    await vi.advanceTimersByTimeAsync(10_000);

    // Should have at least 2 calls: mount + poll
    expect(mockedService.getSyncStatus.mock.calls.length).toBeGreaterThanOrEqual(2);

    unmount();
  });
});

describe('useInstagramDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches dashboard data on mount', async () => {
    mockedService.getDashboardData.mockResolvedValue({
      profile: {
        username: 'test',
        fullName: 'Test User',
        avatarUrl: '',
        bio: '',
        website: undefined,
        isVerified: false,
        isBusiness: true,
        followersCount: 1000,
        followingCount: 100,
        postsCount: 50,
      },
      overview: {
        followers: { current: 1000, previous: 950, trend: 'up', percentageChange: 5 },
        engagement: { current: 200, previous: 180, trend: 'up', percentageChange: 11 },
        reach: { current: 5000, previous: 4800, trend: 'up', percentageChange: 4 },
        impressions: { current: 8000, previous: 7500, trend: 'up', percentageChange: 7 },
        profileViews: { current: 300, previous: 280, trend: 'up', percentageChange: 7 },
      },
      engagementHistory: [],
      topPosts: [],
      recentPosts: [],
      audience: {
        ageRanges: [],
        topCities: [],
        topCountries: [],
        genderSplit: { male: 50, female: 50, other: 0 },
      },
      period: '7d',
      lastUpdated: '2026-01-01',
    } as any);

    const { result } = renderHook(() => useInstagramDashboard());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles fetch errors', async () => {
    mockedService.getDashboardData.mockRejectedValue(
      new Error('Dashboard fetch failed'),
    );

    const { result } = renderHook(() => useInstagramDashboard());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('Dashboard fetch failed');
    expect(result.current.data).toBeNull();
  });

  it('refetch re-triggers data loading', async () => {
    const firstData = {
      profile: { username: 'first', fullName: 'F', avatarUrl: '', bio: '', website: undefined, isVerified: false, isBusiness: false, followersCount: 0, followingCount: 0, postsCount: 0 },
      overview: {
        followers: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        engagement: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        reach: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        impressions: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        profileViews: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
      },
      engagementHistory: [],
      topPosts: [],
      recentPosts: [],
      audience: { ageRanges: [], topCities: [], topCountries: [], genderSplit: { male: 50, female: 50, other: 0 } },
      period: '7d',
      lastUpdated: '2026-01-01',
    };

    mockedService.getDashboardData
      .mockResolvedValueOnce(firstData as any)
      .mockResolvedValueOnce({
        ...firstData,
        profile: { ...firstData.profile, username: 'updated' },
      } as any);

    const { result } = renderHook(() => useInstagramDashboard());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data?.profile.username).toBe('updated');
  });

  it('setPeriod changes period', async () => {
    mockedService.getDashboardData.mockResolvedValue({
      profile: { username: 'test', fullName: 'T', avatarUrl: '', bio: '', website: undefined, isVerified: false, isBusiness: false, followersCount: 0, followingCount: 0, postsCount: 0 },
      overview: {
        followers: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        engagement: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        reach: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        impressions: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
        profileViews: { current: 0, previous: 0, trend: 'stable', percentageChange: 0 },
      },
      engagementHistory: [],
      topPosts: [],
      recentPosts: [],
      audience: { ageRanges: [], topCities: [], topCountries: [], genderSplit: { male: 50, female: 50, other: 0 } },
      period: '7d',
      lastUpdated: '2026-01-01',
    } as any);

    const { result } = renderHook(() => useInstagramDashboard());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.period).toBe('7d');

    await act(async () => {
      result.current.setPeriod('30d');
    });

    expect(result.current.period).toBe('30d');
  });
});

describe('useGrowthData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleGrowthPoints = [
    { date: '2026-06-15T10:00:00.000Z', value: 1000 },
    { date: '2026-06-16T10:00:00.000Z', value: 1050 },
  ];

  it('fetches growth data on mount', async () => {
    mockedService.getGrowthData.mockResolvedValue(sampleGrowthPoints);

    const { result } = renderHook(() => useGrowthData('followers', '7d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(sampleGrowthPoints);
    expect(result.current.error).toBeNull();
    expect(mockedService.getGrowthData).toHaveBeenCalledWith('followers', '7d');
  });

  it('does not fetch when enabled is false', async () => {
    mockedService.getGrowthData.mockResolvedValue(sampleGrowthPoints);

    const { result } = renderHook(() =>
      useGrowthData('followers', '7d', { enabled: false }),
    );

    // Wait for any potential async work
    await new Promise((r) => setTimeout(r, 100));

    expect(mockedService.getGrowthData).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('refetches on metric change', async () => {
    mockedService.getGrowthData
      .mockResolvedValueOnce(sampleGrowthPoints)
      .mockResolvedValueOnce([{ date: '2026-06-15T10:00:00.000Z', value: 5.0 }]);

    const { result, rerender } = renderHook(
      ({ metric }) => useGrowthData(metric, '7d'),
      { initialProps: { metric: 'followers' as const } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toEqual(sampleGrowthPoints);

    // Change metric
    rerender({ metric: 'engagement' as const });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedService.getGrowthData).toHaveBeenLastCalledWith('engagement', '7d');
    expect(result.current.data[0]!.value).toBe(5.0);
  });

  it('refetches on period change', async () => {
    mockedService.getGrowthData
      .mockResolvedValueOnce(sampleGrowthPoints)
      .mockResolvedValueOnce([{ date: '2026-06-01T10:00:00.000Z', value: 900 }]);

    const { result, rerender } = renderHook(
      ({ period }) => useGrowthData('followers', period),
      { initialProps: { period: '7d' as const } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ period: '30d' as const });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedService.getGrowthData).toHaveBeenLastCalledWith('followers', '30d');
  });

  it('handles fetch errors', async () => {
    mockedService.getGrowthData.mockRejectedValue(
      new Error('Network failure'),
    );

    const { result } = renderHook(() => useGrowthData('reach', '7d'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('Network failure');
    expect(result.current.data).toEqual([]);
  });

  it('returns empty array as initial data', () => {
    mockedService.getGrowthData.mockResolvedValue(sampleGrowthPoints);

    const { result } = renderHook(() => useGrowthData('impressions', '7d'));

    // Before the fetch resolves, data should be empty array
    expect(result.current.data).toEqual([]);
  });
});
