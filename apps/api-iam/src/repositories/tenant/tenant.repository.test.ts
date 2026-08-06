import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaTenantRepository } from './tenant.repository.js'
import { NotFoundError } from '../../errors.js'

const makeTenant = () => ({
  id: 'tenant-uuid-1',
  slug: 'acme',
  name: 'Acme Corp',
  schemaName: 'tenant_acme',
  planId: 'starter',
  status: 'active' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    tenant: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payment: { findMany: vi.fn() },
  }
}

describe('PrismaTenantRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaTenantRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaTenantRepository(prisma as never)
  })

  it('findBySlug returns null when not found', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null)
    expect(await repo.findBySlug('missing')).toBeNull()
  })

  it('findByUuid throws NotFoundError when not found', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null)
    await expect(repo.findByUuid('missing-id')).rejects.toThrow(NotFoundError)
  })

  it('create sets schemaName derived from slug', async () => {
    prisma.tenant.create.mockResolvedValue(makeTenant())
    await repo.create({ slug: 'acme', name: 'Acme Corp', planId: 'starter', status: 'pending' })
    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ schemaName: 'tenant_acme' }) })
    )
  })

  // Task 3.9 — day-15 unpaid sweep boundary
  describe('sweepUnpaidPending', () => {
    it('suspends tenants whose oldest pending payment is past the threshold', async () => {
      prisma.payment.findMany.mockResolvedValue([{ tenantId: 'tenant-stale' }])
      const result = await repo.sweepUnpaidPending(15)

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending', tenantId: { not: null }, tenant: { status: 'pending' } }),
        }),
      )
      expect(prisma.tenant.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['tenant-stale'] }, status: 'pending' },
        data: { status: 'suspended' },
      })
      expect(result).toEqual(['tenant-stale'])
    })

    it('skips a tenant that settled to active between selection and update (compare-and-swap)', async () => {
      // A tenant that just paid is no longer `pending` by the time the write
      // runs — the `status: 'pending'` predicate makes Prisma's updateMany
      // affect 0 rows for it instead of overwriting the settlement.
      prisma.payment.findMany.mockResolvedValue([{ tenantId: 'tenant-just-paid' }])
      await repo.sweepUnpaidPending(15)

      expect(prisma.tenant.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'pending' }) }),
      )
    })

    it('does nothing when no payment is past the threshold', async () => {
      prisma.payment.findMany.mockResolvedValue([])
      const result = await repo.sweepUnpaidPending(15)

      expect(prisma.tenant.updateMany).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })
})
