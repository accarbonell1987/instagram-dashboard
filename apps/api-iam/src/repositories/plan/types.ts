import type { Plan } from '../../domain/index.js'

export interface PlanWithTenantCount extends Plan {
  tenantCount: number
}

export interface CreatePlanInput {
  name: string
  description?: string
  price: number
  currency: string
  billingInterval: string
}

export type UpdatePlanInput = Partial<{
  name: string
  description: string
  price: number
  currency: string
  billingInterval: string
  active: boolean
}>

export interface PlanListFilter {
  active?: boolean
}

export interface PlanRepository {
  findAll(): Promise<Plan[]>
  findById(id: string): Promise<Plan>
  create(data: CreatePlanInput): Promise<Plan>
  update(id: string, data: UpdatePlanInput): Promise<Plan>
  findAllWithTenantCount(filter?: PlanListFilter): Promise<PlanWithTenantCount[]>
}
