export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, 'NOT_FOUND', `${resource} with id '${id}' not found`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ConflictError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(409, 'CONFLICT', `${resource} with ${field} '${value}' already exists`);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
  }
}

// Domain-specific errors
export class InstagramAPIError extends AppError {
  constructor(message: string, details?: unknown) {
    super(502, 'INSTAGRAM_API_ERROR', message, details);
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(
      401,
      'TOKEN_EXPIRED',
      'Instagram access token has expired. Please reconnect your account.',
    );
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(
      429,
      'RATE_LIMITED',
      `Rate limit reached. Retry after ${retryAfterSeconds} seconds.`,
      { retryAfterSeconds },
    );
  }
}

export class AccountNotConnectedError extends AppError {
  constructor() {
    super(404, 'ACCOUNT_NOT_CONNECTED', 'No Instagram account connected for this tenant.');
  }
}

export class InsufficientScopeError extends AppError {
  constructor() {
    super(
      403,
      'INSUFFICIENT_SCOPE',
      'Instagram account requires reconnection to enable publishing. Please reconnect your Instagram account.',
    );
  }
}

export class QuotaExceededError extends AppError {
  constructor(
    resourceType: string,
    limit: number,
    resetsAt: string,
  ) {
    super(
      429,
      'QUOTA_EXCEEDED',
      `Quota exceeded for ${resourceType}. Used: exceeded, limit: ${limit}. Resets at ${resetsAt}.`,
      { resourceType, used: limit, limit, resetsAt },
    );
  }
}
