import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions.js';
import { config } from '../config.js';

export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface DeepSeekResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export class DeepSeekClient {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.DEEPSEEK_API_KEY,
      baseURL: config.DEEPSEEK_BASE_URL,
    });
  }

  async chat(params: {
    messages: ChatCompletionMessageParam[];
    tools?: ChatCompletionTool[];
    model?: DeepSeekModel;
    reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'max';
  }): Promise<DeepSeekResponse> {
    const model = params.model ?? config.DEEPSEEK_MODEL;
    // DeepSeek-specific: control thinking mode via reasoning_effort.
    // Defaults to 'none' (non-thinking) for faster interactive responses.
    const reasoningEffort = params.reasoningEffort ?? 'none';
    const response = await this.client.chat.completions.create(
      {
        model,
        messages: params.messages,
        ...(params.tools !== undefined && { tools: params.tools }),
      },
      // extra_body merges into the request body — passes DeepSeek-specific fields through
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { extra_body: { reasoning_effort: reasoningEffort } } as any,
    );
    const choice = response.choices[0];
    if (!choice) throw new Error('DeepSeek returned no choices');
    return {
      content: choice.message.content ?? '',
      toolCalls: (choice.message.tool_calls ?? []).map((tc) => {
        // Use type assertion to access function property (OpenAI SDK union type)
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
      finishReason: (choice.finish_reason ?? 'stop') as DeepSeekResponse['finishReason'],
    };
  }
}
