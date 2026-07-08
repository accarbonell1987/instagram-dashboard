import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import type { InstagramRepository } from '../repositories/instagram/index.js';
import { AccountNotConnectedError, NotFoundError } from '../errors.js';
import { clearAllCache } from '../lib/cache.js';

function createMockRepo(): {
  instagram: Record<keyof InstagramRepository, ReturnType<typeof vi.fn>>;
} {
  return {
    instagram: {
      findAccountByTenantId: vi.fn(),
      disconnectAccount: vi.fn(),
      upsertAccount: vi.fn(),
      updateToken: vi.fn(),
      updateSyncStatus: vi.fn(),
      getAgentConfig: vi.fn(),
      saveAgentConfig: vi.fn(),
      findAccountById: vi.fn(),
      findAccountWithToken: vi.fn(),
      findAccountsExpiringSoon: vi.fn(),
      findMediaByIgId: vi.fn(),
      upsertMedia: vi.fn(),
      findMediaById: vi.fn(),
      listMedia: vi.fn(),
      insertMetrics: vi.fn(),
      getLatestMetrics: vi.fn(),
      insertAccountInsight: vi.fn(),
      getLatestAccountInsight: vi.fn(),
      getAccountInsightHistory: vi.fn(),
      countAccountInsightHistory: vi.fn(),
      bulkCreateFollowerSnapshots: vi.fn(),
      getDashboardData: vi.fn(),
      getNorthStarMetrics: vi.fn(),
      createSyncLog: vi.fn(),
      updateSyncLog: vi.fn(),
      getLatestSyncLog: vi.fn(),
      updateProfile: vi.fn(),
      hasFalApiKey: vi.fn(),
      saveFalApiKey: vi.fn(),
      getFalApiKeyEncrypted: vi.fn(),
    },
  };
}

function createMockAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    igUserId: 'ig-1',
    username: 'test',
    accountType: 'BUSINESS' as const,
    facebookPageId: null,
    accessTokenHash: 'h',
    tokenExpiresAt: new Date(),
    syncStatus: 'idle' as const,
    lastSyncAt: null,
    connectedAt: new Date(),
    displayName: null,
    profilePictureUrl: null,
    followersCount: null,
    mediaCount: null,
    ...overrides,
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
    service = new DashboardService(repo as any);
    clearAllCache();
  });

  describe('getDashboardData', () => {
    it('throws AccountNotConnectedError when no account connected', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(null);

      await expect(service.getDashboardData('tenant-1', 'user-1')).rejects.toThrow(
        AccountNotConnectedError,
      );
    });

    it('delegates to repository when account exists', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      const mockDashboard = {
        period: '7d',
        account: {
          username: 'test',
          accountType: 'BUSINESS',
          followerCount: null,
        },
        overview: {
          totalPosts: 10,
          totalSaves: 100,
          totalShares: 50,
          totalImpressions: 2000,
          totalReach: 1500,
        },
        ranking: [],
        formatBreakdown: [],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
        findings: [],
      };
      repo.instagram.getDashboardData.mockResolvedValue(mockDashboard);

      const result = await service.getDashboardData('tenant-1', 'user-1');

      expect(result).toEqual(mockDashboard);
      expect(repo.instagram.getDashboardData).toHaveBeenCalledWith('acc-1');
    });

    it('passes correct account ID to repository', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount({ id: 'specific-account-id' }),
      );
      repo.instagram.getDashboardData.mockResolvedValue({
        period: '7d',
        account: {
          username: 'specific',
          accountType: 'CREATOR',
          followerCount: null,
        },
        overview: {
          totalPosts: 0,
          totalSaves: 0,
          totalShares: 0,
          totalImpressions: 0,
          totalReach: 0,
        },
        ranking: [],
        formatBreakdown: [],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
      });

      await service.getDashboardData('tenant-1', 'user-1');

      expect(repo.instagram.getDashboardData).toHaveBeenCalledWith(
        'specific-account-id',
      );
    });

    it('propagates repository errors', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getDashboardData.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getDashboardData('tenant-1', 'user-1')).rejects.toThrow(
        'Database error',
      );
    });

    it('scopes data to the correct tenant and user', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount({ id: 'tenant-a-acc' }),
      );
      repo.instagram.getDashboardData.mockResolvedValue({
        period: '7d',
        account: {
          username: 'a',
          accountType: 'BUSINESS',
          followerCount: null,
        },
        overview: {
          totalPosts: 1,
          totalSaves: 10,
          totalShares: 5,
          totalImpressions: 100,
          totalReach: 80,
        },
        ranking: [],
        formatBreakdown: [],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
      });

      await service.getDashboardData('tenant-a', 'user-a');
      expect(repo.instagram.findAccountByTenantId).toHaveBeenCalledWith('tenant-a');

      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount({ id: 'tenant-b-acc' }),
      );

      await service.getDashboardData('tenant-b', 'user-b');
      expect(repo.instagram.findAccountByTenantId).toHaveBeenCalledWith('tenant-b');
    });
  });

  describe('getMediaDetail', () => {
    it('throws AccountNotConnectedError when no account', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(null);

      await expect(
        service.getMediaDetail('tenant-1', 'user-1', 'media-1'),
      ).rejects.toThrow(AccountNotConnectedError);
    });

    it('throws NotFoundError when media not found', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.findMediaById.mockResolvedValue(null);

      await expect(
        service.getMediaDetail('tenant-1', 'user-1', 'media-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('returns media with metrics when found', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      const mediaDetail = {
        id: 'media-1',
        accountId: 'acc-1',
        igMediaId: 'ig-media-123',
        mediaType: 'VIDEO' as const,
        mediaProductType: 'REELS' as const,
        permalink: 'https://instagram.com/p/xyz',
        caption: 'Great post!',
        postedAt: new Date('2026-06-01'),
        metrics: {
          likes: 100,
          comments: 10,
          saves: 50,
          shares: 25,
          reach: 5000,
          impressions: 8000,
          totalInteractions: 185,
          videoViews: 2000,
          syncedAt: new Date(),
        },
      };
      repo.instagram.findMediaById.mockResolvedValue(mediaDetail);

      const result = await service.getMediaDetail('tenant-1', 'user-1', 'media-1');

      expect(result).toEqual(mediaDetail);
      expect(result.metrics).not.toBeNull();
      expect(result.metrics?.likes).toBe(100);
    });
  });

  describe('listMedia', () => {
    it('throws AccountNotConnectedError when no account', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(null);

      await expect(service.listMedia('tenant-1', 'user-1', {})).rejects.toThrow(
        AccountNotConnectedError,
      );
    });

    it('delegates to repository with pagination params', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      const paginatedResult = {
        data: [],
        total: 0,
        page: 2,
        pageSize: 5,
      };
      repo.instagram.listMedia.mockResolvedValue(paginatedResult);

      const result = await service.listMedia('tenant-1', 'user-1', {
        page: 2,
        pageSize: 5,
      });

      expect(result).toEqual(paginatedResult);
      expect(repo.instagram.listMedia).toHaveBeenCalledWith('acc-1', {
        page: 2,
        pageSize: 5,
      });
    });

    it('uses default pagination when no params provided', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.listMedia.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await service.listMedia('tenant-1', 'user-1', {});

      expect(repo.instagram.listMedia).toHaveBeenCalledWith('acc-1', {});
    });
  });

  describe('getGrowthData', () => {
    const baseSnapshot = {
      syncedAt: new Date('2026-06-15T10:00:00Z'),
      followerCount: 1000,
      likes: 50,
      comments: 10,
      saves: 20,
      shares: 5,
      impressions: 500,
      reach: 400,
      profileViews: 30,
    };

    it('throws AccountNotConnectedError when no account', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(null);

      await expect(
        service.getGrowthData('tenant-1', 'user-1', 'followers', '7d'),
      ).rejects.toThrow(AccountNotConnectedError);
    });

    it('returns GrowthDataPoint[] for followers metric', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getAccountInsightHistory.mockResolvedValue([
        { ...baseSnapshot, followerCount: 1000 },
        { ...baseSnapshot, syncedAt: new Date('2026-06-16T10:00:00Z'), followerCount: 1050 },
      ]);

      const result = await service.getGrowthData('tenant-1', 'user-1', 'followers', '7d');

      expect(result).toHaveLength(2);
      expect(result[0]!.date).toBe('2026-06-15T10:00:00.000Z');
      expect(result[0]!.value).toBe(1000);
      expect(result[1]!.value).toBe(1050);
    });

    it('computes engagement rate correctly', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      // (50+10+20+5) / 500 * 100 = 17.0
      repo.instagram.getAccountInsightHistory.mockResolvedValue([{ ...baseSnapshot }]);

      const result = await service.getGrowthData('tenant-1', 'user-1', 'engagement', '7d');

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(17);
    });

    it('returns 0 for engagement when impressions ≤ 0', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getAccountInsightHistory.mockResolvedValue([
        { ...baseSnapshot, impressions: 0 },
      ]);

      const result = await service.getGrowthData('tenant-1', 'user-1', 'engagement', '7d');

      expect(result[0]!.value).toBe(0);
    });

    it('returns empty array when no snapshots in period', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getAccountInsightHistory.mockResolvedValue([]);

      const result = await service.getGrowthData('tenant-1', 'user-1', 'reach', '7d');

      expect(result).toEqual([]);
    });

    it('calculates correct since date for 7d period', async () => {
      const now = Date.now();
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getAccountInsightHistory.mockResolvedValue([]);

      await service.getGrowthData('tenant-1', 'user-1', 'impressions', '7d');

      const sinceArg = repo.instagram.getAccountInsightHistory.mock.calls[0]![1] as Date;
      const diffDays = (now - sinceArg.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('maps profileViews metric directly', async () => {
      repo.instagram.findAccountByTenantId.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getAccountInsightHistory.mockResolvedValue([
        { ...baseSnapshot, profileViews: 42 },
      ]);

      const result = await service.getGrowthData('tenant-1', 'user-1', 'profileViews', '7d');

      expect(result[0]!.value).toBe(42);
    });
  });
});
