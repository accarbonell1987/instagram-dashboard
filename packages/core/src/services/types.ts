import type { CrudService } from './CrudService';

/**
 * Respuesta paginada estándar del servidor.
 *
 * Cubre el patrón común donde el backend devuelve un array de items
 * junto con metadatos de paginación. El genérico T es la entidad.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Parámetros de filtro para consultas paginadas.
 *
 * Diseñado como base flexible: los servicios concretos pueden
 * extender esta interfaz para agregar filtros específicos de dominio.
 *
 * @example
 * ```ts
 * interface UserFilter extends FilterParams {
 *   role?: string;
 *   isActive?: boolean;
 * }
 * ```
 */
export interface FilterParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: unknown;
}

// ─── Batch Operation Types ──────────────────────────────

/**
 * Result of a batch create operation.
 * Contains the created entities and total count.
 *
 * @typeParam T - Entity type
 *
 * @example
 * ```ts
 * const result: BatchCreateResult<User> = {
 *   created: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }],
 *   total: 2,
 * };
 * ```
 */
export interface BatchCreateResult<T> {
  created: T[];
  total: number;
}

/**
 * Result of a batch delete operation.
 * Contains the count of deleted items and optionally IDs that were not found.
 *
 * @example
 * ```ts
 * const result: BatchDeleteResult = {
 *   deleted: 3,
 *   notFound: ['id-that-didnt-exist'],
 * };
 * ```
 */
export interface BatchDeleteResult {
  deleted: number;
  notFound?: string[] | undefined;
}

// ─── Service Extension Types ────────────────────────────

/**
 * Minimal HTTP helpers for service extensions.
 * Provides typed HTTP methods without coupling to Axios internals.
 *
 * Extension methods use these helpers to call custom API endpoints
 * while benefiting from the configured authentication and interceptors.
 *
 * @example
 * ```ts
 * // Inside an extension callback
 * const extensions = (http: HttpHelpers, basePath: string) => ({
 *   batchCreate: (users: UserCreate[]) =>
 *     http.post<BatchResult>(`${basePath}/batch`, { users }),
 * });
 * ```
 */
export interface HttpHelpers {
  get: <R>(path: string, params?: Record<string, unknown>) => Promise<R>;
  post: <R>(path: string, data?: unknown) => Promise<R>;
  put: <R>(path: string, data?: unknown) => Promise<R>;
  patch: <R>(path: string, data?: unknown) => Promise<R>;
  delete: <R>(path: string) => Promise<R>;
}

/**
 * Callback type for extending a CrudService with custom methods.
 * Receives HTTP helpers and base path, returns an object of extension methods.
 *
 * @typeParam _T - Entity type (unused, kept for API consistency)
 * @typeParam _TCreate - Create payload type (unused, kept for API consistency)
 * @typeParam _TUpdate - Update payload type (unused, kept for API consistency)
 * @typeParam E - Extensions object type (inferred from callback return)
 *
 * @example
 * ```ts
 * const userExtensions: ServiceExtender<User, UserCreate, UserUpdate, UserExtensions> =
 *   (http, basePath) => ({
 *     assignRole: (id: string, roleId: string) =>
 *       http.post<User>(`${basePath}/${id}/assign-role`, { roleId }),
 *   });
 * ```
 */
export type ServiceExtender<
  _T extends { id: string | number },
  _TCreate,
  _TUpdate,
  E extends object,
> = (http: HttpHelpers, basePath: string) => E;

/**
 * Combined type of CrudService and extensions.
 * Used internally for type inference in createService().
 *
 * @typeParam T - Entity type
 * @typeParam TCreate - Create payload type
 * @typeParam TUpdate - Update payload type
 * @typeParam E - Extensions object type
 */
export type ExtendedService<
  T extends { id: string | number },
  TCreate,
  TUpdate,
  E extends object,
> = CrudService<T, TCreate, TUpdate> & E;
