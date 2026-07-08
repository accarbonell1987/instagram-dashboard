import { refreshSession } from '../../modules/iam/identity/session/refresh';

import { apiFetch } from './client';
import type { RequestOptions } from './client';
import { AuthError } from './errors';
import { generateIdempotencyKey, resetIdempotencyKey } from './idempotency';


export interface InterceptorOptions extends RequestOptions {
  idempotencyScope?: string;
  resetIdempotency?: boolean;
}

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export async function apiFetchWithInterceptors<T>(
  path: string,
  options: InterceptorOptions = {}
): Promise<T> {
  const { idempotencyScope, resetIdempotency, ...fetchOptions } = options;
  const method = fetchOptions.method ?? 'GET';

  if (resetIdempotency === true && idempotencyScope !== undefined) {
    resetIdempotencyKey(idempotencyScope);
  }

  const enrichedOptions: RequestOptions = { ...fetchOptions };

  if (MUTATING_METHODS.has(method) && enrichedOptions.idempotencyKey === undefined) {
    enrichedOptions.idempotencyKey = generateIdempotencyKey();
  }

  try {
    return await apiFetch<T>(path, enrichedOptions);
  } catch (error) {
    if (error instanceof AuthError) {
      try {
        // Single-flight refresh from the identity module.
        // refreshSession() deduplicates concurrent 401s and updates tokenHolder.
        await refreshSession();
      } catch {
        throw error;
      }
      return apiFetch<T>(path, enrichedOptions);
    }
    throw error;
  }
}
