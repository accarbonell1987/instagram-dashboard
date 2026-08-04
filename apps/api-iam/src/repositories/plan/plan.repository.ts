import crypto from 'node:crypto'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { Decimal } from '@prisma/client/runtime/client'
import { NotFoundError, ConflictError } from '../../errors.js'
import type { Plan } from '../../domain/index.js'
import type { PlanRepository, PlanWithTenantCount, CreatePlanInput, UpdatePlanInput, PlanListFilter } from './types.js'

// Included by every read path so the plan carries the modules it grants.
// Write paths (create/update) don't select it — a fresh plan has none yet.
const withModules = { planModules: { include: { module: true } } } as const

// Backoffice drag-and-drop order, with createdAt as the deterministic
// tie-breaker for plans that were never reordered (all default to 0).
const PLAN_ORDER = [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }]

type PlanModuleRow = {
  module: {
    id: string
    name: string
    description: string | null
    parentId: string | null
    active: boolean
  }
}

function mapPlan(raw: {
  id: string
  name: string
  description: string | null
  price: Decimal
  currency: string
  billingInterval: string
  maxUsers: number
  features: unknown
  popular: boolean
  active: boolean
  displayOrder?: number
  isDefault?: boolean
  productId?: string | null
  createdAt: Date
  updatedAt: Date
  planModules?: PlanModuleRow[]
}): Plan {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    price: raw.price.toNumber(),
    currency: raw.currency,
    billingInterval: raw.billingInterval,
    maxUsers: raw.maxUsers,
    features: raw.features as Record<string, unknown>,
    productId: raw.productId ?? null,
    modules: (raw.planModules ?? [])
      .filter((pm) => pm.module.active)
      .map((pm) => ({
        id: pm.module.id,
        name: pm.module.name,
        description: pm.module.description ?? undefined,
        parentId: pm.module.parentId,
      })),
    popular: raw.popular,
    active: raw.active,
    displayOrder: raw.displayOrder ?? 0,
    isDefault: raw.isDefault ?? false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: { active: true },
      include: withModules,
      orderBy: PLAN_ORDER,
    })
    return rows.map(mapPlan)
  }

  async findById(id: string): Promise<Plan> {
    const raw = await this.prisma.plan.findUnique({ where: { id }, include: withModules })
    if (!raw) throw new NotFoundError('plans.not_found')
    return mapPlan(raw)
  }

  async create(data: CreatePlanInput): Promise<Plan> {
    try {
      const raw = await this.prisma.plan.create({
        data: {
          id: crypto.randomUUID(),
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          currency: data.currency,
          billingInterval: data.billingInterval,
          maxUsers: 0,
        },
      })
      return mapPlan(raw)
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictError('plans.duplicate', 'A plan with this name already exists')
      }
      throw error
    }
  }

  async update(id: string, data: UpdatePlanInput): Promise<Plan> {
    try {
      const raw = await this.prisma.$transaction(async (tx) => {
        // At most one default per product: promoting a plan demotes its
        // siblings in the same transaction, so the two can't both be true.
        if (data.isDefault === true) {
          const target = await tx.plan.findUnique({ where: { id }, select: { productId: true } })
          if (!target) throw new NotFoundError('plans.not_found')
          await tx.plan.updateMany({
            where: { productId: target.productId, id: { not: id } },
            data: { isDefault: false },
          })
        }

        return tx.plan.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.price !== undefined && { price: data.price }),
            ...(data.currency !== undefined && { currency: data.currency }),
            ...(data.billingInterval !== undefined && { billingInterval: data.billingInterval }),
            ...(data.active !== undefined && { active: data.active }),
            ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          },
          include: withModules,
        })
      })
      return mapPlan(raw)
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2025'
      ) {
        throw new NotFoundError('plans.not_found')
      }
      throw error
    }
  }

  async findAllWithTenantCount(filter?: PlanListFilter): Promise<PlanWithTenantCount[]> {
    const where: Record<string, unknown> = {}
    if (filter?.active !== undefined) where['active'] = filter.active
    if (filter?.productId !== undefined) where['productId'] = filter.productId

    const rows = await this.prisma.plan.findMany({
      where,
      include: {
        ...withModules,
        _count: { select: { tenants: true } },
      },
      orderBy: PLAN_ORDER,
    })

    return rows.map((raw) => ({
      ...mapPlan(raw),
      tenantCount: raw._count.tenants,
    }))
  }

  async reorder(planIds: string[]): Promise<void> {
    const found = await this.prisma.plan.findMany({
      where: { id: { in: planIds } },
      select: { id: true },
    })
    if (found.length !== planIds.length) {
      const known = new Set(found.map((p) => p.id))
      const missing = planIds.filter((id) => !known.has(id))
      throw new NotFoundError('plans.not_found', `Unknown plans: ${missing.join(', ')}`)
    }

    await this.prisma.$transaction(
      planIds.map((id, index) =>
        this.prisma.plan.update({ where: { id }, data: { displayOrder: index } })
      )
    )
  }
}
