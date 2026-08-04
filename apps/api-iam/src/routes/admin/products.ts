import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { ForbiddenError, NotFoundError } from '../../errors.js';
import { commonErrorResponses } from '../schemas/index.js';

function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') throw new ForbiddenError('admin.forbidden');
}

export function createAdminProductsRouter(
  prisma: PrismaClient,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono();
  router.use('/admin/products', authGuard);
  router.use('/admin/products/:productId', authGuard);

  // GET /admin/products
  router.openapi(
    createRoute({
      method: 'get', path: '/admin/products', operationId: 'listProducts',
      tags: ['admin'],
      responses: { 200: { description: 'Product list' }, 401: commonErrorResponses[401], 403: commonErrorResponses[403] },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role);
      const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
      return c.json({ products }, 200);
    },
  );

  // PATCH /admin/products/:productId
  router.openapi(
    createRoute({
      method: 'patch', path: '/admin/products/{productId}', operationId: 'updateProduct',
      tags: ['admin'],
      request: {
        params: z.object({ productId: z.string() }),
        body: { content: { 'application/json': { schema: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          active: z.boolean().optional(),
          trialEnabled: z.boolean().optional(),
          trialDurationDays: z.number().int().min(1).max(365).optional(),
        }) } } },
      },
      responses: { 200: { description: 'Product updated' }, 401: commonErrorResponses[401], 403: commonErrorResponses[403], 404: commonErrorResponses[404] },
    }),
    async (c) => {
      assertSuperAdmin(c.var.user.role);
      const { productId } = c.req.valid('param');
      const body = c.req.valid('json');
      const existing = await prisma.product.findUnique({ where: { id: productId } });
      if (!existing) throw new NotFoundError('product.not_found');
      // Strip undefined fields for exactOptionalPropertyTypes
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined) data[k] = v;
      }
      const updated = await prisma.product.update({ where: { id: productId }, data });
      return c.json(updated, 200);
    },
  );

  return router;
}
