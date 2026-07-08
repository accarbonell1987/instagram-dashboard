import type { CreateRoleInput, Role, UpdateRoleInput } from '../../domain/role.js';
import { FileBaseRepository } from '../base/file.base.repository.js';
import type { FilterParams } from '../repository.interface.js';

export class RoleFileRepository extends FileBaseRepository<Role, CreateRoleInput, UpdateRoleInput> {
  constructor(dataDirectory: string) {
    super(dataDirectory, 'roles');
  }

  async findByName(name: string): Promise<Role | null> {
    const roles = await this.findAll();
    return roles.find((role) => role.name === name) ?? null;
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

  protected deserialize(raw: Record<string, unknown>): Role {
    return {
      id: raw['id'] as string,
      name: raw['name'] as string,
      description: raw['description'] as string | undefined,
      permissions: raw['permissions'] as string[],
      createdAt: new Date(raw['createdAt'] as string),
      updatedAt: new Date(raw['updatedAt'] as string),
    };
  }
}
