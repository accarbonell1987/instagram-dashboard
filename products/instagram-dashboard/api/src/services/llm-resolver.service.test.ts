import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InstagramRepository } from '../repositories/instagram/index.js';

import { LlmResolver } from './llm-resolver.service.js';


vi.mock('../config.js', () => ({
  config: {
    DEEPSEEK_API_KEY: 'env-key',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_MODEL: 'deepseek-v4-flash',
  },
}));

vi.mock('../lib/crypto.js', () => ({
  decryptToken: (value: string) => `decrypted:${value}`,
}));

const OWNER = { tenantId: 'tenant-1', userId: 'user-1' };

function makeRepo(agentConfig: unknown, encryptedKey: string | null) {
  return {
    getAgentConfig: vi.fn().mockResolvedValue(agentConfig),
    getLlmApiKeyEncrypted: vi.fn().mockResolvedValue(encryptedKey),
  } as unknown as InstagramRepository;
}

/** Reads back what the client was actually built with. */
function built(client: unknown) {
  const c = client as { client: { apiKey: string; baseURL: string }; model: string; supportsReasoningEffort: boolean };
  return { apiKey: c.client.apiKey, baseUrl: c.client.baseURL, model: c.model, reasoning: c.supportsReasoningEffort };
}

describe('LlmResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Every tenant ran on the deployment's key and model before this was
   * configurable. Without this fallback they all lose the agent the moment it
   * ships.
   */
  it('falls back to the deployment when the account configured nothing', async () => {
    const client = await new LlmResolver(makeRepo(null, null)).resolve(OWNER);

    expect(built(client)).toEqual({
      apiKey: 'env-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      reasoning: false,
    });
  });

  it("uses the account's provider, model and key", async () => {
    const repo = makeRepo({ llm: { provider: 'openai', model: 'gpt-4o' } }, 'stored');
    const client = await new LlmResolver(repo).resolve(OWNER);

    expect(built(client)).toEqual({
      apiKey: 'decrypted:stored',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      reasoning: false,
    });
  });

  /**
   * `reasoning_effort` travels in the request body and belongs to DeepSeek.
   * OpenAI and Groq reject an unknown field, so a provider switch would turn
   * every call into a 400 if the flag were not tied to the provider.
   */
  it('only sends the DeepSeek-specific field to DeepSeek', async () => {
    const deepseek = await new LlmResolver(
      makeRepo({ llm: { provider: 'deepseek', model: 'deepseek-v4-pro' } }, 'k'),
    ).resolve(OWNER);
    const groq = await new LlmResolver(
      makeRepo({ llm: { provider: 'groq', model: 'llama-3.3-70b' } }, 'k'),
    ).resolve(OWNER);

    expect(built(deepseek).reasoning).toBe(true);
    expect(built(groq).reasoning).toBe(false);
  });

  // Claude and Gemini arrive this way rather than through their own protocols.
  it('routes OpenRouter models through the OpenRouter address', async () => {
    const repo = makeRepo(
      { llm: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4' } },
      'k',
    );
    const client = await new LlmResolver(repo).resolve(OWNER);

    expect(built(client).baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(built(client).model).toBe('anthropic/claude-sonnet-4');
  });

  /**
   * The preset list is a convenience, not a gate: a model on the customer's own
   * hardware is reachable by giving its address directly.
   */
  it('honours a custom address', async () => {
    const repo = makeRepo(
      { llm: { provider: 'custom', baseUrl: 'http://ollama.local:11434/v1', model: 'llama3' } },
      'k',
    );
    const client = await new LlmResolver(repo).resolve(OWNER);

    expect(built(client).baseUrl).toBe('http://ollama.local:11434/v1');
  });

  // A key on its own is still worth honouring — it lands on the defaults the
  // deployment already uses.
  it('takes the key even when nothing else was chosen', async () => {
    const client = await new LlmResolver(makeRepo(null, 'only-a-key')).resolve(OWNER);

    expect(built(client).apiKey).toBe('decrypted:only-a-key');
    expect(built(client).model).toBe('deepseek-v4-flash');
  });

  // An unknown name must not silently inherit another provider's dialect.
  it('sends nothing vendor-specific for an unrecognised provider', async () => {
    const repo = makeRepo({ llm: { provider: 'not-a-provider', model: 'x' } }, 'k');
    const client = await new LlmResolver(repo).resolve(OWNER);

    expect(built(client).reasoning).toBe(false);
    expect(built(client).baseUrl).toBe('https://api.deepseek.com');
  });
});
