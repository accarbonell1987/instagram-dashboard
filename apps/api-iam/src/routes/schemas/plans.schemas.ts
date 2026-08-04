import { z } from '@hono/zod-openapi';

// Sub-modules are the "functionalities" of a module. Nesting is 1 level max
// (enforced at the application layer), so the shape is explicit, not recursive.
export const PlanSubModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const PlanModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  subModules: z.array(PlanSubModuleSchema),
});

export const PlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']),
  features: z.array(z.string()),
  // Live-resolved from PlanModule — the modules and functionalities the plan
  // grants. Optional: the draft's embedded plan doesn't carry them.
  modules: z.array(PlanModuleSchema).optional(),
  // The product's default plan — the wizard pre-selects it.
  isDefault: z.boolean().optional(),
  popular: z.boolean(),
});

export const ListPlansResponseSchema = z.object({
  plans: z.array(PlanSchema),
});

export const GetPlanResponseSchema = PlanSchema;
