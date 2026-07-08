import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import {
  DeleteResponseSchema,
  ErrorResponseSchema,
  FilterQuerySchema,
  IdParamSchema,
} from '../../lib/shared-schemas.js';
import type { UserService } from '../../services/user.service.js';

import {
  AssignPersonRequestSchema,
  AssignPersonResponseSchema,
  AssignRoleRequestSchema,
  AssignRoleResponseSchema,
  BatchCreateUsersRequestSchema,
  BatchCreateUsersResponseSchema,
  BatchDeleteUsersRequestSchema,
  BatchDeleteUsersResponseSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserResponseSchema,
  UsersListResponseSchema,
  userToDTO,
} from './users.schemas.js';

const listUsers = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'List users',
  description: 'Returns a paginated, searchable list of users.',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: UsersListResponseSchema } },
      description: 'Paginated list of users',
    },
  },
});

const filterUsers = createRoute({
  method: 'get',
  path: '/filter',
  tags: ['Users'],
  summary: 'Filter users',
  description: 'Returns a paginated, searchable list of users (alias for list).',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: UsersListResponseSchema } },
      description: 'Paginated list of users',
    },
  },
});

const getUser = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
});

const createUser = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create a user',
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Email already exists',
    },
  },
});

const updateUser = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update a user',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateUserSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserResponseSchema } },
      description: 'User updated',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Email already in use by another user',
    },
  },
});

const deleteUser = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete a user',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteResponseSchema } },
      description: 'User deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
});

// ─── Batch Operations ──────────────────────────────────

const batchCreateUsers = createRoute({
  method: 'post',
  path: '/batch',
  tags: ['Users'],
  summary: 'Create multiple users',
  description:
    'Creates multiple users in a single request (1-100 items). All must succeed or the operation fails.',
  request: {
    body: {
      content: { 'application/json': { schema: BatchCreateUsersRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: BatchCreateUsersResponseSchema } },
      description: 'Users created successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'One or more emails already exist',
    },
  },
});

const batchDeleteUsers = createRoute({
  method: 'post',
  path: '/batch/delete',
  tags: ['Users'],
  summary: 'Delete multiple users',
  description:
    'Deletes multiple users by their IDs (1-100 items). Returns deleted and not found IDs.',
  request: {
    body: {
      content: { 'application/json': { schema: BatchDeleteUsersRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BatchDeleteUsersResponseSchema } },
      description: 'Batch delete completed',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
  },
});

// ─── Assign Operations ─────────────────────────────────

const assignRole = createRoute({
  method: 'post',
  path: '/{id}/assign-role',
  tags: ['Users'],
  summary: 'Assign role to user',
  description: 'Assigns a role to a user by setting the roleId field.',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: AssignRoleRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AssignRoleResponseSchema } },
      description: 'Role assigned successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
});

const assignPerson = createRoute({
  method: 'post',
  path: '/{id}/assign-person',
  tags: ['Users'],
  summary: 'Associate user with person',
  description: 'Associates a user with a person (party) by setting the partyId field.',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: AssignPersonRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AssignPersonResponseSchema } },
      description: 'Person assigned successfully',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'User not found',
    },
  },
});

export function createUserRoutes(userService: UserService): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(listUsers, async (c) => {
    const params = c.req.valid('query');
    const result = await userService.filter(params);
    return c.json({ success: true, data: { ...result, data: result.data.map(userToDTO) } }, 200);
  });

  routes.openapi(filterUsers, async (c) => {
    const params = c.req.valid('query');
    const result = await userService.filter(params);
    return c.json({ success: true, data: { ...result, data: result.data.map(userToDTO) } }, 200);
  });

  routes.openapi(getUser, async (c) => {
    const { id } = c.req.valid('param');
    const user = await userService.findById(id);
    return c.json({ success: true, data: userToDTO(user) }, 200);
  });

  routes.openapi(createUser, async (c) => {
    const body = c.req.valid('json');
    const user = await userService.create(body);
    return c.json({ success: true, data: userToDTO(user) }, 201);
  });

  routes.openapi(updateUser, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = await userService.update(id, body);
    return c.json({ success: true, data: userToDTO(user) }, 200);
  });

  routes.openapi(deleteUser, async (c) => {
    const { id } = c.req.valid('param');
    await userService.remove(id);
    return c.json({ success: true, data: null }, 200);
  });

  // ─── Batch Operations ──────────────────────────────────

  routes.openapi(batchCreateUsers, async (c) => {
    const body = c.req.valid('json');
    const result = await userService.batchCreate(body);
    return c.json(
      { success: true, data: { created: result.created.map(userToDTO), total: result.total } },
      201
    );
  });

  routes.openapi(batchDeleteUsers, async (c) => {
    const body = c.req.valid('json');
    const result = await userService.batchDelete(body);
    return c.json({ success: true, data: result }, 200);
  });

  // ─── Assign Operations ─────────────────────────────────

  routes.openapi(assignRole, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = await userService.assignRole(id, body);
    return c.json({ success: true, data: userToDTO(user) }, 200);
  });

  routes.openapi(assignPerson, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const user = await userService.assignPerson(id, body);
    return c.json({ success: true, data: userToDTO(user) }, 200);
  });

  return routes;
}
