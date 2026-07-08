import type { PaginatedResponse } from '../services/types';

import type { MockHandler, MockResponse, User } from './types';

// ─── Seed data ─────────────────────────────────────────

const SEED_USERS: User[] = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'admin',
    createdAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'editor',
    createdAt: '2025-02-20T10:30:00Z',
  },
  {
    id: 3,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    role: 'viewer',
    createdAt: '2025-03-10T14:00:00Z',
  },
  {
    id: 4,
    name: 'Diana Prince',
    email: 'diana@example.com',
    role: 'admin',
    createdAt: '2025-04-05T09:15:00Z',
  },
  {
    id: 5,
    name: 'Eve Martinez',
    email: 'eve@example.com',
    role: 'editor',
    createdAt: '2025-05-12T16:45:00Z',
  },
  {
    id: 6,
    name: 'Frank Lee',
    email: 'frank@example.com',
    role: 'viewer',
    createdAt: '2025-06-01T11:00:00Z',
  },
  {
    id: 7,
    name: 'Grace Kim',
    email: 'grace@example.com',
    role: 'editor',
    createdAt: '2025-06-15T13:30:00Z',
  },
  {
    id: 8,
    name: 'Henry Wilson',
    email: 'henry@example.com',
    role: 'viewer',
    createdAt: '2025-07-20T07:45:00Z',
  },
  {
    id: 9,
    name: 'Iris Chen',
    email: 'iris@example.com',
    role: 'admin',
    createdAt: '2025-08-08T15:00:00Z',
  },
  {
    id: 10,
    name: 'Jack Rivera',
    email: 'jack@example.com',
    role: 'viewer',
    createdAt: '2025-09-01T10:00:00Z',
  },
];

// ─── In-memory store ───────────────────────────────────

/**
 * Crea un store en memoria con los datos seed.
 *
 * Cada llamada retorna una instancia independiente,
 * útil para tests que necesitan estado aislado.
 */
export function createUsersStore(initialData: User[] = SEED_USERS) {
  let users = [...initialData];
  let nextId = Math.max(...users.map((user) => user.id), 0) + 1;

  return {
    getAll(): User[] {
      return [...users];
    },

    getById(id: number): User | undefined {
      return users.find((user) => user.id === id);
    },

    create(data: Omit<User, 'id' | 'createdAt'>): User {
      const newUser: User = {
        ...data,
        id: nextId++,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      return newUser;
    },

    update(id: number, data: Partial<Omit<User, 'id' | 'createdAt'>>): User | undefined {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return undefined;

      const existing = users[index];
      if (!existing) return undefined;
      users[index] = { ...existing, ...data };
      return users[index];
    },

    remove(id: number): boolean {
      const initialLength = users.length;
      users = users.filter((user) => user.id !== id);
      return users.length < initialLength;
    },

    filter(params: {
      page?: number;
      pageSize?: number;
      search?: string;
      role?: string;
    }): PaginatedResponse<User> {
      const { page = 1, pageSize = 10, search, role } = params;

      let filtered = [...users];

      if (search) {
        const lowerSearch = search.toLowerCase();
        filtered = filtered.filter(
          (user) =>
            user.name.toLowerCase().includes(lowerSearch) ||
            user.email.toLowerCase().includes(lowerSearch)
        );
      }

      if (role) {
        filtered = filtered.filter((user) => user.role === role);
      }

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const data = filtered.slice(start, start + pageSize);

      return { data, total, page, pageSize };
    },

    /** Resetea al estado inicial (útil para tests) */
    reset(): void {
      users = [...initialData];
      nextId = Math.max(...users.map((user) => user.id), 0) + 1;
    },
  };
}

// ─── Mock handlers ─────────────────────────────────────

/**
 * Crea los handlers de mock para la entidad Users.
 *
 * Implementa el contrato completo de CrudService:
 * - GET /users → getAll
 * - GET /users/filter → filter con paginación
 * - GET /users/:id → getById
 * - POST /users → create
 * - PUT /users/:id → update
 * - DELETE /users/:id → remove
 *
 * @param basePath Ruta base (default: '/users')
 * @returns Handlers + store (para acceso directo en tests)
 *
 * @example
 * ```ts
 * const { handlers, store } = createUsersMockHandlers();
 * const adapter = createMockAdapter(handlers);
 * httpClient.defaults.adapter = adapter;
 * ```
 */
export function createUsersMockHandlers(basePath = '/users') {
  const store = createUsersStore();

  const handlers: MockHandler[] = [
    // GET /users → getAll
    {
      method: 'GET',
      urlPattern: basePath,
      handler: () => ({
        status: 200,
        data: store.getAll(),
      }),
    },

    // GET /users/filter → filter con paginación y búsqueda
    {
      method: 'GET',
      urlPattern: `${basePath}/filter`,
      handler: (request) => {
        const filterParams: Parameters<typeof store.filter>[0] = {};
        if (request.queryParams['page']) filterParams.page = Number(request.queryParams['page']);
        if (request.queryParams['pageSize'])
          filterParams.pageSize = Number(request.queryParams['pageSize']);
        if (request.queryParams['search']) filterParams.search = request.queryParams['search'];
        if (request.queryParams['role']) filterParams.role = request.queryParams['role'];
        return { status: 200, data: store.filter(filterParams) };
      },
    },

    // GET /users/:id → getById
    {
      method: 'GET',
      urlPattern: `${basePath}/:id`,
      handler: (request): MockResponse => {
        const user = store.getById(Number(request.pathParams['id']));
        if (!user) {
          return { status: 404, data: { message: 'User not found' } };
        }
        return { status: 200, data: user };
      },
    },

    // POST /users → create
    {
      method: 'POST',
      urlPattern: basePath,
      handler: (request): MockResponse => {
        const body = request.body as Omit<User, 'id' | 'createdAt'>;
        const user = store.create(body);
        return { status: 201, data: user };
      },
    },

    // PUT /users/:id → update
    {
      method: 'PUT',
      urlPattern: `${basePath}/:id`,
      handler: (request): MockResponse => {
        const body = request.body as Partial<Omit<User, 'id' | 'createdAt'>>;
        const user = store.update(Number(request.pathParams['id']), body);
        if (!user) {
          return { status: 404, data: { message: 'User not found' } };
        }
        return { status: 200, data: user };
      },
    },

    // DELETE /users/:id → remove
    {
      method: 'DELETE',
      urlPattern: `${basePath}/:id`,
      handler: (request): MockResponse => {
        const removed = store.remove(Number(request.pathParams['id']));
        if (!removed) {
          return { status: 404, data: { message: 'User not found' } };
        }
        return { status: 204, data: null };
      },
    },
  ];

  return { handlers, store };
}
