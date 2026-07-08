import crypto from 'node:crypto'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { Decimal } from '@prisma/client/runtime/client'
import { NotFoundError, ConflictError } from '../../errors.js'
import type { Plan } from '../../domain/index.js'
import type { PlanRepository, PlanWithTenantCount, CreatePlanInput, UpdatePlanInput, PlanListFilter } from './types.js'

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
  createdAt: Date
  updatedAt: Date
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
    popular: raw.popular,
    active: raw.active,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export class PrismaPlanRepository implements PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({ where: { active: true } })
    return rows.map(mapPlan)
  }

  async findById(id: string): Promise<Plan> {
    const raw = await this.prisma.plan.findUnique({ where: { id } })
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
      const raw = await this.prisma.plan.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.billingInterval !== undefined && { billingInterval: data.billingInterval }),
          ...(data.active !== undefined && { active: data.active }),
        },
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
    if (filter?.active !== undefined) {
      where['active'] = filter.active
    }

    const rows = await this.prisma.plan.findMany({
      where,
      include: {
        _count: { select: { tenants: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return rows.map((raw) => ({
      ...mapPlan(raw),
      tenantCount: raw._count.tenants,
    }))
  }
}
