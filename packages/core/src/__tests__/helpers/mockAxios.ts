import type { AxiosInstance, AxiosResponse } from 'axios';
import { vi } from 'vitest';

/**
 * Crea un mock de AxiosInstance para tests unitarios.
 *
 * Uso:
 *   const { http, mockGet, mockPost } = createMockAxios();
 *   mockGet.mockResolvedValueOnce(mockResponse({ id: '1' }));
 *   const service = new MyService(http, '/api/v1');
 */
export function createMockAxios() {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockPatch = vi.fn();
  const mockDelete = vi.fn();

  const http = {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  } as unknown as AxiosInstance;

  return { http, mockGet, mockPost, mockPut, mockPatch, mockDelete };
}

/** Envuelve un dato en una estructura AxiosResponse para usar con mockResolvedValueOnce */
export function mockResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}
