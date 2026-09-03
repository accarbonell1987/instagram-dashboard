import { ValidationError } from '../../errors.js';
import type { Owner } from '../../shared/domain/owner.js';
import type { ConnectionFailureReason, ConnectionRequest } from '../domain/connection-request.js';
import type { OperatorNotifier } from '../lib/operator-notifier.js';
import type { ConnectionRequestRepository } from '../repositories/connection-request/index.js';

/**
 * Reglas de Instagram: 1-30 caracteres, letras, digitos, puntos y guiones bajos.
 * Se valida antes de guardar porque este string es lo unico que el operador
 * copia al App Dashboard de Meta; un caracter de mas y el alta falla en silencio
 * del otro lado.
 */
const USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

export class ConnectionRequestService {
  constructor(
    private readonly repo: ConnectionRequestRepository,
    private readonly notifier: OperatorNotifier,
  ) {}

  /** El cliente pide conectar. Idempotente: reintentar reescribe su solicitud. */
  async request(owner: Owner, rawUsername: string): Promise<ConnectionRequest> {
    const username = normalizeUsername(rawUsername);
    const saved = await this.repo.upsert(owner, username);

    // El aviso no puede voltear la solicitud: si el correo falla, el dato ya
    // quedo guardado y la bandeja lo muestra igual. Perder la solicitud porque
    // el SMTP tuvo un mal dia seria cambiar un problema chico por uno grande.
    try {
      await this.notifier.connectionRequested({ username, tenantId: owner.tenantId });
    } catch {
      // Deliberadamente silencioso: la bandeja es la fuente de verdad.
    }

    return saved;
  }

  getStatus(owner: Owner): Promise<ConnectionRequest | null> {
    return this.repo.findByOwner(owner);
  }

  /** El operador dio el alta en Meta. Null si la solicitud cambio mientras tanto. */
  markInviteSent(id: string): Promise<ConnectionRequest | null> {
    return this.repo.markInviteSent(id);
  }

  /** La bandeja del operador. Cross-tenant: ver la advertencia del repositorio. */
  listPending(): Promise<ConnectionRequest[]> {
    return this.repo.listPendingAcrossTenants();
  }

  /** Se llama desde el callback de OAuth, no desde el wizard. */
  markConnected(owner: Owner): Promise<void> {
    return this.repo.markConnected(owner);
  }

  recordFailure(owner: Owner, reason: ConnectionFailureReason): Promise<void> {
    return this.repo.recordFailure(owner, reason);
  }
}

export function normalizeUsername(raw: string): string {
  // El cliente escribe con o sin @, y suele pegarlo con espacios alrededor.
  const username = raw.trim().replace(/^@+/, '');
  if (!USERNAME_PATTERN.test(username)) {
    throw new ValidationError(
      'El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos (máximo 30).',
    );
  }
  return username;
}

/**
 * Traduce el error de Meta a uno de los tres fallos que el cliente puede
 * arreglar solo.
 *
 * Meta devuelve el mismo mensaje generico para "no tiene rol en la app" y para
 * "tiene rol pero no acepto la invitacion", asi que no se puede distinguir con
 * certeza: el wizard muestra los dos pasos y deja que el cliente confirme cual
 * le falta. Es mejor que mostrarle el texto crudo de Meta, que no dice ninguno.
 */
export function classifyFailure(message: string): ConnectionFailureReason {
  const text = message.toLowerCase();
  if (text.includes('personal')) return 'personal_account';
  if (text.includes('tester') || text.includes('role')) return 'not_a_tester';
  return 'invite_not_accepted';
}
