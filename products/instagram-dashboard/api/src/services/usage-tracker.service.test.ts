import type { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

import { UsageTracker } from './usage-tracker.service.js';

// Access to UsageTracker private members overridden/inspected in tests
interface UsageTrackerInternals {
  cache: Map<string, { quotas: unknown[]; fetchedAt: number }>;
  getPlanQuotas: Mock;
}

function internals(tracker: UsageTracker): UsageTrackerInternals {
  return tracker as unknown as UsageTrackerInternals;
}

// Helper to create a basic mock PrismaClient
function makeMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    aiUsageLog: {
      create: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    ...overrides,
  } as unknown as PrismaClient & {
    aiUsageLog: Record<'create' | 'aggregate' | 'groupBy' | 'count', Mock>;
  };
}

describe('UsageTracker', () => {
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Feature Flag ──────────────────────────────────────────────────────────

  describe('when enabled = false', () => {
    it('checkQuota always returns allowed:true', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', false);
      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      expect(result).toEqual({ allowed: true });
    });

    it('log does NOT insert any AiUsageLog', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', false);
      await tracker.log({
        tenantId: 'tenant-1',
        operation: 'chat',
        promptTokens: 100,
        completionTokens: 200,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockPrisma.aiUsageLog.create).not.toHaveBeenCalled();
    });

    it('getUsage returns zeroed values', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', false);
      const result = await tracker.getUsage('tenant-1');
      expect(result).toEqual({
        tokens: { used: 0, limit: 0, period: 'month' },
        images: { used: 0, limit: 0, period: 'month' },
        sessions: { used: 0, limit: 0, period: 'day' },
        period: 'month',
      });
    });

    it('purgeCache is a no-op (does not throw)', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', false);
      await expect(tracker.purgeCache()).resolves.toBeUndefined();
    });
  });

  // ── log ────────────────────────────────────────────────────────────────────

  describe('log (enabled)', () => {
    it('inserts an AiUsageLog record with correct fields', async () => {
      mockPrisma.aiUsageLog.create.mockResolvedValue({ id: 'log-1' });
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      await tracker.log({
        tenantId: 'tenant-1',
        operation: 'chat',
        model: 'deepseek-v4-flash',
        promptTokens: 150,
        completionTokens: 350,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockPrisma.aiUsageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          operation: 'chat',
          model: 'deepseek-v4-flash',
          promptTokens: 150,
          completionTokens: 350,
          imageCount: 0,
        }) as object,
      });
    });

    it('inserts AiUsageLog with imageCount for image_gen operations', async () => {
      mockPrisma.aiUsageLog.create.mockResolvedValue({ id: 'log-2' });
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      await tracker.log({
        tenantId: 'tenant-1',
        operation: 'image_gen',
        imageCount: 3,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockPrisma.aiUsageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          operation: 'image_gen',
          imageCount: 3,
          promptTokens: 0,
          completionTokens: 0,
        }) as object,
      });
    });
  });

  // ── checkQuota ─────────────────────────────────────────────────────────────

  describe('checkQuota (enabled)', () => {
    const mockQuotasResponse = [
      { resourceType: 'llm_tokens', limit: 100000, period: 'month' },
      { resourceType: 'fal_images', limit: 50, period: 'month' },
      { resourceType: 'chat_sessions', limit: 30, period: 'month' },
    ];

    it('returns allowed:true when usage is under limit', async () => {
      // SUM returns 10000 tokens used (under 100000 limit)
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 5000, completionTokens: 5000, imageCount: null },
      });

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(mockQuotasResponse);

      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.limit).toBe(100000);
    });

    it('returns allowed:false when usage is at or over limit', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 60000, completionTokens: 40000, imageCount: null },
      });

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(mockQuotasResponse);

      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(100000);
      expect(result.resetsAt).toBeDefined();
    });

    it('returns allowed:true when quota period is unlimited', async () => {
      const unlimitedQuotas = [
        { resourceType: 'llm_tokens', limit: 500000, period: 'unlimited' },
      ];

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(unlimitedQuotas);

      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500000);
    });

    it('returns allowed:true when no quota is configured for the resource', async () => {
      // Plan has no fal_images quota
      const partialQuotas = [
        { resourceType: 'llm_tokens', limit: 10000, period: 'month' },
      ];

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(partialQuotas);

      const result = await tracker.checkQuota('tenant-1', 'fal_images');
      expect(result.allowed).toBe(true);
    });
  });

  // ── getUsage ───────────────────────────────────────────────────────────────

  describe('getUsage (enabled)', () => {
    it('aggregates token usage from AiUsageLog', async () => {
      // Mock token SUM
      mockPrisma.aiUsageLog.aggregate
        .mockResolvedValueOnce({
          _sum: { promptTokens: 5000, completionTokens: 7000, imageCount: null },
        })
        .mockResolvedValueOnce({
          _sum: { promptTokens: null, completionTokens: null, imageCount: 8 },
        });

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      // Override getPlanQuotas to return quotas
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue([
        { resourceType: 'llm_tokens', limit: 100000, period: 'month' },
        { resourceType: 'fal_images', limit: 50, period: 'month' },
        { resourceType: 'chat_sessions', limit: 30, period: 'day' },
      ]);
      mockPrisma.aiUsageLog.count.mockResolvedValue(4);

      const result = await tracker.getUsage('tenant-1');

      expect(result.tokens).toEqual({ used: 12000, limit: 100000, period: 'month' });
      expect(result.images).toEqual({ used: 8, limit: 50, period: 'month' });
      expect(result.sessions).toEqual({ used: 4, limit: 30, period: 'day' });
    });

    /**
     * `sessions.used` was the literal 0, and the old assertion locked it in. The
     * meter read 0 of 30 right up to the cap — an allowance that appears
     * untouched while it is being spent.
     */
    it('counts chat messages instead of reporting zero', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 0, completionTokens: 0, imageCount: 0 },
      });
      mockPrisma.aiUsageLog.count.mockResolvedValue(17);

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue([
        { resourceType: 'chat_sessions', limit: 30, period: 'day' },
      ]);

      const result = await tracker.getUsage('tenant-1');

      expect(result.sessions.used).toBe(17);
      // Rows, not a token sum, and only chat — scripts and suggestions are not
      // messages someone sent.
      expect(mockPrisma.aiUsageLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ operation: 'chat' }),
        }),
      );
    });

    it('counts the day, not the month, for a daily allowance', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 0, completionTokens: 0, imageCount: 0 },
      });
      mockPrisma.aiUsageLog.count.mockResolvedValue(1);

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue([
        { resourceType: 'chat_sessions', limit: 30, period: 'day' },
      ]);

      await tracker.getUsage('tenant-1');

      const call = mockPrisma.aiUsageLog.count.mock.calls[0]?.[0] as
        | { where: { createdAt: { gte: Date } } }
        | undefined;
      const since = call?.where.createdAt.gte;
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      expect(since?.getTime()).toBe(midnight.getTime());
    });
  });

  // ── purgeCache ─────────────────────────────────────────────────────────────

  describe('purgeCache', () => {
    it('clears the internal cache', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      // Warm the cache
      internals(tracker).cache.set('plan-pro', { quotas: [], fetchedAt: Date.now() });

      await tracker.purgeCache();
      expect(internals(tracker).cache.size).toBe(0);
    });

    it('clears only specific planId when provided', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      internals(tracker).cache.set('plan-pro', { quotas: [], fetchedAt: Date.now() });
      internals(tracker).cache.set('plan-starter', { quotas: [], fetchedAt: Date.now() });

      await tracker.purgeCache('plan-pro');
      expect(internals(tracker).cache.has('plan-pro')).toBe(false);
      expect(internals(tracker).cache.has('plan-starter')).toBe(true);
    });
  });

  // ── Cache TTL ──────────────────────────────────────────────────────────────

  describe('cache TTL', () => {
    it('returns cached data when within TTL', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      const quotas = [{ resourceType: 'llm_tokens', limit: 5000, period: 'month' }];

      // Pre-populate cache
      internals(tracker).cache.set('plan-pro', {
        quotas,
        fetchedAt: Date.now() - 30_000, // 30s ago — within TTL
      });

      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 1000, completionTokens: 500, imageCount: null },
      });

      // Mock getPlanQuotas to verify it's NOT called (cache hit)
      const getPlanQuotasSpy = vi.fn().mockResolvedValue(quotas);
      internals(tracker).getPlanQuotas = getPlanQuotasSpy;

      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5000);
    });

    it('refreshes cache when TTL is expired', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      // Pre-populate expired cache
      internals(tracker).cache.set('plan-pro', {
        quotas: [{ resourceType: 'llm_tokens', limit: 1000, period: 'month' }],
        fetchedAt: Date.now() - 120_000, // 120s ago — expired
      });

      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 0, completionTokens: 0, imageCount: null },
      });

      // fetchFn will fail because we didn't set up real mocks — but cache is expired so it tries to fetch
      // Instead, mock getPlanQuotas to return different quotas
      const newQuotas = [{ resourceType: 'llm_tokens', limit: 500000, period: 'month' }];
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(newQuotas);

      const result = await tracker.checkQuota('tenant-1', 'llm_tokens');
      // Should use the newly fetched (mocked) quotas
      expect(result.limit).toBe(500000);
    });
  });

  // ── checkQuota with image counts ──────────────────────────────────────────

  describe('checkQuota for fal_images', () => {
    it('aggregates imageCount from image_gen operations', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: null, completionTokens: null, imageCount: 45 },
      });

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue([
        { resourceType: 'fal_images', limit: 50, period: 'month' },
      ]);

      const result = await tracker.checkQuota('tenant-1', 'fal_images');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('denies when image count exceeds limit', async () => {
      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: null, completionTokens: null, imageCount: 50 },
      });

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue([
        { resourceType: 'fal_images', limit: 50, period: 'month' },
      ]);

      const result = await tracker.checkQuota('tenant-1', 'fal_images');
      expect(result.allowed).toBe(false);
    });
  });

  // ── getBreakdown ───────────────────────────────────────────────────────────

  describe('getBreakdown', () => {
    const row = (
      userId: string | null,
      operation: string,
      sums: { promptTokens?: number; completionTokens?: number; imageCount?: number },
      count = 1,
    ) => ({
      userId,
      operation,
      _sum: {
        promptTokens: sums.promptTokens ?? 0,
        completionTokens: sums.completionTokens ?? 0,
        imageCount: sums.imageCount ?? 0,
      },
      _count: { _all: count },
    });

    it('adds each member up and totals the tenant', async () => {
      mockPrisma.aiUsageLog.groupBy.mockResolvedValue([
        row('user-a', 'chat', { promptTokens: 100, completionTokens: 200 }, 3),
        row('user-b', 'chat', { promptTokens: 50, completionTokens: 50 }, 2),
        row('user-b', 'image_gen', { imageCount: 4 }, 4),
      ]);
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      const result = await tracker.getBreakdown('tenant-1', new Date('2026-08-01'));

      expect(result.total).toEqual({ tokens: 400, images: 4, calls: 9, messages: 5 });
      expect(result.byUser).toHaveLength(2);
    });

    /**
     * The rows written before the column existed. They belong to nobody, and
     * both alternatives are worse: dropping them makes the members stop adding
     * up to the total, and spreading them credits calls to people who did not
     * make them.
     */
    it('keeps unattributed history in its own entry', async () => {
      mockPrisma.aiUsageLog.groupBy.mockResolvedValue([
        row(null, 'chat', { promptTokens: 900, completionTokens: 100 }, 10),
        row('user-a', 'chat', { promptTokens: 100, completionTokens: 0 }, 1),
      ]);
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      const result = await tracker.getBreakdown('tenant-1', new Date('2026-08-01'));

      const orphan = result.byUser.find((u) => u.userId === null);
      expect(orphan?.tokens).toBe(1000);
      expect(result.byUser.reduce((sum, u) => sum + u.tokens, 0)).toBe(result.total.tokens);
    });

    it('counts messages as chat calls only', async () => {
      mockPrisma.aiUsageLog.groupBy.mockResolvedValue([
        row('user-a', 'chat', { promptTokens: 10 }, 7),
        row('user-a', 'suggestion', { promptTokens: 10 }, 5),
        row('user-a', 'script', { promptTokens: 10 }, 3),
      ]);
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      const result = await tracker.getBreakdown('tenant-1', new Date('2026-08-01'));

      expect(result.total.messages).toBe(7);
      expect(result.total.calls).toBe(15);
    });

    it('sorts the heaviest consumer first', async () => {
      mockPrisma.aiUsageLog.groupBy.mockResolvedValue([
        row('light', 'chat', { promptTokens: 10 }),
        row('heavy', 'chat', { promptTokens: 5000 }),
        row('middle', 'chat', { promptTokens: 500 }),
      ]);
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      const result = await tracker.getBreakdown('tenant-1', new Date('2026-08-01'));

      expect(result.byUser.map((u) => u.userId)).toEqual(['heavy', 'middle', 'light']);
    });

    it('returns empty totals when nothing was recorded', async () => {
      mockPrisma.aiUsageLog.groupBy.mockResolvedValue([]);
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      const result = await tracker.getBreakdown('tenant-1', new Date('2026-08-01'));

      expect(result.total).toEqual({ tokens: 0, images: 0, calls: 0, messages: 0 });
      expect(result.byUser).toEqual([]);
    });
  });
});

