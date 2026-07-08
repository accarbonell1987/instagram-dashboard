import { describe, it, expect } from 'vitest'
import { planFormSchema } from './plan-schema'

describe('planFormSchema — quota fields', () => {
  it('accepts valid positive integers for quota fields', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan Pro',
      price: 100,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: 100000,
      falImagesLimit: 50,
      chatSessionsLimit: 30,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deepseekTokensLimit).toBe(100000)
      expect(result.data.falImagesLimit).toBe(50)
      expect(result.data.chatSessionsLimit).toBe(30)
    }
  })

  it('accepts zero for quota fields', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan',
      price: 0,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: 0,
      falImagesLimit: 0,
      chatSessionsLimit: 0,
    })
    expect(result.success).toBe(true)
  })

  it('allows quota fields to be undefined (backward compat)', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan Legacy',
      price: 50,
      currency: 'PYG',
      billingInterval: 'year',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deepseekTokensLimit).toBeUndefined()
      expect(result.data.falImagesLimit).toBeUndefined()
      expect(result.data.chatSessionsLimit).toBeUndefined()
    }
  })

  it('rejects negative numbers for deepseekTokensLimit', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan',
      price: 10,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative numbers for falImagesLimit', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan',
      price: 10,
      currency: 'PYG',
      billingInterval: 'month',
      falImagesLimit: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative numbers for chatSessionsLimit', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan',
      price: 10,
      currency: 'PYG',
      billingInterval: 'month',
      chatSessionsLimit: -3,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer values for quota fields', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan',
      price: 10,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: 10.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts only some quota fields set', () => {
    const result = planFormSchema.safeParse({
      name: 'Plan Partial',
      price: 20,
      currency: 'PYG',
      billingInterval: 'month',
      deepseekTokensLimit: 5000,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.deepseekTokensLimit).toBe(5000)
      expect(result.data.falImagesLimit).toBeUndefined()
      expect(result.data.chatSessionsLimit).toBeUndefined()
    }
  })
})
