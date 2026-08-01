/**
 * Fire-and-forget cache-purge fan-out to the product API's entitlement
 * guard (packages/entitlements, mounted by api-instagram-analytics).
 *
 * Purge-direction correction (owner-resolved, a4): the entitlement cache
 * lives in the guard, so the purge route lives there too — api-iam is the
 * CALLER, mirroring the existing /internal/quotas/purge fan-out
 * (see routes/admin/plans.ts).
 */
export function purgeAnalyticsEntitlementsCache(tenantId: string, productId: string): void {
  const analyticsUrl = process.env['ANALYTICS_INTERNAL_URL'] ?? 'http://localhost:3003'
  fetch(`${analyticsUrl}/internal/entitlements/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, productId }),
  }).catch(() => {
    // Fire-and-forget — failure is non-critical
  })
}
