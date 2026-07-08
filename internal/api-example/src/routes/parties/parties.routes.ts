import { createRoute } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { createApiRouter } from '../../lib/create-openapi-router.js';
import {
  DeleteResponseSchema,
  ErrorResponseSchema,
  FilterQuerySchema,
  IdParamSchema,
} from '../../lib/shared-schemas.js';
import type { PartyService } from '../../services/party.service.js';

import {
  CreatePartySchema,
  PartiesListResponseSchema,
  PartyResponseSchema,
  UpdatePartySchema,
  partyToDTO,
} from './parties.schemas.js';

const listParties = createRoute({
  method: 'get',
  path: '/',
  tags: ['Parties'],
  summary: 'List parties',
  description: 'Returns a paginated, searchable list of parties.',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: PartiesListResponseSchema } },
      description: 'Paginated list of parties',
    },
  },
});

const filterParties = createRoute({
  method: 'get',
  path: '/filter',
  tags: ['Parties'],
  summary: 'Filter parties',
  description: 'Returns a paginated, searchable list of parties (alias for list).',
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: PartiesListResponseSchema } },
      description: 'Paginated list of parties',
    },
  },
});

const getParty = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Parties'],
  summary: 'Get party by ID',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: PartyResponseSchema } },
      description: 'Party found',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Party not found',
    },
  },
});

const createParty = createRoute({
  method: 'post',
  path: '/',
  tags: ['Parties'],
  summary: 'Create a party',
  request: {
    body: {
      content: { 'application/json': { schema: CreatePartySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PartyResponseSchema } },
      description: 'Party created',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation error',
    },
  },
});

const updateParty = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Parties'],
  summary: 'Update a party',
  request: {
    params: IdParamSchema,
    body: {
      content: { 'application/json': { schema: UpdatePartySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PartyResponseSchema } },
      description: 'Party updated',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Party not found',
    },
  },
});

const deleteParty = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Parties'],
  summary: 'Delete a party',
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteResponseSchema } },
      description: 'Party deleted',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Party not found',
    },
  },
});

export function createPartyRoutes(partyService: PartyService): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(listParties, async (c) => {
    const params = c.req.valid('query');
    const result = await partyService.filter(params);
    return c.json(
      {
        success: true,
        data: { ...result, data: result.data.map(partyToDTO) },
      },
      200
    );
  });

  routes.openapi(filterParties, async (c) => {
    const params = c.req.valid('query');
    const result = await partyService.filter(params);
    return c.json(
      {
        success: true,
        data: { ...result, data: result.data.map(partyToDTO) },
      },
      200
    );
  });

  routes.openapi(getParty, async (c) => {
    const { id } = c.req.valid('param');
    const party = await partyService.findById(id);
    return c.json({ success: true, data: partyToDTO(party) }, 200);
  });

  routes.openapi(createParty, async (c) => {
    const body = c.req.valid('json');
    const party = await partyService.create(body);
    return c.json({ success: true, data: partyToDTO(party) }, 201);
  });

  routes.openapi(updateParty, async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const party = await partyService.update(id, body);
    return c.json({ success: true, data: partyToDTO(party) }, 200);
  });

  routes.openapi(deleteParty, async (c) => {
    const { id } = c.req.valid('param');
    await partyService.remove(id);
    return c.json({ success: true, data: null }, 200);
  });

  return routes;
}
