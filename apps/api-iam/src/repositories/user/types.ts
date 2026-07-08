import type { User, UserStatus, UserRole } from '../../domain/index.js';

export interface CreateUserInput {
  email: string;
  passwordHash: string | undefined;
  tenantId: string;
  role: UserRole;
  status: UserStatus;
}

export interface UserRepository {
  findByEmail(email: string, tenantId: string): Promise<User | null>;
  findByEmailGlobal(email: string): Promise<User | null>;
  findById(id: string): Promise<User>;
  findByActivationTokenHash(hash: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
  updateProfile(id: string, data: { fullName: string; phone: string }): Promise<User>;
  incrementFailedAttempts(id: string): Promise<{ failedLoginAttempts: number }>;
  resetFailedAttempts(id: string): Promise<void>;
  setLockedUntil(id: string, lockedUntil: Date): Promise<void>;
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  setActivationTokenUsed(id: string): Promise<void>;
  listByTenant(tenantId: string): Promise<User[]>;
  findByIdInTenant(id: string, tenantId: string): Promise<User | null>;
  countActiveAdmins(tenantId: string): Promise<number>;
  softDelete(id: string): Promise<void>;
  findActiveUserIdsByTenant(tenantId: string): Promise<string[]>;
}
