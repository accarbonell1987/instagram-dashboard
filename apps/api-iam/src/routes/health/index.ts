import { OpenAPIHono } from '@hono/zod-openapi'

export function createHealthRouter() {
  const router = new OpenAPIHono()

  router.get('/healthz', (c) => c.json({ status: 'ok', service: 'iam' }, 200))

  return router
}
