import { createMiddleware } from 'hono/factory'
import { ForbiddenError } from '../errors.js'

export function createTenantGuard() {
  return createMiddleware(async (c, next) => {
    const tenantSlug = c.req.header('X-Tenant-Slug')
    if (tenantSlug !== undefined && tenantSlug !== c.var.user?.tenantId) {
      throw new ForbiddenError('auth.tenant_mismatch')
    }
    await next()
  })
}
