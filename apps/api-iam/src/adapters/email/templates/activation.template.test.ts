import { describe, it, expect } from 'vitest'
import { activationTemplate } from './activation.template.js'

describe('activationTemplate', () => {
  it('returns correct subject', () => {
    const { subject } = activationTemplate({
      tenantName: 'Acme Corp',
      activationUrl: 'https://app.corehub.com/first-login?token=abc',
    })

    expect(subject).toBe('Tu empresa ha sido activada')
  })

  it('includes tenant name in html', () => {
    const { html } = activationTemplate({
      tenantName: 'Globex Inc',
      activationUrl: 'https://example.com/activate',
    })

    expect(html).toContain('Globex Inc')
  })

  it('includes activation URL in CTA button', () => {
    const { html } = activationTemplate({
      tenantName: 'Acme',
      activationUrl: 'https://app.corehub.com/first-login?token=xyz',
    })

    expect(html).toContain('https://app.corehub.com/first-login?token=xyz')
    expect(html).toContain('background-color:#f59e0b')
  })

  it('does not contain <style> blocks', () => {
    const { html } = activationTemplate({
      tenantName: 'Acme',
      activationUrl: 'https://example.com',
    })

    expect(html).not.toContain('<style')
  })
})
