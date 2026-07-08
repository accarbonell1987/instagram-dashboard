export abstract class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: string,
    public readonly meta?: Record<string, unknown>
  ) {
    super(detail ?? code)
    this.name = this.constructor.name
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, detail?: string, meta?: Record<string, unknown>) {
    super(code, 401, detail, meta)
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, detail?: string, meta?: Record<string, unknown>) {
    super(code, 403, detail, meta)
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, detail?: string) {
    super(code, 404, detail)
  }
}

export class ConflictError extends AppError {
  constructor(code: string, detail?: string, meta?: Record<string, unknown>) {
    super(code, 409, detail, meta)
  }
}

export class GoneError extends AppError {
  constructor(code: string, detail?: string) {
    super(code, 410, detail)
  }
}

export class ValidationError extends AppError {
  constructor(
    code: string,
    detail?: string,
    public readonly errors?: Array<{ field: string; code: string; message: string }>
  ) {
    super(code, 422, detail)
  }
}

export class RateLimitError extends AppError {
  constructor(code: string, retryAfterSeconds: number, detail?: string) {
    super(code, 429, detail, { retryAfter: retryAfterSeconds })
  }
}

export class InternalError extends AppError {
  constructor(code: string, detail?: string) {
    super(code, 500, detail)
  }
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  instance: string
  code: string
  [key: string]: unknown
}

export interface ValidationProblemDetails extends ProblemDetails {
  errors: Array<{ field: string; code: string; message: string }>
}

const HTTP_STATUS_TITLES: Record<number, string> = {
  400: 'Solicitud incorrecta',
  401: 'No autorizado',
  403: 'Acceso denegado',
  404: 'No encontrado',
  409: 'Conflicto',
  410: 'Ya no disponible',
  422: 'Datos inválidos',
  429: 'Demasiadas solicitudes',
  500: 'Error interno del servidor',
}

export function toProblemDetails(error: AppError, requestId: string): ProblemDetails {
  const base: ProblemDetails = {
    type: `https://corehub.com/errors/${error.code.replace(/\./g, '/')}`,
    title: HTTP_STATUS_TITLES[error.status] ?? 'Error',
    status: error.status,
    instance: requestId,
    code: error.code,
  }
  if (error.detail !== undefined) base.detail = error.detail
  if (error.meta !== undefined) Object.assign(base, error.meta)
  if (error instanceof ValidationError && error.errors !== undefined) {
    return { ...base, errors: error.errors }
  }
  return base
}
