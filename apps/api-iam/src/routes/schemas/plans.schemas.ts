import { z } from '@hono/zod-openapi';

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']),
  features: z.array(z.string()),
  popular: z.boolean(),
});

export const ListPlansResponseSchema = z.object({
  plans: z.array(PlanSchema),
});

export const GetPlanResponseSchema = PlanSchema;
