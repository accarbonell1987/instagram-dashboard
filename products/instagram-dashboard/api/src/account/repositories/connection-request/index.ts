import type { Owner } from '../../../shared/domain/owner.js';
import type { ConnectionRequest } from '../../domain/connection-request.js';

export interface ConnectionRequestRepository {
  /** La solicitud del propio usuario. Una por usuario, igual que la cuenta. */
  findByOwner(owner: Owner): Promise<ConnectionRequest | null>;

  /**
   * Crea la solicitud o reescribe la que haya. Reintentar con otro usuario
   * reusa la fila y vuelve a `awaiting_invite`: acumular solicitudes muertas
   * llenaria la bandeja del operador de trabajo que ya no existe.
   */
  upsert(owner: Owner, username: string): Promise<ConnectionRequest>;

  /** El operador dio el alta en el App Dashboard de Meta. */
  markInviteSent(id: string): Promise<ConnectionRequest | null>;

  /** El OAuth se completo. Se llama desde el callback, no desde el wizard. */
  markConnected(owner: Owner): Promise<void>;

  /** Guarda el ultimo error del callback para que el wizard explique cual fue. */
  recordFailure(owner: Owner, message: string): Promise<void>;

  /**
   * ⚠️ LA UNICA CONSULTA CROSS-TENANT DEL PRODUCTO.
   *
   * No recibe Owner a proposito: la bandeja del operador tiene que ver las
   * solicitudes de TODOS los tenants, porque el alta en Meta la hace una sola
   * persona para toda la plataforma.
   *
   * Todo lo demas en este codebase se scopea por tenant Y usuario. Esta es la
   * excepcion, y la ruta que la expone va detras de un guard de SuperAdmin
   * estricto — no TenantAdmin. Si algun dia se afloja ese guard, esto pasa a
   * ser una fuga de datos entre clientes.
   */
  listPendingAcrossTenants(): Promise<ConnectionRequest[]>;
}
