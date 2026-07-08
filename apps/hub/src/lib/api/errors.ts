import { ServiceError } from '@core/core/errors';

export type { ServiceError };

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export type AuthErrorReason =
  | 'invalid_credentials'
  | 'account_locked'
  | 'session_expired'
  | 'tenant_mismatch';

export class ApiError extends ServiceError {
  constructor(
    message: string,
    status: number,
    code: string | null,
    endpoint: string,
    originalError?: unknown,
    public readonly problem?: ProblemDetail,
    public readonly traceId?: string
  ) {
    super(message, status, code, endpoint, originalError);
  }
}

export interface ValidationErrorDetail {
  field: string;
  code: string;
  message: string;
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    endpoint: string,
    public readonly errors: ValidationErrorDetail[],
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ) {
    super(message, 422, 'VALIDATION_ERROR', endpoint, originalError, problem, traceId);
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message: string,
    endpoint: string,
    public readonly retryAfterSeconds: number,
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', endpoint, originalError, problem, traceId);
  }

  static fromRetryAfterHeader(
    message: string,
    endpoint: string,
    retryAfterHeader: string,
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ): RateLimitError {
    const seconds = parseRetryAfter(retryAfterHeader);
    return new RateLimitError(message, endpoint, seconds, originalError, problem, traceId);
  }
}

export class AuthError extends ApiError {
  constructor(
    message: string,
    endpoint: string,
    public readonly reason: AuthErrorReason,
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ) {
    super(message, 401, 'UNAUTHORIZED', endpoint, originalError, problem, traceId);
  }
}

export class ForbiddenError extends ApiError {
  constructor(
    message: string,
    endpoint: string,
    code?: string,
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ) {
    super(message, 403, code ?? 'FORBIDDEN', endpoint, originalError, problem, traceId);
  }
}

export class ConflictError extends ApiError {
  public readonly backendCode: string | undefined;

  constructor(
    message: string,
    endpoint: string,
    originalError?: unknown,
    problem?: ProblemDetail,
    traceId?: string
  ) {
    const code =
      typeof problem?.['code'] === 'string' ? problem['code'] : 'CONFLICT';
    super(message, 409, code, endpoint, originalError, problem, traceId);
    this.backendCode = code !== 'CONFLICT' ? code : undefined;
  }
}

function parseRetryAfter(header: string): number {
  const numeric = Number(header);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, Math.round((date.getTime() - Date.now()) / 1000));
  }
  return 0;
}
