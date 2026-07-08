import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { MiddlewareHandler } from 'hono'
import type { PlanChangeService } from '../../services/index.js'
import { commonErrorResponses } from '../schemas/index.js'
import { ForbiddenError, ConflictError, NotFoundError } from '../../errors.js'

const PlanChangeRequestBodySchema = z.object({
  toPlanId: z.string().min(1),
})

const PlanChangeResponseSchema = z.object({
  id: z.string().uuid(),
})

export function createPlanChangeRouter(
  planChangeService: PlanChangeService,
  authGuard: MiddlewareHandler,
) {
  const router = new OpenAPIHono()

  router.use('/tenants/*', authGuard)

  const createPlanChangeRequestRoute = createRoute({
    method: 'post',
    path: '/tenants/current/plan-change',
    operationId: 'createPlanChangeRequest',
    tags: ['plan-change'],
    request: {
      body: {
        content: { 'application/json': { schema: PlanChangeRequestBodySchema } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { 'application/json': { schema: PlanChangeResponseSchema } },
        description: 'Plan change request created',
      },
      401: commonErrorResponses[401],
      403: commonErrorResponses[403],
      404: commonErrorResponses[404],
      409: commonErrorResponses[409],
    },
  })

  router.openapi(createPlanChangeRequestRoute, async (c) => {
    const { toPlanId } = c.req.valid('json')
    try {
      const result = await planChangeService.createRequest({
        tenantUuid: c.var.user.tenantUuid,
        requesterUserId: c.var.user.sub,
        requesterRole: c.var.user.role,
        toPlanId,
      })
      return c.json({ id: result.id }, 201)
    } catch (err) {
      if (err instanceof ForbiddenError) throw err
      if (err instanceof ConflictError) throw err
      if (err instanceof NotFoundError) throw err
      throw err
    }
  })

  return router
}
