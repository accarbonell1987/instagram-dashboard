import type {
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions.js';

import {
  buildSystemPrompt,
  buildSuggestionPrompt,
} from '../config/prompts.js';
import type {
  DashboardContext,
  PostSummary,
  FormatStats,
  HeatmapData,
  SuggestionOutcomeResult,
  ToolCall,
} from '../domain/growth-agent.js';
import type { Owner } from '../domain/owner.js';
import { InternalError, QuotaExceededError } from '../errors.js';
import type { Repositories } from '../lib/create-repositories.js';
import { TOOL_DEFINITIONS } from '../lib/tool-definitions.js';
import type { ContentSuggestion } from '../repositories/suggestion.repository.js';

import type { DashboardService } from './dashboard.service.js';
import type { LlmResolver } from './llm-resolver.service.js';
import type { SuggestionService } from './suggestion.service.js';
import type { UsageTracker } from './usage-tracker.service.js';




// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, errorCode: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new InternalError(errorCode)); }, ms);
  });
  // Clear the timer once the race settles so the loser never rejects an
  // orphaned promise (which would surface as an unhandled rejection).
  return Promise.race([promise, timeout]).finally(() => { clearTimeout(timer); });
}


// ─── Time budgets ─────────────────────────────────────────────────────────────
//
// One hop used to allow 60s, and nothing bounded the request. The observed
// spread of successful chats on this deployment is 28–59s, so the wall stood
// where ordinary traffic passes: a reply that took 63s was refused after having
// very nearly arrived, while a run of five slow hops could hold the connection
// for five minutes and still be "within budget".
//
// So: a hop gets room above the real tail, and the request as a whole gets a
// ceiling. Whichever runs out first ends it, and the caller waits a bounded
// time either way.
const HOP_TIMEOUT_MS = 120_000;
const REQUEST_BUDGET_MS = 180_000;

/** What is left of the request's budget, never below zero. */
function remainingBudget(startedAt: number): number {
  return Math.max(0, REQUEST_BUDGET_MS - (Date.now() - startedAt));
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// Imported from ../config/prompts.ts — DEFAULT_SYSTEM_PROMPT, buildSystemPrompt, buildSuggestionPrompt

const MAX_ITERATIONS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['caption', 'format', 'posting_time', 'hook', 'hashtags', 'content_idea'] as const;
type SuggestionCategory = (typeof VALID_CATEGORIES)[number];

// LLM output is a trust boundary: it drifts to invalid enum values (e.g. "caption_tip").
// Coerce onto the known set — prefix match catches the common drift, else fall back to content_idea.
export function normalizeCategory(raw: string): SuggestionCategory {
  const value = raw.trim().toLowerCase();
  return VALID_CATEGORIES.find((valid) => value === valid || value.startsWith(valid)) ?? 'content_idea';
}

interface ParsedSuggestion {
  category: SuggestionCategory;
  content: string;
}

interface ChatParams {
  tenantId: string;
  userId: string;
  sessionId: string;
  userMessage: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}

interface ChatResult {
  reply: string;
  suggestions: ContentSuggestion[];
  toolCallsTrace: ToolCall[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GrowthAgentService {
  constructor(
    private readonly repos: Repositories,
    private readonly dashboardService: DashboardService,
    private readonly llm: LlmResolver,
    private readonly suggestionService: SuggestionService,
    private readonly usageTracker?: UsageTracker,
  ) {}

  async chat(params: ChatParams): Promise<ChatResult> {
    const { tenantId, userId, sessionId, userMessage, history } = params;
    const owner = { tenantId, userId };

    // ── Pre-call quota enforcement ──
    //
    // Tokens first, deliberately. Both can be spent at once, and the error the
    // caller sees names when it lifts: the monthly cap outlasts the daily one,
    // so leading with sessions would answer "come back at midnight" to someone
    // for whom midnight changes nothing.
    //
    // chat_sessions is the daily message allowance. The rows have existed and
    // been ajustable per plan since the quota table went in, and nothing ever
    // asked for them — the limit was configuration that did not limit.
    if (this.usageTracker) {
      for (const resource of ['llm_tokens', 'chat_sessions'] as const) {
        const check = await this.usageTracker.checkQuota(owner.tenantId, resource);
        if (!check.allowed) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- when allowed is false, checkQuota always sets limit + resetsAt
          throw new QuotaExceededError(resource, check.limit!, check.resetsAt!);
        }
      }
    }

    // Read agent config to build dynamic system prompt
    const account = await this.repos.instagram.findAccountByOwner(owner);
    const agentConfig = account
      ? await this.repos.instagram.getAgentConfig(owner)
      : null;
    const systemPrompt = buildSystemPrompt(agentConfig);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage },
    ];

    const toolCallsTrace: ToolCall[] = [];
    let iterations = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const startedAt = Date.now();

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Resolved inside the budget: it reads the account and decrypts a key,
      // and a hang there was previously untimed.
      // Shrinks as the request spends itself, so the last hop cannot outlive
      // the budget. No zero-check: a hop that exhausts the budget rejects from
      // its own shortened window and leaves the loop, so the top is never
      // reached with nothing left.
      const hopBudget = Math.min(HOP_TIMEOUT_MS, remainingBudget(startedAt));

      const response = await withTimeout(
        this.llm.resolve(owner).then((client) =>
          client.chat({ messages, tools: TOOL_DEFINITIONS }),
        ),
        hopBudget,
        'AGENT_TIMEOUT',
      );

      // ── Accumulate tokens per iteration ──
      totalPromptTokens += response.usage.promptTokens;
      totalCompletionTokens += response.usage.completionTokens;

      if (response.finishReason === 'stop') {
        // ── Loop-end quota check ──
        if (this.usageTracker) {
          const loopCheck = await this.usageTracker.checkQuota(owner.tenantId, 'llm_tokens');
          const totalUsed = totalPromptTokens + totalCompletionTokens;

          if (loopCheck.remaining !== undefined && totalUsed > (loopCheck.remaining ?? 0)) {
            // Mid-loop exceed: return partial result
            const cleanedReply = response.content
              .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '')
              .trim();

            // Save messages even for partial result
            await this.repos.chatMessage.save({
              tenantId, userId, sessionId, role: 'user' as const, content: userMessage,
            });
            await this.repos.chatMessage.save({
              tenantId, userId, sessionId, role: 'assistant' as const, content: cleanedReply,
            });

            // Log accumulated usage
            await this.usageTracker.log({
              tenantId: owner.tenantId,
              userId: owner.userId,
              operation: 'chat',
              model: response.model,
              promptTokens: totalPromptTokens,
              completionTokens: totalCompletionTokens,
            });

            return {
              reply: cleanedReply,
              suggestions: [],
              toolCallsTrace,
              quotaExceeded: true,
              tokensUsed: totalUsed,
              partialReply: cleanedReply,
            } as ChatResult & { quotaExceeded: boolean; tokensUsed: number; partialReply: string };
          }
        }

        // Normal success path
        const batch = await this.suggestionService.createBatch(owner, userMessage);
        const suggestions = await this.parseSuggestionsBlock(owner, response.content, batch.id);

        const cleanedReply = response.content
          .replace(/<suggestions>[\s\S]*?<\/suggestions>/g, '')
          .trim();

        await this.repos.chatMessage.save({
          tenantId, userId, sessionId, role: 'user' as const, content: userMessage,
        });
        await this.repos.chatMessage.save({
          tenantId, userId, sessionId, role: 'assistant' as const, content: cleanedReply,
        });

        // ── Post-call logging ──
        if (this.usageTracker) {
          await this.usageTracker.log({
            tenantId: owner.tenantId,
            userId: owner.userId,
            operation: 'chat',
            model: response.model,
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
          });
        }

        return { reply: cleanedReply, suggestions, toolCallsTrace };
      }

      // Handle tool calls
      if (response.finishReason === 'tool_calls' && response.toolCalls.length > 0) {
        // Append assistant message with tool_calls
        messages.push({
          role: 'assistant',
          content: response.content,
           
          tool_calls: response.toolCalls.map((tc): ChatCompletionMessageFunctionToolCall => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });

        // Dispatch each tool call
        for (const tc of response.toolCalls) {
          const result = await this.dispatchTool(owner, tc.name, tc.arguments);
          toolCallsTrace.push({ name: tc.name, arguments: tc.arguments, result });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }
    }

    // If we exhausted iterations, throw
    throw new InternalError('AGENT_TIMEOUT');
  }

  async generateSuggestions(owner: Owner): Promise<ContentSuggestion[]> {
    const agentConfig = owner.userId
      ? await this.repos.instagram.getAgentConfig(owner)
      : null;
    const systemPrompt = buildSystemPrompt(agentConfig);
    const suggestionPrompt = buildSuggestionPrompt(agentConfig);

    const response = await withTimeout(
      this.llm.resolve(owner).then((client) =>
        client.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: suggestionPrompt },
          ],
        }),
      ),
      HOP_TIMEOUT_MS,
      'AGENT_TIMEOUT',
    );

    return this.parseSuggestionsBlock(owner, response.content /* no batchId for scheduled generation */);
  }

  // ─── Tool dispatch ──────────────────────────────────────────────────────────

  private async dispatchTool(
    owner: Owner,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case 'getDashboardContext':
        return this.getDashboardContext(owner);
      case 'getTopPosts':
        return this.getTopPosts(
          owner,
          (args['by'] as 'saves_shares' | 'reach' | 'engagement_rate' | undefined) ?? 'saves_shares',
          typeof args['n'] === 'number' ? args['n'] : 5,
        );
      case 'getFormatBreakdown':
        return this.getFormatBreakdown(owner);
      case 'getPostingHeatmap':
        return this.getPostingHeatmap(owner);
      case 'getSuggestionOutcomes':
        return this.getSuggestionOutcomes(owner);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ─── Tool methods ───────────────────────────────────────────────────────────

  async getDashboardContext(owner: Owner): Promise<DashboardContext> {
    const data = await this.dashboardService.getDashboardData(owner);
    const topFormat = data.formatBreakdown.length > 0
      ? data.formatBreakdown.reduce((best, curr) =>
          (curr.avgSaves + curr.avgShares) > (best.avgSaves + best.avgShares) ? curr : best,
        ).format
      : 'unknown';

    return {
      followersCount: data.account.followerCount ?? 0,
      mediaCount: data.overview.totalPosts,
      recentPostCount: data.overview.totalPosts,
      avgEngagementRate:
        data.overview.totalReach > 0
          ? (data.overview.totalSaves + data.overview.totalShares) / data.overview.totalReach
          : 0,
      topFormat,
    };
  }

  async getTopPosts(
    owner: Owner,
    by: 'saves_shares' | 'reach' | 'engagement_rate',
    n: number,
  ): Promise<PostSummary[]> {
    const data = await this.dashboardService.getDashboardData(owner);
    const ranking = data.ranking;

    // Sort ranking by the requested metric (ranking type has saves, shares, totalEngagement)
    const sorted = [...ranking].sort((a, b) => {
      if (by === 'reach') return b.totalEngagement - a.totalEngagement;
      // engagement_rate and saves_shares both sort by saves + shares
      return (b.saves + b.shares) - (a.saves + a.shares);
    });

    return sorted.slice(0, n).map((r) => {
      const reach = r.totalEngagement;
      const engagementRate = reach > 0 ? (r.saves + r.shares) / reach : 0;
      return {
        mediaId: r.igMediaId,
        mediaType: r.mediaType,
        caption: r.caption ?? null,
        postedAt: r.postedAt,
        saves: r.saves,
        shares: r.shares,
        reach,
        engagementRate,
      };
    });
  }

  async getFormatBreakdown(owner: Owner): Promise<FormatStats[]> {
    const data = await this.dashboardService.getDashboardData(owner);
    // FormatBreakdown type: format, postCount, avgSaves, avgShares, avgLikes, avgComments
    return data.formatBreakdown.map((f) => ({
      format: f.format,
      avgEngagementRate: f.postCount > 0 ? (f.avgSaves + f.avgShares) / f.postCount : 0,
      avgReach: 0, // not available in FormatBreakdown type
      avgSaves: f.avgSaves,
      avgShares: f.avgShares,
      count: f.postCount,
    }));
  }

  async getPostingHeatmap(owner: Owner): Promise<HeatmapData[]> {
    const data = await this.dashboardService.getDashboardData(owner);
    // HeatmapCell has: day, slot, totalSavesShares, postCount
    return data.heatmap.map((h) => ({
      dayOfWeek: this.dayNameToNumber(h.day),
      hour: this.slotToHour(h.slot),
      avgSavesShares: h.postCount > 0 ? h.totalSavesShares / h.postCount : 0,
    }));
  }

  async getSuggestionOutcomes(owner: Owner): Promise<SuggestionOutcomeResult[]> {
    const suggestions = await this.repos.suggestion.findByOwner(owner, 'used');
    return suggestions.slice(0, 20).map((s) => ({
      id: s.id,
      category: s.category,
      content: s.content,
      outcome: s.outcome,
      createdAt: s.createdAt,
    }));
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async parseSuggestionsBlock(
    owner: Owner,
    content: string,
    batchId?: string,
  ): Promise<ContentSuggestion[]> {
    const match = /<suggestions>([\s\S]*?)<\/suggestions>/m.exec(content);
    if (!match) return [];

    let parsed: ParsedSuggestion[];
    try {
      parsed = JSON.parse(match[1]?.trim() ?? '[]') as ParsedSuggestion[];
    } catch {
      return [];
    }

    const created: ContentSuggestion[] = [];
    for (const item of parsed) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- parsed from untrusted JSON; fields may be absent at runtime despite the type
      if (item.category && item.content) {
        const suggestion = await this.suggestionService.createSuggestion(
          owner,
          normalizeCategory(item.category),
          item.content,
          batchId,
        );
        created.push(suggestion);
      }
    }

    return created;
  }

  private dayNameToNumber(day: string): number {
    const days: Record<string, number> = {
      domingo: 0, lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6,
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
    };
    return days[day.toLowerCase()] ?? 0;
  }

  private slotToHour(slot: string): number {
    const match = /(\d+)/.exec(slot);
    return match ? parseInt(match[1] ?? '0', 10) : 0;
  }
}
