import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ModuleService } from '../../services/index.js'
import { ForbiddenError } from '../../errors.js'
import {
  ModuleSchema,
  ListAllModulesResponseSchema,
  CreateModuleRequestSchema,
  GetModuleByIdParamsSchema,
  UpdateModuleRequestSchema,
  SetPlanModulesParamsSchema,
  SetPlanModulesRequestSchema,
  TenantModuleOverrideParamsSchema,
  UpsertTenantModuleOverrideRequestSchema,
} from './modules.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('modules.forbidden', 'SuperAdmin role required')
  }
}

export function createAdminModulesRouter(
  moduleService: ModuleService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  // Apply authGuard to all admin routes
  router.use('/admin/modules', authGuard)
  router.use('/admin/modules/:moduleId', authGuard)
  router.use('/admin/plans/:planId/modules', authGuard)
  router.use('/admin/tenants/:tenantId/modules/:moduleId/override', authGuard)

  // ── GET /admin/modules ─────────────────────────────────────────────────

  const listAllModulesRoute = createRoute({
    method: 'get',
    path: '/admin/modules',
    operationId: 'listAllModules',
    tags: ['admin', 'modules'],
    responses: {
      200: {
        content: { 'application/json': { schema: ListAllModulesResponseSchema } },
        description: 'List of all modules',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listAllModulesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const modules = await moduleService.listAll()

    return c.json(
      {
        modules: modules.map((module) => ({
          id: module.id,
          name: module.name,
          description: module.description,
          defaultUrl: module.defaultUrl,
          active: module.active,
        })),
      },
      200,
    )
  })

  // ── POST /admin/modules ────────────────────────────────────────────────

  router.on('POST', '/admin/modules', idempotency)

  const createModuleRoute = createRoute({
    method: 'post',
    path: '/admin/modules',
    operationId: 'createModule',
    tags: ['admin', 'modules'],
    request: {
      body: {
        content: { 'application/json': { schema: CreateModuleRequestSchema } },
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: ModuleSchema } },
        description: 'Module created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(createModuleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const body = c.req.valid('json')
    const createData: { id: string; name: string; description?: string; defaultUrl: string } = {
      id: body.id,
      name: body.name,
      defaultUrl: body.defaultUrl,
    }
    if (body.description !== undefined) createData.description = body.description
    const module = await moduleService.create(createData)

    return c.json(
      {
        id: module.id,
        name: module.name,
        description: module.description,
        defaultUrl: module.defaultUrl,
        active: module.active,
      },
      201,
    )
  })

  // ── GET /admin/modules/:moduleId ───────────────────────────────────────

  const getModuleByIdRoute = createRoute({
    method: 'get',
    path: '/admin/modules/{moduleId}',
    operationId: 'getModuleById',
    tags: ['admin', 'modules'],
    request: {
      params: GetModuleByIdParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ModuleSchema } },
        description: 'Module details',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getModuleByIdRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { moduleId } = c.req.valid('param')
    const module = await moduleService.getById(moduleId)

    return c.json(
      {
        id: module.id,
        name: module.name,
        description: module.description,
        defaultUrl: module.defaultUrl,
        active: module.active,
      },
      200,
    )
  })

  // ── PATCH /admin/modules/:moduleId ─────────────────────────────────────

  router.on('PATCH', '/admin/modules/:moduleId', idempotency)

  const updateModuleRoute = createRoute({
    method: 'patch',
    path: '/admin/modules/{moduleId}',
    operationId: 'updateModule',
    tags: ['admin', 'modules'],
    request: {
      params: GetModuleByIdParamsSchema,
      body: {
        content: { 'application/json': { schema: UpdateModuleRequestSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: ModuleSchema } },
        description: 'Module updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updateModuleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { moduleId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updateData: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.defaultUrl !== undefined) updateData.defaultUrl = body.defaultUrl
    if (body.active !== undefined) updateData.active = body.active
    const module = await moduleService.update(moduleId, updateData)

    return c.json(
      {
        id: module.id,
        name: module.name,
        description: module.description,
        defaultUrl: module.defaultUrl,
        active: module.active,
      },
      200,
    )
  })

  // ── DELETE /admin/modules/:moduleId ────────────────────────────────────

  router.on('DELETE', '/admin/modules/:moduleId', idempotency)

  const deleteModuleRoute = createRoute({
    method: 'delete',
    path: '/admin/modules/{moduleId}',
    operationId: 'deleteModule',
    tags: ['admin', 'modules'],
    request: {
      params: GetModuleByIdParamsSchema,
    },
    responses: {
      204: {
        description: 'Module deleted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(deleteModuleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { moduleId } = c.req.valid('param')
    await moduleService.remove(moduleId)

    return c.body(null, 204)
  })

  // ── PUT /admin/plans/:planId/modules ───────────────────────────────────

  router.on('PUT', '/admin/plans/:planId/modules', idempotency)

  const setPlanModulesRoute = createRoute({
    method: 'put',
    path: '/admin/plans/{planId}/modules',
    operationId: 'setPlanModules',
    tags: ['admin', 'modules'],
    request: {
      params: SetPlanModulesParamsSchema,
      body: {
        content: { 'application/json': { schema: SetPlanModulesRequestSchema } },
      },
    },
    responses: {
      204: {
        description: 'Plan modules updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(setPlanModulesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { planId } = c.req.valid('param')
    const { moduleIds } = c.req.valid('json')
    await moduleService.setPlanModules(planId, moduleIds)

    return c.body(null, 204)
  })

  // ── PUT /admin/tenants/:tenantId/modules/:moduleId/override ───────────

  router.on('PUT', '/admin/tenants/:tenantId/modules/:moduleId/override', idempotency)

  const upsertTenantModuleOverrideRoute = createRoute({
    method: 'put',
    path: '/admin/tenants/{tenantId}/modules/{moduleId}/override',
    operationId: 'upsertTenantModuleOverride',
    tags: ['admin', 'modules'],
    request: {
      params: TenantModuleOverrideParamsSchema,
      body: {
        content: { 'application/json': { schema: UpsertTenantModuleOverrideRequestSchema } },
      },
    },
    responses: {
      204: {
        description: 'Tenant module override upserted',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(upsertTenantModuleOverrideRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { tenantId, moduleId } = c.req.valid('param')
    const { enabled, reason } = c.req.valid('json')
    const createdBy = c.var.user.sub
    await moduleService.upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason)

    return c.body(null, 204)
  })

  // ── DELETE /admin/tenants/:tenantId/modules/:moduleId/override ─────────

  router.on('DELETE', '/admin/tenants/:tenantId/modules/:moduleId/override', idempotency)

  const deleteTenantModuleOverrideRoute = createRoute({
    method: 'delete',
    path: '/admin/tenants/{tenantId}/modules/{moduleId}/override',
    operationId: 'deleteTenantModuleOverride',
    tags: ['admin', 'modules'],
    request: {
      params: TenantModuleOverrideParamsSchema,
    },
    responses: {
      204: {
        description: 'Tenant module override removed',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(deleteTenantModuleOverrideRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { tenantId, moduleId } = c.req.valid('param')
    await moduleService.removeTenantOverride(tenantId, moduleId)

    return c.body(null, 204)
  })

  return router
}
