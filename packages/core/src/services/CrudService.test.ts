import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockAxios, mockResponse } from '../__tests__/helpers/mockAxios';

import { CrudService } from './CrudService';
import type { PaginatedResponse } from './types';

// ─── Entidad de prueba ──────────────────────────────────

interface TestEntity {
  id: number;
  name: string;
  email: string;
}

type TestCreatePayload = Omit<TestEntity, 'id'>;

const BASE_URL = '/api/v1/entities';

describe('CrudService', () => {
  let service: CrudService<TestEntity>;
  let mockGet: ReturnType<typeof createMockAxios>['mockGet'];
  let mockPost: ReturnType<typeof createMockAxios>['mockPost'];
  let mockPut: ReturnType<typeof createMockAxios>['mockPut'];
  let mockDelete: ReturnType<typeof createMockAxios>['mockDelete'];

  beforeEach(() => {
    vi.restoreAllMocks();
    const mocks = createMockAxios();
    mockGet = mocks.mockGet;
    mockPost = mocks.mockPost;
    mockPut = mocks.mockPut;
    mockDelete = mocks.mockDelete;
    service = new CrudService<TestEntity>(mocks.http, BASE_URL);
  });

  // ─── getAll ─────────────────────────────────────────────

  describe('getAll', () => {
    it('calls GET on base URL and returns array', async () => {
      const entities: TestEntity[] = [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ];
      mockGet.mockResolvedValueOnce(mockResponse(entities));

      const result = await service.getAll();

      expect(result).toEqual(entities);
      expect(mockGet).toHaveBeenCalledWith(BASE_URL, { params: undefined });
    });

    it('returns empty array when no entities', async () => {
      mockGet.mockResolvedValueOnce(mockResponse([]));

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  // ─── getById ────────────────────────────────────────────

  describe('getById', () => {
    it('calls GET with id path and returns entity', async () => {
      const entity: TestEntity = { id: 42, name: 'Alice', email: 'alice@test.com' };
      mockGet.mockResolvedValueOnce(mockResponse(entity));

      const result = await service.getById(42);

      expect(result).toEqual(entity);
      expect(mockGet).toHaveBeenCalledWith(`${BASE_URL}/42`, { params: undefined });
    });

    it('works with string ids', () => {
      interface StringIdEntity {
        id: string;
        label: string;
      }
      const stringService = new CrudService<StringIdEntity>(createMockAxios().http, '/items');

      // Verify it compiles and the type constraint works
      expect(stringService).toBeInstanceOf(CrudService);
    });
  });

  // ─── create ─────────────────────────────────────────────

  describe('create', () => {
    it('calls POST with data and returns created entity', async () => {
      const payload: TestCreatePayload = { name: 'Charlie', email: 'charlie@test.com' };
      const created: TestEntity = { id: 3, ...payload };
      mockPost.mockResolvedValueOnce(mockResponse(created));

      const result = await service.create(payload);

      expect(result).toEqual(created);
      expect(mockPost).toHaveBeenCalledWith(BASE_URL, payload, undefined);
    });
  });

  // ─── update ─────────────────────────────────────────────

  describe('update', () => {
    it('calls PUT with id and partial data, returns updated entity', async () => {
      const updated: TestEntity = { id: 1, name: 'Alice Updated', email: 'alice@test.com' };
      mockPut.mockResolvedValueOnce(mockResponse(updated));

      const result = await service.update(1, { name: 'Alice Updated' });

      expect(result).toEqual(updated);
      expect(mockPut).toHaveBeenCalledWith(`${BASE_URL}/1`, { name: 'Alice Updated' }, undefined);
    });
  });

  // ─── remove ─────────────────────────────────────────────

  describe('remove', () => {
    it('calls DELETE with id path', async () => {
      mockDelete.mockResolvedValueOnce(mockResponse(undefined));

      await service.remove(1);

      expect(mockDelete).toHaveBeenCalledWith(`${BASE_URL}/1`, undefined);
    });
  });

  // ─── filter ─────────────────────────────────────────────

  describe('filter', () => {
    it('calls GET /filter with params and returns paginated response', async () => {
      const paginatedResponse: PaginatedResponse<TestEntity> = {
        data: [{ id: 1, name: 'Alice', email: 'alice@test.com' }],
        total: 50,
        page: 1,
        pageSize: 10,
      };
      mockGet.mockResolvedValueOnce(mockResponse(paginatedResponse));

      const result = await service.filter({ page: 1, pageSize: 10, search: 'Alice' });

      expect(result).toEqual(paginatedResponse);
      expect(mockGet).toHaveBeenCalledWith(`${BASE_URL}/filter`, {
        params: { page: 1, pageSize: 10, search: 'Alice' },
      });
    });

    it('calls filter with empty params by default', async () => {
      const emptyPage: PaginatedResponse<TestEntity> = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };
      mockGet.mockResolvedValueOnce(mockResponse(emptyPage));

      await service.filter();

      expect(mockGet).toHaveBeenCalledWith(`${BASE_URL}/filter`, {
        params: {},
      });
    });

    it('passes sort parameters', async () => {
      const sortedPage: PaginatedResponse<TestEntity> = {
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      mockGet.mockResolvedValueOnce(mockResponse(sortedPage));

      await service.filter({ sortBy: 'name', sortOrder: 'desc', pageSize: 20 });

      expect(mockGet).toHaveBeenCalledWith(`${BASE_URL}/filter`, {
        params: { sortBy: 'name', sortOrder: 'desc', pageSize: 20 },
      });
    });
  });

  // ─── Herencia (patrón de uso) ──────────────────────────

  describe('inheritance pattern', () => {
    it('allows extending with custom methods', async () => {
      class OrderService extends CrudService<TestEntity> {
        async getByEmail(email: string): Promise<TestEntity[]> {
          return this.get<TestEntity[]>(`/by-email/${email}`);
        }
      }

      const { http, mockGet: orderMockGet } = createMockAxios();
      const orderService = new OrderService(http, '/orders');
      const orders: TestEntity[] = [{ id: 1, name: 'Order 1', email: 'user@test.com' }];
      orderMockGet.mockResolvedValueOnce(mockResponse(orders));

      const result = await orderService.getByEmail('user@test.com');

      expect(result).toEqual(orders);
      expect(orderMockGet).toHaveBeenCalledWith('/orders/by-email/user@test.com', {
        params: undefined,
      });
    });
  });
});
