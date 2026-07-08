import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the openai module before importing the client ────────────────────────
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Import AFTER mock is set up
const { DeepSeekClient } = await import('./deepseek-client.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompletionResponse(overrides: {
  content?: string | undefined;
  finishReason?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  promptTokens?: number;
  completionTokens?: number;
}) {
  return {
    choices: [
      {
        message: {
          content: overrides.content ?? null,
          tool_calls: overrides.toolCalls ?? null,
        },
        finish_reason: overrides.finishReason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: overrides.promptTokens ?? 10,
      completion_tokens: overrides.completionTokens ?? 20,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DeepSeekClient', () => {
  let client: InstanceType<typeof DeepSeekClient>;

  beforeEach(() => {
    mockCreate.mockReset();
    client = new DeepSeekClient();
  });

  describe('chat()', () => {
    it('Test 1 — maps content correctly when finishReason is stop', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletionResponse({
          content: 'Tu mejor formato es REEL.',
          finishReason: 'stop',
          promptTokens: 15,
          completionTokens: 8,
        }),
      );

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Qué formato funciona mejor?' }],
      });

      expect(result.content).toBe('Tu mejor formato es REEL.');
      expect(result.finishReason).toBe('stop');
      expect(result.toolCalls).toEqual([]);
      expect(result.usage.promptTokens).toBe(15);
      expect(result.usage.completionTokens).toBe(8);
    });

    it('Test 2 — maps toolCalls array correctly when finishReason is tool_calls', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletionResponse({
          content: undefined,
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'call_abc123',
              type: 'function',
              function: {
                name: 'getDashboardContext',
                arguments: '{}',
              },
            },
            {
              id: 'call_def456',
              type: 'function',
              function: {
                name: 'getTopPosts',
                arguments: '{"by":"saves_shares","n":5}',
              },
            },
          ],
        }),
      );

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Analiza mi cuenta' }],
      });

      expect(result.finishReason).toBe('tool_calls');
      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]).toEqual({
        id: 'call_abc123',
        name: 'getDashboardContext',
        arguments: {},
      });
      expect(result.toolCalls[1]).toEqual({
        id: 'call_def456',
        name: 'getTopPosts',
        arguments: { by: 'saves_shares', n: 5 },
      });
      expect(result.content).toBe('');
    });

    it('Test 3 — throws error when DeepSeek returns no choices', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 0 },
      });

      await expect(
        client.chat({ messages: [{ role: 'user', content: 'test' }] }),
      ).rejects.toThrow('DeepSeek returned no choices');
    });

    it('Test 4 — DEEPSEEK_API_KEY never appears in the response object', async () => {
      mockCreate.mockResolvedValueOnce(
        makeCompletionResponse({
          content: 'Response content here',
          finishReason: 'stop',
        }),
      );

      const result = await client.chat({
        messages: [{ role: 'user', content: 'hello' }],
      });

      // Serialize the whole response to string and check no API key appears
      const responseString = JSON.stringify(result);
      // The test api key set in vitest.setup.ts is 'test_deepseek_api_key'
      expect(responseString).not.toContain('test_deepseek_api_key');
      // Also check it doesn't contain any common API key patterns
      expect(responseString).not.toMatch(/api.*key/i);
    });
  });
});
