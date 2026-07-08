import { describe, it, expect, vi } from 'vitest'
import { createPlanService } from './plan.service.js'
import { NotFoundError, ConflictError } from '../errors.js'
import type { PlanServiceDeps } from './plan.service.js'

function makePlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'professional',
    name: 'Professional',
    description: 'Professional plan',
    price: 99.0,
    currency: 'PYG',
    billingInterval: 'month',
    maxUsers: 50,
    features: {},
    popular: true,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makePlanWithTenantCount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ...makePlan(overrides),
    tenantCount: (overrides['tenantCount'] as number) ?? 5,
  }
}

function makeDeps(overrides: Partial<PlanServiceDeps> = {}): PlanServiceDeps {
  return {
    planRepo: {
      findAll: vi.fn().mockResolvedValue([makePlan(), makePlan({ id: 'starter' })]),
      findById: vi.fn().mockResolvedValue(makePlan()),
      create: vi.fn().mockResolvedValue(makePlan()),
      update: vi.fn().mockResolvedValue(makePlan({ name: 'Updated' })),
      findAllWithTenantCount: vi.fn().mockResolvedValue([
        makePlanWithTenantCount(),
        makePlanWithTenantCount({ id: 'starter', active: false, tenantCount: 0 }),
      ]),
    },
    ...overrides,
  }
}

describe('PlanService', () => {
  describe('listPlans', () => {
    it('returns active plans with tenant counts by default', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)

      const plans = await service.listPlans()

      expect(plans).toHaveLength(2)
      expect(deps.planRepo.findAllWithTenantCount).toHaveBeenCalledWith({ active: true })
    })

    it('returns empty array when no plans exist', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          findAllWithTenantCount: vi.fn().mockResolvedValue([]),
        },
      })
      const service = createPlanService(deps)

      const plans = await service.listPlans()
      expect(plans).toHaveLength(0)
    })
  })

  describe('getPlan', () => {
    it('returns plan by id', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)

      const plan = await service.getPlan('professional')

      expect(plan.id).toBe('professional')
      expect(deps.planRepo.findById).toHaveBeenCalledWith('professional')
    })

    it('propagates NotFoundError from repository for unknown plan', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn().mockRejectedValue(new NotFoundError('plans.not_found')),
          create: vi.fn(),
          update: vi.fn(),
          findAllWithTenantCount: vi.fn(),
        },
      })
      const service = createPlanService(deps)

      await expect(service.getPlan('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── Admin: listPlans ───────────────────────────────────────────────────────

  describe('listPlans (admin)', () => {
    it('returns all plans with tenant counts', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)
      const plans = await service.listPlans()

      expect(plans).toHaveLength(2)
      expect(plans[0]!.tenantCount).toBe(5)
      expect(plans[1]!.active).toBe(false)
    })

    it('filters by active status', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          findAllWithTenantCount: vi.fn().mockResolvedValue([
            makePlanWithTenantCount({ tenantCount: 5 }),
          ]),
        },
      })
      const service = createPlanService(deps)
      const plans = await service.listPlans({ active: true })

      expect(plans).toHaveLength(1)
      expect(deps.planRepo.findAllWithTenantCount).toHaveBeenCalledWith({ active: true })
    })
  })

  // ── Admin: createPlan ─────────────────────────────────────────────────────

  describe('createPlan', () => {
    it('creates a new plan and returns it', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)
      const plan = await service.createPlan({
        name: 'Enterprise',
        price: 299.99,
        currency: 'PYG',
        billingInterval: 'month',
      })

      expect(plan.id).toBe('professional')
      expect(deps.planRepo.create).toHaveBeenCalledWith({
        name: 'Enterprise',
        price: 299.99,
        currency: 'PYG',
        billingInterval: 'month',
      })
    })

    it('propagates ConflictError for duplicate plan name', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn(),
          create: vi.fn().mockRejectedValue(new ConflictError('plans.duplicate')),
          update: vi.fn(),
          findAllWithTenantCount: vi.fn(),
        },
      })
      const service = createPlanService(deps)
      await expect(
        service.createPlan({ name: 'Duplicate', price: 99, currency: 'PYG', billingInterval: 'month' })
      ).rejects.toBeInstanceOf(ConflictError)
    })
  })

  // ── Admin: updatePlan ─────────────────────────────────────────────────────

  describe('updatePlan', () => {
    it('updates an existing plan', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)
      const plan = await service.updatePlan('professional', { name: 'New Name' })

      expect(plan.name).toBe('Updated')
      expect(deps.planRepo.update).toHaveBeenCalledWith('professional', { name: 'New Name' })
    })

    it('propagates NotFoundError for unknown plan', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockRejectedValue(new NotFoundError('plans.not_found')),
          findAllWithTenantCount: vi.fn(),
        },
      })
      const service = createPlanService(deps)
      await expect(
        service.updatePlan('nonexistent', { name: 'X' })
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  // ── Admin: archivePlan ────────────────────────────────────────────────────

  describe('archivePlan', () => {
    it('archives a plan by setting active to false', async () => {
      const deps = makeDeps()
      const service = createPlanService(deps)
      await service.archivePlan('professional')

      expect(deps.planRepo.update).toHaveBeenCalledWith('professional', { active: false })
    })

    it('propagates NotFoundError for unknown plan', async () => {
      const deps = makeDeps({
        planRepo: {
          findAll: vi.fn(),
          findById: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockRejectedValue(new NotFoundError('plans.not_found')),
          findAllWithTenantCount: vi.fn(),
        },
      })
      const service = createPlanService(deps)
      await expect(service.archivePlan('nonexistent')).rejects.toBeInstanceOf(NotFoundError)
    })
  })
})
