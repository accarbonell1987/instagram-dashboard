import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaRefreshTokenRepository } from './refresh-token.repository.js'

const makeRawToken = () => ({
  id: 'token-1',
  userId: 'user-1',
  tokenHash: 'abc123',
  familyId: 'family-1',
  parentId: null,
  usedAt: null,
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  }
}

describe('PrismaRefreshTokenRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaRefreshTokenRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaRefreshTokenRepository(prisma as never)
  })

  it('findByHash returns null when not found', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null)
    expect(await repo.findByHash('nope')).toBeNull()
  })

  it('findByHash maps nulls to undefined', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(makeRawToken())
    const token = await repo.findByHash('abc123')
    expect(token?.parentId).toBeUndefined()
    expect(token?.usedAt).toBeUndefined()
  })

  it('invalidateFamily calls updateMany with correct filter', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })
    await repo.invalidateFamily('family-1')
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    })
  })

  it('findByHashForUpdate uses $queryRaw with FOR UPDATE', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) }
    const result = await repo.findByHashForUpdate('abc', tx as never)
    expect(result).toBeNull()
    expect(tx.$queryRaw).toHaveBeenCalled()
  })
})
