import { z } from 'zod';

/**
 * Zod schema for the plan create/edit form.
 * Extracted from the backoffice plans page for reuse and testability.
 */
export const planFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'El precio debe ser mayor o igual a 0'),
  currency: z.string().min(1, 'La moneda es obligatoria'),
  billingInterval: z.enum(['month', 'year'], {
    errorMap: () => ({ message: 'El ciclo debe ser mensual o anual' }),
  }),
  // Quota fields (all optional for backward compat)
  deepseekTokensLimit: z.number().int().min(0).optional(),
  falImagesLimit: z.number().int().min(0).optional(),
  chatSessionsLimit: z.number().int().min(0).optional(),
});

export type PlanFormData = z.infer<typeof planFormSchema>;
