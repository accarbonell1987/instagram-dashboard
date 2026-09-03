import type { PrismaClient, InstagramConnectionRequest as Row } from '@prisma/client';

import type { Owner } from '../../../shared/domain/owner.js';
import type { ConnectionRequest } from '../../domain/connection-request.js';
import type { ConnectionRequestRepository } from './index.js';

export class PrismaConnectionRequestRepository implements ConnectionRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOwner(owner: Owner): Promise<ConnectionRequest | null> {
    const record = await this.prisma.instagramConnectionRequest.findFirst({ where: { ...owner } });
    return record ? toDomain(record) : null;
  }

  async upsert(owner: Owner, username: string): Promise<ConnectionRequest> {
    // Volver a `awaiting_invite` en el update es deliberado: si el cliente
    // corrige el usuario, el alta anterior quedo hecha para una cuenta que no
    // es la suya y el operador tiene que rehacerla.
    const record = await this.prisma.instagramConnectionRequest.upsert({
      where: { tenantId_userId: { ...owner } },
      update: {
        username,
        status: 'awaiting_invite',
        lastError: null,
        inviteSentAt: null,
        requestedAt: new Date(),
      },
      create: { ...owner, username },
    });
    return toDomain(record);
  }

  async markInviteSent(id: string): Promise<ConnectionRequest | null> {
    // updateMany en vez de update: `update` tira si no encuentra la fila, y una
    // solicitud que el cliente reescribio mientras el operador miraba la
    // bandeja no es un error del sistema.
    const { count } = await this.prisma.instagramConnectionRequest.updateMany({
      where: { id, status: 'awaiting_invite' },
      data: { status: 'invite_sent', inviteSentAt: new Date() },
    });
    if (count === 0) return null;
    const record = await this.prisma.instagramConnectionRequest.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async markConnected(owner: Owner): Promise<void> {
    // Sin fila no hay nada que marcar: una cuenta conectada por el flujo viejo
    // nunca creo solicitud, y eso no es una falla.
    await this.prisma.instagramConnectionRequest.updateMany({
      where: { ...owner },
      data: { status: 'connected', connectedAt: new Date(), lastError: null },
    });
  }

  async recordFailure(owner: Owner, message: string): Promise<void> {
    await this.prisma.instagramConnectionRequest.updateMany({
      where: { ...owner },
      data: { status: 'failed', lastError: message },
    });
  }

  /** Ver la advertencia del contrato: esta consulta NO se scopea por tenant. */
  async listPendingAcrossTenants(): Promise<ConnectionRequest[]> {
    const records = await this.prisma.instagramConnectionRequest.findMany({
      where: { status: { in: ['awaiting_invite', 'invite_sent', 'failed'] } },
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
    });
    return records.map(toDomain);
  }
}

function toDomain(record: Row): ConnectionRequest {
  return {
    id: record.id,
    tenantId: record.tenantId,
    userId: record.userId,
    username: record.username,
    status: record.status,
    lastError: record.lastError,
    requestedAt: record.requestedAt,
    inviteSentAt: record.inviteSentAt,
    connectedAt: record.connectedAt,
  };
}
