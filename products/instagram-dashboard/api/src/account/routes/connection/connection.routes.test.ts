import { OpenAPIHono } from '@hono/zod-openapi';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { errorHandler } from '../../../middleware/error-handler.js';
import type { TenantContext } from '../../../shared/lib/jwt-verifier.js';
import type { ConnectionRequest } from '../../domain/connection-request.js';
import type { ConnectionRequestService } from '../../services/connection-request.service.js';

import { createConnectionRoutes } from './connection.routes.js';

const REQUEST: ConnectionRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'tenant-1',
  userId: '22222222-2222-4222-8222-222222222222',
  username: 'miempresa',
  status: 'awaiting_invite',
  lastError: null,
  requestedAt: new Date('2026-09-03T10:00:00.000Z'),
  inviteSentAt: null,
  connectedAt: null,
};

const service = {
  request: vi.fn(),
  getStatus: vi.fn(),
  listPending: vi.fn(),
  markInviteSent: vi.fn(),
} as unknown as ConnectionRequestService;

/** Reemplaza al authGuard, que deja los claims verificados en el contexto. */
function makeApp(role: string) {
  const app = new OpenAPIHono();
  app.use('*', async (c, next) => {
    c.set('tenant', {
      userId: '22222222-2222-4222-8222-222222222222',
      tenantId: 'tenant-1',
      role,
    } as TenantContext);
    await next();
  });
  app.route('/connection', createConnectionRoutes(service));
  app.onError(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('la solicitud propia', () => {
  it('registra la solicitud del usuario', async () => {
    vi.mocked(service.request).mockResolvedValueOnce(REQUEST);

    const res = await makeApp('User').request('/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '@miempresa' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { username: string; status: string } };
    expect(body.data.username).toBe('miempresa');
    expect(body.data.status).toBe('awaiting_invite');
  });

  // El cliente no tiene por que ver ids internos de la plataforma en la
  // respuesta de su propia solicitud.
  it('no expone tenantId ni userId al cliente', async () => {
    vi.mocked(service.request).mockResolvedValueOnce(REQUEST);

    const res = await makeApp('User').request('/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'miempresa' }),
    });

    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('tenantId');
    expect(body.data).not.toHaveProperty('userId');
  });

  it('devuelve null cuando el usuario nunca pidió', async () => {
    vi.mocked(service.getStatus).mockResolvedValueOnce(null);

    const res = await makeApp('User').request('/connection');

    expect(res.status).toBe(200);
    expect((await res.json()) as { data: unknown }).toEqual({ success: true, data: null });
  });
});

describe('la bandeja del operador', () => {
  // ⚠️ El núcleo de esta feature. La bandeja es cross-tenant: deja ver
  // solicitudes de OTROS clientes. Un TenantAdmin administra SU organización y
  // no tiene por qué verlas. Esconder el botón en el front no alcanza — la ruta
  // se llama a mano.
  it.each(['User', 'TenantAdmin'])('rechaza a %s con 403', async (role) => {
    const res = await makeApp(role).request('/connection/pending');

    expect(res.status).toBe(403);
    expect(service.listPending).not.toHaveBeenCalled();
  });

  it('deja pasar al SuperAdmin', async () => {
    vi.mocked(service.listPending).mockResolvedValueOnce([REQUEST]);

    const res = await makeApp('SuperAdmin').request('/connection/pending');

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { tenantId: string }[] };
    expect(body.data[0]?.tenantId).toBe('tenant-1');
  });

  it.each(['User', 'TenantAdmin'])('rechaza que %s marque una invitación como enviada', async (role) => {
    const res = await makeApp(role).request(`/connection/pending/${REQUEST.id}/invite-sent`, {
      method: 'POST',
    });

    expect(res.status).toBe(403);
    expect(service.markInviteSent).not.toHaveBeenCalled();
  });

  it('el SuperAdmin marca la invitación', async () => {
    vi.mocked(service.markInviteSent).mockResolvedValueOnce({ ...REQUEST, status: 'invite_sent' });

    const res = await makeApp('SuperAdmin').request(`/connection/pending/${REQUEST.id}/invite-sent`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(service.markInviteSent).toHaveBeenCalledWith(REQUEST.id);
  });

  // El cliente puede reescribir su solicitud mientras el operador tiene la
  // bandeja abierta. Eso no es un error del sistema, pero tampoco puede
  // reportarse como un alta hecha.
  it('404 si la solicitud dejó de estar esperando', async () => {
    vi.mocked(service.markInviteSent).mockResolvedValueOnce(null);

    const res = await makeApp('SuperAdmin').request(`/connection/pending/${REQUEST.id}/invite-sent`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });
});
