import type { PlanRepository, PlanWithTenantCount, CreatePlanInput, UpdatePlanInput, PlanListFilter } from '../repositories/index.js'
import type { Plan } from '../domain/index.js'

export type CreatePlanParams = {
  name: string
  description?: string | undefined
  price: number
  currency: string
  billingInterval: string
}

export type PlanServiceDeps = {
  planRepo: PlanRepository
}

export function createPlanService(deps: PlanServiceDeps) {
  const { planRepo } = deps

  async function listPlans(filter?: PlanListFilter): Promise<PlanWithTenantCount[]> {
    // Default to active only (public endpoint compatibility)
    const effectiveFilter = filter ?? { active: true }
    return planRepo.findAllWithTenantCount(effectiveFilter)
  }

  async function getPlan(id: string): Promise<Plan> {
    return planRepo.findById(id)
  }

  async function createPlan(data: CreatePlanParams): Promise<Plan> {
    const input: CreatePlanInput = {
      name: data.name,
      price: data.price,
      currency: data.currency,
      billingInterval: data.billingInterval,
    }
    if (data.description !== undefined) input.description = data.description
    return planRepo.create(input)
  }

  async function updatePlan(id: string, data: UpdatePlanInput): Promise<Plan> {
    return planRepo.update(id, data)
  }

  async function archivePlan(id: string): Promise<Plan> {
    return planRepo.update(id, { active: false })
  }

  return { listPlans, getPlan, createPlan, updatePlan, archivePlan }
}

export type PlanService = ReturnType<typeof createPlanService>
