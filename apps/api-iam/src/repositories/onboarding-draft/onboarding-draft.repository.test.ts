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
      const rawRow = {
        id: 'draft-xyz',
        status: 'draft',
        current_step: 'company',
        version: 3,
        plan_id: 'starter',
        data: { company: { ruc: '123456789' } },
        representative_email: 'test@example.com',
        resume_token_hash: null,
        resume_token_expires_at: null,
        resume_token_used: false,
        tenant_id: null,
        expires_at: new Date('2099-01-01'),
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      }
      prisma.$queryRawUnsafe.mockResolvedValue([rawRow])

      const result = await repo.findByRuc('123456789')

      expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result!.id).toBe('draft-xyz')
      expect(result!.data).toEqual({ company: { ruc: '123456789' } })
    })

    it('returns null when no draft matches the RUC', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])

      const result = await repo.findByRuc('nonexistent')

      expect(result).toBeNull()
    })

    it('excludes completed and expired drafts from results', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])

      const result = await repo.findByRuc('123456789')

      expect(result).toBeNull()
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
    })
  })
})
