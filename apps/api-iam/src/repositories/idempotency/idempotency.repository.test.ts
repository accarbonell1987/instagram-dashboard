import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaIdempotencyRepository } from './idempotency.repository.js'

function makePrisma() {
  return {
    idempotencyRecord: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('PrismaIdempotencyRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaIdempotencyRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaIdempotencyRepository(prisma as never)
  })

  it('findByKey uses $queryRaw with FOR UPDATE', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) }
    const result = await repo.findByKey('some-uuid', tx as never)
    expect(result).toBeNull()
    expect(tx.$queryRaw).toHaveBeenCalled()
  })

  it('findByKey returns mapped record when found', async () => {
    const row = {
      key: 'key-1',
      request_hash: 'hash-1',
      response_status: 200,
      response_body: { ok: true },
      response_headers: null,
      expires_at: new Date('2099-01-01'),
      created_at: new Date('2024-01-01'),
    }
    const tx = { $queryRaw: vi.fn().mockResolvedValue([row]) }
    const result = await repo.findByKey('key-1', tx as never)
    expect(result?.key).toBe('key-1')
    expect(result?.responseHeaders).toBeUndefined()
  })

  it('deleteExpired returns count', async () => {
    prisma.idempotencyRecord.deleteMany.mockResolvedValue({ count: 4 })
    expect(await repo.deleteExpired()).toBe(4)
  })
})
