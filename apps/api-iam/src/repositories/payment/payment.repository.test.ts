import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaPaymentRepository } from './payment.repository.js'

const makeRaw = () => ({
  id: 'pay-1',
  draftId: 'draft-1',
  tenantId: null,
  bancardProcessId: 'bancard-proc-1',
  amount: { toNumber: () => 150000 } as never,
  currency: 'PYG',
  status: 'pending',
  reason: null,
  initiatedAt: new Date('2024-01-01'),
  confirmedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return {
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
}

describe('PrismaPaymentRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaPaymentRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaPaymentRepository(prisma as never)
  })

  it('findByDraftId orders by initiatedAt desc', async () => {
    prisma.payment.findFirst.mockResolvedValue(null)
    await repo.findByDraftId('draft-1')
    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { draftId: 'draft-1' },
      orderBy: { initiatedAt: 'desc' },
    })
  })

  it('cancelPendingByDraftId only cancels pending payments', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 1 })
    await repo.cancelPendingByDraftId('draft-1')
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { draftId: 'draft-1', status: 'pending' },
      data: { status: 'cancelled' },
    })
  })

  it('updateStatus includes confirmedAt when provided', async () => {
    const confirmedAt = new Date()
    prisma.payment.update.mockResolvedValue(makeRaw())
    await repo.updateStatus('pay-1', 'approved', confirmedAt)
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'approved', confirmedAt },
    })
  })
})
