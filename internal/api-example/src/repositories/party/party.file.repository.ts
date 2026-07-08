import type { CreatePartyInput, Party, UpdatePartyInput } from '../../domain/party.js';
import { FileBaseRepository } from '../base/file.base.repository.js';
import type { FilterParams } from '../repository.interface.js';

export class PartyFileRepository extends FileBaseRepository<
  Party,
  CreatePartyInput,
  UpdatePartyInput
> {
  constructor(dataDirectory: string) {
    super(dataDirectory, 'parties');
  }

  async findByEmail(email: string): Promise<Party | null> {
    const parties = await this.findAll();
    return parties.find((party) => party.email === email) ?? null;
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

  protected deserialize(raw: Record<string, unknown>): Party {
    return {
      id: raw['id'] as string,
      type: raw['type'] as Party['type'],
      displayName: raw['displayName'] as string,
      email: raw['email'] as string | undefined,
      phone: raw['phone'] as string | undefined,
      createdAt: new Date(raw['createdAt'] as string),
      updatedAt: new Date(raw['updatedAt'] as string),
    };
  }
}
