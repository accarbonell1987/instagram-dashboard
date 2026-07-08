import { describe, it, expect } from 'vitest'
import { passwordRecoveryTemplate } from './password-recovery.template.js'

describe('passwordRecoveryTemplate', () => {
  it('returns correct Spanish subject', () => {
    const { subject } = passwordRecoveryTemplate({
      resetUrl: 'https://example.com/reset',
      expiresInMinutes: 30,
    })

    expect(subject).toBe('Restablecer tu contraseña')
  })

  it('includes reset URL in CTA button', () => {
    const { html } = passwordRecoveryTemplate({
      resetUrl: 'https://app.corehub.com/auth/password/recover?token=tok',
      expiresInMinutes: 30,
    })

    expect(html).toContain('https://app.corehub.com/auth/password/recover?token=tok')
    expect(html).toContain('background-color:#f59e0b')
  })

  it('includes expiry notice in Spanish', () => {
    const { html } = passwordRecoveryTemplate({
      resetUrl: 'https://example.com/reset',
      expiresInMinutes: 30,
    })

    expect(html).toContain('30')
    expect(html).toContain('minutos')
  })

  it('includes "Si no solicitaste esto" ignore notice', () => {
    const { html } = passwordRecoveryTemplate({
      resetUrl: 'https://example.com/reset',
      expiresInMinutes: 30,
    })

    expect(html).toContain('Si no solicitaste')
  })

  it('does NOT contain English text (language bug fix)', () => {
    const { html, subject } = passwordRecoveryTemplate({
      resetUrl: 'https://example.com/reset',
      expiresInMinutes: 30,
    })

    expect(html).not.toContain('Password Recovery')
    expect(html).not.toContain('Click here')
    expect(html).not.toContain('reset your password')
    expect(subject).not.toContain('Password Recovery')
  })

  it('does not contain <style> blocks', () => {
    const { html } = passwordRecoveryTemplate({
      resetUrl: 'https://example.com/reset',
      expiresInMinutes: 15,
    })

    expect(html).not.toContain('<style')
  })
})
