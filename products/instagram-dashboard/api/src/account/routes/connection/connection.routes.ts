import { createRoute, z } from '@hono/zod-openapi';
import type { OpenAPIHono } from '@hono/zod-openapi';

import { ForbiddenError, NotFoundError } from '../../../errors.js';
import { ownerOf } from '../../../shared/domain/owner.js';
import { createApiRouter } from '../../../shared/lib/create-openapi-router.js';
import { ErrorResponseSchema } from '../../../shared/lib/shared-schemas.js';
import type { ConnectionRequest } from '../../domain/connection-request.js';
import type { ConnectionRequestService } from '../../services/connection-request.service.js';

import {
  ConnectionRequestBodySchema,
  ConnectionRequestSchema,
  PendingRequestSchema,
} from './connection.schemas.js';

/**
 * La bandeja del operador ve TODOS los tenants, asi que exige SuperAdmin — no
 * TenantAdmin.
 *
 * Un TenantAdmin es administrador de SU organizacion; dejarlo entrar aca le
 * mostraria las solicitudes de los demas clientes. Y esconder el boton en el
 * front no alcanza: la ruta se puede llamar a mano. Es el mismo patron ya
 * documentado en el CLAUDE.md del hub.
 */
function assertSuperAdmin(role: string): void {
  if (role !== 'SuperAdmin') {
    throw new ForbiddenError('Solo un SuperAdmin puede ver las solicitudes de conexión.');
  }
}

const requestRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Connection'],
  summary: 'Pedir la conexión de una cuenta de Instagram',
  request: { body: { content: { 'application/json': { schema: ConnectionRequestBodySchema } } } },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), data: ConnectionRequestSchema }) } },
      description: 'Solicitud registrada',
    },
    422: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Usuario inválido' },
  },
});

const statusRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Connection'],
  summary: 'Estado de la propia solicitud',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), data: ConnectionRequestSchema.nullable() }),
        },
      },
      description: 'La solicitud del usuario, o null si nunca pidió',
    },
  },
});

const pendingRoute = createRoute({
  method: 'get',
  path: '/pending',
  tags: ['Connection'],
  summary: 'Bandeja del operador — TODOS los tenants (SuperAdmin)',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true), data: z.array(PendingRequestSchema) }),
        },
      },
      description: 'Solicitudes sin resolver',
    },
    403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'No es SuperAdmin' },
  },
});

const inviteSentRoute = createRoute({
  method: 'post',
  path: '/pending/{id}/invite-sent',
  tags: ['Connection'],
  summary: 'Marcar que el alta en Meta fue hecha (SuperAdmin)',
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.literal(true), data: PendingRequestSchema }) } },
      description: 'Marcada',
    },
    403: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'No es SuperAdmin' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'La solicitud ya no estaba esperando' },
  },
});

export function createConnectionRoutes(service: ConnectionRequestService): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(requestRoute, async (c) => {
    const tenant = c.get('tenant');
    const { username } = c.req.valid('json');
    const saved = await service.request(ownerOf(tenant), username);
    return c.json({ success: true as const, data: serialize(saved) }, 200);
  });

  routes.openapi(statusRoute, async (c) => {
    const tenant = c.get('tenant');
    const found = await service.getStatus(ownerOf(tenant));
    return c.json({ success: true as const, data: found ? serialize(found) : null }, 200);
  });

  routes.openapi(pendingRoute, async (c) => {
    const tenant = c.get('tenant');
    assertSuperAdmin(tenant.role);
    const pending = await service.listPending();
    return c.json({ success: true as const, data: pending.map(serializeForOperator) }, 200);
  });

  routes.openapi(inviteSentRoute, async (c) => {
    const tenant = c.get('tenant');
    assertSuperAdmin(tenant.role);
    const { id } = c.req.valid('param');
    const updated = await service.markInviteSent(id);
    if (!updated) {
      // 404 y no 409: desde el operador es indistinguible que la solicitud haya
      // desaparecido o que el cliente la haya reescrito mientras miraba.
      throw new NotFoundError('Solicitud de conexión', id);
    }
    return c.json({ success: true as const, data: serializeForOperator(updated) }, 200);
  });

  return routes;
}

/** Lo que el cliente puede ver de su propia solicitud: sin ids de tenant. */
function serialize(request: ConnectionRequest) {
  return {
    id: request.id,
    username: request.username,
    status: request.status,
    lastError: request.lastError,
    requestedAt: request.requestedAt.toISOString(),
    inviteSentAt: request.inviteSentAt?.toISOString() ?? null,
    connectedAt: request.connectedAt?.toISOString() ?? null,
  };
}

function serializeForOperator(request: ConnectionRequest) {
  return { ...serialize(request), tenantId: request.tenantId, userId: request.userId };
}
