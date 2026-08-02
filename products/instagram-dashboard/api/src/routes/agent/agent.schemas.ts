import { z } from 'zod';

export const AgentConfigSchema = z.object({
  niche: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(100)).min(0).max(30),
  customPrompt: z.string().max(2000).optional(),
});

export const ImageGenConfigSchema = z.object({
  basePrompt: z.string().max(1000).optional(),
  hookPrompt: z.string().max(1000).optional(),
  developmentPrompt: z.string().max(1000).optional(),
  ctaPrompt: z.string().max(1000).optional(),
  t2iModel: z.string().max(100).optional(),
  i2iModel: z.string().max(100).optional(),
});

export const AgentLimitsSchema = z.object({
  slideText: z.number().int().min(50).max(500).optional(),
  visualPrompt: z.number().int().min(50).max(1000).optional(),
});

export const SaveAgentSettingsBodySchema = z.object({
  niche: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(100)).min(0).max(30),
  customPrompt: z.string().max(2000).optional(),
  imageGen: ImageGenConfigSchema.optional(),
  limits: AgentLimitsSchema.optional(),
  falApiKey: z.string().min(1).optional(),
});

export const QuotaEntrySchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int(),
  period: z.enum(['month', 'day', 'unlimited']),
  resetsAt: z.string(),
});

export const UsageResponseDataSchema = z.object({
  quotas: z.object({
    deepseek_tokens: QuotaEntrySchema,
    fal_images: QuotaEntrySchema,
  }),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export const UsageResponseSchema = z.object({
  success: z.literal(true),
  data: UsageResponseDataSchema,
});

export type ImageGenConfig = z.infer<typeof ImageGenConfigSchema>;
export type SaveAgentSettingsBody = z.infer<typeof SaveAgentSettingsBodySchema>;
export type UsageResponse = z.infer<typeof UsageResponseSchema>;
