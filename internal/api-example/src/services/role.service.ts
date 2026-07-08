import type { CreateRoleInput, Role, UpdateRoleInput } from '../domain/role.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { FilterParams, PaginatedResponse } from '../repositories/repository.interface.js';
import type { RoleRepository } from '../repositories/role/index.js';

export class RoleService {
  constructor(private readonly repository: RoleRepository) {}

  async findAll(): Promise<Role[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Role> {
    const role = await this.repository.findById(id);
    if (!role) throw new NotFoundError('Role', id);
    return role;
  }

  async create(data: CreateRoleInput): Promise<Role> {
    const existing = await this.repository.findByName(data.name);
    if (existing) throw new ConflictError('Role', 'name', data.name);
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateRoleInput): Promise<Role> {
    if (data.name) {
      const existing = await this.repository.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError('Role', 'name', data.name);
      }
    }
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError('Role', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repository.remove(id);
    if (!removed) throw new NotFoundError('Role', id);
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<Role>> {
    return this.repository.filter(params);
  }
}
