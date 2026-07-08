import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ModuleService } from '../../services/index.js'
import { GetTenantModulesResponseSchema } from './modules.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

export function createTenantModulesRouter(
  moduleService: ModuleService,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/tenants/current/modules', authGuard)

  const getTenantModulesRoute = createRoute({
    method: 'get',
    path: '/tenants/current/modules',
    operationId: 'getTenantModules',
    tags: ['modules'],
    responses: {
      200: {
        content: { 'application/json': { schema: GetTenantModulesResponseSchema } },
        description: 'Effective modules for the current tenant',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getTenantModulesRoute, async (c) => {
    const { tenantUuid, role } = c.var.user

    if (role === 'SuperAdmin') {
      const allModules = await moduleService.listAll()
      const activeModules = allModules.filter((m) => m.active)
      return c.json(
        {
          modules: activeModules.map((module) => ({
            id: module.id,
            name: module.name,
            description: module.description,
            defaultUrl: module.defaultUrl,
            source: 'admin' as const,
          })),
        },
        200,
      )
    }

    const effectiveModules = await moduleService.getEffectiveModulesForTenant(tenantUuid)

    return c.json(
      {
        modules: effectiveModules.map((module) => ({
          id: module.id,
          name: module.name,
          description: module.description,
          defaultUrl: module.defaultUrl,
          source: module.source,
        })),
      },
      200,
    )
  })

  return router
}
