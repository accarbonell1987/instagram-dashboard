/**
 * Unit tests for ScriptGeneratorService — UsageTracker enforcement wiring
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { QuotaExceededError } from '../errors.js';
import type { LlmResolver } from './llm-resolver.service.js';

import { ScriptGeneratorService } from './script-generator.service.js';
import type { UsageTracker } from './usage-tracker.service.js';

const OWNER = { tenantId: 'tenant-1', userId: 'user-1' };

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDeepSeekChat = vi.fn();
const mockDeepseekClient = { chat: mockDeepSeekChat };

function createMockUsageTracker(overrides: Partial<UsageTracker> = {}): UsageTracker {
  return {
    checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
    log: vi.fn().mockResolvedValue(undefined),
    getUsage: vi.fn(),
    purgeCache: vi.fn(),
    ...overrides,
  } as unknown as UsageTracker;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeScriptResponse(content: string) {
  return {
    // The provider reports what actually answered; the usage log records it.
    model: 'deepseek-v4-flash',
    content,
    usage: { promptTokens: 150, completionTokens: 300 },
    finishReason: 'stop' as const,
    toolCalls: [],
  };
}

const validScriptJson = JSON.stringify([
  {
    order: 1,
    role: 'hook',
    text: '¿Querés más seguidores?',
    visualPrompt: 'Instagram follower counter rapidly multiplying, neon green accent',
  },
  {
    order: 2,
    role: 'development',
    text: 'Publicá 5 veces por semana',
    visualPrompt: 'Weekly calendar with highlighted posting slots',
  },
  {
    order: 3,
    role: 'cta',
    text: 'Empezá hoy',
    visualPrompt: 'Open hands holding smartphone with download button',
  },
]);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ScriptGeneratorService (UsageTracker enforcement)', () => {
  let service: ScriptGeneratorService;
  let mockTracker: UsageTracker;

  describe('constructor', () => {
    it('accepts UsageTracker as optional 2nd param', () => {
      const tracker = createMockUsageTracker();
      const svc = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver), tracker);
      expect(svc).toBeInstanceOf(ScriptGeneratorService);
    });

    it('works without UsageTracker (backward compat)', () => {
      const svc = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver));
      expect(svc).toBeInstanceOf(ScriptGeneratorService);
    });
  });

  describe('generateScript() with tenantId (preview-script flow)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver), mockTracker);
    });

    it('calls checkQuota before DeepSeek when tenantId is provided', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Cómo crecer en Instagram', OWNER);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.checkQuota).toHaveBeenCalledBefore(mockDeepSeekChat);
    });

    it('throws QuotaExceededError when checkQuota returns allowed=false', async () => {
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        limit: 100000,
        resetsAt: '2026-07-01T00:00:00.000Z',
      });

      await expect(
        service.generateScript('Cómo crecer en Instagram', OWNER),
      ).rejects.toThrow(QuotaExceededError);

      // DeepSeek should NOT be called when quota is exceeded
      expect(mockDeepSeekChat).not.toHaveBeenCalled();
    });

    it('calls log after successful DeepSeek call with promptTokens and completionTokens', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Tema de prueba', OWNER, 'Contexto base');

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        operation: 'script',
        model: 'deepseek-v4-flash',
        promptTokens: 150,
        completionTokens: 300,
      });
    });

    it('does NOT call log when DeepSeek call fails', async () => {
      mockDeepSeekChat.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.generateScript('Tema inválido', OWNER),
      ).rejects.toThrow('API error');

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.log).not.toHaveBeenCalled();
    });
  });

  describe('generateScript() without tenantId (carousel flow)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver), mockTracker);
    });

    /**
     * There is no unmeasured path any more. Generating a script used to be
     * possible without a tenant — the carousel flow passed none — and that call
     * consumed tokens nobody counted. The owner is now required, so every
     * generation is attributed.
     */
    it('enforces the quota on every generation, including the carousel flow', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Tema sin tenant', OWNER);

      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
      // eslint-disable-next-line @typescript-eslint/unbound-method -- asserting on a mock reference, not calling it
      expect(mockTracker.log).toHaveBeenCalled();
    });

    it('still generates script normally without tenantId', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      const result = await service.generateScript('Tema sin tenant', OWNER);

      expect(result).toHaveLength(3);
      expect(result[0]?.text).toBe('¿Querés más seguidores?');
    });
  });

  describe('generateScript() with usageTracker undefined', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      service = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver));
    });

    it('generates script normally without usageTracker and tenantId', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      const result = await service.generateScript('Tema sin tracker', OWNER);

      expect(result).toHaveLength(3);
      // No errors — tracker absence is silently tolerated
    });
  });

  describe('quota check on non-deepseek_tokens resource', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(({ resolve: async () => mockDeepseekClient } as unknown as LlmResolver), mockTracker);
    });

    it('passes deepseek_tokens as resourceType to checkQuota', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('topic', OWNER);

      const callArgs = (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs?.[1]).toBe('deepseek_tokens');
    });
  });
});
