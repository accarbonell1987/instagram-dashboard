import type { CreatePartyInput, Party, UpdatePartyInput } from '../../domain/party.js';
import { InMemoryBaseRepository } from '../base/in-memory.base.repository.js';
import type { FilterParams } from '../repository.interface.js';
import { SEED_PARTIES } from '../seed.js';

export class PartyInMemoryRepository extends InMemoryBaseRepository<
  Party,
  CreatePartyInput,
  UpdatePartyInput
> {
  constructor() {
    super();
    for (const party of SEED_PARTIES) {
      this.store.set(party.id, party);
    }
  }

  findByEmail(email: string): Promise<Party | null> {
    for (const party of this.store.values()) {
      if (party.email === email) return Promise.resolve(party);
    }
    return Promise.resolve(null);
  }

  protected override applySearch(items: Party[], params: FilterParams): Party[] {
    if (!params.search) return items;
    const term = params.search.toLowerCase();
    return items.filter(
      (party) =>
        party.displayName.toLowerCase().includes(term) || party.email?.toLowerCase().includes(term)
    );
  }

  protected buildEntity(data: CreatePartyInput): Party {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      type: data.type,
      displayName: data.displayName,
      email: data.email,
      phone: data.phone,
      createdAt: now,
      updatedAt: now,
    };
  }
}
