import type { CreateUserInput, UpdateUserInput, User } from '../../domain/user.js';
import type { Repository } from '../repository.interface.js';

export interface UserRepository extends Repository<User, CreateUserInput, UpdateUserInput> {
  findByEmail(email: string): Promise<User | null>;
}

export { UserInMemoryRepository } from './user.in-memory.repository.js';
export { UserFileRepository } from './user.file.repository.js';
export { UserPrismaRepository } from './user.prisma.repository.js';
