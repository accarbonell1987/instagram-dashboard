import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaDeviceTrustRepository } from './device-trust.repository.js'

const makeRaw = () => ({
  id: 'dt-1',
  userId: 'user-1',
  deviceHash: 'hash-abc',
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    deviceTrust: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('PrismaDeviceTrustRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaDeviceTrustRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaDeviceTrustRepository(prisma as never)
  })

  it('upsert uses composite unique key', async () => {
    prisma.deviceTrust.upsert.mockResolvedValue(makeRaw())
    await repo.upsert({ userId: 'user-1', deviceHash: 'hash-abc', expiresAt: new Date() })
    expect(prisma.deviceTrust.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_deviceHash: { userId: 'user-1', deviceHash: 'hash-abc' } },
      })
    )
  })

  it('findByUserAndHash returns null when not found', async () => {
    prisma.deviceTrust.findUnique.mockResolvedValue(null)
    expect(await repo.findByUserAndHash('user-1', 'hash')).toBeNull()
  })

  it('deleteExpired returns count of deleted rows', async () => {
    prisma.deviceTrust.deleteMany.mockResolvedValue({ count: 5 })
    expect(await repo.deleteExpired()).toBe(5)
    expect(prisma.deviceTrust.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    })
  })
})
