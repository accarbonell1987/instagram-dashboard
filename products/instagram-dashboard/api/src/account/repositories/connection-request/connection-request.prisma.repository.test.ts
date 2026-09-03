import type { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PrismaConnectionRequestRepository } from './connection-request.prisma.repository.js';


/** El primer argumento de la primera llamada, sin aserciones non-null. */
function firstArg(fn: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return (fn.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

const owner = { tenantId: 'tenant-1', userId: 'user-1' };

const row = {
  id: 'req-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  username: 'someone',
  status: 'awaiting_invite' as const,
  lastError: null,
  requestedAt: new Date('2026-09-03T00:00:00Z'),
  inviteSentAt: null,
  connectedAt: null,
};

function makePrisma() {
  return {
    instagramConnectionRequest: {
      findFirst: vi.fn().mockResolvedValue(row),
      findUnique: vi.fn().mockResolvedValue(row),
      findMany: vi.fn().mockResolvedValue([row]),
      upsert: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe('PrismaConnectionRequestRepository', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let repo: PrismaConnectionRequestRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaConnectionRequestRepository(prisma as unknown as PrismaClient);
  });

  // Scopear por tenant solo dejaria que cualquier miembro leyera la solicitud
  // de sus companeros. Es la misma regla que el resto del producto.
  it('busca acotando por tenant Y usuario', async () => {
    await repo.findByOwner(owner);

    expect(prisma.instagramConnectionRequest.findFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', userId: 'user-1' },
    });
  });

  // Si el cliente corrige el usuario, el alta que el operador ya hizo quedo
  // hecha para una cuenta ajena. Volver a awaiting_invite lo devuelve a la
  // bandeja; dejarlo en invite_sent lo dejaria esperando una invitacion que
  // nunca va a llegar a la cuenta correcta.
  it('al reescribir la solicitud vuelve a awaiting_invite y limpia la invitacion', async () => {
    await repo.upsert(owner, 'otro_usuario');

    const call = { update: firstArg(prisma.instagramConnectionRequest.upsert)['update'] as Record<string, unknown> };
    expect(call.update['status']).toBe('awaiting_invite');
    expect(call.update['inviteSentAt']).toBeNull();
    expect(call.update['lastError']).toBeNull();
  });

  // El operador puede tener la bandeja abierta mientras el cliente reescribe su
  // solicitud. Marcarla entonces reportaria un alta que no corresponde.
  it('solo marca invitada una solicitud que sigue esperando', async () => {
    await repo.markInviteSent('req-1');

    const call = { where: firstArg(prisma.instagramConnectionRequest.updateMany)['where'] as Record<string, unknown> };
    expect(call.where['status']).toBe('awaiting_invite');
  });

  it('devuelve null si la solicitud ya no estaba esperando', async () => {
    prisma.instagramConnectionRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(repo.markInviteSent('req-1')).resolves.toBeNull();
  });

  it('marcar conectado se acota al dueno', async () => {
    await repo.markConnected(owner);

    const call = { where: firstArg(prisma.instagramConnectionRequest.updateMany)['where'] as Record<string, unknown> };
    expect(call.where).toEqual({ tenantId: 'tenant-1', userId: 'user-1' });
  });

  // ⚠️ Este test afirma la EXCEPCION, no la regla. La bandeja del operador es
  // cross-tenant a proposito, y la ruta que la expone va detras de un guard de
  // SuperAdmin. Si alguien agrega un filtro de tenant aca, la bandeja deja de
  // funcionar; si alguien afloja el guard de la ruta, esto es una fuga.
  it('la bandeja del operador NO se acota por tenant, a proposito', async () => {
    await repo.listPendingAcrossTenants();

    const call = { where: firstArg(prisma.instagramConnectionRequest.findMany)['where'] as Record<string, unknown> };
    expect(call.where).not.toHaveProperty('tenantId');
    expect(call.where).not.toHaveProperty('userId');
    expect(call.where['status']).toEqual({ in: ['awaiting_invite', 'invite_sent', 'failed'] });
  });

  it('la bandeja excluye las ya conectadas', async () => {
    await repo.listPendingAcrossTenants();

    const call = { where: firstArg(prisma.instagramConnectionRequest.findMany)['where'] as { status: { in: string[] } } };
    expect(call.where.status.in).not.toContain('connected');
  });
});
