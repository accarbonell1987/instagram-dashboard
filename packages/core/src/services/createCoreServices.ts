import type { AxiosInstance } from 'axios';

import { ApiAuthStrategy } from '../auth/ApiAuthStrategy';
import { OAuthStrategy } from '../auth/OAuthStrategy';
import { Token } from '../auth/Token';
import type {
  AuthStrategy,
  ITokenProvider,
  TokenStorage,
  OAuthConfig,
  ApiAuthConfig,
} from '../auth/types';
import { createHttpClient } from '../http/createHttpClient';

import { CrudService } from './CrudService';
import type { HttpHelpers, ServiceExtender } from './types';

// ─── Configuración de auth por tipo ─────────────────────

interface OAuthAuthConfig {
  type: 'oauth';
  config: OAuthConfig;
}

interface ApiAuthAuthConfig {
  type: 'api';
  config: ApiAuthConfig;
}

interface CustomAuthConfig {
  type: 'custom';
  strategy: AuthStrategy;
}

type AuthConfig = OAuthAuthConfig | ApiAuthAuthConfig | CustomAuthConfig;

// ─── Configuración principal ────────────────────────────

export interface CoreServicesConfig {
  /** Configuración de autenticación */
  auth: AuthConfig;
  /** URL base para el HTTP client (ej: 'https://api.example.com/v1') */
  baseUrl: string;
  /** Timeout en milisegundos (default: 30000) */
  timeout?: number;
  /** Headers adicionales para todas las peticiones */
  headers?: Record<string, string>;
  /** Storage para tokens (default: memoria) */
  storage?: TokenStorage;
  /** Prefijo para las keys en storage (default: 'auth') */
  storagePrefix?: string;
}

// ─── Resultado ──────────────────────────────────────────

export interface CoreServices {
  /** Proveedor de tokens (para uso directo o en componentes) */
  tokenProvider: ITokenProvider;
  /** Instancia Axios pre-configurada con auth + error interceptors */
  httpClient: AxiosInstance;
  /**
   * Crea un CrudService tipado, conectado al httpClient ya configurado.
   * Opcionalmente acepta un callback de extensión para agregar métodos custom.
   *
   * @example
   * ```ts
   * // Uso básico (sin extensiones)
   * interface User { id: number; name: string; email: string }
   * const usersService = core.createService<User>('/users');
   * const users = await usersService.getAll();
   *
   * // Con extensiones
   * interface UserExtensions {
   *   batchCreate: (users: UserCreate[]) => Promise<BatchResult>;
   *   assignRole: (id: string, roleId: string) => Promise<User>;
   * }
   * const usersService = core.createService<User, UserCreate, UserUpdate, UserExtensions>(
   *   '/users',
   *   (http, basePath) => ({
   *     batchCreate: (users) => http.post<BatchResult>(`${basePath}/batch`, { users }),
   *     assignRole: (id, roleId) => http.post<User>(`${basePath}/${id}/assign-role`, { roleId }),
   *   })
   * );
   * // usersService tiene: getAll, getById, create, update, remove, filter + batchCreate, assignRole
   * ```
   */
  createService: <
    T extends { id: string | number },
    TCreate = Omit<T, 'id'>,
    TUpdate = Partial<TCreate>,
    E extends object = Record<string, never>,
  >(
    path: string,
    extend?: ServiceExtender<T, TCreate, TUpdate, E>
  ) => E extends Record<string, never>
    ? CrudService<T, TCreate, TUpdate>
    : CrudService<T, TCreate, TUpdate> & E;
}

// ─── Factory ────────────────────────────────────────────

/**
 * Composition Root: ensambla el sistema de autenticación y HTTP.
 *
 * Esta función es el único lugar donde se crean dependencias concretas.
 * Todo el resto de la aplicación depende de interfaces (ITokenProvider,
 * AxiosInstance, CrudService<T>).
 *
 * @example
 * ```ts
 * // Con OAuth2
 * const core = createCoreServices({
 *   auth: { type: 'oauth', config: { url, clientId, clientSecret } },
 *   baseUrl: 'https://api.example.com/v1',
 * });
 *
 * // Con API simple
 * const core = createCoreServices({
 *   auth: {
 *     type: 'api',
 *     config: { loginUrl: '/auth/login', refreshUrl: '/auth/refresh', credentials: { email, password } },
 *   },
 *   baseUrl: 'https://api.example.com/v1',
 * });
 *
 * // Crear servicios
 * const usersService = core.createService<User>('/users');
 * const ordersService = core.createService<Order>('/orders');
 * ```
 */
export function createCoreServices(config: CoreServicesConfig): CoreServices {
  const strategy = buildAuthStrategy(config.auth);

  const tokenProvider = new Token(strategy, config.storage, config.storagePrefix);

  const httpClientConfig: Parameters<typeof createHttpClient>[0] = {
    baseUrl: config.baseUrl,
    tokenProvider,
  };
  if (config.timeout !== undefined) httpClientConfig.timeout = config.timeout;
  if (config.headers !== undefined) httpClientConfig.headers = config.headers;

  const httpClient = createHttpClient(httpClientConfig);

  const createService = <
    T extends { id: string | number },
    TCreate = Omit<T, 'id'>,
    TUpdate = Partial<TCreate>,
    E extends object = Record<string, never>,
  >(
    path: string,
    extend?: ServiceExtender<T, TCreate, TUpdate, E>
  ): E extends Record<string, never>
    ? CrudService<T, TCreate, TUpdate>
    : CrudService<T, TCreate, TUpdate> & E => {
    const base = new CrudService<T, TCreate, TUpdate>(httpClient, path);

    if (!extend) {
      return base as E extends Record<string, never>
        ? CrudService<T, TCreate, TUpdate>
        : CrudService<T, TCreate, TUpdate> & E;
    }

    return Object.assign(
      base,
      (extend as unknown as (http: HttpHelpers, basePath: string) => E)(
        createHttpHelpers(httpClient),
        path
      )
    ) as E extends Record<string, never>
      ? CrudService<T, TCreate, TUpdate>
      : CrudService<T, TCreate, TUpdate> & E;
  };

  return { tokenProvider, httpClient, createService };
}

function buildAuthStrategy(authConfig: AuthConfig): AuthStrategy {
  switch (authConfig.type) {
    case 'oauth':
      return new OAuthStrategy(authConfig.config);
    case 'api':
      return new ApiAuthStrategy(authConfig.config);
    case 'custom':
      return authConfig.strategy;
  }
}

/**
 * Creates an HttpHelpers instance from an Axios client.
 * Used internally to provide typed HTTP methods for service extensions.
 *
 * Note: The extension callback receives both httpHelpers and basePath separately.
 * The httpHelpers methods expect the FULL path (including basePath) since the
 * callback is responsible for path construction, allowing flexible URL patterns.
 */
function createHttpHelpers(httpClient: AxiosInstance): HttpHelpers {
  return {
    get: async <R>(path: string, params?: Record<string, unknown>): Promise<R> => {
      const response = await httpClient.get<R>(path, { params });
      return response.data;
    },
    post: async <R>(path: string, data?: unknown): Promise<R> => {
      const response = await httpClient.post<R>(path, data);
      return response.data;
    },
    put: async <R>(path: string, data?: unknown): Promise<R> => {
      const response = await httpClient.put<R>(path, data);
      return response.data;
    },
    patch: async <R>(path: string, data?: unknown): Promise<R> => {
      const response = await httpClient.patch<R>(path, data);
      return response.data;
    },
    delete: async <R>(path: string): Promise<R> => {
      const response = await httpClient.delete<R>(path);
      return response.data;
    },
  };
}
