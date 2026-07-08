import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AuthError, ForbiddenError, ConflictError } from '@/lib/api/errors'
import { server } from '@/lib/mocks/server'
import {
  listModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
} from './module-admin.service'

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080'

describe('module-admin.service — listModules', () => {
  it('returns list of modules from GET /admin/modules', async () => {
    const mockModules = [
      { id: 'billing', name: 'Billing', description: 'Billing module', defaultUrl: '/billing', active: true },
      { id: 'reports', name: 'Reports', description: 'Reports module', defaultUrl: '/reports', active: true },
    ]
    server.use(
      http.get(`${BASE}/admin/modules`, () =>
        HttpResponse.json({ modules: mockModules }, { status: 200 })
      )
    )
    const result = await listModules()
    expect(result.modules).toHaveLength(2)
    expect(result.modules[0]!['id']).toBe('billing')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/admin/modules`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Unauthorized', status: 401 }, { status: 401, headers: { 'Content-Type': 'application/problem+json' } })
      )
    )
    await expect(listModules()).rejects.toBeInstanceOf(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/admin/modules`, () =>
        HttpResponse.json({ type: 'about:blank', title: 'Forbidden', status: 403 }, { status: 403, headers: { 'Content-Type': 'application/problem+json' } })
      )
    )
    await expect(listModules()).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('module-admin.service — getModule', () => {
  it('returns a single module by id', async () => {
    const mockModule = { id: 'billing', name: 'Billing', description: 'desc', defaultUrl: '/billing', active: true }
    server.use(
      http.get(`${BASE}/admin/modules/:id`, ({ params }) => {
        expect(params['id']).toBe('billing')
        return HttpResponse.json(mockModule, { status: 200 })
      })
    )
    const result = await getModule('billing')
    expect(result['id']).toBe('billing')
    expect(result.name).toBe('Billing')
  })
})

describe('module-admin.service — createModule', () => {
  it('creates a module via POST /admin/modules', async () => {
    const mockModule = { id: 'new-mod', name: 'New Module', description: 'desc', defaultUrl: '/new', active: true }
    let capturedBody: any = null
    server.use(
      http.post(`${BASE}/admin/modules`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(mockModule, { status: 201 })
      })
    )
    const result = await createModule({ id: 'new-mod', name: 'New Module', defaultUrl: '/new' })
    expect(result['id']).toBe('new-mod')
    expect(capturedBody['id']).toBe('new-mod')
    expect(capturedBody.name).toBe('New Module')
  })
})

describe('module-admin.service — updateModule', () => {
  it('updates a module via PATCH /admin/modules/:id', async () => {
    const mockModule = { id: 'billing', name: 'Updated', description: undefined, defaultUrl: '/billing', active: true }
    let capturedBody: any = null
    server.use(
      http.patch(`${BASE}/admin/modules/:id`, async ({ request, params }) => {
        capturedBody = await request.json()
        expect(params['id']).toBe('billing')
        return HttpResponse.json(mockModule, { status: 200 })
      })
    )
    const result = await updateModule('billing', { name: 'Updated' })
    expect(result.name).toBe('Updated')
    expect(capturedBody.name).toBe('Updated')
  })
})

describe('module-admin.service — deleteModule', () => {
  it('deletes a module via DELETE /admin/modules/:id', async () => {
    server.use(
      http.delete(`${BASE}/admin/modules/:id`, ({ params }) => {
        expect(params['id']).toBe('billing')
        return new HttpResponse(null, { status: 204 })
      })
    )
    await expect(deleteModule('billing')).resolves.toBeUndefined()
  })
})
