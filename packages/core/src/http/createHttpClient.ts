import axios, { type AxiosInstance } from 'axios';

import type { ITokenProvider } from '../auth/types';

import { createAuthInterceptor } from './interceptors/authInterceptor';
import { createErrorInterceptor } from './interceptors/errorInterceptor';

export interface HttpClientConfig {
  /** URL base para todas las peticiones (ej: 'https://api.example.com/v1') */
  baseUrl: string;
  /** Proveedor de tokens para autenticación automática */
  tokenProvider: ITokenProvider;
  /** Timeout en milisegundos (default: 30000) */
  timeout?: number;
  /** Headers adicionales para todas las peticiones */
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 30_000;

/**
 * Crea una instancia de Axios pre-configurada con:
 * - Auth interceptor: inyecta Bearer token en cada request
 * - Error interceptor: refresh automático en 401, errores como ServiceError
 * - Timeout y headers por defecto
 *
 * Esta es la forma recomendada de crear clientes HTTP en la aplicación.
 * Los servicios concretos reciben esta instancia ya configurada.
 *
 * @example
 * ```ts
 * const http = createHttpClient({
 *   baseUrl: 'https://api.example.com/v1',
 *   tokenProvider: token,
 * });
 *
 * const usersService = new UsersService(http, '/users');
 * ```
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout ?? DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
  });

  // Request: inyectar token
  instance.interceptors.request.use(createAuthInterceptor(config.tokenProvider));

  // Response: unwrap API envelope { success: true, data: ... }
  instance.interceptors.response.use((response) => {
    // Check if response has the standard API envelope format
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      'data' in response.data
    ) {
      // Unwrap the envelope, return the inner data
      const envelope = response.data as { success: boolean; data: unknown };
      response.data = envelope.data;
    }
    return response;
  });

  // Response: refresh en 401 + conversión a ServiceError
  instance.interceptors.response.use(
    (response) => response,
    createErrorInterceptor(instance, config.tokenProvider)
  );

  return instance;
}
