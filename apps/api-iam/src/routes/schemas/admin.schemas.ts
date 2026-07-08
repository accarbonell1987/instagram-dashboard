import { z } from '@hono/zod-openapi'

// ── Admin Plan response schema ──────────────────────────────────────────────

export const AdminPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  currency: z.string(),
  billingInterval: z.string(),
  active: z.boolean(),
  tenantCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AdminPlan = z.infer<typeof AdminPlanSchema>

export const AdminPlanListResponseSchema = z.object({
  plans: z.array(AdminPlanSchema),
})

export type AdminPlanListResponse = z.infer<typeof AdminPlanListResponseSchema>

// ── Admin Plan create request ───────────────────────────────────────────────

export const AdminCreatePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().min(1).default('PYG'),
  billingInterval: z.enum(['month', 'year']),
})

export type AdminCreatePlanRequest = z.infer<typeof AdminCreatePlanSchema>

// ── Admin Plan update request ───────────────────────────────────────────────

export const AdminUpdatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  billingInterval: z.enum(['month', 'year']).optional(),
  active: z.boolean().optional(),
})

export type AdminUpdatePlanRequest = z.infer<typeof AdminUpdatePlanSchema>

// ── Admin Plan params ──────────────────────────────────────────────────────

export const AdminPlanParamsSchema = z.object({
  planId: z.string(),
})

export type AdminPlanParams = z.infer<typeof AdminPlanParamsSchema>

// ── Admin Tenant list query ────────────────────────────────────────────────

export const AdminTenantListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['pending', 'active', 'suspended']).optional(),
})

export type AdminTenantListQuery = z.infer<typeof AdminTenantListQuerySchema>

// ── Admin Tenant list item (response) ──────────────────────────────────────

export const AdminTenantListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['pending', 'active', 'suspended']),
  planId: z.string(),
  planName: z.string(),
  userCount: z.number().int().min(0),
  createdAt: z.string(),
})

export type AdminTenantListItem = z.infer<typeof AdminTenantListItemSchema>

export const AdminTenantListResponseSchema = z.object({
  items: z.array(AdminTenantListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
})

export type AdminTenantListResponse = z.infer<typeof AdminTenantListResponseSchema>

// ── Admin Tenant detail ───────────────────────────────────────────────────

export const AdminTenantDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['pending', 'active', 'suspended']),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    currency: z.string(),
    billingInterval: z.string(),
  }),
  userCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AdminTenantDetail = z.infer<typeof AdminTenantDetailSchema>

// ── Admin Tenant params ────────────────────────────────────────────────────

export const AdminTenantParamsSchema = z.object({
  tenantId: z.string(),
})

export type AdminTenantParams = z.infer<typeof AdminTenantParamsSchema>

// ── Admin Tenant status change request ─────────────────────────────────────

export const AdminTenantStatusChangeSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended']),
  reason: z.string().optional(),
})

export type AdminTenantStatusChangeRequest = z.infer<typeof AdminTenantStatusChangeSchema>

// ── Plan Quota schemas ──────────────────────────────────────────────────────

export const PlanQuotaResourceTypeSchema = z.enum([
  'deepseek_tokens',
  'fal_images',
  'chat_sessions',
]);

export const PlanQuotaPeriodSchema = z.enum(['month', 'day', 'unlimited']);

export const PlanQuotaItemSchema = z.object({
  id: z.string(),
  planId: z.string(),
  resourceType: PlanQuotaResourceTypeSchema,
  limit: z.number().int().min(0),
  period: PlanQuotaPeriodSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AdminPlanQuotaItem = z.infer<typeof PlanQuotaItemSchema>;

export const PlanQuotaListResponseSchema = z.object({
  quotas: z.array(PlanQuotaItemSchema),
});

export type AdminPlanQuotaListResponse = z.infer<typeof PlanQuotaListResponseSchema>;

export const UpsertPlanQuotaInputSchema = z.object({
  resourceType: PlanQuotaResourceTypeSchema,
  limit: z.number().int().min(0),
  period: PlanQuotaPeriodSchema,
});

export const UpsertPlanQuotasRequestSchema = z.object({
  quotas: z.array(UpsertPlanQuotaInputSchema).min(1).max(3),
});

export type AdminUpsertPlanQuotasRequest = z.infer<typeof UpsertPlanQuotasRequestSchema>;
