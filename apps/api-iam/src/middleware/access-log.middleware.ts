import type { MiddlewareHandler } from 'hono'
import type { Logger } from '../lib/logger.js'

const EXCLUDED_PATHS = new Set(['/healthz', '/ready', '/metrics'])

function resolveLevel(status: number): 'info' | 'warn' | 'error' {
  if (status < 400) return 'info'
  if (status < 500) return 'warn'
  return 'error'
}

export function createAccessLogMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const path = new URL(c.req.url).pathname
    if (EXCLUDED_PATHS.has(path)) {
      await next()
      return
    }

    const requestId = c.var.requestId
    const requestLogger = logger.child({ requestId })
    c.set('logger', requestLogger)

    const start = performance.now()
    await next()

    const durationMs = Math.round(performance.now() - start)
    const status = c.res.status
    const level = resolveLevel(status)

    requestLogger[level](
      {
        category: 'http',
        event: 'http_request',
        method: c.req.method,
        path,
        status,
        durationMs,
        ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
        userAgent: c.req.header('user-agent'),
      },
      'http_request',
    )
  }
}
