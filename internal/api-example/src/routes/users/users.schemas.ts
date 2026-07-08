import { z } from '@hono/zod-openapi';

import type { User } from '../../domain/user.js';
import { paginatedResponseSchema } from '../../lib/shared-schemas.js';

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: 'user-001' }),
    email: z.string().email().openapi({ example: 'alice@example.com' }),
    name: z.string().optional().openapi({ example: 'Alice Smith' }),
    partyId: z.string().openapi({ example: 'party-001' }),
    roleId: z.string().optional().openapi({ example: 'role-admin' }),
    createdAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('User');

export const CreateUserSchema = z
  .object({
    email: z.string().email().openapi({ example: 'alice@example.com' }),
    name: z.string().min(2).max(100).optional().openapi({ example: 'Alice Smith' }),
    partyId: z.string().min(1).openapi({ example: 'party-001' }),
  })
  .openapi('CreateUser');

export const UpdateUserSchema = z
  .object({
    email: z.string().email().optional().openapi({ example: 'alice@example.com' }),
    name: z.string().min(2).max(100).optional().openapi({ example: 'Alice Smith' }),
  })
  .openapi('UpdateUser');

export const UserResponseSchema = z
  .object({
    success: z.literal(true),
    data: UserSchema,
  })
  .openapi('UserResponse');

export const UsersListResponseSchema = paginatedResponseSchema(UserSchema, 'UsersListResponse');

export function userToDTO(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    partyId: user.partyId,
    roleId: user.roleId,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

// ─── Batch Create ──────────────────────────────────────

export const BatchCreateUsersRequestSchema = z
  .object({
    users: z.array(CreateUserSchema).min(1).max(100).openapi({
      description: 'Array of users to create (1-100 items)',
    }),
  })
  .openapi('BatchCreateUsersRequest');

export const BatchCreateResultSchema = z
  .object({
    created: z.array(UserSchema),
    total: z.number().int(),
  })
  .openapi('BatchCreateResult');

export const BatchCreateUsersResponseSchema = z
  .object({
    success: z.literal(true),
    data: BatchCreateResultSchema,
  })
  .openapi('BatchCreateUsersResponse');

// ─── Batch Delete ──────────────────────────────────────

export const BatchDeleteUsersRequestSchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .openapi({
        description: 'Array of user IDs to delete (1-100 items)',
        example: ['user-001', 'user-002'],
      }),
  })
  .openapi('BatchDeleteUsersRequest');

export const BatchDeleteResultSchema = z
  .object({
    deleted: z.number().int(),
    notFound: z.array(z.string()).optional(),
  })
  .openapi('BatchDeleteResult');

export const BatchDeleteUsersResponseSchema = z
  .object({
    success: z.literal(true),
    data: BatchDeleteResultSchema,
  })
  .openapi('BatchDeleteUsersResponse');

// ─── Assign Role ───────────────────────────────────────

export const AssignRoleRequestSchema = z
  .object({
    roleId: z.string().min(1).openapi({ example: 'role-admin' }),
  })
  .openapi('AssignRoleRequest');

export const AssignRoleResponseSchema = z
  .object({
    success: z.literal(true),
    data: UserSchema,
  })
  .openapi('AssignRoleResponse');

// ─── Assign Person ─────────────────────────────────────

export const AssignPersonRequestSchema = z
  .object({
    partyId: z.string().min(1).openapi({ example: 'party-001' }),
  })
  .openapi('AssignPersonRequest');

export const AssignPersonResponseSchema = z
  .object({
    success: z.literal(true),
    data: UserSchema,
  })
  .openapi('AssignPersonResponse');
