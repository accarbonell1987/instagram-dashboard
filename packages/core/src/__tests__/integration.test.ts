/**
 * Test de integración end-to-end.
 *
 * Valida que todas las piezas del sistema funcionan juntas:
 * 1. AuthStrategy → Token → getAccessToken
 * 2. createHttpClient → interceptors inyectan token + convierten errores
 * 3. CrudService → CRUD sobre el httpClient configurado
 * 4. createCoreServices → ensambla todo
 * 5. createServicesStore → React hooks consumen los servicios
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { AuthStrategy, TokenResponse } from '../auth/types';
import { ServiceError } from '../errors/ServiceError';
import { createServicesStore } from '../react/createServicesStore';
import { createCoreServices } from '../services/createCoreServices';
import { CrudService } from '../services/CrudService';

// ─── Entidad de prueba ──────────────────────────────────

interface Product {
  id: number;
  name: string;
  price: number;
}

// ─── Mock de servidor HTTP ──────────────────────────────

function createMockStrategy(): AuthStrategy {
  return {
    requestToken: vi.fn().mockResolvedValue({
      accessToken: 'integration-token',
      refreshToken: 'integration-refresh',
      expiresIn: 3600,
    } satisfies TokenResponse),
    refreshToken: vi.fn().mockResolvedValue({
      accessToken: 'integration-refreshed-token',
      refreshToken: 'integration-refresh-2',
      expiresIn: 3600,
    } satisfies TokenResponse),
  };
}

describe('Integration: end-to-end flow', () => {
  let mockStrategy: AuthStrategy;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStrategy = createMockStrategy();
  });

  // ─── 1. createCoreServices ensambla correctamente ─────

  describe('createCoreServices wiring', () => {
    it('creates a fully functional core with custom strategy', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      // Token provider obtiene token de la estrategia
      const token = await core.tokenProvider.getAccessToken();
      expect(token).toBe('integration-token');
      expect(vi.mocked(mockStrategy.requestToken)).toHaveBeenCalledOnce();

      // httpClient está configurado con la baseURL
      expect(core.httpClient.defaults.baseURL).toBe('https://api.test.com/v1');

      // createService produce CrudService instances
      const productsService = core.createService<Product>('/products');
      expect(productsService).toBeInstanceOf(CrudService);
    });
  });

  // ─── 2. Auth interceptor inyecta token en requests ────

  describe('auth interceptor injects token', () => {
    it('adds Authorization header to outgoing requests', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      let capturedAuthHeader: string | undefined;

      // Mock del adapter para capturar la request sin HTTP real
      core.httpClient.defaults.adapter = (config) => {
        capturedAuthHeader = config.headers.Authorization as string | undefined;
        return Promise.resolve({ data: [], status: 200, statusText: 'OK', headers: {}, config });
      };

      await core.httpClient.get('/products');

      expect(capturedAuthHeader).toBe('Bearer integration-token');
    });
  });

  // ─── 3. Error interceptor convierte errores ───────────

  describe('error interceptor converts errors', () => {
    it('transforms HTTP errors into ServiceError', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      core.httpClient.defaults.adapter = () => {
        const error = new Error('Not Found');
        Object.assign(error, {
          isAxiosError: true,
          response: { status: 404, statusText: 'Not Found', data: {}, headers: {} },
          config: { url: '/products/999', headers: {} },
          code: 'ERR_BAD_REQUEST',
          toJSON: () => ({}),
        });
        throw error;
      };

      try {
        await core.httpClient.get('/products/999');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).status).toBe(404);
        expect((error as ServiceError).isNotFound).toBe(true);
      }
    });
  });

  // ─── 4. CrudService opera sobre httpClient configurado ─

  describe('CrudService through configured httpClient', () => {
    it('getAll sends authenticated GET and returns data', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      const products: Product[] = [
        { id: 1, name: 'Widget', price: 9.99 },
        { id: 2, name: 'Gadget', price: 19.99 },
      ];

      let capturedUrl = '';
      let capturedAuthHeader = '';
      core.httpClient.defaults.adapter = (config) => {
        capturedUrl = `${config.baseURL ?? ''}${config.url ?? ''}`;
        capturedAuthHeader = config.headers.Authorization as string;
        return Promise.resolve({
          data: products,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      };

      const productsService = core.createService<Product>('/products');
      const result = await productsService.getAll();

      expect(result).toEqual(products);
      expect(capturedUrl).toBe('https://api.test.com/v1/products');
      expect(capturedAuthHeader).toBe('Bearer integration-token');
    });

    it('create sends authenticated POST with data', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      const newProduct: Product = { id: 3, name: 'Doohickey', price: 29.99 };
      let capturedMethod = '';
      let capturedData = '';

      core.httpClient.defaults.adapter = (config) => {
        capturedMethod = config.method ?? '';
        capturedData = config.data as string;
        return Promise.resolve({
          data: newProduct,
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
        });
      };

      const productsService = core.createService<Product>('/products');
      const result = await productsService.create({ name: 'Doohickey', price: 29.99 });

      expect(result).toEqual(newProduct);
      expect(capturedMethod).toBe('post');
      expect(JSON.parse(capturedData)).toEqual({ name: 'Doohickey', price: 29.99 });
    });

    it('filter sends authenticated GET with query params', async () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      const paginatedResponse = {
        data: [{ id: 1, name: 'Widget', price: 9.99 }],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      let capturedParams: Record<string, unknown> = {};
      core.httpClient.defaults.adapter = (config) => {
        capturedParams = config.params as Record<string, unknown>;
        return Promise.resolve({
          data: paginatedResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      };

      const productsService = core.createService<Product>('/products');
      const result = await productsService.filter({ page: 1, pageSize: 10, search: 'Widget' });

      expect(result).toEqual(paginatedResponse);
      expect(capturedParams).toEqual({ page: 1, pageSize: 10, search: 'Widget' });
    });
  });

  // ─── 5. React store integra con componentes ───────────

  describe('React store integration', () => {
    it('full flow: create core → initialize store → consume via hook', () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      const { store, useServices, useServicesStore } = createServicesStore();

      // Verificar estado inicial
      const { result: initializedResult } = renderHook(() =>
        useServicesStore((state) => state.initialized)
      );
      expect(initializedResult.current).toBe(false);

      // Inicializar
      act(() => {
        store.getState().initialize(core);
      });
      expect(initializedResult.current).toBe(true);

      // Consumir servicios
      const { result: servicesResult } = renderHook(() => useServices());
      expect(servicesResult.current).toBe(core);
      expect(servicesResult.current.tokenProvider).toBe(core.tokenProvider);
      expect(servicesResult.current.httpClient).toBe(core.httpClient);

      // Crear servicio desde el hook
      const productsService = servicesResult.current.createService<Product>('/products');
      expect(productsService).toBeInstanceOf(CrudService);
    });

    it('reset clears services (logout flow)', () => {
      const core = createCoreServices({
        auth: { type: 'custom', strategy: mockStrategy },
        baseUrl: 'https://api.test.com/v1',
      });

      const { store, useServicesStore } = createServicesStore();

      store.getState().initialize(core);

      const { result } = renderHook(() => useServicesStore((state) => state.initialized));
      expect(result.current).toBe(true);

      act(() => {
        store.getState().reset();
      });
      expect(result.current).toBe(false);
    });
  });

  // ─── 6. Múltiples estrategias de auth ─────────────────

  describe('auth strategy switching', () => {
    it('works with oauth config', () => {
      const core = createCoreServices({
        auth: {
          type: 'oauth',
          config: {
            url: 'https://auth.test.com/token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
          },
        },
        baseUrl: 'https://api.test.com/v1',
      });

      expect(core.tokenProvider).toBeDefined();
      expect(core.httpClient.defaults.baseURL).toBe('https://api.test.com/v1');
    });

    it('works with api auth config', () => {
      const core = createCoreServices({
        auth: {
          type: 'api',
          config: {
            loginUrl: 'https://api.test.com/auth/login',
            refreshUrl: 'https://api.test.com/auth/refresh',
            credentials: { email: 'user@test.com', password: 'pass' },
          },
        },
        baseUrl: 'https://api.test.com/v1',
      });

      expect(core.tokenProvider).toBeDefined();
      expect(core.httpClient.defaults.baseURL).toBe('https://api.test.com/v1');
    });
  });
});
