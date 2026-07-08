import type { Repositories } from '../lib/create-repositories.js';
import type {
  ContentSuggestion,
  SuggestionBatch,
  SuggestionStatus,
} from '../repositories/suggestion.repository.js';
import type { SuggestionCategory } from '../repositories/suggestion.repository.js';
import type { DeepSeekClient } from '../lib/deepseek-client.js';
import type { UsageTracker } from './usage-tracker.service.js';
import { InternalError, QuotaExceededError } from '../errors.js';

// ─── Service ─────────────────────────────────────────────────────────────────

export class SuggestionService {
  constructor(
    private readonly repos: Repositories,
    private readonly deepseekClient?: DeepSeekClient,
    private readonly usageTracker?: UsageTracker,
  ) {}

  async getSuggestions(tenantId: string, status?: SuggestionStatus): Promise<ContentSuggestion[]> {
    return this.repos.suggestion.findByTenant(tenantId, status);
  }

  async createSuggestion(
    tenantId: string,
    category: SuggestionCategory,
    content: string,
    batchId?: string,
  ): Promise<ContentSuggestion> {
    return this.repos.suggestion.create({
      tenantId,
      category,
      content,
      ...(batchId !== undefined ? { batchId } : {}),
    });
  }

  async createBatch(tenantId: string, userMessage: string): Promise<SuggestionBatch> {
    return this.repos.suggestion.createBatch({ tenantId, userMessage });
  }

  async listBatches(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<{ batches: SuggestionBatch[]; total: number }> {
    return this.repos.suggestion.findBatchesByTenant(tenantId, page, limit);
  }

  async markUsed(tenantId: string, id: string, linkedMediaId?: string): Promise<void> {
    await this.repos.suggestion.update(tenantId, id, {
      status: 'used' as SuggestionStatus,
      ...(linkedMediaId !== undefined ? { linkedMediaId } : {}),
      linkedAt: new Date(),
    });
  }

  async dismiss(tenantId: string, id: string): Promise<void> {
    await this.repos.suggestion.update(tenantId, id, {
      status: 'dismissed' as SuggestionStatus,
    });
  }

  async generateContentIdea(tenantId: string, prompt: string): Promise<ContentSuggestion> {
    // ── Pre-call quota enforcement ──
    if (this.usageTracker) {
      const check = await this.usageTracker.checkQuota(tenantId, 'deepseek_tokens');
      if (!check.allowed) {
        throw new QuotaExceededError('deepseek_tokens', check.limit!, check.resetsAt!);
      }
    }

    if (!this.deepseekClient) throw new InternalError('AI client not configured');

    const response = await this.deepseekClient.chat({
      messages: [
        {
          role: 'system',
          content:
            'Sos un estratega de contenido para Instagram. Generá exactamente 1 idea de contenido concreta y original basada en el pedido del usuario. La idea debe ser específica, práctica y lista para convertirse en un post o carrusel. Respondé SOLO con el texto de la idea (máximo 200 caracteres), sin prefijos, sin numeración, sin comillas, sin explicaciones adicionales.',
        },
        { role: 'user', content: prompt },
      ],
      model: 'deepseek-v4-flash',
    });

    // ── Post-call logging ──
    if (this.usageTracker) {
      await this.usageTracker.log({
        tenantId,
        operation: 'suggestion',
        model: 'deepseek-v4-flash',
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      });
    }

    const content = response.content.trim();
    if (!content) throw new InternalError('AI returned empty response');

    const batch = await this.createBatch(tenantId, prompt);
    return this.createSuggestion(tenantId, 'content_idea', content, batch.id);
  }

  async measureOutcomes(): Promise<void> {
    const eligible = await this.repos.suggestion.findEligibleForMeasurement();

    for (const suggestion of eligible) {
      try {
        await this.measureSingleSuggestion(suggestion);
      } catch (error) {
        console.error('[measureOutcomes] Error measuring suggestion', suggestion.id, error);
      }
    }
  }

  private async measureSingleSuggestion(suggestion: ContentSuggestion): Promise<void> {
    const { tenantId, id, linkedMediaId } = suggestion;

    // Try to get account and dashboard data for baseline
    let outcome: 'exceeded' | 'met' | 'below' = 'met';
    let sampleCount = 0;
    let medianEngagementRate = 0;
    let actualEngagementRate = 0;
    let format = 'unknown';

    try {
      const account = await this.repos.instagram.findAccountByTenantId(tenantId);
      if (!account) {
        // No baseline data — default to met
        await this.repos.suggestion.update(tenantId, id, {
          outcome: 'met' as any,
          baselineJson: { format, period: '90d', sampleCount: 0, medianEngagementRate: 0 },
          metricsJson: { engagementRate: 0 },
          measuredAt: new Date(),
        });
        return;
      }

      const dashboardData = await this.repos.instagram.getDashboardData(account.id);

      // Find the linked media in ranking
      const linkedMedia = dashboardData.ranking?.find(
        (r: { igMediaId: string }) => r.igMediaId === linkedMediaId,
      );

      if (linkedMedia) {
        format = linkedMedia.mediaType ?? 'unknown';
        // DashboardData ranking: saves, shares, totalEngagement (no reach field)
        const saves = linkedMedia.saves;
        const shares = linkedMedia.shares;
        const total = linkedMedia.totalEngagement;
        // Use saves+shares ratio vs totalEngagement as engagement rate proxy
        actualEngagementRate = total > 0 ? (saves + shares) / total : 0;
      }

      // Compute rolling median from format breakdown
      // FormatBreakdown: format, postCount, avgSaves, avgShares, avgLikes, avgComments
      const formatBreakdown = dashboardData.formatBreakdown ?? [];
      const formatStats = formatBreakdown.find((f) => f.format === format);

      if (formatStats) {
        sampleCount = formatStats.postCount;
        const avgSaves = formatStats.avgSaves;
        const avgShares = formatStats.avgShares;
        const avgTotal = avgSaves + avgShares + (formatStats.avgLikes) + (formatStats.avgComments);
        // Engagement rate proxy: saves+shares / totalEngagement average
        medianEngagementRate = avgTotal > 0 ? (avgSaves + avgShares) / avgTotal : 0;
      }

      // Verdict: exceeded > 1.15×, below < 0.85×, met otherwise
      if (medianEngagementRate === 0) {
        outcome = 'met';
      } else if (actualEngagementRate > medianEngagementRate * 1.15) {
        outcome = 'exceeded';
      } else if (actualEngagementRate < medianEngagementRate * 0.85) {
        outcome = 'below';
      } else {
        outcome = 'met';
      }
    } catch {
      // If any sub-query fails, use default values (no rethrow)
    }

    await this.repos.suggestion.update(tenantId, id, {
      outcome: outcome as any,
      baselineJson: { format, period: '90d', sampleCount, medianEngagementRate },
      metricsJson: { engagementRate: actualEngagementRate },
      measuredAt: new Date(),
    });
  }
}
