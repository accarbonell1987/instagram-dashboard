import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { createInternalRouter } from './index.js'
import { requestId } from '../../middleware/request-id.js'
import { createErrorHandler } from '../../middleware/error-handler.js'
import { silentLogger } from '../../test-helpers/logger.js'
import type { ModuleService } from '../../services/index.js'

type JsonBody = Record<string, unknown>

function makeModuleService(overrides: Partial<ModuleService> = {}): ModuleService {
  return {
    getEffectiveModulesForTenant: vi.fn(),
    getEffectiveModulesForTenantAndProduct: vi.fn().mockResolvedValue([]),
    listAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setPlanModules: vi.fn(),
    upsertTenantOverride: vi.fn(),
    removeTenantOverride: vi.fn(),
    ...overrides,
  } as unknown as ModuleService
}

function makePrisma(tenant: { id: string } | null = { id: 'tenant-1' }) {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
    },
  }
}

function buildApp(prisma: ReturnType<typeof makePrisma>, moduleService: ModuleService) {
  const app = new Hono()
  app.use('*', requestId)
  app.route('/', createInternalRouter(prisma as never, moduleService))
  app.onError(createErrorHandler(silentLogger))
  return app
}

// 3.2/3.4: internal endpoint the future entitlement middleware (a4) calls.
describe('GET /internal/tenants/:tenantId/entitlements', () => {
  it('returns 422 when productId is missing', async () => {
    const app = buildApp(makePrisma(), makeModuleService())

    const response = await app.request('/internal/tenants/tenant-1/entitlements')

    expect(response.status).toBe(422)
  })

  it('returns 404 when the tenant does not exist', async () => {
    const app = buildApp(makePrisma(null), makeModuleService())

    const response = await app.request('/internal/tenants/tenant-1/entitlements?productId=instagram-dashboard')

    expect(response.status).toBe(404)
  })

  it('returns allowed:true and the source when moduleId is granted', async () => {
    const moduleService = makeModuleService({
      getEffectiveModulesForTenantAndProduct: vi.fn().mockResolvedValue([
        { id: 'growth-agent', name: 'Growth Agent', defaultUrl: 'x', active: true, effectiveUrl: 'x', source: 'trial' },
      ]),
    })
    const app = buildApp(makePrisma(), moduleService)

    const response = await app.request(
      '/internal/tenants/tenant-1/entitlements?productId=instagram-dashboard&moduleId=growth-agent',
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['allowed']).toBe(true)
    expect(body['source']).toBe('trial')
    expect(moduleService.getEffectiveModulesForTenantAndProduct).toHaveBeenCalledWith('tenant-1', 'instagram-dashboard')
  })

  it('returns allowed:false when moduleId is not among the effective modules (deny by default)', async () => {
    const app = buildApp(makePrisma(), makeModuleService())

    const response = await app.request(
      '/internal/tenants/tenant-1/entitlements?productId=instagram-dashboard&moduleId=growth-agent',
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['allowed']).toBe(false)
  })

  it('returns the full effective-modules list when moduleId is omitted', async () => {
    const moduleService = makeModuleService({
      getEffectiveModulesForTenantAndProduct: vi.fn().mockResolvedValue([
        { id: 'mod-a', name: 'A', defaultUrl: 'x', active: true, effectiveUrl: 'x', source: 'plan' },
      ]),
    })
    const app = buildApp(makePrisma(), moduleService)

    const response = await app.request('/internal/tenants/tenant-1/entitlements?productId=instagram-dashboard')

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect(body['allowed']).toBe(true)
    expect(body['modules']).toEqual([{ id: 'mod-a', source: 'plan' }])
  })
})

// 3.3/3.4: cache purge hook, mirrors the /internal/quotas/purge network-
// protected style already used between api-iam and the analytics product API.
describe('POST /internal/entitlements/purge', () => {
  it('returns 200 with purged:true', async () => {
    const app = buildApp(makePrisma(), makeModuleService())

    const response = await app.request('/internal/entitlements/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-1', productId: 'instagram-dashboard' }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as JsonBody
    expect((body['data'] as JsonBody)['purged']).toBe(true)
  })

  it('returns 200 even with an empty body (fire-and-forget callers)', async () => {
    const app = buildApp(makePrisma(), makeModuleService())

    const response = await app.request('/internal/entitlements/purge', { method: 'POST' })

    expect(response.status).toBe(200)
  })
})
