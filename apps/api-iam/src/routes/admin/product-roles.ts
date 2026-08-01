import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { ProductRoleService } from '../../services/index.js'
import type { ProductRole, UserProductRole } from '../../domain/index.js'
import { ForbiddenError } from '../../errors.js'
import {
  ProductRoleSchema,
  ProductRoleListResponseSchema,
  ProductRoleParamsSchema,
  ProductRoleIdParamsSchema,
  CreateProductRoleRequestSchema,
  UpdateProductRoleRequestSchema,
  UserProductRoleParamsSchema,
  UserProductRoleIdParamsSchema,
  AssignProductRoleRequestSchema,
  UserProductRoleSchema,
  UserProductRoleListResponseSchema,
} from '../schemas/admin.schemas.js'
import { commonErrorResponses } from '../schemas/index.js'

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('product-roles.forbidden', 'SuperAdmin role required')
  }
}

// c1 (7.2, PR8): admin CRUD for per-product roles, layered over the global
// role enum (design "Per-Product Roles / JWT"). c2 (JWT product_roles claim)
// reads the UserProductRole rows assigned here.
export function createAdminProductRolesRouter(
  productRoleService: ProductRoleService,
  authGuard: MiddlewareHandler,
  idempotency: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/admin/products/:productId/roles', authGuard)
  router.use('/admin/products/:productId/roles/:roleId', authGuard)
  router.use('/admin/users/:userId/product-roles', authGuard)
  router.use('/admin/users/:userId/product-roles/:productRoleId', authGuard)

  // ── GET /admin/products/:productId/roles ────────────────────────────────

  const listProductRolesRoute = createRoute({
    method: 'get',
    path: '/admin/products/{productId}/roles',
    operationId: 'listProductRoles',
    tags: ['admin', 'product-roles'],
    request: { params: ProductRoleParamsSchema },
    responses: {
      200: { content: { 'application/json': { schema: ProductRoleListResponseSchema } }, description: 'List of product roles' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listProductRolesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { productId } = c.req.valid('param')
    const roles = await productRoleService.listByProduct(productId)

    return c.json({ roles: roles.map(toRoleResponse) }, 200)
  })

  // ── POST /admin/products/:productId/roles ───────────────────────────────

  router.on('POST', '/admin/products/:productId/roles', idempotency)

  const createProductRoleRoute = createRoute({
    method: 'post',
    path: '/admin/products/{productId}/roles',
    operationId: 'createProductRole',
    tags: ['admin', 'product-roles'],
    request: {
      params: ProductRoleParamsSchema,
      body: { content: { 'application/json': { schema: CreateProductRoleRequestSchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: ProductRoleSchema } }, description: 'Product role created' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      409: commonErrorResponses[409],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(createProductRoleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { productId } = c.req.valid('param')
    const { key, name } = c.req.valid('json')
    const role = await productRoleService.create({ productId, key, name })

    return c.json(toRoleResponse(role), 201)
  })

  // ── PATCH /admin/products/:productId/roles/:roleId ──────────────────────

  router.on('PATCH', '/admin/products/:productId/roles/:roleId', idempotency)

  const updateProductRoleRoute = createRoute({
    method: 'patch',
    path: '/admin/products/{productId}/roles/{roleId}',
    operationId: 'updateProductRole',
    tags: ['admin', 'product-roles'],
    request: {
      params: ProductRoleIdParamsSchema,
      body: { content: { 'application/json': { schema: UpdateProductRoleRequestSchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: ProductRoleSchema } }, description: 'Product role updated' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(updateProductRoleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { roleId } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const role = await productRoleService.update(roleId, { name })

    return c.json(toRoleResponse(role), 200)
  })

  // ── DELETE /admin/products/:productId/roles/:roleId ─────────────────────

  router.on('DELETE', '/admin/products/:productId/roles/:roleId', idempotency)

  const deleteProductRoleRoute = createRoute({
    method: 'delete',
    path: '/admin/products/{productId}/roles/{roleId}',
    operationId: 'deleteProductRole',
    tags: ['admin', 'product-roles'],
    request: { params: ProductRoleIdParamsSchema },
    responses: {
      204: { description: 'Product role deleted' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(deleteProductRoleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { roleId } = c.req.valid('param')
    await productRoleService.remove(roleId)

    return c.body(null, 204)
  })

  // ── GET /admin/users/:userId/product-roles ───────────────────────────────

  const listUserProductRolesRoute = createRoute({
    method: 'get',
    path: '/admin/users/{userId}/product-roles',
    operationId: 'listUserProductRoles',
    tags: ['admin', 'product-roles'],
    request: { params: UserProductRoleParamsSchema },
    responses: {
      200: { content: { 'application/json': { schema: UserProductRoleListResponseSchema } }, description: "List of a user's product roles" },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
    },
  })

  router.openapi(listUserProductRolesRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { userId } = c.req.valid('param')
    const roles = await productRoleService.listByUser(userId)

    return c.json({ roles: roles.map(toAssignmentResponse) }, 200)
  })

  // ── POST /admin/users/:userId/product-roles ──────────────────────────────

  router.on('POST', '/admin/users/:userId/product-roles', idempotency)

  const assignProductRoleRoute = createRoute({
    method: 'post',
    path: '/admin/users/{userId}/product-roles',
    operationId: 'assignProductRole',
    tags: ['admin', 'product-roles'],
    request: {
      params: UserProductRoleParamsSchema,
      body: { content: { 'application/json': { schema: AssignProductRoleRequestSchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: UserProductRoleSchema } }, description: 'Product role assigned' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      422: commonErrorResponses[422],
    },
  })

  router.openapi(assignProductRoleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { userId } = c.req.valid('param')
    const { productRoleId } = c.req.valid('json')
    const assignedBy = c.var.user.sub
    const assignment = await productRoleService.assignToUser(userId, productRoleId, assignedBy)

    return c.json(toAssignmentResponse(assignment), 201)
  })

  // ── DELETE /admin/users/:userId/product-roles/:productRoleId ────────────

  router.on('DELETE', '/admin/users/:userId/product-roles/:productRoleId', idempotency)

  const unassignProductRoleRoute = createRoute({
    method: 'delete',
    path: '/admin/users/{userId}/product-roles/{productRoleId}',
    operationId: 'unassignProductRole',
    tags: ['admin', 'product-roles'],
    request: { params: UserProductRoleIdParamsSchema },
    responses: {
      204: { description: 'Product role unassigned' },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
    },
  })

  router.openapi(unassignProductRoleRoute, async (c) => {
    assertSuperAdmin(c.var.user.role)
    const { userId, productRoleId } = c.req.valid('param')
    await productRoleService.unassignFromUser(userId, productRoleId)

    return c.body(null, 204)
  })

  return router
}

function toRoleResponse(role: ProductRole) {
  return {
    id: role.id,
    productId: role.productId,
    key: role.key,
    name: role.name,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  }
}

function toAssignmentResponse(assignment: UserProductRole) {
  return {
    userId: assignment.userId,
    productRoleId: assignment.productRoleId,
    assignedBy: assignment.assignedBy ?? null,
    createdAt: assignment.createdAt.toISOString(),
  }
}
