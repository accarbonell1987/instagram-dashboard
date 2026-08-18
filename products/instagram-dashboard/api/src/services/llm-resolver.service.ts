import { config } from '../config.js';
import type { Owner } from '../domain/owner.js';
import { decryptToken } from '../lib/crypto.js';
import { LLM_PROVIDERS, LlmClient, isLlmProvider } from '../lib/llm-client.js';
import type { InstagramRepository } from '../repositories/instagram/index.js';

/** What an account stored about which model to talk to. */
export interface LlmConfig {
  provider?: string;
  /** Only meaningful for the `custom` provider; presets carry their own. */
  baseUrl?: string;
  model?: string;
}

/**
 * Builds the LLM client for one account, per call.
 *
 * The client used to be constructed once at startup from environment
 * variables, which made the model a property of the deployment rather than of
 * the customer. Images already worked the other way — the fal.ai key is stored
 * per account and passed per call — so this brings text in line with its
 * neighbour rather than inventing a second pattern.
 *
 * An account with nothing configured falls back to the environment. Without
 * that fallback every existing tenant loses the agent the moment this ships.
 */
export class LlmResolver {
  constructor(private readonly instagramRepo: InstagramRepository) {}

  async resolve(owner: Owner): Promise<LlmClient> {
    const [agentConfig, encryptedKey] = await Promise.all([
      this.instagramRepo.getAgentConfig(owner),
      this.instagramRepo.getLlmApiKeyEncrypted(owner),
    ]);

    const llm = (agentConfig as { llm?: LlmConfig } | null)?.llm;
    const providerKey = llm?.provider ?? '';
    const preset = isLlmProvider(providerKey) ? LLM_PROVIDERS[providerKey] : null;

    // A key without the rest is still worth honouring: the customer typed it,
    // and the defaults it lands on are the ones the deployment already uses.
    const apiKey = encryptedKey !== null ? decryptToken(encryptedKey) : config.DEEPSEEK_API_KEY;

    const baseUrl =
      preset && preset.baseUrl !== '' ? preset.baseUrl : (llm?.baseUrl ?? config.DEEPSEEK_BASE_URL);

    return new LlmClient({
      apiKey,
      baseUrl,
      model: llm?.model ?? config.DEEPSEEK_MODEL,
      // Unknown provider, unknown dialect: send nothing vendor-specific. The
      // default deployment is DeepSeek, so its preset restores the flag.
      supportsReasoningEffort: preset?.supportsReasoningEffort ?? false,
    });
  }
}
