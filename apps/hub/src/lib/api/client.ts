import { getAccessToken, isExpired } from '../../modules/iam/identity/session/token';

import { ApiError, AuthError, ConflictError, ForbiddenError, RateLimitError, ValidationError } from './errors';
import type { ProblemDetail, ValidationErrorDetail } from './errors';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function getBaseUrl(): string {
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers: extraHeaders = {}, idempotencyKey, signal } = options;

  const headers: Record<string, string> = { ...extraHeaders };

  const token = getAccessToken();
  if (token !== null && !isExpired(token)) {
    headers['Authorization'] = `Bearer ${token.raw}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const init: RequestInit = { method, headers, credentials: 'include' };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal !== undefined) init.signal = signal;

  const response = await fetch(`${getBaseUrl()}${path}`, init);

  if (response.ok) {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (
      contentType.includes('application/json') ||
      contentType.includes('application/problem+json')
    ) {
      return response.json() as Promise<T>;
    }
    return undefined as unknown as T;
  }

  return throwTypedError(response, path);
}

async function throwTypedError(response: Response, endpoint: string): Promise<never> {
  const contentType = response.headers.get('Content-Type') ?? '';
  const isProblemJson =
    contentType.includes('application/problem+json') || contentType.includes('application/json');

  let problem: ProblemDetail | undefined;
  let traceId: string | undefined;

  if (isProblemJson) {
    try {
      problem = (await response.json()) as ProblemDetail;
      if (typeof problem['traceId'] === 'string') traceId = problem['traceId'];
    } catch {
      // ignore parse errors
    }
  }

  const message = problem?.title ?? response.statusText;

  if (response.status === 401) {
    throw new AuthError(message, endpoint, 'session_expired', undefined, problem, traceId);
  }

  if (response.status === 403) {
    const code = typeof problem?.['code'] === 'string' ? problem['code'] : undefined;
    throw new ForbiddenError(message, endpoint, code, undefined, problem, traceId);
  }

  if (response.status === 409) {
    throw new ConflictError(message, endpoint, undefined, problem, traceId);
  }

  if (response.status === 422) {
    const errors: ValidationErrorDetail[] =
      problem !== undefined && Array.isArray(problem['errors'])
        ? (problem['errors'] as ValidationErrorDetail[])
        : [];
    throw new ValidationError(message, endpoint, errors, undefined, problem, traceId);
  }

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After') ?? '60';
    throw RateLimitError.fromRetryAfterHeader(
      message,
      endpoint,
      retryAfterHeader,
      undefined,
      problem,
      traceId
    );
  }

  throw new ApiError(message, response.status, null, endpoint, undefined, problem, traceId);
}
