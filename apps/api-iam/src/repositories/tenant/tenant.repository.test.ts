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
  return { tenant: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } }
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
})
