import type { CreateRoleInput, Role, UpdateRoleInput } from '../../domain/role.js';
import { InMemoryBaseRepository } from '../base/in-memory.base.repository.js';
import type { FilterParams } from '../repository.interface.js';
import { SEED_ROLES } from '../seed.js';

export class RoleInMemoryRepository extends InMemoryBaseRepository<
  Role,
  CreateRoleInput,
  UpdateRoleInput
> {
  constructor() {
    super();
    for (const role of SEED_ROLES) {
      this.store.set(role.id, role);
    }
  }

  findByName(name: string): Promise<Role | null> {
    for (const role of this.store.values()) {
      if (role.name === name) return Promise.resolve(role);
    }
    return Promise.resolve(null);
  }

  protected override applySearch(items: Role[], params: FilterParams): Role[] {
    if (!params.search) return items;
    const term = params.search.toLowerCase();
    return items.filter(
      (role) =>
        role.name.toLowerCase().includes(term) || role.description?.toLowerCase().includes(term)
    );
  }

  protected buildEntity(data: CreateRoleInput): Role {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      createdAt: now,
      updatedAt: now,
    };
  }
}
