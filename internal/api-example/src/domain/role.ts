export interface Role {
  id: string;
  name: string;
  description?: string | undefined;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleInput {
  name: string;
  description?: string | undefined;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string | undefined;
  description?: string | undefined;
  permissions?: string[] | undefined;
}
