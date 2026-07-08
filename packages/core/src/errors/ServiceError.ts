import type { AxiosError } from 'axios';

/**
 * Error estandarizado para toda la capa de servicios.
 *
 * Reglas:
 * - HttpService SIEMPRE lanza ServiceError (via interceptor)
 * - Los servicios concretos NUNCA hacen try/catch internos
 * - El consumidor decide cómo manejar: try/catch, .catch(), o React Error Boundary
 */
export class ServiceError extends Error {
  override readonly name = 'ServiceError';

  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: string | null,
    public readonly endpoint: string | null,
    public readonly originalError?: unknown
  ) {
    super(message);
  }

  /** Errores 4xx — problema del cliente */
  get isClientError(): boolean {
    return this.status !== null && this.status >= 400 && this.status < 500;
  }

  /** Errores 5xx — problema del servidor */
  get isServerError(): boolean {
    return this.status !== null && this.status >= 500;
  }

  /** Error de red (sin respuesta del servidor) */
  get isNetworkError(): boolean {
    return this.status === null && this.code === 'ERR_NETWORK';
  }

  /** Error de timeout */
  get isTimeoutError(): boolean {
    return this.code === 'ECONNABORTED';
  }

  /** 401 — Token expirado o inválido */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 403 — Sin permisos */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** 404 — Recurso no encontrado */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 409 — Conflicto (ej: recurso ya existe) */
  get isConflict(): boolean {
    return this.status === 409;
  }

  /** 422 — Entidad no procesable (validación del servidor) */
  get isUnprocessable(): boolean {
    return this.status === 422;
  }

  /** Factory desde AxiosError — usado por el interceptor de errores */
  static fromAxiosError(axiosError: AxiosError): ServiceError {
    return new ServiceError(
      axiosError.response?.statusText ?? axiosError.message,
      axiosError.response?.status ?? null,
      axiosError.code ?? null,
      axiosError.config?.url ?? null,
      axiosError
    );
  }
}
