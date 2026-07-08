import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaOtpCodeRepository } from './otp-code.repository.js'

const makeRaw = () => ({
  id: 'otp-1',
  identifier: 'user@example.com',
  channel: 'email',
  purpose: 'login',
  codeHash: 'hash',
  attempts: 0,
  used: false,
  lockedUntil: null,
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    otpCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('PrismaOtpCodeRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaOtpCodeRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaOtpCodeRepository(prisma as never)
  })

  it('findActiveById filters by id, purpose, used=false, lockedUntil=null, and future expiresAt', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(null)
    await repo.findActiveById('otp-1', 'login')
    expect(prisma.otpCode.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'otp-1',
        purpose: 'login',
        used: false,
        lockedUntil: null,
        expiresAt: { gt: expect.any(Date) },
      },
    })
  })

  it('incrementAttempts uses prisma increment', async () => {
    prisma.otpCode.update.mockResolvedValue({ ...makeRaw(), attempts: 1 })
    const result = await repo.incrementAttempts('otp-1')
    expect(result.attempts).toBe(1)
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { attempts: { increment: 1 } },
    })
  })

  it('deleteExpired returns count', async () => {
    prisma.otpCode.deleteMany.mockResolvedValue({ count: 3 })
    expect(await repo.deleteExpired()).toBe(3)
  })
})
