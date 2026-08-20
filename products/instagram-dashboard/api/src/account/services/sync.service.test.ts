import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AccountNotConnectedError } from '../../errors.js';
import type { Repositories } from '../../shared/lib/create-repositories.js';
import { FixedWindowRateLimiter } from '../../shared/lib/rate-limiter.js';
import type { InstagramRepository } from '../repositories/instagram/index.js';

import { SyncService } from './sync.service.js';

/** A limiter with nothing left, for the cases about what happens on a refusal. */
function exhaustedLimiter(): FixedWindowRateLimiter {
  const limiter = new FixedWindowRateLimiter(0, 3_600_000);
  // The first call opens the window and is always allowed — behaviour carried
  // over from the counter this replaced. Opening it here leaves the next one
  // to be refused, which is what these cases are about.
  limiter.allows('acc-1');
  return limiter;
}

vi.mock('../../shared/lib/crypto.js', () => ({ decryptToken: vi.fn(() => 'mock-token') }));
vi.mock('../lib/instagram-client.js', () => ({
  InstagramClient: vi.fn().mockImplementation(() => ({
    getFollowerCountHistory: vi.fn().mockResolvedValue([]),
  })),
  extractInsightValue: vi.fn(),
}));

function createMockRepo(): {
  instagram: Record<keyof InstagramRepository, ReturnType<typeof vi.fn>>;
} {
  return {
    instagram: {
      findAccountByOwner: vi.fn(),
      disconnectAccount: vi.fn(),
  listAccountsByTenantId: vi.fn(),
  disconnectAccountById: vi.fn(),
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
  hasLlmApiKey: vi.fn(),
  saveLlmApiKey: vi.fn(),
  getLlmApiKeyEncrypted: vi.fn().mockResolvedValue(null),
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

describe('SyncService', () => {
  let service: SyncService;
  let repo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    repo = createMockRepo();
    service = new SyncService(repo as unknown as Repositories);
  });

  describe('triggerSync', () => {
    it('throws AccountNotConnectedError when no account exists', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(null);

      await expect(service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' })).rejects.toThrow(
        AccountNotConnectedError,
      );
    });

    it('returns already_running when sync is in progress', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount({ syncStatus: 'syncing' }),
      );

      const result = await service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.status).toBe('already_running');
      expect(result.syncId).toBe('');
    });

    it('starts sync when account is idle', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.createSyncLog.mockResolvedValue('log-1');

      const result = await service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.status).toBe('started');
      expect(result.syncId).toBe('log-1');
      expect(repo.instagram.updateSyncStatus).toHaveBeenCalledWith(
        'acc-1',
        'syncing',
      );
    });

    it('starts sync when account is in error state', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount({ syncStatus: 'error' }),
      );
      repo.instagram.createSyncLog.mockResolvedValue('log-error-1');

      const result = await service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.status).toBe('started');
      expect(result.syncId).toBe('log-error-1');
    });

    it('returns rate_limited when rate counter exhausted', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount(),
      );

      // A limiter that refuses, handed in. What the service does with a "no"
      // is the subject; how the limiter stores its counters is not.
      service = new SyncService(repo as unknown as Repositories, exhaustedLimiter());

      const result = await service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.status).toBe('rate_limited');
      expect(result.syncId).toBe('');
    });

    it('resets rate counter after window expires', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.createSyncLog.mockResolvedValue('log-reset');

      // A real limiter whose window has already rolled over: it allows again.
      const limiter = new FixedWindowRateLimiter(190, 3_600_000);
      for (let i = 0; i < 200; i++) limiter.record('acc-1');
      service = new SyncService(repo as unknown as Repositories, limiter);

      const result = await service.triggerSync({ tenantId: 'tenant-1', userId: 'user-1' });

      // Window expired → counter reset → sync starts
      expect(result.status).toBe('started');
    });
  });

  describe('getSyncStatus', () => {
    it('throws AccountNotConnectedError when no account connected', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(null);

      await expect(service.getSyncStatus({ tenantId: 'tenant-1', userId: 'user-1' })).rejects.toThrow(
        AccountNotConnectedError,
      );
    });

    it('returns idle status with last sync and media count', async () => {
      const lastSyncAt = new Date('2026-06-10T12:00:00Z');
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount({ lastSyncAt, syncStatus: 'idle' }),
      );
      repo.instagram.getLatestSyncLog.mockResolvedValue({
        id: 'log-1',
        status: 'completed',
        startedAt: new Date(),
        completedAt: lastSyncAt,
        mediaSynced: 24,
      });

      const status = await service.getSyncStatus({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(status.status).toBe('idle');
      expect(status.mediaCount).toBe(24);
      expect(status.lastSyncAt).toBe(lastSyncAt.toISOString());
    });

    it('returns nextSyncAvailableAt when rate limited', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount(),
      );

      service = new SyncService(repo as unknown as Repositories, exhaustedLimiter());

      const status = await service.getSyncStatus({ tenantId: 'tenant-1', userId: 'user-1' });

      // Rate limited → nextSyncAvailableAt is ~1 hour from now
      expect(status.nextSyncAvailableAt).toBeTruthy();
      const nextAvailable = new Date(status.nextSyncAvailableAt ?? '').getTime();
      expect(nextAvailable).toBeGreaterThan(Date.now());
      expect(nextAvailable).toBeLessThan(Date.now() + 3_700_000);
    });

    it('returns null mediaCount when no sync log exists', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount(),
      );
      repo.instagram.getLatestSyncLog.mockResolvedValue(null);

      const status = await service.getSyncStatus({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(status.mediaCount).toBe(0);
    });

    it('returns syncing status when sync is in progress', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(
        createMockAccount({ syncStatus: 'syncing' }),
      );
      repo.instagram.getLatestSyncLog.mockResolvedValue(null);

      const status = await service.getSyncStatus({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(status.status).toBe('syncing');
      expect(status.mediaCount).toBe(0);
    });
  });

  describe('backfillFollowerHistory', () => {
    const mockTokenRecord = {
      ...createMockAccount(),
      tokenEncrypted: 'encrypted',
      igUserId: 'ig-1',
    };

    it('throws AccountNotConnectedError when no account', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(null);

      await expect(
        service.backfillFollowerHistory({ tenantId: 'tenant-1', userId: 'user-1' }),
      ).rejects.toThrow(AccountNotConnectedError);
    });

    it('throws AccountNotConnectedError when no token', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(createMockAccount());
      repo.instagram.findAccountWithToken.mockResolvedValue(null);

      await expect(
        service.backfillFollowerHistory({ tenantId: 'tenant-1', userId: 'user-1' }),
      ).rejects.toThrow(AccountNotConnectedError);
    });

    it('always calls bulkCreateFollowerSnapshots for the full 730-day window', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(createMockAccount());
      repo.instagram.findAccountWithToken.mockResolvedValue(mockTokenRecord);
      repo.instagram.bulkCreateFollowerSnapshots.mockResolvedValue(5);

      const result = await service.backfillFollowerHistory({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(repo.instagram.bulkCreateFollowerSnapshots).toHaveBeenCalledWith(
        'acc-1',
        expect.any(Array),
      );
      expect(result.inserted).toBe(5);
    });

    it('returns inserted=0 when all dates in the window already exist (idempotent)', async () => {
      repo.instagram.findAccountByOwner.mockResolvedValue(createMockAccount());
      repo.instagram.findAccountWithToken.mockResolvedValue(mockTokenRecord);
      // IG client mock returns [] (no new data) → bulkCreate returns 0
      repo.instagram.bulkCreateFollowerSnapshots.mockResolvedValue(0);

      const result = await service.backfillFollowerHistory({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.inserted).toBe(0);
    });
  });
});
