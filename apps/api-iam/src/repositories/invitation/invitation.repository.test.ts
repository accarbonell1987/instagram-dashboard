import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaInvitationRepository } from './invitation.repository.js'

const makeRaw = (overrides: Record<string, unknown> = {}) => ({
  id: 'inv-1',
  email: 'invited@example.com',
  tenantId: 'tenant-1',
  inviterUserId: null,
  role: 'User',
  tokenHash: 'tok-hash',
  usedAt: null,
  revokedAt: null,
  expiresAt: new Date('2099-01-01'),
  createdAt: new Date('2024-01-01'),
  ...overrides,
})

function makePrisma() {
  return {
    invitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('PrismaInvitationRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaInvitationRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaInvitationRepository(prisma as never)
  })

  // ── existing tests ──────────────────────────────────────────────────────

  it('findByTokenHash returns null when not found', async () => {
    prisma.invitation.findUnique.mockResolvedValue(null)
    expect(await repo.findByTokenHash('nope')).toBeNull()
  })

  it('findByTokenHash maps inviterUserId null to undefined', async () => {
    prisma.invitation.findUnique.mockResolvedValue(makeRaw())
    const inv = await repo.findByTokenHash('tok-hash')
    expect(inv?.inviterUserId).toBeUndefined()
    expect(inv?.usedAt).toBeUndefined()
    expect(inv?.revokedAt).toBeUndefined()
  })

  it('markUsed sets usedAt to current date', async () => {
    prisma.invitation.update.mockResolvedValue(makeRaw())
    await repo.markUsed('inv-1')
    expect(prisma.invitation.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { usedAt: expect.any(Date) },
    })
  })

  // ── new tests ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates invitation and returns mapped domain object', async () => {
      const raw = makeRaw({ inviterUserId: 'user-inviter' })
      prisma.invitation.create.mockResolvedValue(raw)

      const input = {
        email: 'invited@example.com',
        tenantId: 'tenant-1',
        inviterUserId: 'user-inviter',
        role: 'User' as const,
        tokenHash: 'tok-hash',
        expiresAt: new Date('2099-01-01'),
      }

      const result = await repo.create(input)

      expect(prisma.invitation.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          tenantId: input.tenantId,
          inviterUserId: input.inviterUserId,
          role: input.role,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      })
      expect(result.id).toBe('inv-1')
      expect(result.email).toBe('invited@example.com')
      expect(result.revokedAt).toBeUndefined()
    })
  })

  describe('listByTenant', () => {
    it('returns list of RawInvitationRows ordered by createdAt desc', async () => {
      const raw1 = makeRaw({ id: 'inv-1', email: 'a@test.com', createdAt: new Date('2024-02-01') })
      const raw2 = makeRaw({ id: 'inv-2', email: 'b@test.com', createdAt: new Date('2024-01-01'), usedAt: new Date('2024-01-15') })
      prisma.invitation.findMany.mockResolvedValue([raw1, raw2])

      const rows = await repo.listByTenant('tenant-1')

      expect(prisma.invitation.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        orderBy: { createdAt: 'desc' },
      })
      expect(rows).toHaveLength(2)
      expect(rows[0]!.id).toBe('inv-1')
      expect(rows[0]!.usedAt).toBeUndefined()
      expect(rows[0]!.revokedAt).toBeUndefined()
      expect(rows[1]!.usedAt).toBeInstanceOf(Date)
    })

    it('returns empty array when no invitations found', async () => {
      prisma.invitation.findMany.mockResolvedValue([])
      const rows = await repo.listByTenant('tenant-empty')
      expect(rows).toHaveLength(0)
    })
  })

  describe('findPendingByEmail', () => {
    it('returns invitation when pending invitation exists', async () => {
      prisma.invitation.findFirst.mockResolvedValue(makeRaw())

      const result = await repo.findPendingByEmail('invited@example.com', 'tenant-1')

      expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'invited@example.com',
          tenantId: 'tenant-1',
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
      })
      expect(result?.email).toBe('invited@example.com')
    })

    it('returns null when no pending invitation found', async () => {
      prisma.invitation.findFirst.mockResolvedValue(null)
      const result = await repo.findPendingByEmail('other@example.com', 'tenant-1')
      expect(result).toBeNull()
    })
  })

  describe('findById', () => {
    it('returns invitation when found for tenant', async () => {
      prisma.invitation.findFirst.mockResolvedValue(makeRaw())

      const result = await repo.findById('inv-1', 'tenant-1')

      expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
        where: { id: 'inv-1', tenantId: 'tenant-1' },
      })
      expect(result?.id).toBe('inv-1')
    })

    it('returns null when invitation not found or belongs to different tenant', async () => {
      prisma.invitation.findFirst.mockResolvedValue(null)
      const result = await repo.findById('inv-999', 'tenant-1')
      expect(result).toBeNull()
    })
  })

  describe('revokeById', () => {
    it('sets revokedAt on the invitation', async () => {
      prisma.invitation.update.mockResolvedValue(makeRaw({ revokedAt: new Date() }))

      await repo.revokeById('inv-1')

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { revokedAt: expect.any(Date) },
      })
    })
  })
})
