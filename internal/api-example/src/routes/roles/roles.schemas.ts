import { z } from "@hono/zod-openapi";

import type { Role } from "../../domain/role.js";
import { paginatedResponseSchema } from "../../lib/shared-schemas.js";

export const RoleSchema = z
  .object({
    id: z.string().openapi({ example: "role-001" }),
    name: z.string().openapi({ example: "admin" }),
    description: z.string().optional().openapi({ example: "Full system access" }),
    permissions: z
      .array(z.string())
      .openapi({ example: ["users:read", "users:write"] }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2026-01-01T00:00:00.000Z" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2026-01-01T00:00:00.000Z" }),
  })
  .openapi("Role");

export const CreateRoleSchema = z
  .object({
    name: z.string().min(2).max(50).openapi({ example: "editor" }),
    description: z
      .string()
      .max(255)
      .optional()
      .openapi({ example: "Can edit content" }),
    permissions: z
      .array(z.string())
      .min(1)
      .openapi({ example: ["content:read", "content:write"] }),
  })
  .openapi("CreateRole");

export const UpdateRoleSchema = z
  .object({
    name: z.string().min(2).max(50).optional().openapi({ example: "editor" }),
    description: z
      .string()
      .max(255)
      .optional()
      .openapi({ example: "Can edit content" }),
    permissions: z
      .array(z.string())
      .optional()
      .openapi({ example: ["content:read", "content:write"] }),
  })
  .openapi("UpdateRole");

export const RoleResponseSchema = z
  .object({
    success: z.literal(true),
    data: RoleSchema,
  })
  .openapi("RoleResponse");

export const RolesListResponseSchema = paginatedResponseSchema(
  RoleSchema,
  "RolesListResponse",
);

export function roleToDTO(role: Role) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}
