export interface User {
  id: string;
  email: string;
  name?: string | undefined;
  partyId: string;
  roleId?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name?: string | undefined;
  partyId: string;
}

export interface UpdateUserInput {
  email?: string | undefined;
  name?: string | undefined;
  partyId?: string | undefined;
  roleId?: string | undefined;
}

// ─── Batch Operations ──────────────────────────────────

export interface BatchCreateUsersInput {
  users: CreateUserInput[];
}

export interface BatchDeleteUsersInput {
  ids: string[];
}

export interface BatchCreateResult {
  created: User[];
  total: number;
}

export interface BatchDeleteResult {
  deleted: number;
  notFound?: string[] | undefined;
}

// ─── Assign Operations ─────────────────────────────────

export interface AssignRoleInput {
  roleId: string;
}

export interface AssignPersonInput {
  partyId: string;
}
