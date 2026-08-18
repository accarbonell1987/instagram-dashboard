import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { IdentityService, ProductRoleService } from '../../services/index.js'
import {
  TenantSchema,
  MemberListItemSchema,
  MemberListResponseSchema,
  SetMemberProductRolesRequestSchema,
  TenantProductRolesResponseSchema,
  UpdateTenantNameRequestSchema,
  UpdateMemberStatusRequestSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
  commonErrorResponses,
} from '../schemas/index.js'
import { ForbiddenError, NotFoundError, ConflictError } from '../../errors.js'

export function createIdentityRouter(
  identityService: IdentityService,
  productRoleService: ProductRoleService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/tenants/*', authGuard)

  const getCurrentTenantRoute = createRoute({
    method: 'get',
    path: '/tenants/current',
    operationId: 'getCurrentTenant',
    tags: ['identity'],
    responses: {
      200: {
        content: { 'application/json': { schema: TenantSchema } },
        description: 'Current tenant',
      },
      401: commonErrorResponses[401],
    },
  })

  router.openapi(getCurrentTenantRoute, async (c) => {
    const tenant = await identityService.getCurrentTenant(c.var.user.tenantUuid)
    return c.json(
      {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        planId: tenant.planId,
        status: tenant.status,
        colorTheme: tenant.colorTheme ?? null,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
      },
      200,
    )
  })

  const getMembersRoute = createRoute({
    method: 'get',
    path: '/tenants/current/members',
    operationId: 'getMembers',
    tags: ['identity'],
    responses: {
      200: {
        content: { 'application/json': { schema: MemberListResponseSchema } },
        description: 'Active members of the current tenant',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getMembersRoute, async (c) => {
    const { items } = await identityService.getMembers({
      tenantUuid: c.var.user.tenantUuid,
      requesterRole: c.var.user.role,
    })

    // Joined here rather than inside the identity service: product access is a
    // separate domain, and the team screen is the only caller that needs both.
    // One query for the whole list — see listRolesByUsers.
    const rolesByUser = await productRoleService.listRolesForMembers(items.map((m) => m.id))

    return c.json(
      {
        items: items.map((m) => ({
          id: m.id,
          email: m.email,
          fullName: m.fullName ?? null,
          role: m.role as 'SuperAdmin' | 'TenantAdmin' | 'User',
          status: m.status as 'pending_first_login' | 'active' | 'suspended',
          createdAt: m.createdAt.toISOString(),
          productRoles: (rolesByUser.get(m.id) ?? []).map((role) => ({
            id: role.id,
            productId: role.productId,
            key: role.key,
            name: role.name,
          })),
        })),
      },
      200,
    )
  })

  // ── Product access administered by the tenant itself ───────────────────────

  const getTenantProductRolesRoute = createRoute({
    method: 'get',
    path: '/tenants/current/product-roles',
    operationId: 'getTenantProductRoles',
    summary: 'Roles this tenant may hand out, grouped by contracted product',
    tags: ['identity'],
    responses: {
      200: {
        content: { 'application/json': { schema: TenantProductRolesResponseSchema } },
        description: 'Assignable roles per contracted product',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(getTenantProductRolesRoute, async (c) => {
    const { role, tenantUuid } = c.var.user
    if (role !== 'TenantAdmin' && role !== 'SuperAdmin') {
      throw new ForbiddenError('product-roles.forbidden', 'TenantAdmin role required')
    }

    const products = await productRoleService.listRolesForTenant(tenantUuid)

    return c.json(
      {
        products: products.map((product) => ({
          productId: product.productId,
          productName: product.productName,
          roles: product.roles.map((r) => ({
            id: r.id,
            productId: r.productId,
            key: r.key,
            name: r.name,
            moduleCount: r.moduleCount,
          })),
        })),
      },
      200,
    )
  })

  router.on('PUT', '/tenants/current/members/:memberId/product-roles', idempotency)

  const setMemberProductRolesRoute = createRoute({
    method: 'put',
    path: '/tenants/current/members/:memberId/product-roles',
    operationId: 'setMemberProductRoles',
    summary: "Replace a member's product roles",
    tags: ['identity'],
    request: {
      params: z.object({ memberId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: SetMemberProductRolesRequestSchema } },
        required: true,
      },
    },
    responses: {
      204: { description: 'Member product roles replaced' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(setMemberProductRolesRoute, async (c) => {
    const { memberId } = c.req.valid('param')
    const { productRoleIds } = c.req.valid('json')

    await productRoleService.setMemberRoles({
      tenantUuid: c.var.user.tenantUuid,
      memberId,
      productRoleIds,
      requesterRole: c.var.user.role,
      assignedBy: c.var.user.sub,
    })

    return c.body(null, 204)
  })

  const updateTenantNameRoute = createRoute({
    method: 'patch',
    path: '/tenants/current',
    operationId: 'updateTenantName',
    // operationId kept for contract compatibility; this updates tenant
    // settings in general, not just the name.
    summary: 'Update tenant settings (name, visual style)',
    tags: ['identity'],
    request: {
      body: {
        content: { 'application/json': { schema: UpdateTenantNameRequestSchema } },
        required: true,
      },
    },
    responses: {
      204: { description: 'Tenant settings updated' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(updateTenantNameRoute, async (c) => {
    const { name, colorTheme } = c.req.valid('json')
    try {
      await identityService.updateTenant({
        tenantUuid: c.var.user.tenantUuid,
        name,
        colorTheme,
        requesterRole: c.var.user.role,
      })
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
      throw err
    }
    return c.body(null, 204)
  })

  const updateMemberStatusRoute = createRoute({
    method: 'patch',
    path: '/tenants/current/members/:memberId/status',
    operationId: 'updateMemberStatus',
    tags: ['identity'],
    request: {
      params: z.object({ memberId: z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateMemberStatusRequestSchema } },
        required: true,
      },
    },
    responses: {
      204: { description: 'Member status updated' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
    },
  })

  router.openapi(updateMemberStatusRoute, async (c) => {
    const { memberId } = c.req.valid('param')
    const { status } = c.req.valid('json')
    try {
      await identityService.updateMemberStatus({
        targetUserId: memberId,
        tenantUuid: c.var.user.tenantUuid,
        status,
        requesterRole: c.var.user.role,
        requesterUserId: c.var.user.sub,
      })
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
      if (err instanceof NotFoundError) throw err
      if (err instanceof ConflictError) throw err
      throw err
    }
    return c.body(null, 204)
  })

  const deleteMemberRoute = createRoute({
    method: 'delete',
    path: '/tenants/current/members/:memberId',
    operationId: 'deleteMember',
    tags: ['identity'],
    request: {
      params: z.object({ memberId: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Member deleted' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
    },
  })

  router.openapi(deleteMemberRoute, async (c) => {
    const { memberId } = c.req.valid('param')
    try {
      await identityService.deleteMember({
        targetUserId: memberId,
        tenantUuid: c.var.user.tenantUuid,
        requesterRole: c.var.user.role,
        requesterUserId: c.var.user.sub,
      })
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
      if (err instanceof NotFoundError) throw err
      if (err instanceof ConflictError) throw err
      throw err
    }
    return c.body(null, 204)
  })

  const updateCurrentUserRoute = createRoute({
    method: 'patch',
    path: '/users/me',
    operationId: 'updateCurrentUser',
    tags: ['identity'],
    request: {
      headers: z.object({ 'idempotency-key': z.string().uuid() }),
      body: {
        content: { 'application/json': { schema: UpdateProfileRequestSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: UpdateProfileResponseSchema } },
        description: 'Profile updated, new JWT issued',
      },
      401: commonErrorResponses[401],
      422: commonErrorResponses[422],
    },
  })

  router.use('/users/me', authGuard)
  router.use('/users/me', idempotency)

  router.openapi(updateCurrentUserRoute, async (c) => {
    const { fullName, phone } = c.req.valid('json')
    const result = await identityService.updateCurrentUser(c.var.user.sub, { fullName, phone })
    return c.json(result, 200)
  })

  return router
}
