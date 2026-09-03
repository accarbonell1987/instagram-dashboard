import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ValidationError } from '../../errors.js';
import type { ConnectionRequestRepository } from '../repositories/connection-request/index.js';

import { ConnectionRequestService, normalizeUsername, classifyFailure } from './connection-request.service.js';

const owner = { tenantId: 'tenant-1', userId: 'user-1' };

function makeRepo(): ConnectionRequestRepository {
  return {
    findByOwner: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ id: 'req-1', username: 'ana' }),
    markInviteSent: vi.fn().mockResolvedValue(null),
    markConnected: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(undefined),
    listPendingAcrossTenants: vi.fn().mockResolvedValue([]),
  } as unknown as ConnectionRequestRepository;
}

describe('normalizeUsername', () => {
  it('acepta el usuario con @ y con espacios alrededor', () => {
    expect(normalizeUsername('  @ana.perez_1  ')).toBe('ana.perez_1');
  });

  it('rechaza caracteres que Instagram no admite', () => {
    expect(() => normalizeUsername('ana perez')).toThrow(ValidationError);
    expect(() => normalizeUsername('ana/perez')).toThrow(ValidationError);
  });

  it('rechaza mas de 30 caracteres', () => {
    expect(() => normalizeUsername('a'.repeat(31))).toThrow(ValidationError);
  });

  it('rechaza el vacio', () => {
    expect(() => normalizeUsername('@')).toThrow(ValidationError);
  });
});

describe('ConnectionRequestService.request', () => {
  let repo: ConnectionRequestRepository;
  let notifier: { connectionRequested: ReturnType<typeof vi.fn> };
  let service: ConnectionRequestService;

  beforeEach(() => {
    repo = makeRepo();
    notifier = { connectionRequested: vi.fn().mockResolvedValue(undefined) };
    service = new ConnectionRequestService(repo, notifier);
  });

  it('guarda el usuario ya normalizado', async () => {
    await service.request(owner, '  @Ana.Perez  ');

    expect(repo.upsert).toHaveBeenCalledWith(owner, 'Ana.Perez');
  });

  it('avisa al operador con el usuario y el tenant', async () => {
    await service.request(owner, 'ana');

    expect(notifier.connectionRequested).toHaveBeenCalledWith({
      username: 'ana',
      tenantId: 'tenant-1',
    });
  });

  // La bandeja es la fuente de verdad; el correo es una comodidad. Perder la
  // solicitud porque el SMTP tuvo un mal dia cambia un problema chico por uno
  // grande: el cliente cree que pidio y nadie tiene registro.
  it('si el aviso falla, la solicitud igual queda guardada', async () => {
    notifier.connectionRequested.mockRejectedValueOnce(new Error('SMTP caido'));

    await expect(service.request(owner, 'ana')).resolves.toMatchObject({ id: 'req-1' });
    expect(repo.upsert).toHaveBeenCalled();
  });

  // Validar antes de guardar: este string es lo unico que el operador copia al
  // dashboard de Meta.
  it('no guarda ni avisa si el usuario es invalido', async () => {
    await expect(service.request(owner, 'ana perez')).rejects.toThrow(ValidationError);

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(notifier.connectionRequested).not.toHaveBeenCalled();
  });
});

describe('classifyFailure', () => {
  it('reconoce la cuenta personal', () => {
    expect(classifyFailure('This account is a Personal account')).toBe('personal_account');
  });

  it('reconoce la falta de rol en la app', () => {
    expect(classifyFailure('User is not a tester of this app')).toBe('not_a_tester');
  });

  // Meta devuelve el mismo texto generico para "no acepto" que para varios
  // otros casos, asi que este es el cajon por defecto — a proposito.
  it('cae en invitacion no aceptada cuando no puede distinguir', () => {
    expect(classifyFailure('Invalid platform app')).toBe('invite_not_accepted');
  });
});
