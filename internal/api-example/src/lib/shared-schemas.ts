import { z } from "@hono/zod-openapi";

// Common schemas reused across all routes

export const IdParamSchema = z.object({
  id: z.string().openapi({ example: "user-001", description: "Resource ID" }),
});

export const FilterQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .openapi({ example: 1, description: "Page number (1-based)" }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({ example: 20, description: "Items per page (max 100)" }),
  search: z
    .string()
    .optional()
    .openapi({ example: "alice", description: "Search term" }),
  sortBy: z
    .string()
    .optional()
    .openapi({ example: "createdAt", description: "Field to sort by" }),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .openapi({ example: "desc", description: "Sort direction" }),
});

export const ErrorSchema = z
  .object({
    code: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().openapi({ example: "User with id 'x' not found" }),
    details: z.unknown().optional(),
  })
  .openapi("Error");

export const ErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: ErrorSchema,
  })
  .openapi("ErrorResponse");

export const DeleteResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.null(),
  })
  .openapi("DeleteResponse");

export function paginatedResponseSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
  name: string,
) {
  return z
    .object({
      success: z.literal(true),
      data: z.object({
        data: z.array(itemSchema),
        total: z.number().int().openapi({ example: 2 }),
        page: z.number().int().openapi({ example: 1 }),
        pageSize: z.number().int().openapi({ example: 20 }),
      }),
    })
    .openapi(name);
}
