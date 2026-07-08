import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AuthError, ForbiddenError, ConflictError } from '@/lib/api/errors'
import { server } from '@/lib/mocks/server'
import {
  listPlans,
  createPlan,
  updatePlan,
  archivePlan,
  savePlanQuotas,
  getPlanQuotas,
} from './plan-admin.service'

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080'

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    name: 'Enterprise',
    description: 'Enterprise plan',
    price: 299.99,
    currency: 'PYG',
    billingInterval: 'month',
    active: true,
    tenantCount: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('plan-admin.service — listPlans', () => {
  it('returns plans from GET /admin/plans', async () => {
    server.use(
      http.get(`${BASE}/admin/plans`, () =>
        HttpResponse.json({ plans: [makePlan(), makePlan({ id: 'plan-2', name: 'Starter' })] }, { status: 200 })
      )
    )
    const result = await listPlans()
    expect(result.plans).toHaveLength(2)
    expect(result.plans[0]!.name).toBe('Enterprise')
  })

  it('sends active filter query param', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${BASE}/admin/plans`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ plans: [makePlan()] }, { status: 200 })
      })
    )
    await listPlans({ active: true })
    expect(capturedUrl).toContain('active=true')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/admin/plans`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      )
    )
    await expect(listPlans()).rejects.toBeInstanceOf(AuthError)
  })
})

describe('plan-admin.service — createPlan', () => {
  it('creates a plan via POST /admin/plans', async () => {
    let capturedBody: any = null
    server.use(
      http.post(`${BASE}/admin/plans`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(makePlan({ name: 'New Plan' }), { status: 201 })
      })
    )
    const result = await createPlan({ name: 'New Plan', price: 99, currency: 'PYG', billingInterval: 'month' })
    expect(result.name).toBe('New Plan')
    expect(capturedBody.price).toBe(99)
  })
})

describe('plan-admin.service — updatePlan', () => {
  it('updates a plan via PATCH /admin/plans/:id', async () => {
    let capturedBody: any = null
    server.use(
      http.patch(`${BASE}/admin/plans/:id`, async ({ request, params }) => {
        capturedBody = await request.json()
        expect(params['id']).toBe('plan-1')
        return HttpResponse.json(makePlan({ name: 'Updated' }), { status: 200 })
      })
    )
    const result = await updatePlan('plan-1', { name: 'Updated' })
    expect(result.name).toBe('Updated')
    expect(capturedBody.name).toBe('Updated')
  })
})

describe('plan-admin.service — archivePlan', () => {
  it('archives a plan via DELETE /admin/plans/:id', async () => {
    server.use(
      http.delete(`${BASE}/admin/plans/:id`, ({ params }) => {
        expect(params['id']).toBe('plan-1')
        return HttpResponse.json({ archived: true, planId: 'plan-1' }, { status: 200 })
      })
    )
    await expect(archivePlan('plan-1')).resolves.toBeUndefined()
  })
})

describe('plan-admin.service — savePlanQuotas', () => {
  it('sends PUT with correct URL and quotas body', async () => {
    let capturedUrl = ''
    let capturedBody: any = null
    server.use(
      http.put(`${BASE}/admin/plans/:planId/quotas`, async ({ request, params }) => {
        capturedUrl = request.url
        capturedBody = await request.json()
        expect(params['planId']).toBe('plan-1')
        return HttpResponse.json({ success: true }, { status: 200 })
      })
    )

    await savePlanQuotas('plan-1', [
      { resourceType: 'deepseek_tokens', limit: 100000, period: 'month' },
      { resourceType: 'fal_images', limit: 50, period: 'month' },
    ])

    expect(capturedUrl).toContain('/admin/plans/plan-1/quotas')
    expect(capturedBody).toEqual({
      quotas: [
        { resourceType: 'deepseek_tokens', limit: 100000, period: 'month' },
        { resourceType: 'fal_images', limit: 50, period: 'month' },
      ],
    })
  })

  it('sends empty quotas array', async () => {
    let capturedBody: any = null
    server.use(
      http.put(`${BASE}/admin/plans/:planId/quotas`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true }, { status: 200 })
      })
    )

    await savePlanQuotas('plan-2', [])
    expect(capturedBody).toEqual({ quotas: [] })
  })
})

describe('plan-admin.service — getPlanQuotas', () => {
  it('returns quotas from GET /admin/plans/:planId/quotas', async () => {
    server.use(
      http.get(`${BASE}/admin/plans/:planId/quotas`, ({ params }) => {
        expect(params['planId']).toBe('plan-1')
        return HttpResponse.json({
          quotas: [
            { resourceType: 'deepseek_tokens', limit: 100000, period: 'month' },
            { resourceType: 'fal_images', limit: 50, period: 'month' },
          ],
        }, { status: 200 })
      })
    )

    const result = await getPlanQuotas('plan-1')
    expect(result).toHaveLength(2)
    expect(result[0]!.resourceType).toBe('deepseek_tokens')
    expect(result[0]!.limit).toBe(100000)
    expect(result[1]!.resourceType).toBe('fal_images')
  })

  it('returns empty array when no quotas exist', async () => {
    server.use(
      http.get(`${BASE}/admin/plans/:planId/quotas`, () => {
        return HttpResponse.json({ quotas: [] }, { status: 200 })
      })
    )

    const result = await getPlanQuotas('plan-new')
    expect(result).toEqual([])
  })
})
