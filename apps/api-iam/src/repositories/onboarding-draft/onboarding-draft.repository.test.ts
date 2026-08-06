import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaOnboardingDraftRepository } from './onboarding-draft.repository.js'
import { NotFoundError } from '../../errors.js'

const makeRaw = () => ({
  id: 'draft-1',
  status: 'draft',
  currentStep: 'plan',
  version: 0,
  planId: null,
  data: {},
  representativeEmail: null,
  resumeTokenHash: null,
  resumeTokenExpiresAt: null,
  resumeTokenUsed: false,
  tenantId: null,
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    onboardingDraft: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  }
}

describe('PrismaOnboardingDraftRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaOnboardingDraftRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaOnboardingDraftRepository(prisma as never)
  })

  it('findById returns null when not found', async () => {
    prisma.onboardingDraft.findUnique.mockResolvedValue(null)
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findByIdOrThrow throws NotFoundError when missing', async () => {
    prisma.onboardingDraft.findUnique.mockResolvedValue(null)
    await expect(repo.findByIdOrThrow('missing')).rejects.toThrow(NotFoundError)
    await expect(repo.findByIdOrThrow('missing')).rejects.toThrow('onboarding.draft_not_found')
  })

  it('findByIdForUpdate throws NotFoundError when $queryRaw returns empty', async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) }
    await expect(repo.findByIdForUpdate('missing', tx as never)).rejects.toThrow(NotFoundError)
    expect(tx.$queryRaw).toHaveBeenCalled()
  })

  it('deleteExpired excludes completed status', async () => {
    prisma.onboardingDraft.deleteMany.mockResolvedValue({ count: 2 })
    await repo.deleteExpired()
    expect(prisma.onboardingDraft.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
        status: { notIn: ['completed'] },
      },
    })
  })

  describe('findByRuc', () => {
    it('returns draft when RUC matches an active draft', async () => {
      prisma.onboardingDraft.findFirst.mockResolvedValue({
        ...makeRaw(),
        id: 'draft-xyz',
        currentStep: 'company',
        version: 3,
        planId: 'starter',
        data: { company: { ruc: '123456789' } },
        representativeEmail: 'test@example.com',
      })

      const result = await repo.findByRuc('123456789')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('draft-xyz')
      expect(result!.data).toEqual({ company: { ruc: '123456789' } })
    })

    it('returns null when no draft matches the RUC', async () => {
      prisma.onboardingDraft.findFirst.mockResolvedValue(null)

      expect(await repo.findByRuc('nonexistent')).toBeNull()
    })

    it('filters by JSON path, excludes completed/expired, and omits the id guard when no draft is excluded', async () => {
      prisma.onboardingDraft.findFirst.mockResolvedValue(null)

      await repo.findByRuc('123456789')

      expect(prisma.onboardingDraft.findFirst).toHaveBeenCalledWith({
        where: {
          data: { path: ['company', 'ruc'], equals: '123456789' },
          status: { notIn: ['completed', 'expired'] },
        },
      })
    })

    it('excludes the given draft id when provided', async () => {
      prisma.onboardingDraft.findFirst.mockResolvedValue(null)

      await repo.findByRuc('123456789', 'draft-1')

      expect(prisma.onboardingDraft.findFirst).toHaveBeenCalledWith({
        where: {
          data: { path: ['company', 'ruc'], equals: '123456789' },
          status: { notIn: ['completed', 'expired'] },
          id: { not: 'draft-1' },
        },
      })
    })

    // Regression: findByRuc used to interpolate `ruc` into a $queryRawUnsafe string,
    // so this value closed the literal and made the WHERE clause always true.
    it.each([
      "' OR '1'='1",
      "'; DROP TABLE onboarding_drafts; --",
      "' UNION SELECT * FROM onboarding_drafts WHERE '1'='1",
    ])('treats a malicious RUC (%s) as a bound value, not SQL', async (maliciousRuc) => {
      prisma.onboardingDraft.findFirst.mockResolvedValue(null)

      const result = await repo.findByRuc(maliciousRuc, 'draft-1')

      // No match: the payload is compared as a literal JSON string, not executed.
      expect(result).toBeNull()
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled()
      expect(prisma.onboardingDraft.findFirst).toHaveBeenCalledWith({
        where: {
          data: { path: ['company', 'ruc'], equals: maliciousRuc },
          status: { notIn: ['completed', 'expired'] },
          id: { not: 'draft-1' },
        },
      })
    })
  })
})
