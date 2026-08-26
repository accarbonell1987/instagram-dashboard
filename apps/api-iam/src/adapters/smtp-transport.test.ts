import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createTransport } = vi.hoisted(() => ({ createTransport: vi.fn((_options: unknown) => ({})) }))
vi.mock('nodemailer', () => ({ default: { createTransport } }))

import { createSmtpTransport } from './smtp-transport.js'

type TransportOptions = { secure?: boolean; auth?: { user: string; pass: string } }

const optionsPassedToNodemailer = (): TransportOptions =>
  (createTransport.mock.calls[0]?.[0] ?? {}) as TransportOptions

describe('createSmtpTransport', () => {
  beforeEach(() => createTransport.mockClear())

  it('cifra desde el saludo en el 465', () => {
    createSmtpTransport({ host: 'smtp.hostinger.com', port: 465 })
    expect(optionsPassedToNodemailer().secure).toBe(true)
  })

  it('deja que el 587 negocie STARTTLS', () => {
    createSmtpTransport({ host: 'smtp.hostinger.com', port: 587 })
    expect(optionsPassedToNodemailer().secure).toBe(false)
  })

  it('autentica cuando hay usuario y contrasena', () => {
    createSmtpTransport({ host: 'smtp.hostinger.com', port: 587, user: 'u@guay.pro', password: 'p' })
    expect(optionsPassedToNodemailer().auth).toEqual({ user: 'u@guay.pro', pass: 'p' })
  })

  // MailDev rechaza el comando AUTH, asi que mandarlo vacio rompe el envio en
  // desarrollo. La ausencia de credenciales tiene que omitir la clave entera.
  it('omite auth sin credenciales', () => {
    createSmtpTransport({ host: 'localhost', port: 1025 })
    expect(optionsPassedToNodemailer()).not.toHaveProperty('auth')
  })

  it('omite auth si falta la contrasena', () => {
    createSmtpTransport({ host: 'smtp.hostinger.com', port: 587, user: 'u@guay.pro' })
    expect(optionsPassedToNodemailer()).not.toHaveProperty('auth')
  })
})
