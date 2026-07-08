import type { PrismaClient } from '@prisma/client';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining?: number;
  limit?: number;
  resetsAt?: string;
}

export interface UsageLogParams {
  tenantId: string;
  operation: 'chat' | 'script' | 'suggestion' | 'image_gen';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  imageCount?: number;
}

export interface UsageData {
  tokens: { used: number; limit: number };
  images: { used: number; limit: number };
  sessions: { used: number; limit: number };
  period: string;
}

interface PlanQuotaCache {
  resourceType: string;
  limit: number;
  period: string;
}

interface CacheEntry {
  quotas: PlanQuotaCache[];
  fetchedAt: number;
}

export class UsageTracker {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60_000;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly iamBaseUrl: string,
    private readonly enabled: boolean,
  ) {
    this.fetchFn = globalThis.fetch.bind(globalThis);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async checkQuota(
    tenantId: string,
    resourceType: 'deepseek_tokens' | 'fal_images' | 'chat_sessions',
  ): Promise<QuotaCheckResult> {
    if (!this.enabled) return { allowed: true };

    const quotas = await this.getPlanQuotas(tenantId);
    const quota = quotas.find((q) => q.resourceType === resourceType);

    if (!quota) return { allowed: true };
    if (quota.period === 'unlimited') return { allowed: true, limit: quota.limit };

    const used = await this.prisma.aiUsageLog.aggregate({
      _sum:
        resourceType === 'fal_images'
          ? { imageCount: true }
          : { promptTokens: true, completionTokens: true },
      where: {
        tenantId,
        operation:
          resourceType === 'fal_images'
            ? 'image_gen'
            : { in: ['chat', 'script', 'suggestion'] },
        createdAt: { gte: this.periodStart(quota.period) },
      },
    });

    const sum =
      resourceType === 'fal_images'
        ? (used._sum.imageCount ?? 0)
        : ((used._sum.promptTokens ?? 0) + (used._sum.completionTokens ?? 0));

    return {
      allowed: sum < quota.limit,
      remaining: Math.max(0, quota.limit - sum),
      limit: quota.limit,
      resetsAt: this.periodEnd(quota.period).toISOString(),
    };
  }

  async log(params: UsageLogParams): Promise<void> {
    if (!this.enabled) return;

    await this.prisma.aiUsageLog.create({
      data: {
        tenantId: params.tenantId,
        operation: params.operation,
        model: params.model ?? null,
        promptTokens: params.promptTokens ?? 0,
        completionTokens: params.completionTokens ?? 0,
        imageCount: params.imageCount ?? 0,
      },
    });
  }

  async getUsage(tenantId: string): Promise<UsageData> {
    if (!this.enabled) {
      return {
        tokens: { used: 0, limit: 0 },
        images: { used: 0, limit: 0 },
        sessions: { used: 0, limit: 0 },
        period: 'month',
      };
    }

    const quotas = await this.getPlanQuotas(tenantId);

    const tokenUsage = await this.prisma.aiUsageLog.aggregate({
      _sum: { promptTokens: true, completionTokens: true },
      where: {
        tenantId,
        operation: { in: ['chat', 'script', 'suggestion'] },
        createdAt: { gte: this.periodStart('month') },
      },
    });

    const imageUsage = await this.prisma.aiUsageLog.aggregate({
      _sum: { imageCount: true },
      where: {
        tenantId,
        operation: 'image_gen',
        createdAt: { gte: this.periodStart('month') },
      },
    });

    const tokenCount =
      (tokenUsage._sum.promptTokens ?? 0) + (tokenUsage._sum.completionTokens ?? 0);
    const imageCount = imageUsage._sum.imageCount ?? 0;

    const tokensQuota = quotas.find((q) => q.resourceType === 'deepseek_tokens');
    const imagesQuota = quotas.find((q) => q.resourceType === 'fal_images');
    const sessionsQuota = quotas.find((q) => q.resourceType === 'chat_sessions');

    return {
      tokens: {
        used: tokenCount,
        limit: tokensQuota?.period !== 'unlimited' ? (tokensQuota?.limit ?? 0) : tokensQuota?.limit ?? 0,
      },
      images: {
        used: imageCount,
        limit: imagesQuota?.period !== 'unlimited' ? (imagesQuota?.limit ?? 0) : imagesQuota?.limit ?? 0,
      },
      sessions: {
        used: 0,
        limit: sessionsQuota?.period !== 'unlimited' ? (sessionsQuota?.limit ?? 0) : sessionsQuota?.limit ?? 0,
      },
      period: 'month',
    };
  }

  async purgeCache(planId?: string): Promise<void> {
    if (!this.enabled) return;

    if (planId) {
      this.cache.delete(planId);
    } else {
      this.cache.clear();
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getPlanQuotas(tenantId: string): Promise<PlanQuotaCache[]> {
    // Resolve tenant's planId from iam
    const tenantRes = await this.fetchFn(`${this.iamBaseUrl}/internal/tenants/${tenantId}`);
    const tenantData = (await tenantRes.json()) as { planId: string };
    const planId = tenantData.planId;

    // Check cache
    const cached = this.cache.get(planId);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.quotas;
    }

    // Fetch from iam
    const quotasRes = await this.fetchFn(`${this.iamBaseUrl}/plans/${planId}/quotas`);
    const body = (await quotasRes.json()) as { quotas: PlanQuotaCache[] };
    const quotas = body.quotas;

    // Store in cache
    this.cache.set(planId, { quotas, fetchedAt: Date.now() });

    return quotas;
  }

  private periodStart(period: string): Date {
    const now = new Date();
    if (period === 'day') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    // Default: month
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private periodEnd(period: string): Date {
    const now = new Date();
    if (period === 'day') {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return end;
    }
    // Default: month
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
