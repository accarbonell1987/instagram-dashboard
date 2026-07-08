/**
 * User Service Extensions
 *
 * Custom methods beyond CRUD for the User entity.
 * These extensions are added to the base CrudService via the extension pattern.
 */
import type { BatchCreateResult, BatchDeleteResult, HttpHelpers } from '@core/core/services';

import type {
  AssignPersonInput,
  AssignRoleInput,
  BatchCreateUsersInput,
  BatchDeleteUsersInput,
  User,
} from '@/types/entities';

// ─── Extension Type ────────────────────────────────────

/**
 * Custom methods available on the extended User service.
 *
 * Note: This needs to be a `type` rather than `interface` because
 * createService() requires E extends Record<string, unknown>,
 * and interfaces don't implicitly satisfy index signatures.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type UserExtensions = {
  /** Create multiple users in a single request */
  batchCreate: (data: BatchCreateUsersInput) => Promise<BatchCreateResult<User>>;
  /** Delete multiple users by their IDs */
  batchDelete: (data: BatchDeleteUsersInput) => Promise<BatchDeleteResult>;
  /** Assign a role to a user */
  assignRole: (userId: string, data: AssignRoleInput) => Promise<User>;
  /** Associate a user with a person (party) */
  assignPerson: (userId: string, data: AssignPersonInput) => Promise<User>;
};

// ─── Extension Factory ─────────────────────────────────

/**
 * Creates the extension methods for the User service.
 * This function is passed to createService() as the extend callback.
 *
 * @param http - HTTP helpers for making API calls
 * @param basePath - Base path for the user endpoints (e.g., '/users')
 * @returns Object containing all extension methods
 */
export function createUserExtensions(http: HttpHelpers, basePath: string): UserExtensions {
  return {
    batchCreate: (data: BatchCreateUsersInput): Promise<BatchCreateResult<User>> =>
      http.post<BatchCreateResult<User>>(`${basePath}/batch`, data),

    batchDelete: (data: BatchDeleteUsersInput): Promise<BatchDeleteResult> =>
      http.post<BatchDeleteResult>(`${basePath}/batch/delete`, data),

    assignRole: (userId: string, data: AssignRoleInput): Promise<User> =>
      http.post<User>(`${basePath}/${userId}/assign-role`, data),

    assignPerson: (userId: string, data: AssignPersonInput): Promise<User> =>
      http.post<User>(`${basePath}/${userId}/assign-person`, data),
  };
}
