import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ModuleService } from '../../services/index.js'
import type { EffectiveModule } from '../../domain/index.js'
import {
  GetTenantModulesResponseSchema,
  GetTenantProductsResponseSchema,
} from './modules.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

/**
 * Nests a product's flat module list into module → sub-modules. A sub-module
 * whose parent isn't reachable is surfaced as top-level, so nothing the tenant
 * has access to disappears from the portal.
 */
function toModuleTree(modules: EffectiveModule[]) {
  const reachable = new Set(modules.map((m) => m.id))
  const toNode = (m: EffectiveModule) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    defaultUrl: m.effectiveUrl,
    source: m.source,
  })

  return modules
    .filter((m) => m.parentId === null || !reachable.has(m.parentId))
    .map((parent) => ({
      ...toNode(parent),
      subModules: modules.filter((m) => m.parentId === parent.id).map(toNode),
    }))
}

export function createTenantModulesRouter(
  moduleService: ModuleService,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/tenants/current/modules', authGuard)
  router.use('/tenants/current/products', authGuard)

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
    const { tenantUuid, role, sub: userId } = c.var.user

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

    const effectiveModules = await moduleService.getEffectiveModulesForTenant(tenantUuid, userId)

    return c.json(
      {
        modules: effectiveModules.map((module) => ({
          id: module.id,
          name: module.name,
          description: module.description,
          defaultUrl: module.defaultUrl,
          source: module.source,
          parentId: module.parentId ?? null,
        })),
      },
      200,
    )
  })

  // ── GET /tenants/current/products ────────────────────────────────────────

  const getTenantProductsRoute = createRoute({
    method: 'get',
    path: '/tenants/current/products',
    operationId: 'getTenantProducts',
    tags: ['modules'],
    responses: {
      200: {
        content: { 'application/json': { schema: GetTenantProductsResponseSchema } },
        description: 'Products available to the current tenant, with their modules',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getTenantProductsRoute, async (c) => {
    const { tenantUuid, role, sub: userId } = c.var.user

    const products = await moduleService.getAvailableProductsForTenant(
      tenantUuid,
      userId,
      role === 'SuperAdmin',
    )

    return c.json(
      {
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          defaultUrl: product.defaultUrl,
          modules: toModuleTree(product.modules),
        })),
      },
      200,
    )
  })

  return router
}
