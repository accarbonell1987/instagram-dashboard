import { HttpResponse } from 'msw';

const BASE_URL = 'https://corehub.com/errors';

type ProblemBody = Record<string, unknown>;

export function problem(
  status: number,
  code: string,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
): HttpResponse<ProblemBody> {
  const body: ProblemBody = {
    type: `${BASE_URL}/${code}`,
    title,
    status,
    ...(detail !== undefined ? { detail } : {}),
    ...(extra ?? {}),
  };
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export const unauthorized = (detail = 'Unauthorized'): HttpResponse<ProblemBody> =>
  problem(401, 'unauthorized', 'Unauthorized', detail);

export const forbidden = (): HttpResponse<ProblemBody> =>
  problem(403, 'forbidden', 'Forbidden');

export const notFound = (detail = 'Not found'): HttpResponse<ProblemBody> =>
  problem(404, 'not-found', 'Not Found', detail);

export const conflict = (detail = 'Conflict'): HttpResponse<ProblemBody> =>
  problem(409, 'conflict', 'Conflict', detail);

export const gone = (detail = 'Resource expired'): HttpResponse<ProblemBody> =>
  problem(410, 'gone', 'Gone', detail);

export const unprocessable = (detail = 'Validation failed', errors?: unknown[]): HttpResponse<ProblemBody> =>
  problem(422, 'validation', 'Validation failed', detail, errors !== undefined ? { errors } : {});

export const tooManyRequests = (retryAfter = 60): HttpResponse<ProblemBody> =>
  problem(429, 'rate-limited', 'Too Many Requests', 'Rate limit exceeded', { retryAfter });
