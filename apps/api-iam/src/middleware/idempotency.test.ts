import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { requestId } from './request-id.js'
import { createIdempotencyMiddleware } from './idempotency.js'
import { createErrorHandler } from './error-handler.js'
import { silentLogger } from '../test-helpers/logger.js'
import type {
  IdempotencyRepository,
  CreateIdempotencyInput,
} from '../repositories/idempotency/types.js'
import type { IdempotencyRecord } from '../domain/index.js'
import type { PrismaClient } from '../generated/prisma/client.js'

type JsonBody = Record<string, unknown>

const baseRecord: IdempotencyRecord = {
  key: 'test-key',
  requestHash: 'abc123',
  responseStatus: 201,
  responseBody: { id: 'created-1' },
  responseHeaders: undefined,
  expiresAt: new Date(Date.now() + 86_400_000),
  createdAt: new Date(),
}

function makeIdempotencyRepo(overrides?: Partial<IdempotencyRepository>): IdempotencyRepository {
  return {
    findByKey: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(baseRecord),
    deleteExpired: vi.fn().mockResolvedValue(0),
    ...overrides,
  }
}

function makePrisma(): PrismaClient {
  return {
    $transaction: vi.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    ),
  } as unknown as PrismaClient
}

function buildApp(repo: IdempotencyRepository, prisma: PrismaClient) {
  const app = new Hono()
  app.use('*', requestId)
  app.use('/idempotent', createIdempotencyMiddleware(repo, prisma))
  app.post('/idempotent', (c) => c.json({ created: true }, 201))
  app.onError(createErrorHandler(silentLogger))
  return app
}

describe('createIdempotencyMiddleware', () => {
  it('throws ValidationError when Idempotency-Key header is missing', async () => {
    const repo = makeIdempotencyRepo()
    const prisma = makePrisma()
    const app = buildApp(repo, prisma)

    const response = await app.request('/idempotent', { method: 'POST' })
    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('idempotency.key_missing')
  })

  it('replays the cached response on a repeat request with the same key and body', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update('POST/idempotent{"data":1}').digest('hex')

    const cachedRecord: IdempotencyRecord = {
      ...baseRecord,
      requestHash: hash,
      responseStatus: 201,
      responseBody: { id: 'cached-entity' },
    }
    const repo = makeIdempotencyRepo({
      findByKey: vi.fn().mockResolvedValue(cachedRecord),
    })
    const prisma = makePrisma()
    const app = buildApp(repo, prisma)

    const response = await app.request('/idempotent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'replay-key',
      },
      body: '{"data":1}',
    })
    expect(response.status).toBe(201)
    const body = (await response.json()) as JsonBody
    expect(body['id']).toBe('cached-entity')
    // Handler should NOT have been reached — create should NOT be called
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('throws ValidationError when same key is used with a different body', async () => {
    const cachedRecord: IdempotencyRecord = {
      ...baseRecord,
      requestHash: 'different-hash',
    }
    const repo = makeIdempotencyRepo({
      findByKey: vi.fn().mockResolvedValue(cachedRecord),
    })
    const prisma = makePrisma()
    const app = buildApp(repo, prisma)

    const response = await app.request('/idempotent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'conflict-key',
      },
      body: '{"data":"different"}',
    })
    expect(response.status).toBe(422)
    const body = (await response.json()) as JsonBody
    expect(body['code']).toBe('idempotency.key_reused')
  })

  it('sets idempotencyReset to true in context when X-Idempotency-Reset header is "true"', async () => {
    let capturedReset: boolean | undefined
    const repo = makeIdempotencyRepo()
    const prisma = makePrisma()

    const app = new Hono()
    app.use('*', requestId)
    app.use('/idempotent', createIdempotencyMiddleware(repo, prisma))
    app.post('/idempotent', (c) => {
      capturedReset = c.var.idempotencyReset
      return c.json({ ok: true }, 200)
    })

    await app.request('/idempotent', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'reset-key',
        'X-Idempotency-Reset': 'true',
      },
    })
    expect(capturedReset).toBe(true)
  })

  it('stores a new idempotency record after a successful (2xx) handler response', async () => {
    const repo = makeIdempotencyRepo()
    const prisma = makePrisma()
    const app = buildApp(repo, prisma)

    await app.request('/idempotent', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'new-key' },
      body: '',
    })

    expect(repo.create).toHaveBeenCalledOnce()
    const mockCreate = repo.create as ReturnType<typeof vi.fn>
    const createArg = mockCreate.mock.calls[0]?.[0] as CreateIdempotencyInput
    expect(createArg).toBeDefined()
    expect(createArg?.key).toBe('new-key')
    expect(createArg?.responseStatus).toBe(201)
  })
})
