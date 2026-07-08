import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaWebhookEventRepository } from './webhook-event.repository.js'

function makePrisma() {
  return { $executeRaw: vi.fn() }
}

describe('PrismaWebhookEventRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaWebhookEventRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaWebhookEventRepository(prisma as never)
  })

  it('insertEvent returns true when row inserted (affected=1)', async () => {
    prisma.$executeRaw.mockResolvedValue(1)
    const result = await repo.insertEvent({
      source: 'bancard',
      processId: 'proc-1',
      status: 'approved',
      rawBody: { foo: 'bar' },
    })
    expect(result).toBe(true)
  })

  it('insertEvent returns false on conflict (affected=0)', async () => {
    prisma.$executeRaw.mockResolvedValue(0)
    const result = await repo.insertEvent({
      source: 'bancard',
      processId: 'proc-1',
      status: 'approved',
      rawBody: {},
    })
    expect(result).toBe(false)
  })

  it('insertEvent calls $executeRaw (uses ON CONFLICT DO NOTHING)', async () => {
    prisma.$executeRaw.mockResolvedValue(1)
    await repo.insertEvent({ source: 'bancard', processId: 'proc-2', status: 'pending', rawBody: {} })
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })
})
