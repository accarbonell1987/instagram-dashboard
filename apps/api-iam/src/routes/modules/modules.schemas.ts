import { z } from '@hono/zod-openapi'

// ── Shared entity schemas ──────────────────────────────────────────────────

export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  defaultUrl: z.string(),
  active: z.boolean(),
})

export type Module = z.infer<typeof ModuleSchema>

export const EffectiveModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  defaultUrl: z.string(),
  source: z.enum(['plan', 'override', 'admin']),
})

export type EffectiveModule = z.infer<typeof EffectiveModuleSchema>

// ── T10: GET /tenants/current/modules ─────────────────────────────────────

export const GetTenantModulesResponseSchema = z.object({
  modules: z.array(EffectiveModuleSchema),
})

export type GetTenantModulesResponse = z.infer<typeof GetTenantModulesResponseSchema>

// ── T11: GET /admin/modules ───────────────────────────────────────────────

export const ListAllModulesResponseSchema = z.object({
  modules: z.array(ModuleSchema),
})

export type ListAllModulesResponse = z.infer<typeof ListAllModulesResponseSchema>

// ── T11: POST /admin/modules ──────────────────────────────────────────────

export const CreateModuleRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  defaultUrl: z.string().min(1),
})

export type CreateModuleRequest = z.infer<typeof CreateModuleRequestSchema>

// ── T12: GET /admin/modules/:moduleId ─────────────────────────────────────

export const GetModuleByIdParamsSchema = z.object({
  moduleId: z.string(),
})

export type GetModuleByIdParams = z.infer<typeof GetModuleByIdParamsSchema>

// ── T12: PATCH /admin/modules/:moduleId ───────────────────────────────────

export const UpdateModuleRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultUrl: z.string().url().optional(),
  active: z.boolean().optional(),
})

export type UpdateModuleRequest = z.infer<typeof UpdateModuleRequestSchema>

// ── T12: PUT /admin/plans/:planId/modules ─────────────────────────────────

export const SetPlanModulesParamsSchema = z.object({
  planId: z.string(),
})

export type SetPlanModulesParams = z.infer<typeof SetPlanModulesParamsSchema>

export const SetPlanModulesRequestSchema = z.object({
  moduleIds: z.array(z.string()),
})

export type SetPlanModulesRequest = z.infer<typeof SetPlanModulesRequestSchema>

// ── T12: PUT /admin/tenants/:tenantId/modules/:moduleId/override ──────────

export const TenantModuleOverrideParamsSchema = z.object({
  tenantId: z.string(),
  moduleId: z.string(),
})

export type TenantModuleOverrideParams = z.infer<typeof TenantModuleOverrideParamsSchema>

export const UpsertTenantModuleOverrideRequestSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().optional(),
})

export type UpsertTenantModuleOverrideRequest = z.infer<typeof UpsertTenantModuleOverrideRequestSchema>
