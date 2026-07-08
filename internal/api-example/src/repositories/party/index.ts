import type { CreatePartyInput, Party, UpdatePartyInput } from '../../domain/party.js';
import type { Repository } from '../repository.interface.js';

export interface PartyRepository extends Repository<Party, CreatePartyInput, UpdatePartyInput> {
  findByEmail(email: string): Promise<Party | null>;
}

export { PartyInMemoryRepository } from './party.in-memory.repository.js';
export { PartyFileRepository } from './party.file.repository.js';
export { PartyPrismaRepository } from './party.prisma.repository.js';
