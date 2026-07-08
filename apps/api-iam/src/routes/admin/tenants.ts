import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { AdminTenantService } from '../../services/index.js'
import { ForbiddenError } from '../../errors.js'
import {
  AdminTenantListQuerySchema,
  AdminTenantListResponseSchema,
  AdminTenantDetailSchema,
  AdminTenantParamsSchema,
  AdminTenantStatusChangeSchema,
} from '../schemas/admin.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('tenants.forbidden', 'SuperAdmin role required')
  }
}

export function createAdminTenantsRouter(
  adminTenantService: AdminTenantService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  // Apply authGuard to all admin routes
  router.use('/admin/tenants', authGuard)
  router.use('/admin/tenants/:tenantId', authGuard)
  router.use('/admin/tenants/:tenantId/status', authGuard)

  // ── GET /admin/tenants ───────────────────────────────────────────────────

  const listTenantsRoute = createRoute({
    method: 'get',
    path: '/admin/tenants',
    operationId: 'listAdminTenants',
    tags: ['admin', 'tenants'],
    request: {
      query: AdminTenantListQuerySchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AdminTenantListResponseSchema } },
        description: 'Paginated tenant list',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listTenantsRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const query = c.req.valid('query')
    const result = await adminTenantService.listTenants({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    })

    return c.json(
      {
        items: result.items.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          status: item.status,
          planId: item.planId,
          planName: item.planName,
          userCount: item.userCount,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        })),
        total: result.total,
        page: query.page,
        pageSize: query.pageSize,
      },
      200,
    )
  })

  // ── GET /admin/tenants/:tenantId ─────────────────────────────────────────

  const getTenantDetailRoute = createRoute({
    method: 'get',
    path: '/admin/tenants/{tenantId}',
    operationId: 'getAdminTenantDetail',
    tags: ['admin', 'tenants'],
    request: {
      params: AdminTenantParamsSchema,
    },
    responses: {
      200: {
        content: { 'application/json': { schema: AdminTenantDetailSchema } },
        description: 'Tenant detail',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(getTenantDetailRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { tenantId } = c.req.valid('param')
    const detail = await adminTenantService.getTenantDetail(tenantId)

    return c.json(
      {
        id: detail.id,
        name: detail.name,
        slug: detail.slug,
        status: detail.status,
        plan: detail.plan,
        userCount: detail.userCount,
        createdAt: detail.createdAt instanceof Date ? detail.createdAt.toISOString() : detail.createdAt,
        updatedAt: detail.updatedAt instanceof Date ? detail.updatedAt.toISOString() : detail.updatedAt,
      },
      200,
    )
  })

  // ── PATCH /admin/tenants/:tenantId/status ────────────────────────────────

  router.on('PATCH', '/admin/tenants/:tenantId/status', idempotency)

  const changeTenantStatusRoute = createRoute({
    method: 'patch',
    path: '/admin/tenants/{tenantId}/status',
    operationId: 'changeTenantStatus',
    tags: ['admin', 'tenants'],
    request: {
      params: AdminTenantParamsSchema,
      body: {
        content: { 'application/json': { schema: AdminTenantStatusChangeSchema } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ id: z.string(), status: z.string() }) } },
        description: 'Tenant status updated',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(changeTenantStatusRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { tenantId } = c.req.valid('param')
    const { status } = c.req.valid('json')
    const result = await adminTenantService.changeTenantStatus(tenantId, status)

    return c.json(result, 200)
  })

  return router
}
