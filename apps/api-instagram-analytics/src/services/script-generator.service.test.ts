/**
 * Unit tests for ScriptGeneratorService — UsageTracker enforcement wiring
 * TDD: RED phase — tests written before implementation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptGeneratorService } from './script-generator.service.js';
import type { UsageTracker } from './usage-tracker.service.js';
import { QuotaExceededError } from '../errors.js';

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
      const svc = new ScriptGeneratorService(mockDeepseekClient as any, tracker);
      expect(svc).toBeInstanceOf(ScriptGeneratorService);
    });

    it('works without UsageTracker (backward compat)', () => {
      const svc = new ScriptGeneratorService(mockDeepseekClient as any);
      expect(svc).toBeInstanceOf(ScriptGeneratorService);
    });
  });

  describe('generateScript() with tenantId (preview-script flow)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(mockDeepseekClient as any, mockTracker);
    });

    it('calls checkQuota before DeepSeek when tenantId is provided', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Cómo crecer en Instagram', undefined, 'tenant-1');

      expect(mockTracker.checkQuota).toHaveBeenCalledWith('tenant-1', 'deepseek_tokens');
      expect(mockTracker.checkQuota).toHaveBeenCalledBefore(mockDeepSeekChat);
    });

    it('throws QuotaExceededError when checkQuota returns allowed=false', async () => {
      (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        limit: 100000,
        resetsAt: '2026-07-01T00:00:00.000Z',
      });

      await expect(
        service.generateScript('Cómo crecer en Instagram', undefined, 'tenant-1'),
      ).rejects.toThrow(QuotaExceededError);

      // DeepSeek should NOT be called when quota is exceeded
      expect(mockDeepSeekChat).not.toHaveBeenCalled();
    });

    it('calls log after successful DeepSeek call with promptTokens and completionTokens', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Tema de prueba', 'Contexto base', 'tenant-1');

      expect(mockTracker.log).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        operation: 'script',
        promptTokens: 150,
        completionTokens: 300,
        model: 'deepseek-v4-pro',
      });
    });

    it('does NOT call log when DeepSeek call fails', async () => {
      mockDeepSeekChat.mockRejectedValueOnce(new Error('API error'));

      await expect(
        service.generateScript('Tema inválido', undefined, 'tenant-1'),
      ).rejects.toThrow('API error');

      expect(mockTracker.log).not.toHaveBeenCalled();
    });
  });

  describe('generateScript() without tenantId (carousel flow)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(mockDeepseekClient as any, mockTracker);
    });

    it('does NOT call checkQuota when tenantId is NOT provided', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('Tema sin tenant');

      expect(mockTracker.checkQuota).not.toHaveBeenCalled();
      expect(mockTracker.log).not.toHaveBeenCalled();
    });

    it('still generates script normally without tenantId', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      const result = await service.generateScript('Tema sin tenant');

      expect(result).toHaveLength(3);
      expect(result[0]!.text).toBe('¿Querés más seguidores?');
    });
  });

  describe('generateScript() with usageTracker undefined', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      service = new ScriptGeneratorService(mockDeepseekClient as any);
    });

    it('generates script normally without usageTracker and tenantId', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      const result = await service.generateScript('Tema sin tracker', undefined, 'tenant-1');

      expect(result).toHaveLength(3);
      // No errors — tracker absence is silently tolerated
    });
  });

  describe('quota check on non-deepseek_tokens resource', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockTracker = createMockUsageTracker();
      service = new ScriptGeneratorService(mockDeepseekClient as any, mockTracker);
    });

    it('passes deepseek_tokens as resourceType to checkQuota', async () => {
      mockDeepSeekChat.mockResolvedValueOnce(makeScriptResponse(validScriptJson));

      await service.generateScript('topic', undefined, 'tenant-1');

      const callArgs = (mockTracker.checkQuota as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(callArgs[1]).toBe('deepseek_tokens');
    });
  });
});
