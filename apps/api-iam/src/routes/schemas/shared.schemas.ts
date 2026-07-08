import { z } from '@hono/zod-openapi'

export const ProblemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string(),
  code: z.string(),
})

export const ValidationErrorItemSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
})

export const ValidationProblemDetailsSchema = ProblemDetailsSchema.extend({
  errors: z.array(ValidationErrorItemSchema),
})

export const JsonWebKeySchema = z.object({
  kty: z.string(),
  use: z.string().optional(),
  alg: z.string().optional(),
  kid: z.string().optional(),
  n: z.string().optional(),
  e: z.string().optional(),
  x: z.string().optional(),
  y: z.string().optional(),
  crv: z.string().optional(),
})

export const JsonWebKeySetSchema = z.object({
  keys: z.array(JsonWebKeySchema),
})

export const commonErrorResponses = {
  400: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Bad Request',
  },
  401: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Unauthorized',
  },
  403: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Forbidden',
  },
  404: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Not Found',
  },
  409: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Conflict',
  },
  410: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Gone',
  },
  422: {
    content: { 'application/problem+json': { schema: ValidationProblemDetailsSchema } },
    description: 'Unprocessable Entity',
  },
  429: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Too Many Requests',
  },
  500: {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description: 'Internal Server Error',
  },
} as const
