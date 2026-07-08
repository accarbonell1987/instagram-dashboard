import axios from 'axios';
import { describe, it, expect, beforeEach } from 'vitest';

import type { PaginatedResponse } from '../services/types';

import { createMockAdapter } from './createMockAdapter';
import type { MockHandler, User } from './types';
import { createUsersMockHandlers } from './usersMock';

// ─── createMockAdapter: URL matching ───────────────────

describe('createMockAdapter', () => {
  describe('url pattern matching', () => {
    it('matches exact paths', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/items',
          handler: () => ({ status: 200, data: ['a', 'b'] }),
        },
      ]);

      const response = await adapter({ method: 'get', url: '/items' });
      expect(response.data).toEqual(['a', 'b']);
      expect(response.status).toBe(200);
    });

    it('matches paths with route params', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/items/:id',
          handler: (req) => ({ status: 200, data: { id: req.pathParams['id'] } }),
        },
      ]);

      const response = await adapter({ method: 'get', url: '/items/42' });
      expect(response.data).toEqual({ id: '42' });
    });

    it('matches paths with multiple route params', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/orgs/:orgId/users/:userId',
          handler: (req) => ({
            status: 200,
            data: { orgId: req.pathParams['orgId'], userId: req.pathParams['userId'] },
          }),
        },
      ]);

      const response = await adapter({ method: 'get', url: '/orgs/acme/users/5' });
      expect(response.data).toEqual({ orgId: 'acme', userId: '5' });
    });

    it('strips baseURL before matching', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/users',
          handler: () => ({ status: 200, data: [] }),
        },
      ]);

      const response = await adapter({
        method: 'get',
        url: 'https://api.test.com/v1/users',
        baseURL: 'https://api.test.com/v1',
      });
      expect(response.data).toEqual([]);
    });

    it('rejects unmatched routes with 404 error', async () => {
      const adapter = createMockAdapter([]);

      await expect(adapter({ method: 'get', url: '/unknown' })).rejects.toThrow(
        'Mock: no handler for GET /unknown'
      );
    });

    it('matches by method (case-insensitive)', async () => {
      const adapter = createMockAdapter([
        {
          method: 'POST',
          urlPattern: '/items',
          handler: () => ({ status: 201, data: { created: true } }),
        },
      ]);

      const response = await adapter({ method: 'post', url: '/items', data: {} });
      expect(response.status).toBe(201);
    });

    it('uses first matching handler when multiple match', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/items',
          handler: () => ({ status: 200, data: 'first' }),
        },
        {
          method: 'GET',
          urlPattern: '/items',
          handler: () => ({ status: 200, data: 'second' }),
        },
      ]);

      const response = await adapter({ method: 'get', url: '/items' });
      expect(response.data).toBe('first');
    });
  });

  describe('query params extraction', () => {
    it('extracts query params from URL', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/search',
          handler: (req) => ({ status: 200, data: req.queryParams }),
        },
      ]);

      const response = await adapter({ method: 'get', url: '/search?q=test&page=2' });
      expect(response.data).toEqual({ q: 'test', page: '2' });
    });

    it('extracts query params from config.params', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/search',
          handler: (req) => ({ status: 200, data: req.queryParams }),
        },
      ]);

      const response = await adapter({
        method: 'get',
        url: '/search',
        params: { q: 'test', page: 2 },
      });
      expect(response.data).toEqual({ q: 'test', page: '2' });
    });
  });

  describe('request body parsing', () => {
    it('passes object body directly', async () => {
      const adapter = createMockAdapter([
        {
          method: 'POST',
          urlPattern: '/items',
          handler: (req) => ({ status: 201, data: req.body }),
        },
      ]);

      const body = { name: 'Test Item' };
      const response = await adapter({ method: 'post', url: '/items', data: body });
      expect(response.data).toEqual(body);
    });

    it('parses JSON string body', async () => {
      const adapter = createMockAdapter([
        {
          method: 'POST',
          urlPattern: '/items',
          handler: (req) => ({ status: 201, data: req.body }),
        },
      ]);

      const response = await adapter({
        method: 'post',
        url: '/items',
        data: JSON.stringify({ name: 'Test' }),
      });
      expect(response.data).toEqual({ name: 'Test' });
    });
  });

  describe('async handlers', () => {
    it('supports async handler functions', async () => {
      const adapter = createMockAdapter([
        {
          method: 'GET',
          urlPattern: '/async',
          handler: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { status: 200, data: 'async-result' };
          },
        },
      ]);

      const response = await adapter({ method: 'get', url: '/async' });
      expect(response.data).toBe('async-result');
    });
  });
});

// ─── Users mock handlers integration ───────────────────

describe('createUsersMockHandlers', () => {
  let handlers: MockHandler[];
  let store: ReturnType<typeof createUsersMockHandlers>['store'];
  let http: ReturnType<typeof axios.create>;

  beforeEach(() => {
    const mock = createUsersMockHandlers();
    handlers = mock.handlers;
    store = mock.store;

    http = axios.create({ baseURL: 'https://api.test.com' });
    http.defaults.adapter = createMockAdapter(handlers);
  });

  describe('GET /users', () => {
    it('returns all users', async () => {
      const response = await http.get<User[]>('/users');

      expect(response.data).toHaveLength(10);
      expect(response.data[0]).toMatchObject({
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'admin',
      });
    });
  });

  describe('GET /users/:id', () => {
    it('returns a user by id', async () => {
      const response = await http.get<User>('/users/3');

      expect(response.data).toMatchObject({
        id: 3,
        name: 'Charlie Brown',
        role: 'viewer',
      });
    });

    it('returns 404 for non-existent user', async () => {
      await expect(http.get('/users/999')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('POST /users', () => {
    it('creates a new user', async () => {
      const response = await http.post<User>('/users', {
        name: 'New User',
        email: 'new@example.com',
        role: 'viewer',
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        id: 11,
        name: 'New User',
        email: 'new@example.com',
        role: 'viewer',
      });
      expect(response.data.createdAt).toBeDefined();

      // Verify it was actually added
      expect(store.getAll()).toHaveLength(11);
    });
  });

  describe('PUT /users/:id', () => {
    it('updates an existing user', async () => {
      const response = await http.put<User>('/users/1', {
        name: 'Alice Updated',
      });

      expect(response.data).toMatchObject({
        id: 1,
        name: 'Alice Updated',
        email: 'alice@example.com',
      });
    });

    it('returns 404 for non-existent user', async () => {
      await expect(http.put('/users/999', { name: 'Ghost' })).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('DELETE /users/:id', () => {
    it('removes a user', async () => {
      const response = await http.delete('/users/1');
      expect(response.status).toBe(204);
      expect(store.getAll()).toHaveLength(9);
      expect(store.getById(1)).toBeUndefined();
    });

    it('returns 404 for non-existent user', async () => {
      await expect(http.delete('/users/999')).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('GET /users/filter', () => {
    it('returns paginated results', async () => {
      const response = await http.get<PaginatedResponse<User>>('/users/filter', {
        params: { page: 1, pageSize: 3 },
      });

      expect(response.data.data).toHaveLength(3);
      expect(response.data.total).toBe(10);
      expect(response.data.page).toBe(1);
      expect(response.data.pageSize).toBe(3);
    });

    it('returns second page', async () => {
      const response = await http.get<PaginatedResponse<User>>('/users/filter', {
        params: { page: 2, pageSize: 3 },
      });

      expect(response.data.data).toHaveLength(3);
      const firstItem = response.data.data[0];
      if (!firstItem) throw new Error('Expected at least one item in paginated response');
      expect(firstItem.name).toBe('Diana Prince');
    });

    it('filters by search term', async () => {
      const response = await http.get<PaginatedResponse<User>>('/users/filter', {
        params: { search: 'alice' },
      });

      expect(response.data.data).toHaveLength(1);
      const firstItem = response.data.data[0];
      if (!firstItem) throw new Error('Expected at least one item in filtered response');
      expect(firstItem.name).toBe('Alice Johnson');
    });

    it('filters by role', async () => {
      const response = await http.get<PaginatedResponse<User>>('/users/filter', {
        params: { role: 'admin' },
      });

      expect(response.data.data).toHaveLength(3);
      expect(response.data.data.every((user) => user.role === 'admin')).toBe(true);
    });

    it('combines search and role filters', async () => {
      const response = await http.get<PaginatedResponse<User>>('/users/filter', {
        params: { search: 'a', role: 'admin' },
      });

      // "Alice" and "Diana" match 'a', both are admin; "Iris" has 'i' not 'a' — only Alice and Diana
      expect(response.data.data.length).toBeGreaterThanOrEqual(1);
      expect(response.data.data.every((user) => user.role === 'admin')).toBe(true);
    });
  });

  describe('store reset', () => {
    it('restores initial data after reset', () => {
      store.remove(1);
      store.remove(2);
      expect(store.getAll()).toHaveLength(8);

      store.reset();
      expect(store.getAll()).toHaveLength(10);
    });
  });
});
