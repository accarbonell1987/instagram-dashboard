import { HttpResponse } from 'msw';

/**
 * Module-level idempotency cache.
 * Stores (key → { status, body }) to replay on duplicate requests.
 * Cleared by resetDb() via clearIdempotencyCache().
 */
const cache = new Map<string, { status: number; body: Record<string, unknown> }>();

export function clearIdempotencyCache(): void {
  cache.clear();
}

export function getCachedIdempotent(key: string): HttpResponse<Record<string, unknown>> | null {
  const hit = cache.get(key);
  if (hit === undefined) return null;
  return HttpResponse.json(hit.body, { status: hit.status });
}

export function putIdempotentCache(key: string, status: number, body: unknown): void {
  cache.set(key, { status, body: body as Record<string, unknown> });
}

/**
 * Wrap a handler with idempotency caching.
 * The compute function must return a JSON-serializable object (not a Response).
 * The request body must already have been consumed by the caller if needed.
 * Only reads the Idempotency-Key header from the request.
 */
export async function idempotentResponse(
  request: Request,
  defaultStatus: number,
  compute: () => Promise<Record<string, unknown>> | Record<string, unknown>,
  headers?: Headers | Record<string, string>,
): Promise<HttpResponse<Record<string, unknown>>> {
  const key = request.headers.get('Idempotency-Key');

  if (key !== null) {
    const cached = getCachedIdempotent(key);
    if (cached !== null) return cached;
  }

  const body = await compute();

  if (key !== null) {
    putIdempotentCache(key, defaultStatus, body);
  }

  return HttpResponse.json(body, {
    status: defaultStatus,
    ...(headers !== undefined ? { headers } : {}),
  });
}
