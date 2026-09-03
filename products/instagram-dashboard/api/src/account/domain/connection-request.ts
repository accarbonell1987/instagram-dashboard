/**
 * Estado de una solicitud de conexion de Instagram.
 *
 * Refleja el enum de Prisma. No existe `invite_accepted`: la aceptacion no se
 * puede observar desde afuera, y completar el OAuth ya la demuestra. Un estado
 * que habria que inferir es un estado que puede mentir.
 */
export type ConnectionRequestStatus = 'awaiting_invite' | 'invite_sent' | 'connected' | 'failed';

export interface ConnectionRequest {
  id: string;
  tenantId: string;
  userId: string;
  username: string;
  status: ConnectionRequestStatus;
  lastError: string | null;
  requestedAt: Date;
  inviteSentAt: Date | null;
  connectedAt: Date | null;
}

/**
 * Los tres fallos que Meta devuelve en Development y que el cliente puede
 * arreglar solo. Se distinguen para no mostrarle el mensaje crudo de Meta, que
 * no dice cual de los tres es.
 */
export type ConnectionFailureReason = 'not_a_tester' | 'invite_not_accepted' | 'personal_account';
