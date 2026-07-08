import { createMiddleware } from 'hono/factory'

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('X-Request-Id') ?? crypto.randomUUID()
  c.set('requestId', id)
  await next()
  c.header('X-Request-Id', id)
})
