import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions.js';

/**
 * One code path for every model.
 *
 * This was a DeepSeek client, but it was always the OpenAI SDK pointed at a
 * different base URL — so it already spoke to anything that implements the
 * OpenAI chat-completions protocol. Naming it after one vendor hid that, and
 * the credentials being read from the environment at startup made it a single
 * global model for every tenant.
 *
 * Anthropic and Google are reachable through OpenRouter rather than natively:
 * their own protocols differ enough to need a second implementation of tool
 * calling and response parsing, and one path that covers everything beats two
 * that each cover half.
 */

export interface LlmProviderPreset {
  label: string;
  baseUrl: string;
  /**
   * `reasoning_effort` rides in the request body and is DeepSeek's own; OpenAI
   * and Groq reject an unknown field outright. Sending it everywhere is how a
   * provider switch turns into a 400 nobody expected.
   */
  supportsReasoningEffort: boolean;
}

/**
 * Known providers. `custom` exists because the list is a convenience, not a
 * gate — anything OpenAI-compatible works with its own base URL, including a
 * model running on the customer's own hardware.
 */
export const LLM_PROVIDERS = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    supportsReasoningEffort: true,
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    supportsReasoningEffort: false,
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    supportsReasoningEffort: false,
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsReasoningEffort: false,
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    supportsReasoningEffort: false,
  },
  custom: {
    label: 'Otro (compatible con OpenAI)',
    baseUrl: '',
    supportsReasoningEffort: false,
  },
} as const satisfies Record<string, LlmProviderPreset>;

export type LlmProvider = keyof typeof LLM_PROVIDERS;

export function isLlmProvider(value: string): value is LlmProvider {
  return value in LLM_PROVIDERS;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  /**
   * What actually answered, as the provider reports it. Usage logs record this
   * rather than what was requested: an alias like `gpt-4o` resolves to a dated
   * build, and the bill is written against the build.
   */
  model: string;
  content: string;
  toolCalls: ToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface LlmClientOptions {
  apiKey: string;
  baseUrl: string;
  /** The model every call uses unless one overrides it. */
  model: string;
  supportsReasoningEffort?: boolean;
}

export class LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly supportsReasoningEffort: boolean;

  constructor(options: LlmClientOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseUrl });
    this.model = options.model;
    this.supportsReasoningEffort = options.supportsReasoningEffort ?? false;
  }

  async chat(params: {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    /** Overrides the configured model for one call. Rarely needed. */
    model?: string;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'max';
  }): Promise<LlmResponse> {
    const response = await this.client.chat.completions.create(
      {
        model: params.model ?? this.model,
        messages: params.messages,
        ...(params.tools !== undefined && { tools: params.tools }),
      },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.supportsReasoningEffort
        ? // extra_body merges into the request body — how provider-specific
          // fields get through the OpenAI SDK.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ({ extra_body: { reasoning_effort: params.reasoningEffort ?? 'none' } } as any)
        : undefined,
    );

    const choice = response.choices[0];
    if (!choice) throw new Error('The model returned no choices');

    return {
      model: response.model,
      content: choice.message.content ?? '',
      toolCalls: (choice.message.tool_calls ?? []).map((tc) => {
        // Type assertion to reach `function` through the SDK's union type.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCall = tc as any as { id: string; function: { name: string; arguments: string } };
        return {
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments) as Record<string, unknown>,
        };
      }),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
      finishReason: choice.finish_reason as LlmResponse['finishReason'],
    };
  }
}
