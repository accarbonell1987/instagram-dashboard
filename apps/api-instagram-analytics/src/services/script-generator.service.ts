import type { DeepSeekClient } from '../lib/deepseek-client.js';
import type { GeneratedSlide, SlideRole } from '../domain/carousel.js';
import type { UsageTracker } from './usage-tracker.service.js';
import { QuotaExceededError } from '../errors.js';

const SYSTEM_PROMPT = `You are a professional Instagram carousel scriptwriter for Spanish-speaking audiences.
Given a topic, generate a carousel script as a JSON array of slides.

STRICT RULES:
- Return ONLY a valid JSON array, no markdown, no explanation, no extra text.
- Between 4 and 7 slides.
- Each slide has EXACTLY these fields: { "order": number (1-based), "role": "hook"|"development"|"cta", "text": string, "visualPrompt": string }
- First slide role MUST be "hook". Last slide role MUST be "cta". All middle slides: "development".

FIELD RULES:
- text: ALWAYS in Spanish. NEVER in any other language. Max 150 characters. Concise, punchy, direct.
- visualPrompt: ALWAYS in English (required by the image AI model). Max 300 characters.
  Describe ONLY the visual scene/background: objects, layout, colors, mood, and design style that reinforce the slide's message.
  Do NOT add text or typography instructions — the slide text is injected into the image automatically by the system.
  The scene MUST be specific to what the slide content says — never generic imagery.

VISUAL PROMPT EXAMPLES (notice how each scene is specific to the slide content, no typography instructions):
- For "El 80% de las compras empieza con una imagen": "Large '80%' statistic centered on clean white background, surrounded by floating product photos and shopping cart icon. Minimalist flat design, electric blue accent, soft shadows"
- For "Publica 5 veces por semana en horario pico": "Weekly content calendar grid with exactly 5 days highlighted, clock icon showing 6-9pm. Pastel flat design, soft warm colors, clean planner aesthetic"
- For "Responde comentarios en la primera hora": "Smartphone screen showing comment bubbles with fast reply checkmarks, 60-minute hourglass timer beside it. Warm orange tones, friendly rounded illustration"
- For "Descarga nuestra guía gratuita": "Hand holding phone with glowing download button, checklist partially visible on screen. Warm lifestyle photography style, soft natural light"

FULL EXAMPLE OUTPUT for topic "Cómo hacer crecer tu cuenta de Instagram":
[{"order":1,"role":"hook","text":"¿Quieres 10 veces más seguidores en 30 días?","visualPrompt":"Instagram follower counter rapidly multiplying, upward trajectory arrow, numbers soaring. Dark background, neon green accent, high contrast digital aesthetic"},{"order":2,"role":"development","text":"Publica al menos 5 veces por semana en horario pico","visualPrompt":"Weekly calendar with 5 highlighted posting slots, golden hour clock at 6pm. Clean flat design, pastel blues and whites"},{"order":3,"role":"development","text":"Usa los primeros 3 segundos para capturar la atención","visualPrompt":"Video timeline bar with first 3 seconds highlighted, spotlight eye icon focusing on opening frame. Dark studio background, orange accent"},{"order":4,"role":"cta","text":"Empieza hoy: descarga nuestra guía gratuita","visualPrompt":"Open hands holding smartphone, download progress bar completing, guide booklet floating above. Warm golden hour lighting, clean white and gold tones"}]`;

const VALID_ROLES = new Set<string>(['hook', 'development', 'cta', 'default']);

function normalizeRole(value: unknown): SlideRole {
  if (typeof value === 'string' && VALID_ROLES.has(value)) {
    return value as SlideRole;
  }
  return 'default';
}

export class ScriptGeneratorService {
  constructor(
    private readonly deepseek: DeepSeekClient,
    private readonly usageTracker?: UsageTracker,
  ) {}

  async generateScript(
    topic: string,
    basePromptContext?: string,
    tenantId?: string,
  ): Promise<GeneratedSlide[]> {
    // ── Pre-call quota enforcement (preview-script flow only) ──
    if (tenantId && this.usageTracker) {
      const check = await this.usageTracker.checkQuota(tenantId, 'deepseek_tokens');
      if (!check.allowed) {
        throw new QuotaExceededError('deepseek_tokens', check.limit!, check.resetsAt!);
      }
    }

    const userMessage = basePromptContext
      ? `Topic: ${topic}\nStyle context: ${basePromptContext}`
      : `Topic: ${topic}`;

    const response = await this.deepseek.chat({
      model: 'deepseek-v4-pro',
      reasoningEffort: 'none',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    // ── Post-call logging (preview-script flow only) ──
    if (tenantId && this.usageTracker) {
      await this.usageTracker.log({
        tenantId,
        operation: 'script',
        model: 'deepseek-v4-pro',
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      });
    }

    const content = response.content.trim();
    const jsonText = extractJson(content);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`ScriptGenerator: invalid JSON from DeepSeek: ${jsonText.slice(0, 200)}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error('ScriptGenerator: expected JSON array from DeepSeek');
    }

    const slides: GeneratedSlide[] = parsed.map((item, index) => {
      const s = item as Record<string, unknown>;
      return {
        order: typeof s['order'] === 'number' ? s['order'] : index + 1,
        role: normalizeRole(s['role']),
        text: typeof s['text'] === 'string' ? s['text'].slice(0, 150) : '',
        visualPrompt: typeof s['visualPrompt'] === 'string' ? s['visualPrompt'].slice(0, 300) : '',
      };
    });

    if (slides.length === 0) {
      throw new Error('ScriptGenerator: DeepSeek returned empty slide array');
    }

    return slides;
  }
}

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  // Find first '[' to last ']'
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
}
