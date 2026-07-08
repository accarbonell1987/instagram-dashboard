import { describe, it, expect } from 'vitest'
import { otpTemplate } from './otp.template.js'

describe('otpTemplate', () => {
  it('returns correct subject', () => {
    const { subject } = otpTemplate({ code: '123456', expiresInMinutes: 10 })

    expect(subject).toBe('Tu código de verificación')
  })

  it('includes the OTP code in html', () => {
    const { html } = otpTemplate({ code: '654321', expiresInMinutes: 5 })

    expect(html).toContain('654321')
  })

  it('includes expiresInMinutes in html', () => {
    const { html } = otpTemplate({ code: '000000', expiresInMinutes: 15 })

    expect(html).toContain('15')
  })

  it('uses monospace styling for code display', () => {
    const { html } = otpTemplate({ code: '111111', expiresInMinutes: 10 })

    expect(html).toContain('font-family:monospace')
    expect(html).toContain('letter-spacing:8px')
    expect(html).toContain('font-size:32px')
  })

  it('uses muted background for code box', () => {
    const { html } = otpTemplate({ code: '222222', expiresInMinutes: 10 })

    expect(html).toContain('background-color:#f4f4f7')
  })

  it('does not include a CTA button', () => {
    const { html } = otpTemplate({ code: '333333', expiresInMinutes: 10 })

    expect(html).not.toContain('background-color:#f59e0b')
  })

  it('does not contain <style> blocks', () => {
    const { html } = otpTemplate({ code: '444444', expiresInMinutes: 10 })

    expect(html).not.toContain('<style')
  })
})
