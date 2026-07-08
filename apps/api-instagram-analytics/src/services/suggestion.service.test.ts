/**
 * Unit tests for SuggestionService
 * TDD: RED phase — written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionService } from './suggestion.service.js';
import type { UsageTracker } from './usage-tracker.service.js';
import { QuotaExceededError } from '../errors.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sugg-1',
    tenantId: 'tenant-1',
    category: 'hook' as const,
    content: 'Empezá con el truco',
    status: 'pending' as const,
    linkedMediaId: null,
    linkedAt: null,
    outcome: null,
    measuredAt: null,
    baselineJson: null,
    metricsJson: null,
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

const mockSuggestionRepo = {
  create: vi.fn(),
  findByTenant: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  findEligibleForMeasurement: vi.fn(),
  createBatch: vi.fn().mockResolvedValue({ id: 'batch-1' }),
  findBatchesByTenant: vi.fn(),
};

const mockInstagramRepo = {
  getDashboardData: vi.fn(),
  findAccountByTenantId: vi.fn(),
  getLatestMetrics: vi.fn(),
};

function createMockRepos() {
  return {
    instagram: mockInstagramRepo as any,
    chatMessage: {} as any,
    suggestion: mockSuggestionRepo as any,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SuggestionService', () => {
  let service: SuggestionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SuggestionService(createMockRepos() as any);
  });

  describe('getSuggestions()', () => {
    it('calls repo.findByTenant with tenantId and returns result', async () => {
      const suggestions = [makeSuggestion(), makeSuggestion({ id: 'sugg-2' })];
      mockSuggestionRepo.findByTenant.mockResolvedValueOnce(suggestions);

      const result = await service.getSuggestions('tenant-1');

      expect(mockSuggestionRepo.findByTenant).toHaveBeenCalledWith('tenant-1', undefined);
      expect(result).toEqual(suggestions);
    });

    it('filters by status when provided', async () => {
      const suggestions = [makeSuggestion({ status: 'used' })];
      mockSuggestionRepo.findByTenant.mockResolvedValueOnce(suggestions);

      const result = await service.getSuggestions('tenant-1', 'used');

      expect(mockSuggestionRepo.findByTenant).toHaveBeenCalledWith('tenant-1', 'used');
      expect(result).toEqual(suggestions);
    });
  });

  describe('createSuggestion()', () => {
    it('calls repo.create with status=pending', async () => {
      const created = makeSuggestion();
      mockSuggestionRepo.create.mockResolvedValueOnce(created);

      const result = await service.createSuggestion('tenant-1', 'hook', 'Empezá con el truco');

      expect(mockSuggestionRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        category: 'hook',
        content: 'Empezá con el truco',
      });
      expect(result).toEqual(created);
    });
  });

  describe('markUsed()', () => {
    it('calls repo.update with status=used, linkedMediaId, and linkedAt', async () => {
      const updated = makeSuggestion({ status: 'used', linkedMediaId: 'media-123' });
      mockSuggestionRepo.update.mockResolvedValueOnce(updated);

      await service.markUsed('tenant-1', 'sugg-1', 'media-123');

      expect(mockSuggestionRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        'sugg-1',
        expect.objectContaining({
          status: 'used',
          linkedMediaId: 'media-123',
          linkedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('dismiss()', () => {
    it('calls repo.update with status=dismissed', async () => {
      const updated = makeSuggestion({ status: 'dismissed' });
      mockSuggestionRepo.update.mockResolvedValueOnce(updated);

      await service.dismiss('tenant-1', 'sugg-1');

      expect(mockSuggestionRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        'sugg-1',
        { status: 'dismissed' },
      );
    });
  });

  describe('measureOutcomes()', () => {
    it('eligible suggestion with metrics → computes verdict and calls repo.update with outcome + baselineJson + metricsJson + measuredAt', async () => {
      // Suggestion linked 10 days ago (eligible: linkedAt < now-7d)
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const eligible = makeSuggestion({
        id: 'sugg-eligible',
        tenantId: 'tenant-1',
        status: 'used',
        linkedMediaId: 'media-abc',
        linkedAt: tenDaysAgo,
        measuredAt: null,
      });
      mockSuggestionRepo.findEligibleForMeasurement.mockResolvedValueOnce([eligible]);

      // Mock getDashboardData to return format breakdown for baseline
      mockInstagramRepo.findAccountByTenantId.mockResolvedValueOnce({ id: 'acc-1' });
      mockInstagramRepo.getDashboardData.mockResolvedValueOnce({
        period: '30d',
        account: { username: 'test', accountType: 'BUSINESS', followerCount: 1000 },
        overview: { totalPosts: 10, totalSaves: 100, totalShares: 50, totalImpressions: 5000, totalReach: 4000 },
        ranking: [
          { igMediaId: 'media-abc', mediaType: 'REEL', saves: 50, shares: 25, reach: 2000, caption: null },
        ],
        formatBreakdown: [
          { format: 'REEL', postCount: 5, avgSaves: 30, avgShares: 15, avgReach: 1500, avgEngagementRate: 0.03 },
        ],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
      });

      const updatedSuggestion = { ...eligible, outcome: 'exceeded', measuredAt: new Date() };
      mockSuggestionRepo.update.mockResolvedValueOnce(updatedSuggestion);

      await service.measureOutcomes();

      expect(mockSuggestionRepo.findEligibleForMeasurement).toHaveBeenCalled();
      expect(mockSuggestionRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        'sugg-eligible',
        expect.objectContaining({
          outcome: expect.stringMatching(/exceeded|met|below/),
          measuredAt: expect.any(Date),
          baselineJson: expect.objectContaining({
            format: 'REEL',
            period: '90d',
            sampleCount: expect.any(Number),
            medianEngagementRate: expect.any(Number),
          }),
          metricsJson: expect.objectContaining({
            engagementRate: expect.any(Number),
          }),
        }),
      );
    });

    it('linkedAt = 3 days ago (within 7d window) → NOT updated (skipped by repo query)', async () => {
      // findEligibleForMeasurement already filters by linkedAt < now-7d,
      // so if we return empty list, no update is called.
      mockSuggestionRepo.findEligibleForMeasurement.mockResolvedValueOnce([]);

      await service.measureOutcomes();

      expect(mockSuggestionRepo.update).not.toHaveBeenCalled();
    });

    it('no baseline data (empty ranking for format) → outcome=met, sampleCount=0', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const eligible = makeSuggestion({
        id: 'sugg-no-baseline',
        tenantId: 'tenant-1',
        status: 'used',
        linkedMediaId: 'media-xyz',
        linkedAt: tenDaysAgo,
        measuredAt: null,
      });
      mockSuggestionRepo.findEligibleForMeasurement.mockResolvedValueOnce([eligible]);

      // No account found (no baseline)
      mockInstagramRepo.findAccountByTenantId.mockResolvedValueOnce(null);

      const updatedSuggestion = { ...eligible, outcome: 'met', measuredAt: new Date() };
      mockSuggestionRepo.update.mockResolvedValueOnce(updatedSuggestion);

      await service.measureOutcomes();

      expect(mockSuggestionRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        'sugg-no-baseline',
        expect.objectContaining({
          outcome: 'met',
          baselineJson: expect.objectContaining({
            sampleCount: 0,
            medianEngagementRate: 0,
          }),
          metricsJson: expect.objectContaining({
            engagementRate: 0,
          }),
          measuredAt: expect.any(Date),
        }),
      );
    });

    it('catches individual errors per suggestion without aborting others', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const eligible1 = makeSuggestion({ id: 'sugg-err', tenantId: 'tenant-1', status: 'used', linkedMediaId: 'media-err', linkedAt: tenDaysAgo });
      const eligible2 = makeSuggestion({ id: 'sugg-ok', tenantId: 'tenant-1', status: 'used', linkedMediaId: 'media-ok', linkedAt: tenDaysAgo });
      mockSuggestionRepo.findEligibleForMeasurement.mockResolvedValueOnce([eligible1, eligible2]);

      // First suggestion: findAccountByTenantId succeeds but getDashboardData throws
      // Second suggestion: findAccountByTenantId returns null (fallback to met)
      mockInstagramRepo.findAccountByTenantId
        .mockResolvedValueOnce({ id: 'acc-1' })
        .mockResolvedValueOnce(null); // second suggestion → fallback

      // getDashboardData throws for first suggestion
      mockInstagramRepo.getDashboardData
        .mockRejectedValueOnce(new Error('DB error'));

      mockSuggestionRepo.update.mockResolvedValue({ ...eligible2, outcome: 'met', measuredAt: new Date() });

      // Should not throw — errors are caught per-suggestion
      await expect(service.measureOutcomes()).resolves.not.toThrow();

      // Both suggestions should be processed (first with fallback due to error, second normally)
      expect(mockSuggestionRepo.update).toHaveBeenCalledTimes(2);
      // Both should get outcome = 'met' (fallback)
      expect(mockSuggestionRepo.update).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        expect.objectContaining({ outcome: 'met' }),
      );
    });
  });

  describe('generateContentIdea() with UsageTracker enforcement', () => {
    let mockUsageTracker: UsageTracker;
    let mockDeepSeekChat: ReturnType<typeof vi.fn>;

    function createMockUsageTracker(overrides: Partial<UsageTracker> = {}): UsageTracker {
      return {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
        log: vi.fn().mockResolvedValue(undefined),
        getUsage: vi.fn(),
        purgeCache: vi.fn(),
        ...overrides,
      } as unknown as UsageTracker;
    }

    beforeEach(() => {
      vi.clearAllMocks();
      mockDeepSeekChat = vi.fn();
      mockUsageTracker = createMockUsageTracker();
    });

    function createServiceWithTracker() {
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      // Setup repos with createBatch/createSuggestion mocks
      const repos = createMockRepos();
      mockSuggestionRepo.findByTenant.mockResolvedValue([]);
      return new SuggestionService(repos as any, mockDeepseekClient as any, mockUsageTracker);
    }

    it('calls checkQuota before DeepSeek call', async () => {
      mockDeepSeekChat.mockResolvedValueOnce({
        content: 'Una idea genial para Instagram',
        usage: { promptTokens: 50, completionTokens: 100 },
        finishReason: 'stop',
      });
      mockSuggestionRepo.create.mockResolvedValueOnce(makeSuggestion());
      // createBatch is called in generateContentIdea
      // Need to mock findEligibleForMeasurement and findByTenant on the suggestion repo
      const repos = createMockRepos();
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      const svc = new SuggestionService(repos as any, mockDeepseekClient as any, mockUsageTracker);

      await svc.generateContentIdea('tenant-1', 'Dame ideas');

      expect(mockUsageTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
      expect(mockUsageTracker.checkQuota).toHaveBeenCalledBefore(mockDeepSeekChat);
    });

    it('throws QuotaExceededError when checkQuota returns allowed=false', async () => {
      (mockUsageTracker.checkQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        limit: 100000,
        resetsAt: '2026-07-01T00:00:00.000Z',
      });

      const repos = createMockRepos();
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      const svc = new SuggestionService(repos as any, mockDeepseekClient as any, mockUsageTracker);

      await expect(
        svc.generateContentIdea('tenant-1', 'Dame ideas'),
      ).rejects.toThrow(QuotaExceededError);

      expect(mockDeepSeekChat).not.toHaveBeenCalled();
    });

    it('calls log after successful DeepSeek call', async () => {
      mockDeepSeekChat.mockResolvedValueOnce({
        content: 'Una idea genial para Instagram',
        usage: { promptTokens: 50, completionTokens: 100 },
        finishReason: 'stop',
      });
      mockSuggestionRepo.create.mockResolvedValueOnce(makeSuggestion());

      const repos = createMockRepos();
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      const svc = new SuggestionService(repos as any, mockDeepseekClient as any, mockUsageTracker);

      await svc.generateContentIdea('tenant-1', 'Dame ideas');

      expect(mockUsageTracker.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        operation: 'suggestion',
        promptTokens: 50,
        completionTokens: 100,
        model: 'deepseek-v4-flash',
      });
    });

    it('does NOT call log when DeepSeek fails', async () => {
      mockDeepSeekChat.mockRejectedValueOnce(new Error('API error'));

      const repos = createMockRepos();
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      const svc = new SuggestionService(repos as any, mockDeepseekClient as any, mockUsageTracker);

      await expect(
        svc.generateContentIdea('tenant-1', 'Dame ideas'),
      ).rejects.toThrow('API error');

      expect(mockUsageTracker.log).not.toHaveBeenCalled();
    });

    it('works without usageTracker (backward compat)', async () => {
      mockDeepSeekChat.mockResolvedValueOnce({
        content: 'Una idea sin tracker',
        usage: { promptTokens: 30, completionTokens: 60 },
        finishReason: 'stop',
      });
      mockSuggestionRepo.create.mockResolvedValueOnce(makeSuggestion());

      const repos = createMockRepos();
      const mockDeepseekClient = { chat: mockDeepSeekChat };
      const svc = new SuggestionService(repos as any, mockDeepseekClient as any);

      await expect(
        svc.generateContentIdea('tenant-1', 'Dame ideas'),
      ).resolves.toBeDefined();
    });
  });
});
