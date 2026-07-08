import type { PrismaClient } from '../../generated/prisma/client.js'
import type { Module, EffectiveModule } from '../../domain/index.js'

export type ModuleRepository = {
  findAll(): Promise<Module[]>
  findById(id: string): Promise<Module | null>
  findEffectiveForTenant(planId: string, tenantId: string): Promise<EffectiveModule[]>
  create(data: { id: string; name: string; description?: string; defaultUrl: string }): Promise<Module>
  update(id: string, data: Partial<{ name: string; description: string; defaultUrl: string; active: boolean }>): Promise<Module>
  delete(id: string): Promise<void>
  setPlanModules(planId: string, moduleIds: string[]): Promise<void>
  upsertTenantOverride(tenantId: string, moduleId: string, enabled: boolean, createdBy?: string, reason?: string): Promise<void>
  deleteTenantOverride(tenantId: string, moduleId: string): Promise<void>
}

export function createModuleRepository(prisma: PrismaClient): ModuleRepository {
  return {
    async findAll() {
      const rows = await prisma.module.findMany({ orderBy: { id: 'asc' } })
      return rows.map(toModule)
    },

    async findById(id) {
      const row = await prisma.module.findUnique({ where: { id } })
      return row ? toModule(row) : null
    },

    async findEffectiveForTenant(planId, tenantId) {
      const [planModules, overrides] = await Promise.all([
        prisma.planModule.findMany({
          where: { planId, module: { active: true } },
          include: { module: true },
        }),
        prisma.tenantModuleOverride.findMany({
          where: { tenantId },
          include: { module: true },
        }),
      ])

      const result = new Map<string, EffectiveModule>()

      for (const pm of planModules) {
        result.set(pm.moduleId, { ...toModule(pm.module), effectiveUrl: pm.module.defaultUrl, source: 'plan' })
      }

      for (const ov of overrides) {
        if (!ov.module.active) continue
        if (ov.enabled) {
          result.set(ov.moduleId, { ...toModule(ov.module), effectiveUrl: ov.module.defaultUrl, source: 'override' })
        } else {
          result.delete(ov.moduleId)
        }
      }

      return Array.from(result.values())
    },

    async create(data) {
      const row = await prisma.module.create({ data })
      return toModule(row)
    },

    async update(id, data) {
      const row = await prisma.module.update({ where: { id }, data })
      return toModule(row)
    },

    async delete(id) {
      await prisma.module.delete({ where: { id } })
    },

    async setPlanModules(planId, moduleIds) {
      await prisma.$transaction([
        prisma.planModule.deleteMany({ where: { planId } }),
        prisma.planModule.createMany({
          data: moduleIds.map(moduleId => ({ planId, moduleId })),
        }),
      ])
    },

    async upsertTenantOverride(tenantId, moduleId, enabled, createdBy, reason) {
      await prisma.tenantModuleOverride.upsert({
        where: { tenantId_moduleId: { tenantId, moduleId } },
        create: { tenantId, moduleId, enabled, createdBy: createdBy ?? null, reason: reason ?? null },
        update: { enabled, reason: reason ?? null },
      })
    },

    async deleteTenantOverride(tenantId, moduleId) {
      await prisma.tenantModuleOverride.delete({
        where: { tenantId_moduleId: { tenantId, moduleId } },
      })
    },
  }
}

function toModule(row: { id: string; name: string; description: string | null; defaultUrl: string; active: boolean }): Module {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    defaultUrl: row.defaultUrl,
    active: row.active,
  }
}
