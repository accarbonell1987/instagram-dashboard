import type { CreateRoleInput, Role, UpdateRoleInput } from '../../domain/role.js';
import type { Repository } from '../repository.interface.js';

export interface RoleRepository extends Repository<Role, CreateRoleInput, UpdateRoleInput> {
  findByName(name: string): Promise<Role | null>;
}

export { RoleInMemoryRepository } from './role.in-memory.repository.js';
export { RoleFileRepository } from './role.file.repository.js';
export { RolePrismaRepository } from './role.prisma.repository.js';
