import type { PrismaClient } from '@prisma/client';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining?: number;
  limit?: number;
  resetsAt?: string;
}

export interface UsageTotals {
  tokens: number;
  images: number;
  calls: number;
  /** Chat operations — what the daily allowance counts. */
  messages: number;
}

export interface UsageByUser extends UsageTotals {
  /** Null for calls made before the column existed; they cannot be attributed. */
  userId: string | null;
}

export interface UsageBreakdown {
  total: UsageTotals;
  byUser: UsageByUser[];
  since: string;
}

export interface UsageLogParams {
  tenantId: string;
  /** Reporting only. Quota windows stay tenant-wide — see the schema comment. */
  userId?: string;
  operation: 'chat' | 'script' | 'suggestion' | 'image_gen';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  imageCount?: number;
}

export interface UsageData {
  // Each carries its own period: sessions reset daily, the other two monthly,
  // and a single `period` for all three described only the majority.
  tokens: { used: number; limit: number; period: string };
  images: { used: number; limit: number; period: string };
  sessions: { used: number; limit: number; period: string };
  /** @deprecated Read the period off each resource. */
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
    resourceType: 'llm_tokens' | 'fal_images' | 'chat_sessions',
  ): Promise<QuotaCheckResult> {
    if (!this.enabled) return { allowed: true };

    const quotas = await this.getPlanQuotas(tenantId);
    const quota = quotas.find((q) => q.resourceType === resourceType);

    if (!quota) return { allowed: true };
    if (quota.period === 'unlimited') return { allowed: true, limit: quota.limit };

    const sum = await this.countUsage(tenantId, resourceType, quota.period);

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
        userId: params.userId ?? null,
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
        tokens: { used: 0, limit: 0, period: 'month' },
        images: { used: 0, limit: 0, period: 'month' },
        sessions: { used: 0, limit: 0, period: 'day' },
        period: 'month',
      };
    }

    const quotas = await this.getPlanQuotas(tenantId);
    const quotaFor = (resourceType: string) => quotas.find((q) => q.resourceType === resourceType);

    const tokensQuota = quotaFor('llm_tokens');
    const imagesQuota = quotaFor('fal_images');
    const sessionsQuota = quotaFor('chat_sessions');

    const [tokenCount, imageCount, sessionCount] = await Promise.all([
      this.countUsage(tenantId, 'llm_tokens', tokensQuota?.period ?? 'month'),
      this.countUsage(tenantId, 'fal_images', imagesQuota?.period ?? 'month'),
      // Counted rather than left at zero. The meter reported 0 of 30 forever,
      // which reads as "you have used nothing" right up to the cap.
      this.countUsage(tenantId, 'chat_sessions', sessionsQuota?.period ?? 'day'),
    ]);

    return {
      tokens: {
        used: tokenCount,
        limit: tokensQuota?.limit ?? 0,
        period: tokensQuota?.period ?? 'month',
      },
      images: {
        used: imageCount,
        limit: imagesQuota?.limit ?? 0,
        period: imagesQuota?.period ?? 'month',
      },
      sessions: {
        used: sessionCount,
        limit: sessionsQuota?.limit ?? 0,
        period: sessionsQuota?.period ?? 'day',
      },
      period: 'month',
    };
  }


  /**
   * Consumption for a reporting window: the tenant's totals, and the same
   * broken down by member.
   *
   * Rows written before `user_id` existed carry null, and they are reported
   * under their own entry rather than spread over the members or dropped: the
   * totals have to keep adding up, and a member who joined last week should not
   * inherit a year of somebody else's calls.
   */
  async getBreakdown(tenantId: string, since: Date): Promise<UsageBreakdown> {
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['userId', 'operation'],
      where: { tenantId, createdAt: { gte: since } },
      _sum: { promptTokens: true, completionTokens: true, imageCount: true },
      _count: { _all: true },
    });

    const byUser = new Map<string | null, UsageByUser>();
    const total: UsageTotals = { tokens: 0, images: 0, calls: 0, messages: 0 };

    for (const row of rows) {
      const tokens = (row._sum.promptTokens ?? 0) + (row._sum.completionTokens ?? 0);
      const images = row._sum.imageCount ?? 0;
      const calls = row._count._all;
      const messages = row.operation === 'chat' ? calls : 0;

      total.tokens += tokens;
      total.images += images;
      total.calls += calls;
      total.messages += messages;

      const key = row.userId;
      const entry = byUser.get(key) ?? {
        userId: key,
        tokens: 0,
        images: 0,
        calls: 0,
        messages: 0,
      };
      entry.tokens += tokens;
      entry.images += images;
      entry.calls += calls;
      entry.messages += messages;
      byUser.set(key, entry);
    }

    return {
      total,
      // Heaviest first: a breakdown is read to find who is spending, and
      // scanning a list for the big number is work the sort can do.
      byUser: Array.from(byUser.values()).sort((a, b) => b.tokens - a.tokens),
      since: since.toISOString(),
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- interface contract is () => Promise<void>; callers await it
  async purgeCache(planId?: string): Promise<void> {
    if (!this.enabled) return;

    if (planId) {
      this.cache.delete(planId);
    } else {
      this.cache.clear();
    }
  }


  /**
   * What a resource has consumed in its period.
   *
   * `chat_sessions` counts rows, not tokens. The branch used to be binary —
   * fal_images against everything else — so a session limit was compared
   * against a token sum, and 30 "sessions" were spent by the first message.
   * Nothing called it that way yet, which is the only reason it never showed.
   *
   * What is countable is chat operations, i.e. messages: AiUsageLog carries no
   * session id, so the resource's name promises a grouping the data cannot make.
   */
  private async countUsage(
    tenantId: string,
    resourceType: 'llm_tokens' | 'fal_images' | 'chat_sessions',
    period: string,
  ): Promise<number> {
    const createdAt = { gte: this.periodStart(period) };

    if (resourceType === 'chat_sessions') {
      return this.prisma.aiUsageLog.count({
        where: { tenantId, operation: 'chat', createdAt },
      });
    }

    if (resourceType === 'fal_images') {
      const images = await this.prisma.aiUsageLog.aggregate({
        _sum: { imageCount: true },
        where: { tenantId, operation: 'image_gen', createdAt },
      });
      return images._sum.imageCount ?? 0;
    }

    const tokens = await this.prisma.aiUsageLog.aggregate({
      _sum: { promptTokens: true, completionTokens: true },
      where: { tenantId, operation: { in: ['chat', 'script', 'suggestion'] }, createdAt },
    });
    return (tokens._sum.promptTokens ?? 0) + (tokens._sum.completionTokens ?? 0);
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
