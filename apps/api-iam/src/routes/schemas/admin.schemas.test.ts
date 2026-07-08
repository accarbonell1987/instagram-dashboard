import { describe, it, expect } from 'vitest'
import {
  AdminCreatePlanSchema,
  AdminUpdatePlanSchema,
  AdminTenantListQuerySchema,
  AdminTenantStatusChangeSchema,
  AdminPlanSchema,
  AdminTenantListItemSchema,
  AdminTenantDetailSchema,
} from './admin.schemas.js'

// ─── AdminCreatePlanSchema ──────────────────────────────────────────────────────

describe('AdminCreatePlanSchema', () => {
  it('accepts a valid plan creation payload', () => {
    const result = AdminCreatePlanSchema.safeParse({
      name: 'Enterprise Plus',
      description: 'Enterprise tier with premium support',
      price: 299.99,
      currency: 'PYG',
      billingInterval: 'month',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Enterprise Plus')
      expect(result.data.price).toBe(299.99)
      expect(result.data.billingInterval).toBe('month')
    }
  })

  it('rejects empty name', () => {
    const result = AdminCreatePlanSchema.safeParse({
      name: '',
      price: 99,
      currency: 'PYG',
      billingInterval: 'month',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = AdminCreatePlanSchema.safeParse({
      name: 'Negative Plan',
      price: -50,
      currency: 'PYG',
      billingInterval: 'month',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid billing interval', () => {
    const result = AdminCreatePlanSchema.safeParse({
      name: 'Plan',
      price: 99,
      currency: 'PYG',
      billingInterval: 'daily',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = AdminCreatePlanSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })
})

// ─── AdminUpdatePlanSchema ──────────────────────────────────────────────────────

describe('AdminUpdatePlanSchema', () => {
  it('accepts partial update with name only', () => {
    const result = AdminUpdatePlanSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with price only', () => {
    const result = AdminUpdatePlanSchema.safeParse({ price: 149.99 })
    expect(result.success).toBe(true)
  })

  it('accepts empty body (all fields optional)', () => {
    const result = AdminUpdatePlanSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects negative price', () => {
    const result = AdminUpdatePlanSchema.safeParse({ price: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = AdminUpdatePlanSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

// ─── AdminTenantListQuerySchema ─────────────────────────────────────────────────

describe('AdminTenantListQuerySchema', () => {
  it('accepts empty query (all defaults)', () => {
    const result = AdminTenantListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts page and pageSize', () => {
    const result = AdminTenantListQuerySchema.safeParse({ page: '1', pageSize: '10' })
    expect(result.success).toBe(true)
  })

  it('accepts search by name', () => {
    const result = AdminTenantListQuerySchema.safeParse({ search: 'acme' })
    expect(result.success).toBe(true)
  })

  it('accepts status filter', () => {
    const result = AdminTenantListQuerySchema.safeParse({ status: 'active' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status value', () => {
    const result = AdminTenantListQuerySchema.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('coerces page strings to numbers', () => {
    const result = AdminTenantListQuerySchema.safeParse({ page: '3', pageSize: '25' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.pageSize).toBe(25)
    }
  })
})

// ─── AdminTenantStatusChangeSchema ──────────────────────────────────────────────

describe('AdminTenantStatusChangeSchema', () => {
  it('accepts valid status "suspended"', () => {
    const result = AdminTenantStatusChangeSchema.safeParse({ status: 'suspended', reason: 'Payment overdue' })
    expect(result.success).toBe(true)
  })

  it('accepts valid status "active"', () => {
    const result = AdminTenantStatusChangeSchema.safeParse({ status: 'active' })
    expect(result.success).toBe(true)
  })

  it('accepts status "pending"', () => {
    const result = AdminTenantStatusChangeSchema.safeParse({ status: 'pending' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = AdminTenantStatusChangeSchema.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('rejects missing status field', () => {
    const result = AdminTenantStatusChangeSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ─── AdminPlanSchema (response) ─────────────────────────────────────────────────

describe('AdminPlanSchema', () => {
  it('accepts a valid plan response', () => {
    const result = AdminPlanSchema.safeParse({
      id: 'plan-123',
      name: 'Enterprise',
      description: 'Full access',
      price: 299.99,
      currency: 'PYG',
      billingInterval: 'month',
      active: true,
      tenantCount: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing active field', () => {
    const result = AdminPlanSchema.safeParse({
      id: 'plan-123',
      name: 'Enterprise',
      price: 299.99,
      currency: 'PYG',
      billingInterval: 'month',
      tenantCount: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

// ─── AdminTenantListItemSchema ──────────────────────────────────────────────────

describe('AdminTenantListItemSchema', () => {
  it('accepts a valid tenant list item', () => {
    const result = AdminTenantListItemSchema.safeParse({
      id: 'tenant-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      status: 'active',
      planId: 'plan-1',
      planName: 'Enterprise',
      userCount: 42,
      createdAt: '2026-01-15T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

// ─── AdminTenantDetailSchema ────────────────────────────────────────────────────

describe('AdminTenantDetailSchema', () => {
  it('accepts a valid tenant detail response', () => {
    const result = AdminTenantDetailSchema.safeParse({
      id: 'tenant-1',
      name: 'Acme Corp',
      slug: 'acme-corp',
      status: 'active',
      plan: {
        id: 'plan-1',
        name: 'Enterprise',
        price: 299.99,
        currency: 'PYG',
        billingInterval: 'month',
      },
      userCount: 42,
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})
