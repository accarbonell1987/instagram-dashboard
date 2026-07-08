import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type {
  AssignPersonInput,
  AssignRoleInput,
  BatchCreateUsersInput,
  BatchDeleteUsersInput,
  User,
} from '../domain/user.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { UserRepository } from '../repositories/user/index.js';

import { UserService } from './user.service.js';

// ─── Test Helpers ──────────────────────────────────────

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    partyId: 'party-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockUserRepository extends UserRepository {
  findAll: Mock;
  findById: Mock;
  findByEmail: Mock;
  create: Mock;
  update: Mock;
  remove: Mock;
  filter: Mock;
}

function createMockRepository(): MockUserRepository {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    filter: vi.fn(),
  };
}

// ─── Tests ─────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let repository: MockUserRepository;

  beforeEach(() => {
    repository = createMockRepository();
    service = new UserService(repository);
  });

  // ─── Batch Create ────────────────────────────────────

  describe('batchCreate', () => {
    it('creates multiple users when all emails are unique', async () => {
      const input: BatchCreateUsersInput = {
        users: [
          { email: 'user1@example.com', name: 'User 1', partyId: 'party-1' },
          { email: 'user2@example.com', name: 'User 2', partyId: 'party-2' },
        ],
      };

      repository.findByEmail.mockResolvedValue(null);
      repository.create
        .mockResolvedValueOnce(createMockUser({ id: 'user-1', email: 'user1@example.com' }))
        .mockResolvedValueOnce(createMockUser({ id: 'user-2', email: 'user2@example.com' }));

      const result = await service.batchCreate(input);

      expect(result.total).toBe(2);
      expect(result.created).toHaveLength(2);
      expect(repository.create).toHaveBeenCalledTimes(2);
    });

    it('throws ConflictError if any email already exists', async () => {
      const input: BatchCreateUsersInput = {
        users: [
          { email: 'existing@example.com', name: 'User 1', partyId: 'party-1' },
          { email: 'new@example.com', name: 'User 2', partyId: 'party-2' },
        ],
      };

      repository.findByEmail.mockResolvedValueOnce(
        createMockUser({ email: 'existing@example.com' })
      );

      await expect(service.batchCreate(input)).rejects.toThrow(ConflictError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('validates all emails before creating any users (transactional)', async () => {
      const input: BatchCreateUsersInput = {
        users: [
          { email: 'user1@example.com', name: 'User 1', partyId: 'party-1' },
          { email: 'existing@example.com', name: 'User 2', partyId: 'party-2' },
        ],
      };

      // First email is unique, second exists
      repository.findByEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockUser({ email: 'existing@example.com' }));

      await expect(service.batchCreate(input)).rejects.toThrow(ConflictError);
      // No users should be created if any validation fails
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  // ─── Batch Delete ────────────────────────────────────

  describe('batchDelete', () => {
    it('deletes multiple users and returns count', async () => {
      const input: BatchDeleteUsersInput = {
        ids: ['user-1', 'user-2', 'user-3'],
      };

      repository.remove
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await service.batchDelete(input);

      expect(result.deleted).toBe(3);
      expect(result.notFound).toBeUndefined();
    });

    it('returns notFound array for non-existent users', async () => {
      const input: BatchDeleteUsersInput = {
        ids: ['user-1', 'nonexistent', 'user-3'],
      };

      repository.remove
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false) // nonexistent
        .mockResolvedValueOnce(true);

      const result = await service.batchDelete(input);

      expect(result.deleted).toBe(2);
      expect(result.notFound).toEqual(['nonexistent']);
    });

    it('returns all IDs in notFound when none exist', async () => {
      const input: BatchDeleteUsersInput = {
        ids: ['fake-1', 'fake-2'],
      };

      repository.remove.mockResolvedValue(false);

      const result = await service.batchDelete(input);

      expect(result.deleted).toBe(0);
      expect(result.notFound).toEqual(['fake-1', 'fake-2']);
    });
  });

  // ─── Assign Role ─────────────────────────────────────

  describe('assignRole', () => {
    it('assigns role to existing user', async () => {
      const userId = 'user-1';
      const input: AssignRoleInput = { roleId: 'role-admin' };
      const user = createMockUser({ id: userId });
      const updatedUser = createMockUser({ id: userId, roleId: 'role-admin' });

      repository.findById.mockResolvedValue(user);
      repository.update.mockResolvedValue(updatedUser);

      const result = await service.assignRole(userId, input);

      expect(result.roleId).toBe('role-admin');
      expect(repository.update).toHaveBeenCalledWith(userId, { roleId: 'role-admin' });
    });

    it('throws NotFoundError if user does not exist', async () => {
      const userId = 'nonexistent';
      const input: AssignRoleInput = { roleId: 'role-admin' };

      repository.findById.mockResolvedValue(null);

      await expect(service.assignRole(userId, input)).rejects.toThrow(NotFoundError);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // ─── Assign Person ───────────────────────────────────

  describe('assignPerson', () => {
    it('assigns person (party) to existing user', async () => {
      const userId = 'user-1';
      const input: AssignPersonInput = { partyId: 'party-new' };
      const user = createMockUser({ id: userId });
      const updatedUser = createMockUser({ id: userId, partyId: 'party-new' });

      repository.findById.mockResolvedValue(user);
      repository.update.mockResolvedValue(updatedUser);

      const result = await service.assignPerson(userId, input);

      expect(result.partyId).toBe('party-new');
      expect(repository.update).toHaveBeenCalledWith(userId, { partyId: 'party-new' });
    });

    it('throws NotFoundError if user does not exist', async () => {
      const userId = 'nonexistent';
      const input: AssignPersonInput = { partyId: 'party-1' };

      repository.findById.mockResolvedValue(null);

      await expect(service.assignPerson(userId, input)).rejects.toThrow(NotFoundError);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});
