import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaPlanRepository } from './plan.repository.js'
import { NotFoundError } from '../../errors.js'

const makePlanRaw = () => ({
  id: 'starter',
  name: 'Starter',
  description: null,
  price: { toNumber: () => 99.99 } as never,
  currency: 'PYG',
  billingInterval: 'monthly',
  maxUsers: 5,
  features: {},
  popular: false,
  active: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
})

function makePrisma() {
  return { plan: { findMany: vi.fn(), findUnique: vi.fn() } }
}

describe('PrismaPlanRepository', () => {
  let prisma: ReturnType<typeof makePrisma>
  let repo: PrismaPlanRepository

  beforeEach(() => {
    prisma = makePrisma()
    repo = new PrismaPlanRepository(prisma as never)
  })

  it('findAll queries only active plans', async () => {
    prisma.plan.findMany.mockResolvedValue([makePlanRaw()])
    const plans = await repo.findAll()
    expect(plans).toHaveLength(1)
    expect(prisma.plan.findMany).toHaveBeenCalledWith({ where: { active: true } })
  })

  it('findById throws NotFoundError when plan missing', async () => {
    prisma.plan.findUnique.mockResolvedValue(null)
    await expect(repo.findById('unknown')).rejects.toThrow(NotFoundError)
    await expect(repo.findById('unknown')).rejects.toThrow('plans.not_found')
  })

  it('findById maps Decimal price to number', async () => {
    prisma.plan.findUnique.mockResolvedValue(makePlanRaw())
    const plan = await repo.findById('starter')
    expect(plan.price).toBe(99.99)
    expect(plan.description).toBeUndefined()
  })
})
