import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { requestId } from './request-id.js'

function buildApp() {
  const app = new Hono()
  app.use('*', requestId)
  app.get('/test', (c) => c.json({ requestId: c.var.requestId }))
  return app
}

describe('requestId middleware', () => {
  it('generates a UUID and echoes it in the response header when no X-Request-Id is sent', async () => {
    const app = buildApp()
    const response = await app.request('/test')
    const responseId = response.headers.get('X-Request-Id')
    expect(responseId).toBeTruthy()
    expect(responseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('propagates the provided X-Request-Id header value unchanged', async () => {
    const app = buildApp()
    const provided = 'my-custom-request-id-123'
    const response = await app.request('/test', {
      headers: { 'X-Request-Id': provided },
    })
    expect(response.headers.get('X-Request-Id')).toBe(provided)
  })

  it('sets requestId on the context', async () => {
    const app = buildApp()
    const provided = 'ctx-id-abc'
    const response = await app.request('/test', {
      headers: { 'X-Request-Id': provided },
    })
    const body = (await response.json()) as { requestId: string }
    expect(body.requestId).toBe(provided)
  })
})
