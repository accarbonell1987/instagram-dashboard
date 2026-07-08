import type { CreatePartyInput, Party, UpdatePartyInput } from '../domain/party.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { PartyRepository } from '../repositories/party/index.js';
import type { FilterParams, PaginatedResponse } from '../repositories/repository.interface.js';

export class PartyService {
  constructor(private readonly repository: PartyRepository) {}

  async findAll(): Promise<Party[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Party> {
    const party = await this.repository.findById(id);
    if (!party) throw new NotFoundError('Party', id);
    return party;
  }

  async create(data: CreatePartyInput): Promise<Party> {
    if (data.email) {
      const existing = await this.repository.findByEmail(data.email);
      if (existing) throw new ConflictError('Party', 'email', data.email);
    }
    return this.repository.create(data);
  }

  async update(id: string, data: UpdatePartyInput): Promise<Party> {
    if (data.email) {
      const existing = await this.repository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('Party', 'email', data.email);
      }
    }
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError('Party', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repository.remove(id);
    if (!removed) throw new NotFoundError('Party', id);
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<Party>> {
    return this.repository.filter(params);
  }
}
