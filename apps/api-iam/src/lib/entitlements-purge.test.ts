import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { purgeAnalyticsEntitlementsCache } from './entitlements-purge.js'

describe('purgeAnalyticsEntitlementsCache', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env['ANALYTICS_INTERNAL_URL']
  })

  it('POSTs tenantId/productId to the analytics purge endpoint', () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: true })

    purgeAnalyticsEntitlementsCache('tenant-1', 'instagram-dashboard')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/internal/entitlements/purge',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1', productId: 'instagram-dashboard' }),
      }),
    )
  })

  it('uses ANALYTICS_INTERNAL_URL when set', () => {
    process.env['ANALYTICS_INTERNAL_URL'] = 'http://analytics.internal'
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce({ ok: true })

    purgeAnalyticsEntitlementsCache('tenant-1', 'instagram-dashboard')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://analytics.internal/internal/entitlements/purge',
      expect.anything(),
    )
  })

  it('does not throw when the fetch rejects (fire-and-forget)', () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    expect(() => purgeAnalyticsEntitlementsCache('tenant-1', 'instagram-dashboard')).not.toThrow()
  })
})
