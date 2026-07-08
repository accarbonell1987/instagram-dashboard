import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaDocumentRepository } from './document.repository.js'

const makeRaw = () => ({
  id: 'doc-1',
  tenantId: 'tenant-1',
  type: 'invoice',
  storageKey: 'tenants/tenant-1/documents/doc-1.pdf',
  status: 'ready',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    document: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  }
}

describe('PrismaDocumentRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaDocumentRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaDocumentRepository(prisma as never)
  })

  it('findById returns null when not found', async () => {
    prisma.document.findUnique.mockResolvedValue(null)
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findByTenantId returns array', async () => {
    prisma.document.findMany.mockResolvedValue([makeRaw()])
    const docs = await repo.findByTenantId('tenant-1')
    expect(docs).toHaveLength(1)
    expect(prisma.document.findMany).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' } })
  })

  it('updateStatus passes status to prisma update', async () => {
    prisma.document.update.mockResolvedValue(makeRaw())
    await repo.updateStatus('doc-1', 'failed')
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'failed' },
    })
  })
})
