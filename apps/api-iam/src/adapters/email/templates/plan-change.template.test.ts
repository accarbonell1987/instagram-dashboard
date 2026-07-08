import { describe, it, expect } from 'vitest'
import { planChangeTemplate } from './plan-change.template.js'

const defaultParams = {
  tenantName: 'Acme Corp',
  tenantSlug: 'acme-corp',
  fromPlanId: 'starter',
  toPlanId: 'pro',
  requesterEmail: 'admin@acme.com',
}

describe('planChangeTemplate', () => {
  it('returns the correct Spanish subject', () => {
    const { subject } = planChangeTemplate(defaultParams)

    expect(subject).toBe('Solicitud de cambio de plan')
  })

  it('includes tenantName in html', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('Acme Corp')
  })

  it('includes tenantSlug in html', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('acme-corp')
  })

  it('includes fromPlanId in html', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('starter')
  })

  it('includes toPlanId in html', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('pro')
  })

  it('includes requesterEmail in html', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('admin@acme.com')
  })

  it('does NOT contain English text "plan change"', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html.toLowerCase()).not.toContain('plan change')
  })

  it('does NOT contain English text "submitted"', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html.toLowerCase()).not.toContain('submitted')
  })

  it('does NOT contain English text "request" (standalone English word)', () => {
    const { subject, html } = planChangeTemplate(defaultParams)

    // subject and html should use Spanish copy exclusively
    expect(subject).not.toMatch(/\brequest\b/i)
    expect(html).not.toMatch(/\brequest\b/i)
  })

  it('contains brand header color #18181b', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).toContain('#18181b')
  })

  it('does not contain <style> blocks', () => {
    const { html } = planChangeTemplate(defaultParams)

    expect(html).not.toContain('<style')
  })

  it('all params appear in html for a different tenant', () => {
    const params = {
      tenantName: 'Globex Inc',
      tenantSlug: 'globex-inc',
      fromPlanId: 'basic',
      toPlanId: 'enterprise',
      requesterEmail: 'ceo@globex.com',
    }
    const { html } = planChangeTemplate(params)

    expect(html).toContain('Globex Inc')
    expect(html).toContain('globex-inc')
    expect(html).toContain('basic')
    expect(html).toContain('enterprise')
    expect(html).toContain('ceo@globex.com')
  })
})
