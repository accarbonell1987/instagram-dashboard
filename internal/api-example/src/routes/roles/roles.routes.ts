import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import {
  DeleteResponseSchema,
  ErrorResponseSchema,
  FilterQuerySchema,
  IdParamSchema,
} from '../../lib/shared-schemas.js';
import type { RoleService } from '../../services/role.service.js';

import {
  CreateRoleSchema,
  RoleResponseSchema,
  RolesListResponseSchema,
  UpdateRoleSchema,
  roleToDTO,
} from './roles.schemas.js';

const listRoles = createRoute({
  method: 'get',
  path: '/',
  tags: ['Roles'],
  summary: 'List roles',
  description: 'Returns a paginated, searchable list of roles.',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: RolesListResponseSchema } },
      description: 'Paginated list of roles',
    },
  },
});

const filterRoles = createRoute({
  method: 'get',
  path: '/filter',
  tags: ['Roles'],
  summary: 'Filter roles',
  description: 'Returns a paginated, searchable list of roles (alias for list).',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: RolesListResponseSchema } },
      description: 'Paginated list of roles',
    },
  },
});

const getRole = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Roles'],
  summary: 'Get role by ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: RoleResponseSchema } },
      description: 'Role found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Role not found',
    },
  },
});

const createRole = createRoute({
  method: 'post',
  path: '/',
  tags: ['Roles'],
  summary: 'Create a role',
  request: {
    body: {
      content: { 'application/json': { schema: CreateRoleSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: RoleResponseSchema } },
      description: 'Role created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Role name already exists',
    },
  },
});

const updateRole = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Roles'],
  summary: 'Update a role',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdateRoleSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RoleResponseSchema } },
      description: 'Role updated',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Role not found',
    },
    409: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Role name already in use',
    },
  },
});

const deleteRole = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Roles'],
  summary: 'Delete a role',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteResponseSchema } },
      description: 'Role deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Role not found',
    },
  },
});

export function createRoleRoutes(roleService: RoleService): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(listRoles, async (c) => {
    const params = c.req.valid('query');
    const result = await roleService.filter(params);
    return c.json({ success: true, data: { ...result, data: result.data.map(roleToDTO) } }, 200);
  });

  routes.openapi(filterRoles, async (c) => {
    const params = c.req.valid('query');
    const result = await roleService.filter(params);
    return c.json({ success: true, data: { ...result, data: result.data.map(roleToDTO) } }, 200);
  });

  routes.openapi(getRole, async (c) => {
    const { id } = c.req.valid('param');
    const role = await roleService.findById(id);
    return c.json({ success: true, data: roleToDTO(role) }, 200);
  });

  routes.openapi(createRole, async (c) => {
    const body = c.req.valid('json');
    const role = await roleService.create(body);
    return c.json({ success: true, data: roleToDTO(role) }, 201);
  });

  routes.openapi(updateRole, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const role = await roleService.update(id, body);
    return c.json({ success: true, data: roleToDTO(role) }, 200);
  });

  routes.openapi(deleteRole, async (c) => {
    const { id } = c.req.valid('param');
    await roleService.remove(id);
    return c.json({ success: true, data: null }, 200);
  });

  return routes;
}
