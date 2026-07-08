import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaPasswordResetTokenRepository } from './password-reset-token.repository.js'

const makeRaw = () => ({
  id: 'prt-1',
  userId: 'user-1',
  tokenHash: 'hash-xyz',
  used: false,
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('PrismaPasswordResetTokenRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaPasswordResetTokenRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaPasswordResetTokenRepository(prisma as never)
  })

  it('findByHash returns null when not found', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null)
    expect(await repo.findByHash('missing')).toBeNull()
  })

  it('markUsed sets used to true', async () => {
    prisma.passwordResetToken.update.mockResolvedValue(makeRaw())
    await repo.markUsed('prt-1')
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'prt-1' },
      data: { used: true },
    })
  })

  it('deleteExpired returns count', async () => {
    prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 7 })
    expect(await repo.deleteExpired()).toBe(7)
  })
})
