import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AuthError, ForbiddenError } from '@/lib/api/errors'
import { server } from '@/lib/mocks/server'
import {
  listTenants,
  getTenant,
  changeTenantStatus,
} from './tenant-admin.service'

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080'

function makeTenantItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'active',
    planId: 'plan-1',
    planName: 'Enterprise',
    userCount: 42,
    createdAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

function makeTenantDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'active',
    plan: { id: 'plan-1', name: 'Enterprise', price: 299.99, currency: 'PYG', billingInterval: 'month' },
    userCount: 42,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('tenant-admin.service — listTenants', () => {
  it('returns paginated tenant list from GET /admin/tenants', async () => {
    server.use(
      http.get(`${BASE}/admin/tenants`, () =>
        HttpResponse.json(
          { items: [makeTenantItem(), makeTenantItem({ id: 'tenant-2', name: 'Beta' })], total: 2, page: 1, pageSize: 20 },
          { status: 200 }
        )
      )
    )
    const result = await listTenants()
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('sends page and pageSize query params', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/admin/tenants`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ items: [], total: 0, page: 2, pageSize: 10 }, { status: 200 })
      })
    )
    await listTenants({ page: 2, pageSize: 10 })
    expect(capturedUrl).toContain('page=2')
    expect(capturedUrl).toContain('pageSize=10')
  })

  it('sends search query param', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/admin/tenants`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }, { status: 200 })
      })
    )
    await listTenants({ search: 'acme' })
    expect(capturedUrl).toContain('search=acme')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/admin/tenants`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      )
    )
    await expect(listTenants()).rejects.toBeInstanceOf(AuthError)
  })
})

describe('tenant-admin.service — getTenant', () => {
  it('returns tenant detail from GET /admin/tenants/:id', async () => {
    server.use(
      http.get(`${BASE}/admin/tenants/:id`, ({ params }) => {
        expect(params['id']).toBe('tenant-1')
        return HttpResponse.json(makeTenantDetail(), { status: 200 })
      })
    )
    const result = await getTenant('tenant-1')
    expect(result.name).toBe('Acme Corp')
    expect(result.plan.name).toBe('Enterprise')
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/admin/tenants/tenant-1`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Forbidden', status: 403 }, { status: 403, headers: { 'Content-Type': 'application/problem+json' } })
      )
    )
    await expect(getTenant('tenant-1')).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('tenant-admin.service — changeTenantStatus', () => {
  it('changes tenant status via PATCH /admin/tenants/:id/status', async () => {
    let capturedBody: any = null
    server.use(
      http.patch(`${BASE}/admin/tenants/:id/status`, async ({ request, params }) => {
        capturedBody = await request.json()
        expect(params['id']).toBe('tenant-1')
        return HttpResponse.json({ id: 'tenant-1', status: 'suspended' }, { status: 200 })
      })
    )
    const result = await changeTenantStatus('tenant-1', 'suspended')
    expect(result.status).toBe('suspended')
    expect(capturedBody.status).toBe('suspended')
  })
})
