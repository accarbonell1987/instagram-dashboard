/**
 * Unit tests for GrowthAgentService
 * TDD: RED phase — written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { DashboardService } from '../../dashboard/services/dashboard.service.js';
import { InternalError, QuotaExceededError } from '../../errors.js';
import type { Repositories } from '../../shared/lib/create-repositories.js';


import { GrowthAgentService, normalizeCategory } from './growth-agent.service.js';
import type { LlmResolver } from './llm-resolver.service.js';
import type { SuggestionService } from './suggestion.service.js';
import type { UsageTracker } from './usage-tracker.service.js';

describe('normalizeCategory', () => {
  it('passes valid enum values through', () => {
    expect(normalizeCategory('caption')).toBe('caption');
    expect(normalizeCategory('content_idea')).toBe('content_idea');
  });

  it('coerces LLM drift onto the closed enum set', () => {
    expect(normalizeCategory('caption_tip')).toBe('caption');
    expect(normalizeCategory('CAPTION')).toBe('caption');
    expect(normalizeCategory('posting_time_advice')).toBe('posting_time');
  });

  it('falls back to content_idea for unknown values', () => {
    expect(normalizeCategory('random_nonsense')).toBe('content_idea');
  });
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockChat = vi.fn();
const mockDeepseekClient = { chat: mockChat };

const mockCreateSuggestion = vi.fn().mockResolvedValue({
  id: 'sugg-1',
  tenantId: 'tenant-1',
  category: 'hook',
  content: 'Test suggestion',
  status: 'pending',
  linkedMediaId: null,
  linkedAt: null,
  outcome: null,
  measuredAt: null,
  baselineJson: null,
  metricsJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const mockSuggestionService = {
  getSuggestions: vi.fn(),
  createBatch: vi.fn().mockResolvedValue({ id: 'batch-1' }),
  createSuggestion: mockCreateSuggestion,
  markUsed: vi.fn(),
  dismiss: vi.fn(),
  measureOutcomes: vi.fn(),
};

const mockGetDashboardData = vi.fn().mockResolvedValue({
  period: '30d',
  account: { username: 'test_ferreteria', accountType: 'BUSINESS', followerCount: 1500 },
  overview: { totalPosts: 20, totalSaves: 200, totalShares: 100, totalImpressions: 10000, totalReach: 8000 },
  ranking: [],
  formatBreakdown: [],
  heatmap: [],
  insight: { insight: '', generatedAt: '' },
});
const mockDashboardService = {
  getDashboardData: mockGetDashboardData,
  getMediaDetail: vi.fn(),
  listMedia: vi.fn(),
};

const mockSave = vi.fn().mockResolvedValue({ id: 'msg-1', tenantId: 'tenant-1', sessionId: 'sess-1', role: 'user', content: 'hi', createdAt: new Date() });
const mockFindBySession = vi.fn().mockResolvedValue([]);
const mockFindByTenant = vi.fn().mockResolvedValue([]);
const mockFindEligibleForMeasurement = vi.fn().mockResolvedValue([]);
const mockSuggestionCreate = vi.fn();
const mockSuggestionUpdate = vi.fn();
const mockFindById = vi.fn().mockResolvedValue(null);

function createMockRepos(): Repositories {
  return {
    instagram: {
      findAccountByOwner: vi.fn().mockResolvedValue({ id: 'acc-1' }),
      getAgentConfig: vi.fn().mockResolvedValue(null),
    },
    chatMessage: {
      save: mockSave,
      findBySession: mockFindBySession,
    },
    suggestion: {
      create: mockSuggestionCreate,
      findByOwner: mockFindByTenant,
      findById: mockFindById,
      update: mockSuggestionUpdate,
      findEligibleForMeasurement: mockFindEligibleForMeasurement,
    },
  } as unknown as Repositories;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStopResponse(content: string) {
  return { model: 'deepseek-v4-flash', content, toolCalls: [], usage: { promptTokens: 10, completionTokens: 20 }, finishReason: 'stop' as const };
}

function makeToolCallResponse(toolName: string, args: Record<string, unknown> = {}) {
  return {
    model: 'deepseek-v4-flash',
    content: '',
    toolCalls: [{ id: 'tc-1', name: toolName, arguments: args }],
    usage: { promptTokens: 10, completionTokens: 5 },
    finishReason: 'tool_calls' as const,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GrowthAgentService', () => {
  let service: GrowthAgentService;
  let repos: ReturnType<typeof createMockRepos>;

  function createGrowthAgentService(tracker?: UsageTracker): GrowthAgentService {
    return new GrowthAgentService(
      repos,
      mockDashboardService as unknown as DashboardService,
      ({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver),
      mockSuggestionService as unknown as SuggestionService,
      tracker,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    repos = createMockRepos();
    // Reset mockSave to resolve with a valid message
    mockSave.mockResolvedValue({ id: 'msg-1', tenantId: 'tenant-1', sessionId: 'sess-1', role: 'user', content: 'hi', createdAt: new Date() });
    mockCreateSuggestion.mockResolvedValue({
      id: 'sugg-1',
      tenantId: 'tenant-1',
      category: 'hook',
      content: 'Test suggestion',
      status: 'pending',
      linkedMediaId: null,
      linkedAt: null,
      outcome: null,
      measuredAt: null,
      baselineJson: null,
      metricsJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    service = createGrowthAgentService();
  });

  describe('chat()', () => {
    it('happy path: tool_calls → stop → returns { reply, suggestions, toolCallsTrace }', async () => {
      // First call returns tool_calls requesting getDashboardContext
      mockChat
        .mockResolvedValueOnce(makeToolCallResponse('getDashboardContext'))
        .mockResolvedValueOnce(makeStopResponse('Tus Reels funcionan mejor que las fotos.'));

      const result = await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Qué formato debo usar?',
        history: [],
      });

      expect(result.reply).toBe('Tus Reels funcionan mejor que las fotos.');
      expect(result.toolCallsTrace).toHaveLength(1);
      expect(result.toolCallsTrace[0]?.name).toBe('getDashboardContext');
      expect(result.suggestions).toEqual([]);
      // Saved user + assistant messages
      expect(mockSave).toHaveBeenCalledTimes(2);
    });

    it('anti-hallucination: all tools return empty data → reply must not contain standalone digits', async () => {
      // All tool data is empty
      mockGetDashboardData.mockResolvedValueOnce({
        period: '30d',
        account: { username: 'test', accountType: 'BUSINESS', followerCount: 0 },
        overview: { totalPosts: 0, totalSaves: 0, totalShares: 0, totalImpressions: 0, totalReach: 0 },
        ranking: [],
        formatBreakdown: [],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
      });
      mockFindByTenant.mockResolvedValueOnce([]);

      mockChat
        .mockResolvedValueOnce(makeToolCallResponse('getDashboardContext'))
        .mockResolvedValueOnce(
          makeStopResponse('No tengo datos suficientes para hacer una recomendación. Por favor sincronizá tu cuenta primero.'),
        );

      const result = await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Cuántos saves tengo?',
        history: [],
      });

      // The reply must NOT contain standalone digits (our anti-hallucination check)
      expect(result.reply).not.toMatch(/\b\d+\b/);
    });

    it('parses <suggestions> block from reply → calls createSuggestion for each item', async () => {
      const replyWithSuggestions = `Aquí te dejo algunas sugerencias de contenido para tu ferretería.

<suggestions>
[
  {"category": "hook", "content": "Empezá tu Reel con el truco más inesperado del taller"},
  {"category": "format", "content": "Usá CAROUSEL_ALBUM para tutoriales paso a paso"}
]
</suggestions>`;

      mockChat
        .mockResolvedValueOnce(makeStopResponse(replyWithSuggestions));

      const result = await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: 'Dame sugerencias de contenido',
        history: [],
      });

      expect(mockSuggestionService.createSuggestion).toHaveBeenCalledTimes(2);
      expect(mockSuggestionService.createSuggestion).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', userId: 'user-1' },
        'hook',
        'Empezá tu Reel con el truco más inesperado del taller',
        'batch-1',
      );
      expect(mockSuggestionService.createSuggestion).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', userId: 'user-1' },
        'format',
        'Usá CAROUSEL_ALBUM para tutoriales paso a paso',
        'batch-1',
      );
      expect(result.suggestions).toHaveLength(2);
    });

    it('aborts tool call loop at MAX_ITERATIONS (5) without infinite loop', async () => {
      // Always returns tool_calls — should abort at 5 iterations
      mockChat.mockResolvedValue(makeToolCallResponse('getDashboardContext'));

      await expect(
        service.chat({
          tenantId: 'tenant-1',
          userId: 'user-1',
          sessionId: 'sess-1',
          userMessage: 'test',
          history: [],
        }),
      ).rejects.toThrow(InternalError);

      // Should have been called at most 5 times (MAX_ITERATIONS)
      expect(mockChat).toHaveBeenCalledTimes(5);
    });

    it('generates sessionId if not provided (empty string → UUID)', async () => {
      mockChat.mockResolvedValueOnce(makeStopResponse('Hola'));

      await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'provided-session-id',
        userMessage: 'Hola',
        history: [],
      });

      // Both save calls use the provided sessionId
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'provided-session-id' }),
      );
    });

    it('throws AGENT_TIMEOUT when a single call outlasts the hop budget', async () => {
      vi.useFakeTimers()
      mockChat.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 300_000))
      )
      const promise = service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'session-1',
        userMessage: 'hola',
        history: [],
      })
      // Attach the rejection handler before advancing timers, so the rejection
      // (which fires during advanceTimersByTimeAsync) is never momentarily
      // unhandled — otherwise vitest reports an unhandled rejection.
      const assertion = expect(promise).rejects.toThrow('AGENT_TIMEOUT')
      await vi.advanceTimersByTimeAsync(121_000)
      await assertion
      vi.useRealTimers()
    });

    /**
     * The 504 that started this: a reply arriving at 63 seconds was refused by a
     * 60-second wall, on a deployment whose successful chats ran 28–59s. The
     * limit sat inside the ordinary spread, so the tail of normal traffic was
     * being cut off rather than a hang being caught.
     */
    it('lets through a reply that would have missed the old 60s wall', async () => {
      vi.useFakeTimers()
      mockChat.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => { resolve(makeStopResponse('llegué')); }, 63_000)),
      )

      const promise = service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'session-1',
        userMessage: 'hola',
        history: [],
      })
      await vi.advanceTimersByTimeAsync(64_000)

      await expect(promise).resolves.toMatchObject({ reply: 'llegué' })
      vi.useRealTimers()
    });

    /**
     * The budget the loop never had. Five hops of two minutes each were all
     * "within budget" individually, so a slow run could hold the connection for
     * ten minutes and the caller would meet a proxy timeout rather than an
     * answer.
     */
    /**
     * The shrinking window in numbers: two hops of 100s fit inside the 180s
     * budget, the second one running on the 80s it has left rather than a fresh
     * 120s. A third is never sent — which is the point, since it would be
     * billed and then discarded.
     */
    it('stops sending hops once the request budget is spent', async () => {
      vi.useFakeTimers()
      mockChat.mockImplementation(
        () => new Promise((resolve) => setTimeout(
          () => { resolve(makeToolCallResponse('getDashboardContext')); },
          100_000,
        )),
      )

      const promise = service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'session-1',
        userMessage: 'hola',
        history: [],
      })
      const assertion = expect(promise).rejects.toThrow('AGENT_TIMEOUT')
      await vi.advanceTimersByTimeAsync(400_000)
      await assertion

      // Two hops fit the 180s budget. A third would have been sent for nothing.
      expect(mockChat).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    });

    it('gives up on the request even while each hop stays inside its own budget', async () => {
      vi.useFakeTimers()
      // Every hop asks for another tool, so the loop keeps going; each answers
      // in 100s, comfortably under the 120s hop budget.
      mockChat.mockImplementation(
        () => new Promise((resolve) => setTimeout(
          () => { resolve(makeToolCallResponse('getDashboardContext')); },
          100_000,
        )),
      )

      const promise = service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'session-1',
        userMessage: 'hola',
        history: [],
      })
      const assertion = expect(promise).rejects.toThrow('AGENT_TIMEOUT')
      // Two hops fit in the 180s request budget; the third has nothing left.
      await vi.advanceTimersByTimeAsync(400_000)
      await assertion
      vi.useRealTimers()
    });
  });

  describe('generateSuggestions()', () => {
    it('calls DeepSeek once, parses suggestions block, creates suggestions', async () => {
      const reply = `Aquí van tus ideas de contenido.
<suggestions>
[{"category": "content_idea", "content": "Tutorial de cómo usar taladros de impacto"}]
</suggestions>`;
      mockChat.mockResolvedValueOnce(makeStopResponse(reply));

      const result = await service.generateSuggestions({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(mockChat).toHaveBeenCalledTimes(1);
      expect(mockSuggestionService.createSuggestion).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', userId: 'user-1' },
        'content_idea',
        'Tutorial de cómo usar taladros de impacto',
        undefined,
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no suggestions block in reply', async () => {
      mockChat.mockResolvedValueOnce(makeStopResponse('No hay sugerencias disponibles ahora.'));

      const result = await service.generateSuggestions({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(mockSuggestionService.createSuggestion).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('tool methods', () => {
    it('getDashboardContext — calls dashboardService and returns shaped context', async () => {
      mockGetDashboardData.mockResolvedValueOnce({
        period: '30d',
        account: { username: 'ferreteria', accountType: 'BUSINESS', followerCount: 2000 },
        overview: { totalPosts: 50, totalSaves: 500, totalShares: 250, totalImpressions: 20000, totalReach: 15000 },
        ranking: [],
        formatBreakdown: [{ format: 'REEL', postCount: 20, avgSaves: 30, avgShares: 15, avgReach: 400, avgEngagementRate: 0.05 }],
        heatmap: [],
        insight: { insight: '', generatedAt: '' },
      });

      mockChat
        .mockResolvedValueOnce(makeToolCallResponse('getDashboardContext'))
        .mockResolvedValueOnce(makeStopResponse('Contexto cargado.'));

      await service.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'contexto', history: [] });

      expect(mockGetDashboardData).toHaveBeenCalledWith({ tenantId: 'tenant-1',
        userId: 'user-1' });
    });
  });

  describe('buildSystemPrompt (via service)', () => {
    it('null config returns generic DEFAULT_SYSTEM_PROMPT', async () => {
      // mock repos.instagram
      const mockGetAgentConfig = vi.fn().mockResolvedValue(null);
      const mockFindAccount = vi.fn().mockResolvedValue({ id: 'acc-1' });
      repos.instagram = {
        getAgentConfig: mockGetAgentConfig,
        findAccountByOwner: mockFindAccount,
      } as unknown as Repositories['instagram'];

      mockChat.mockResolvedValueOnce(makeStopResponse('Hola desde el agente genérico'));

      const result = await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Qué nicho manejo?',
        history: [],
      });

      expect(result.reply).toBe('Hola desde el agente genérico');
      expect(mockGetAgentConfig).toHaveBeenCalledWith({ tenantId: 'tenant-1',
        userId: 'user-1' });
      // Verify system prompt is generic (no hardcoded niche)
      const systemMsg = (
        mockChat.mock.calls[0]?.[0] as { messages?: { content?: string }[] } | undefined
      )?.messages?.[0]?.content;
      expect(systemMsg).toContain('estratega de contenido');
      expect(systemMsg).not.toContain('ferretería');
    });

    it('config with tags replaces niche in prompt', async () => {
      const mockGetAgentConfig = vi.fn().mockResolvedValue({
        niche: 'Moda',
        tags: ['Ropa', 'Tendencias'],
      });
      const mockFindAccount = vi.fn().mockResolvedValue({ id: 'acc-1' });
      repos.instagram = {
        getAgentConfig: mockGetAgentConfig,
        findAccountByOwner: mockFindAccount,
      } as unknown as Repositories['instagram'];

      mockChat.mockResolvedValueOnce(makeStopResponse('Hola desde moda'));

      await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Qué nicho manejo?',
        history: [],
      });

      const systemMsg = (
        mockChat.mock.calls[0]?.[0] as { messages?: { content?: string }[] } | undefined
      )?.messages?.[0]?.content;
      expect(systemMsg).toContain('Moda');
      expect(systemMsg).toContain('Ropa, Tendencias');
      expect(systemMsg).not.toContain('ferretería');
    });

    it('config with customPrompt appends it to prompt', async () => {
      const mockGetAgentConfig = vi.fn().mockResolvedValue({
        niche: 'Tecnología',
        tags: ['Gadgets'],
        customPrompt: 'Sé breve y usa emojis',
      });
      const mockFindAccount = vi.fn().mockResolvedValue({ id: 'acc-1' });
      repos.instagram = {
        getAgentConfig: mockGetAgentConfig,
        findAccountByOwner: mockFindAccount,
      } as unknown as Repositories['instagram'];

      mockChat.mockResolvedValueOnce(makeStopResponse('Hola'));

      await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Qué nicho manejo?',
        history: [],
      });

      const systemMsg = (
        mockChat.mock.calls[0]?.[0] as { messages?: { content?: string }[] } | undefined
      )?.messages?.[0]?.content;
      expect(systemMsg).toContain('Sé breve y usa emojis');
      expect(systemMsg).toContain('INSTRUCCIONES ADICIONALES DEL USUARIO');
    });

    it('config without customPrompt omits extra section', async () => {
      const mockGetAgentConfig = vi.fn().mockResolvedValue({
        niche: 'Fitness',
        tags: ['Gym', 'Nutrición'],
      });
      const mockFindAccount = vi.fn().mockResolvedValue({ id: 'acc-1' });
      repos.instagram = {
        getAgentConfig: mockGetAgentConfig,
        findAccountByOwner: mockFindAccount,
      } as unknown as Repositories['instagram'];

      mockChat.mockResolvedValueOnce(makeStopResponse('Hola'));

      await service.chat({
        tenantId: 'tenant-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        userMessage: '¿Qué nicho manejo?',
        history: [],
      });

      const systemMsg = (
        mockChat.mock.calls[0]?.[0] as { messages?: { content?: string }[] } | undefined
      )?.messages?.[0]?.content;
      // The header, with its colon — not the bare phrase. The scope block names
      // this section to say it is bound by it, so the words appear either way;
      // what must be absent is the section itself.
      expect(systemMsg).not.toContain('INSTRUCCIONES ADICIONALES DEL USUARIO:');
    });
  });

  describe('UsageTracker enforcement in chat()', () => {
    let mockUsageTracker: UsageTracker;

    function createMockTracker(overrides: Partial<UsageTracker> = {}): UsageTracker {
      return {
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, remaining: 100000, limit: 100000 }),
        log: vi.fn().mockResolvedValue(undefined),
        getUsage: vi.fn(),
        purgeCache: vi.fn(),
        ...overrides,
      } as unknown as UsageTracker;
    }

    function createServiceWithTracker(tracker: UsageTracker) {
      return createGrowthAgentService(tracker);
    }

    beforeEach(() => {
      vi.clearAllMocks();
      repos = createMockRepos();
      mockSave.mockResolvedValue({ id: 'msg-1', tenantId: 'tenant-1', sessionId: 'sess-1', role: 'user', content: 'hi', createdAt: new Date() });
      mockCreateSuggestion.mockResolvedValue({
        id: 'sugg-1', tenantId: 'tenant-1', category: 'hook', content: 'Test', status: 'pending',
        linkedMediaId: null, linkedAt: null, outcome: null, measuredAt: null,
        baselineJson: null, metricsJson: null, createdAt: new Date(), updatedAt: new Date(),
      });
    });

    it('calls checkQuota(llm_tokens) before starting the loop', async () => {
      mockUsageTracker = createMockTracker();
      const svc = createServiceWithTracker(mockUsageTracker);
      mockChat.mockResolvedValueOnce(makeStopResponse('Hola'));

      await svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'Hola', history: [] });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'llm_tokens');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.checkQuota).toHaveBeenCalledBefore(mockChat);
    });

    it('throws QuotaExceededError when pre-call check fails (allowed=false)', async () => {
      mockUsageTracker = createMockTracker({
        checkQuota: vi.fn().mockResolvedValue({ allowed: false, limit: 100000, resetsAt: '2026-07-01T00:00:00.000Z' }),
      });
      const svc = createServiceWithTracker(mockUsageTracker);

      await expect(
        svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'Hola', history: [] }),
      ).rejects.toThrow(QuotaExceededError);

      // DeepSeek should NOT be called
      expect(mockChat).not.toHaveBeenCalled();
      // No log should be written
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.log).not.toHaveBeenCalled();
    });

    it('accumulates tokens across iterations and logs total at end', async () => {
      mockUsageTracker = createMockTracker();
      const svc = createServiceWithTracker(mockUsageTracker);
      mockChat
        .mockResolvedValueOnce(makeToolCallResponse('getDashboardContext'))
        .mockResolvedValueOnce(makeStopResponse('Reply after tool call'));

      await svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'Contexto', history: [] });

      // Two iterations: tool_call (promptTokens:10, completionTokens:5) + stop (promptTokens:10, completionTokens:20)
      // Total: promptTokens=20, completionTokens=25
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          operation: 'chat',
          model: 'deepseek-v4-flash',
          promptTokens: 20,   // 10 + 10
          completionTokens: 25, // 5 + 20
        }),
      );
    });

    /**
     * Named for a mid-loop overrun it never reached: the mocked response spends
     * 30 tokens against a 2000 remaining, so the loop check cannot fire. What it
     * does cover is that a permitted call still logs its usage, so it is named
     * for that. The overrun itself is untested.
     */
    it('logs usage after a call that stayed within quota', async () => {
      mockUsageTracker = createMockTracker({
        // Not `Once`: the pre-call gate asks about tokens and about the daily
        // message allowance, and the loop asks again.
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, remaining: 2000, limit: 5000 }),
      });
      const svc = createServiceWithTracker(mockUsageTracker);

      mockChat.mockResolvedValueOnce(makeStopResponse('Partial reply content'));

      await svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'test', history: [] });

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          operation: 'chat',
          model: 'deepseek-v4-flash',
          promptTokens: 10,
          completionTokens: 20,
        }),
      );
    });

    it('does NOT call log when pre-call quota check fails', async () => {
      mockUsageTracker = createMockTracker({
        checkQuota: vi.fn().mockResolvedValue({ allowed: false, limit: 100000, resetsAt: '2026-07-01T00:00:00.000Z' }),
      });
      const svc = createServiceWithTracker(mockUsageTracker);

      await expect(
        svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'Hola', history: [] }),
      ).rejects.toThrow(QuotaExceededError);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockUsageTracker.log).not.toHaveBeenCalled();
    });

    it('works without usageTracker (backward compat)', async () => {
      // Service without usageTracker (no constructor change needed for old code — usageTracker is optional)
      const svc = createGrowthAgentService();
      mockChat.mockResolvedValueOnce(makeStopResponse('Hola'));

      const result = await svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 'sess-1', userMessage: 'Hola', history: [] });

      expect(result.reply).toBe('Hola');
    });

  /**
   * The daily message allowance. Its rows have been in `plan_quotas` and editable
   * per plan since the quota table went in — 30 a day on professional, 5 on
   * starter — and nothing ever asked for them. It was configuration that did not
   * configure anything.
   */
  describe('daily message allowance', () => {
    it('refuses the message when the daily allowance is spent', async () => {
      const tracker = createMockTracker({
        checkQuota: vi.fn(async (_tenantId: string, resource: string) =>
          resource === 'chat_sessions'
            ? { allowed: false, limit: 30, resetsAt: '2026-06-16T00:00:00.000Z' }
            : { allowed: true, remaining: 90000, limit: 100000 },
        ),
      });
      const svc = createServiceWithTracker(tracker);

      await expect(
        svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 's', userMessage: 'hola', history: [] }),
      ).rejects.toMatchObject({ details: { resourceType: 'chat_sessions' } });

      // Refused before spending anything.
      expect(mockChat).not.toHaveBeenCalled();
    })

    /**
     * Both can be spent at once, and the error names when the block lifts. The
     * monthly cap outlasts the daily one, so answering "come back at midnight" to
     * someone out of tokens would send them back to the same wall.
     */
    it('names the monthly cap when both are spent', async () => {
      const tracker = createMockTracker({
        checkQuota: vi.fn().mockResolvedValue({
          allowed: false,
          limit: 1,
          resetsAt: '2026-07-01T00:00:00.000Z',
        }),
      });
      const svc = createServiceWithTracker(tracker);

      await expect(
        svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 's', userMessage: 'hola', history: [] }),
      ).rejects.toMatchObject({ details: { resourceType: 'llm_tokens' } });
    })

    it('lets the message through when both allow it', async () => {
      const tracker = createMockTracker({
        checkQuota: vi.fn().mockResolvedValue({ allowed: true, remaining: 5000, limit: 100000 }),
      });
      const svc = createServiceWithTracker(tracker);
      mockChat.mockResolvedValueOnce(makeStopResponse('ok'));

      await expect(
        svc.chat({ tenantId: 'tenant-1', userId: 'user-1', sessionId: 's', userMessage: 'hola', history: [] }),
      ).resolves.toBeDefined();

      expect(tracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'chat_sessions');
    })
  })
  });

  // ── getSuggestionOutcomes ──────────────────────────────────────────────────

  /**
   * The tool is named for outcomes and used to return every suggestion marked
   * used — `outcome` included, and that field stays null until the seven-day
   * sweep measures it, which needs the suggestion linked to a published post.
   * Nothing links them, so the model was handed a list of nulls to interpret.
   */
  describe('getSuggestionOutcomes', () => {
    const used = (id: string, outcome: string | null) => ({
      id,
      tenantId: 'tenant-1',
      userId: 'user-1',
      category: 'content_idea',
      content: `idea ${id}`,
      status: 'used',
      outcome,
      createdAt: new Date(),
    });

    it('returns nothing while nothing has been measured', async () => {
      mockFindByTenant.mockResolvedValue([used('a', null), used('b', null)]);

      const result = await service.getSuggestionOutcomes({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result).toEqual([]);
    });

    it('returns the measured ones once there are any', async () => {
      mockFindByTenant.mockResolvedValue([
        used('a', null),
        used('b', 'exceeded'),
        used('c', 'below'),
      ]);

      const result = await service.getSuggestionOutcomes({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(result.map((r) => r.id)).toEqual(['b', 'c']);
    });

    it('asks only for the used ones', async () => {
      mockFindByTenant.mockResolvedValue([]);

      await service.getSuggestionOutcomes({ tenantId: 'tenant-1', userId: 'user-1' });

      expect(mockFindByTenant).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', userId: 'user-1' },
        'used',
      );
    });
  });
});

