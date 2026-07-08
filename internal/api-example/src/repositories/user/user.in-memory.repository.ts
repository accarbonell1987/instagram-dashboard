import type { CreateUserInput, UpdateUserInput, User } from '../../domain/user.js';
import { InMemoryBaseRepository } from '../base/in-memory.base.repository.js';
import type { FilterParams } from '../repository.interface.js';
import { SEED_USERS } from '../seed.js';

export class UserInMemoryRepository extends InMemoryBaseRepository<
  User,
  CreateUserInput,
  UpdateUserInput
> {
  constructor() {
    super();
    for (const user of SEED_USERS) {
      this.store.set(user.id, user);
    }
  }

  findByEmail(email: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.email === email) return Promise.resolve(user);
    }
    return Promise.resolve(null);
  }

  protected override applySearch(items: User[], params: FilterParams): User[] {
    if (!params.search) return items;
    const term = params.search.toLowerCase();
    return items.filter(
      (user) => user.email.toLowerCase().includes(term) || user.name?.toLowerCase().includes(term)
    );
  }

  protected buildEntity(data: CreateUserInput): User {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      partyId: data.partyId,
      createdAt: now,
      updatedAt: now,
    };
  }
}
