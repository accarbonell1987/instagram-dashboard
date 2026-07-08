import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// ─── Entidad de ejemplo para mocks ─────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
}

// ─── Mock adapter types ────────────────────────────────

/**
 * Respuesta que devuelve un handler del mock.
 *
 * Permite al handler controlar status, data, y headers
 * sin acoplarse a la estructura interna de Axios.
 */
export interface MockResponse<T = unknown> {
  status: number;
  data: T;
  headers?: Record<string, string>;
}

/**
 * Parámetros que recibe un handler del mock.
 *
 * Contiene toda la información necesaria para que el handler
 * decida qué responder: método, URL parseada, params de ruta,
 * query string, y body.
 */
export interface MockRequestInfo {
  /** Método HTTP en minúsculas */
  method: string;
  /** URL completa (sin baseURL) */
  url: string;
  /** Parámetros extraídos del patrón de ruta (ej: { id: '5' }) */
  pathParams: Record<string, string>;
  /** Query params del request */
  queryParams: Record<string, string>;
  /** Body del request (POST/PUT/PATCH) */
  body: unknown;
  /** Config original de Axios */
  config: AxiosRequestConfig;
}

/**
 * Un handler de mock que mapea un patrón de ruta a una respuesta.
 *
 * `urlPattern` soporta parámetros con `:param` (ej: '/users/:id').
 * `method` es case-insensitive y se normaliza a minúsculas.
 *
 * @example
 * ```ts
 * const handler: MockHandler = {
 *   method: 'GET',
 *   urlPattern: '/users/:id',
 *   handler: (request) => ({
 *     status: 200,
 *     data: { id: Number(request.pathParams.id), name: 'Test' },
 *   }),
 * };
 * ```
 */
export interface MockHandler {
  method: string;
  urlPattern: string;
  handler: (request: MockRequestInfo) => MockResponse | Promise<MockResponse>;
}

/**
 * Firma del adapter que Axios usa para ejecutar requests.
 *
 * El mock adapter reemplaza el adapter real de Axios para
 * interceptar todas las peticiones y responder con datos en memoria.
 */
export type MockAdapter = (config: AxiosRequestConfig) => Promise<AxiosResponse>;
