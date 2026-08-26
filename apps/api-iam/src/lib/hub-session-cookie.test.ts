import { describe, it, expect, vi, beforeEach } from 'vitest'

const { setCookie, deleteCookie } = vi.hoisted(() => ({
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}))
vi.mock('hono/cookie', () => ({ setCookie, deleteCookie }))

import type { Config } from '../config.js'
import { setHubSessionCookie, deleteHubSessionCookie } from './hub-session-cookie.js'

const ctx = {} as Parameters<typeof setHubSessionCookie>[0]
const configWith = (domain?: string) =>
  ({ JWT_REFRESH_TOKEN_TTL_SECONDS: 604800, COOKIE_DOMAIN: domain }) as Config

const setOptions = () => setCookie.mock.calls[0]?.[3] as Record<string, unknown>
const deleteOptions = () => deleteCookie.mock.calls[0]?.[2] as Record<string, unknown>

describe('hub_session cookie', () => {
  beforeEach(() => {
    setCookie.mockClear()
    deleteCookie.mockClear()
  })

  it('lleva el dominio padre cuando esta configurado', () => {
    setHubSessionCookie(ctx, configWith('.corehub.guay.pro'))
    expect(setOptions()['domain']).toBe('.corehub.guay.pro')
  })

  // Sin COOKIE_DOMAIN la clave no debe existir: mandar `domain: undefined` no es
  // lo mismo que omitirla, y en localhost el atributo sobra.
  it('omite la clave domain entera cuando no hay dominio', () => {
    setHubSessionCookie(ctx, configWith(undefined))
    expect(setOptions()).not.toHaveProperty('domain')
  })

  it('sigue siendo legible por el middleware: no httpOnly, path raiz', () => {
    setHubSessionCookie(ctx, configWith('.corehub.guay.pro'))
    expect(setOptions()['httpOnly']).toBe(false)
    expect(setOptions()['path']).toBe('/')
  })

  // Un borrado sin el mismo domain no encuentra la cookie que se puso: el
  // logout dejaria la marca de sesion viva y el middleware seguiria dejando pasar.
  it('el borrado repite el dominio', () => {
    deleteHubSessionCookie(ctx, configWith('.corehub.guay.pro'))
    expect(deleteOptions()['domain']).toBe('.corehub.guay.pro')
  })

  it('el borrado omite domain cuando no hay dominio', () => {
    deleteHubSessionCookie(ctx, configWith(undefined))
    expect(deleteOptions()).not.toHaveProperty('domain')
  })
})
