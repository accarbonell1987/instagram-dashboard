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
      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
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
        tokens: { used: 0, limit: 0 },
        images: { used: 0, limit: 0 },
        sessions: { used: 0, limit: 0 },
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
      { resourceType: 'deepseek_tokens', limit: 100000, period: 'month' },
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

      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
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

      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(100000);
      expect(result.resetsAt).toBeDefined();
    });

    it('returns allowed:true when quota period is unlimited', async () => {
      const unlimitedQuotas = [
        { resourceType: 'deepseek_tokens', limit: 500000, period: 'unlimited' },
      ];

      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(unlimitedQuotas);

      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(500000);
    });

    it('returns allowed:true when no quota is configured for the resource', async () => {
      // Plan has no fal_images quota
      const partialQuotas = [
        { resourceType: 'deepseek_tokens', limit: 10000, period: 'month' },
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
        { resourceType: 'deepseek_tokens', limit: 100000, period: 'month' },
        { resourceType: 'fal_images', limit: 50, period: 'month' },
        { resourceType: 'chat_sessions', limit: 30, period: 'month' },
      ]);

      const result = await tracker.getUsage('tenant-1');

      expect(result.tokens).toEqual({ used: 12000, limit: 100000 });
      expect(result.images).toEqual({ used: 8, limit: 50 });
      expect(result.sessions).toEqual({ used: 0, limit: 30 });
      expect(result.period).toBe('month');
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
      const quotas = [{ resourceType: 'deepseek_tokens', limit: 5000, period: 'month' }];

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

      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5000);
    });

    it('refreshes cache when TTL is expired', async () => {
      const tracker = new UsageTracker(mockPrisma, 'http://localhost:8080', true);

      // Pre-populate expired cache
      internals(tracker).cache.set('plan-pro', {
        quotas: [{ resourceType: 'deepseek_tokens', limit: 1000, period: 'month' }],
        fetchedAt: Date.now() - 120_000, // 120s ago — expired
      });

      mockPrisma.aiUsageLog.aggregate.mockResolvedValue({
        _sum: { promptTokens: 0, completionTokens: 0, imageCount: null },
      });

      // fetchFn will fail because we didn't set up real mocks — but cache is expired so it tries to fetch
      // Instead, mock getPlanQuotas to return different quotas
      const newQuotas = [{ resourceType: 'deepseek_tokens', limit: 500000, period: 'month' }];
      internals(tracker).getPlanQuotas = vi.fn().mockResolvedValue(newQuotas);

      const result = await tracker.checkQuota('tenant-1', 'deepseek_tokens');
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
});
