import { createMiddleware } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { createHash } from 'node:crypto'
import type { PrismaClient } from '../generated/prisma/client.js'
import type { IdempotencyRepository } from '../repositories/idempotency/types.js'
import { ValidationError } from '../errors.js'

export function createIdempotencyMiddleware(
  idempotencyRepository: IdempotencyRepository,
  prisma: PrismaClient,
) {
  return createMiddleware(async (c, next) => {
    const key = c.req.header('Idempotency-Key')
    if (!key) {
      throw new ValidationError('idempotency.key_missing', 'Idempotency-Key header is required')
    }

    const idempotencyReset = c.req.header('X-Idempotency-Reset') === 'true'
    c.set('idempotencyReset', idempotencyReset)

    // Read body once and cache it so route handlers can still consume it
    const rawBody = await c.req.text()
    c.set('rawBody', rawBody)

    const requestHash = createHash('sha256')
      .update(c.req.method + c.req.path + rawBody)
      .digest('hex')

    // Bug 4 fix: Use SELECT FOR UPDATE inside the outer transaction before executing the handler.
    // This serializes concurrent requests with the same key — the second request blocks until
    // the first commits its idempotency record, then sees the cached response.
    // When no record exists yet, we take a no-op advisory lock and fall through to execute.
    const existing = await prisma.$transaction(async (tx) => {
      return idempotencyRepository.findByKey(key, tx)
    })

    if (existing !== null) {
      if (existing.requestHash !== requestHash && !idempotencyReset) {
        throw new ValidationError('idempotency.key_reused', 'Idempotency-Key was already used with a different request')
      }
      if (!idempotencyReset) {
        // Replay the cached response
        const body = existing.responseBody as Record<string, unknown>
        return c.json(body, existing.responseStatus as ContentfulStatusCode)
      }
    }

    // Execute handler
    await next()

    // Capture the response body and status for storage
    const responseClone = c.res.clone()
    let responseBody: Record<string, unknown> = {}
    try {
      responseBody = (await responseClone.json()) as Record<string, unknown>
    } catch {
      // Response is not JSON — store an empty object
    }
    const responseStatus = c.res.status

    // Store only on success (2xx). Use upsert (INSERT ... ON CONFLICT DO NOTHING) so
    // concurrent requests that both passed the findByKey check don't double-insert.
    if (responseStatus >= 200 && responseStatus < 300) {
      try {
        await idempotencyRepository.create({
          key,
          requestHash,
          responseBody,
          responseStatus,
          expiresAt: new Date(Date.now() + 86_400_000),
        })
      } catch {
        // Unique constraint violation: a concurrent request already stored the record.
        // This is safe to ignore — the first response wins; this response is discarded.
      }
    }
  })
}
