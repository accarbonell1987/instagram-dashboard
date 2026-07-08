import type {
  AssignPersonInput,
  AssignRoleInput,
  BatchCreateResult,
  BatchCreateUsersInput,
  BatchDeleteResult,
  BatchDeleteUsersInput,
  CreateUserInput,
  UpdateUserInput,
  User,
} from '../domain/user.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { FilterParams, PaginatedResponse } from '../repositories/repository.interface.js';
import type { UserRepository } from '../repositories/user/index.js';

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async findAll(): Promise<User[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async create(data: CreateUserInput): Promise<User> {
    const existing = await this.repository.findByEmail(data.email);
    if (existing) throw new ConflictError('User', 'email', data.email);
    return this.repository.create(data);
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    if (data.email) {
      const existing = await this.repository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictError('User', 'email', data.email);
      }
    }
    const updated = await this.repository.update(id, data);
    if (!updated) throw new NotFoundError('User', id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.repository.remove(id);
    if (!removed) throw new NotFoundError('User', id);
  }

  async filter(params: FilterParams): Promise<PaginatedResponse<User>> {
    return this.repository.filter(params);
  }

  // ─── Batch Operations ──────────────────────────────────

  async batchCreate(input: BatchCreateUsersInput): Promise<BatchCreateResult> {
    const created: User[] = [];

    // Validate all emails are unique before creating any
    for (const userData of input.users) {
      const existing = await this.repository.findByEmail(userData.email);
      if (existing) {
        throw new ConflictError('User', 'email', userData.email);
      }
    }

    // Create all users
    for (const userData of input.users) {
      const user = await this.repository.create(userData);
      created.push(user);
    }

    return { created, total: created.length };
  }

  async batchDelete(input: BatchDeleteUsersInput): Promise<BatchDeleteResult> {
    const notFound: string[] = [];
    let deleted = 0;

    for (const id of input.ids) {
      const removed = await this.repository.remove(id);
      if (removed) {
        deleted++;
      } else {
        notFound.push(id);
      }
    }

    return {
      deleted,
      notFound: notFound.length > 0 ? notFound : undefined,
    };
  }

  // ─── Assign Operations ─────────────────────────────────

  async assignRole(id: string, input: AssignRoleInput): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', id);

    // Note: Role validation would require RoleRepository injection
    // For now, we trust the roleId. Production code should validate.
    const updated = await this.repository.update(id, { roleId: input.roleId });
    if (!updated) throw new NotFoundError('User', id);

    return updated;
  }

  async assignPerson(id: string, input: AssignPersonInput): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', id);

    // Note: Party validation would require PartyRepository injection
    const updated = await this.repository.update(id, { partyId: input.partyId });
    if (!updated) throw new NotFoundError('User', id);

    return updated;
  }
}
