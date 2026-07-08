import { z } from '@hono/zod-openapi'

export const TenantSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  planId: z.string(),
  status: z.enum(['pending', 'active', 'suspended']),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const MemberListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['SuperAdmin', 'TenantAdmin', 'User']),
  status: z.enum(['pending_first_login', 'active', 'suspended']),
  createdAt: z.string().datetime(),
})

export const MemberListResponseSchema = z.object({
  items: z.array(MemberListItemSchema),
})

export const UpdateTenantNameRequestSchema = z.object({
  name: z.string().min(1).max(200),
})

export const UpdateMemberStatusRequestSchema = z.object({
  status: z.enum(['active', 'suspended']),
})

export const UpdateProfileRequestSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format'),
})

export const UpdateProfileResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    fullName: z.string(),
    phone: z.string(),
  }),
  accessToken: z.string(),
})
