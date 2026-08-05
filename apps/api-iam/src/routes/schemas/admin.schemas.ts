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
  // Drives the module picker: a plan can only take modules of its own product.
  productId: z.string().nullable().optional(),
  // Backoffice drag-and-drop rank and the product's default plan.
  displayOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
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

// Reorder is its own endpoint: the client posts the full list in its new order.
export const ReorderPlansSchema = z.object({
  planIds: z.array(z.string().min(1)).min(1),
})

export type ReorderPlansRequest = z.infer<typeof ReorderPlansSchema>

export const AdminUpdatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  billingInterval: z.enum(['month', 'year']).optional(),
  active: z.boolean().optional(),
  // Promoting a plan demotes the others of the same product.
  isDefault: z.boolean().optional(),
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
  // Required by the service when status === 'active' — activation routes
  // through settlePayment(), which mandates a note (see admin-tenant.service.ts).
  note: z.string().optional(),
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

// ── Admin Trial schemas (b1, 5.1) ────────────────────────────────────────────

export const TrialParamsSchema = z.object({
  tenantId: z.string(),
})

export type TrialParams = z.infer<typeof TrialParamsSchema>

export const GrantTrialRequestSchema = z.object({
  productId: z.string().min(1),
  // Optional (PR7/b1.5, owner decision #1679/1): omitted moduleId means a
  // product-scoped grant — resolveEffectiveModules expands it to every
  // module of the product. See ModuleRepository.grantTrial.
  moduleId: z.string().min(1).optional(),
  durationDays: z.number().int().positive().optional(),
})

export type GrantTrialRequest = z.infer<typeof GrantTrialRequestSchema>

export const GrantTrialResponseSchema = z.object({
  tenantId: z.string(),
  productId: z.string(),
  moduleId: z.string().nullable(),
  expiresAt: z.string(),
})

export type GrantTrialResponse = z.infer<typeof GrantTrialResponseSchema>

// ── Admin Product Role schemas (c1, 7.2) ────────────────────────────────────

export const ProductRoleSchema = z.object({
  id: z.string(),
  productId: z.string(),
  key: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AdminProductRole = z.infer<typeof ProductRoleSchema>

export const ProductRoleListResponseSchema = z.object({
  roles: z.array(ProductRoleSchema),
})

export type AdminProductRoleListResponse = z.infer<typeof ProductRoleListResponseSchema>

export const ProductRoleParamsSchema = z.object({
  productId: z.string(),
})

export type ProductRoleParams = z.infer<typeof ProductRoleParamsSchema>

export const ProductRoleIdParamsSchema = z.object({
  productId: z.string(),
  roleId: z.string(),
})

export type ProductRoleIdParams = z.infer<typeof ProductRoleIdParamsSchema>

export const CreateProductRoleRequestSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
})

export type CreateProductRoleRequest = z.infer<typeof CreateProductRoleRequestSchema>

export const UpdateProductRoleRequestSchema = z.object({
  name: z.string().min(1),
})

export type UpdateProductRoleRequest = z.infer<typeof UpdateProductRoleRequestSchema>

// ── Admin User Product Role schemas (c1, 7.2) ───────────────────────────────

export const UserProductRoleParamsSchema = z.object({
  userId: z.string(),
})

export type UserProductRoleParams = z.infer<typeof UserProductRoleParamsSchema>

export const UserProductRoleIdParamsSchema = z.object({
  userId: z.string(),
  productRoleId: z.string(),
})

export type UserProductRoleIdParams = z.infer<typeof UserProductRoleIdParamsSchema>

export const AssignProductRoleRequestSchema = z.object({
  productRoleId: z.string().min(1),
})

export type AssignProductRoleRequest = z.infer<typeof AssignProductRoleRequestSchema>

export const UserProductRoleSchema = z.object({
  userId: z.string(),
  productRoleId: z.string(),
  assignedBy: z.string().nullable(),
  createdAt: z.string(),
})

export type AdminUserProductRole = z.infer<typeof UserProductRoleSchema>

export const UserProductRoleListResponseSchema = z.object({
  roles: z.array(UserProductRoleSchema),
})

export type AdminUserProductRoleListResponse = z.infer<typeof UserProductRoleListResponseSchema>

// ── Role module assignment schemas (Phase 2) ─────────────────────────────────

export const RoleModulesParamsSchema = z.object({
  roleId: z.string().min(1),
})

export type RoleModulesParams = z.infer<typeof RoleModulesParamsSchema>

export const SetRoleModulesRequestSchema = z.object({
  moduleIds: z.array(z.string()),
})

export type SetRoleModulesRequest = z.infer<typeof SetRoleModulesRequestSchema>
