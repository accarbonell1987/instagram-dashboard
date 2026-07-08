import type { PrismaClient } from '../../generated/prisma/client.js'
import { Decimal } from '@prisma/client/runtime/client'
import { NotFoundError } from '../../errors.js'
import type { Tenant, TenantStatus } from '../../domain/index.js'
import { slugToSchemaName } from '../../db/with-tenant.js'
import type {
  CreateTenantInput,
  TenantRepository,
  TenantListQuery,
  TenantListResult,
  TenantDetail,
} from './types.js'

function mapTenant(raw: {
  id: string
  slug: string
  name: string
  schemaName: string
  planId: string
  status: string
  createdAt: Date
  updatedAt: Date
}): Tenant {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    schemaName: raw.schemaName,
    planId: raw.planId,
    status: raw.status as Tenant['status'],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySlug(slug: string): Promise<Tenant | null> {
    const raw = await this.prisma.tenant.findUnique({ where: { slug } })
    return raw ? mapTenant(raw) : null
  }

  async findByUuid(id: string): Promise<Tenant> {
    const raw = await this.prisma.tenant.findUnique({ where: { id } })
    if (!raw) throw new NotFoundError('tenant.not_found')
    return mapTenant(raw)
  }

  async create(data: CreateTenantInput): Promise<Tenant> {
    const raw = await this.prisma.tenant.create({
      data: {
        slug: data.slug,
        name: data.name,
        schemaName: slugToSchemaName(data.slug),
        planId: data.planId,
        status: data.status,
      },
    })
    return mapTenant(raw)
  }

  async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
    const raw = await this.prisma.tenant.update({ where: { id }, data: { status } })
    return mapTenant(raw)
  }

  async updateName(id: string, name: string): Promise<void> {
    await this.prisma.tenant.update({ where: { id }, data: { name } })
  }

  async findAllPaginated(query: TenantListQuery): Promise<TenantListResult> {
    const where: Record<string, unknown> = {}

    if (query.search) {
      where['OR'] = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    if (query.status) {
      where['status'] = query.status
    }

    const [rows, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        include: {
          plan: { select: { name: true } },
          _count: { select: { users: true } },
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ])

    return {
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status as TenantStatus,
        planId: row.planId,
        planName: row.plan.name,
        userCount: row._count.users,
        createdAt: row.createdAt,
      })),
      total,
    }
  }

  async findByIdWithDetail(id: string): Promise<TenantDetail> {
    const raw = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        _count: { select: { users: true } },
      },
    })

    if (!raw) throw new NotFoundError('tenant.not_found')

    const plan = raw.plan
    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      status: raw.status as TenantStatus,
      plan: {
        id: plan.id,
        name: plan.name,
        price: (plan.price as Decimal).toNumber(),
        currency: plan.currency,
        billingInterval: plan.billingInterval,
      },
      userCount: raw._count.users,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    }
  }
}
