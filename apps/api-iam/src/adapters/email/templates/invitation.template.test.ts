import { describe, it, expect } from 'vitest'
import { invitationTemplate } from './invitation.template.js'

describe('invitationTemplate', () => {
  it('returns subject with tenant name', () => {
    const { subject } = invitationTemplate({
      tenantName: 'Acme Corp',
      inviteUrl: 'https://app.corehub.com/invite/abc123',
    })

    expect(subject).toBe('Te han invitado a Acme Corp')
  })

  it('includes tenant name prominently in html', () => {
    const { html } = invitationTemplate({
      tenantName: 'Globex Inc',
      inviteUrl: 'https://app.corehub.com/invite/xyz',
    })

    expect(html).toContain('Globex Inc')
  })

  it('includes CTA button with invite URL', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://app.corehub.com/invite/tok123',
    })

    expect(html).toContain('https://app.corehub.com/invite/tok123')
    expect(html).toContain('background-color:#f59e0b')
  })

  it('shows expiry text when expiresInDays is provided', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
      expiresInDays: 7,
    })

    expect(html).toContain('7')
  })

  it('does NOT show expiry text when expiresInDays is undefined', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
    })

    // No expiry days number referenced in a "días" context
    expect(html).not.toMatch(/\d+ días/)
  })

  it('uses fallback "Un administrador" when inviterName is undefined', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
    })

    expect(html).toContain('Un administrador')
  })

  it('shows inviterName when provided', () => {
    const { html } = invitationTemplate({
      inviterName: 'María García',
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
    })

    expect(html).toContain('María García')
  })

  it('includes ignore notice', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
    })

    expect(html).toContain('ignorar este correo')
  })

  it('does not contain <style> blocks', () => {
    const { html } = invitationTemplate({
      tenantName: 'Acme',
      inviteUrl: 'https://example.com',
    })

    expect(html).not.toContain('<style')
  })
})
