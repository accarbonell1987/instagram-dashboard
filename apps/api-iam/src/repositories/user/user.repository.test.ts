import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaUserRepository } from './user.repository.js'
import { NotFoundError } from '../../errors.js'

const makeUser = () => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'test@example.com',
  passwordHash: 'hash',
  role: 'User' as const,
  fullName: null,
  picture: null,
  status: 'active' as const,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('PrismaUserRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaUserRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaUserRepository(prisma as never)
  })

  it('findByEmail returns null when not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    const result = await repo.findByEmail('x@x.com', 'tenant-1')
    expect(result).toBeNull()
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_email: { tenantId: 'tenant-1', email: 'x@x.com' } },
    })
  })

  it('findById throws NotFoundError when user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(repo.findById('missing-id')).rejects.toThrow(NotFoundError)
    await expect(repo.findById('missing-id')).rejects.toThrow('auth.user_not_found')
  })

  it('findById maps nullable fields to undefined', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser())
    const user = await repo.findById('user-1')
    expect(user.passwordHash).toBe('hash')
    expect(user.lockedUntil).toBeUndefined()
  })

  it('incrementFailedAttempts calls update with increment and returns new count', async () => {
    prisma.user.update.mockResolvedValue({ ...makeUser(), failedLoginAttempts: 3 })
    const result = await repo.incrementFailedAttempts('user-1')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })
    expect(result.failedLoginAttempts).toBe(3)
  })

  it('resetFailedAttempts sets count to 0 and clears lockedUntil', async () => {
    prisma.user.update.mockResolvedValue(makeUser())
    await repo.resetFailedAttempts('user-1')
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  })

  describe('findByActivationTokenHash', () => {
    it('returns User when hash matches', async () => {
      const user = { ...makeUser(), activationTokenHash: 'abc-hash', activationTokenExpiresAt: new Date('2026-06-01'), activationTokenUsed: false }
      prisma.user.findUnique.mockResolvedValue(user)
      const result = await repo.findByActivationTokenHash('abc-hash')
      expect(result).not.toBeNull()
      expect(result!.email).toBe('test@example.com')
      expect(result!.activationTokenHash).toBe('abc-hash')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { activationTokenHash: 'abc-hash' },
      })
    })

    it('returns null when hash not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      const result = await repo.findByActivationTokenHash('unknown-hash')
      expect(result).toBeNull()
    })
  })

  describe('setActivationTokenUsed', () => {
    it('sets activationTokenUsed to true', async () => {
      prisma.user.update.mockResolvedValue({ ...makeUser(), activationTokenUsed: true })
      await repo.setActivationTokenUsed('user-1')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { activationTokenUsed: true },
      })
    })
  })
})
