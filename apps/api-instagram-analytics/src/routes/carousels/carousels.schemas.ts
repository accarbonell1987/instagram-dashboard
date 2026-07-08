import { z } from 'zod';

const SlideInputSchema = z.object({
  order: z.number().int().min(1),
  role: z.enum(['hook', 'development', 'cta', 'default']),
  text: z.string().min(1).max(150),
  visualPrompt: z.string().min(1).max(300),
});

export const CreateCarouselBodySchema = z.object({
  topic: z.string().min(1).max(2000),
  suggestionId: z.string().uuid().optional(),
  // Optional pre-approved slides — when provided the script generation step is skipped
  slides: z.array(SlideInputSchema).min(1).max(10).optional(),
});

export const PreviewScriptBodySchema = z.object({
  topic: z.string().min(1).max(2000),
});

export const UpdateSlideBodySchema = z.object({
  text: z.string().min(1).max(150).optional(),
  visualPrompt: z.string().min(1).max(300).optional(),
});

export const ReorderSlidesBodySchema = z.object({
  order: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(1),
    }),
  ).min(1),
});

export const RegenerateCarouselBodySchema = z.object({
  topic: z.string().min(1).max(2000).optional(),
});

export const PublishCarouselBodySchema = z.object({
  caption: z.string().max(2200).optional(),
});

const UploadSlideInputSchema = z.object({
  order: z.number().int().min(1),
  role: z.enum(['hook', 'development', 'cta', 'default']),
  text: z.string().min(1).max(150),
  imageMode: z.enum(['uploaded', 'img2img']),
  visualPrompt: z.string().min(1).max(300).optional(),
});

export const CreateUploadCarouselBodySchema = z.object({
  topic: z.string().min(1).max(2000),
  caption: z.string().max(2200).optional(),
  slides: z.array(UploadSlideInputSchema).min(2).max(10),
});

export type CreateCarouselBody = z.infer<typeof CreateCarouselBodySchema>;
export type UpdateSlideBody = z.infer<typeof UpdateSlideBodySchema>;
export type ReorderSlidesBody = z.infer<typeof ReorderSlidesBodySchema>;
export type RegenerateCarouselBody = z.infer<typeof RegenerateCarouselBodySchema>;
export type PublishCarouselBody = z.infer<typeof PublishCarouselBodySchema>;
export type CreateUploadCarouselBody = z.infer<typeof CreateUploadCarouselBodySchema>;
