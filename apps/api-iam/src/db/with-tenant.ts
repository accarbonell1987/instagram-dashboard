import type { PrismaClient, Prisma } from '../generated/prisma/client.js'
import { ValidationError } from '../errors.js'

export const SCHEMA_NAME_REGEX = /^tenant_[a-z0-9_]{3,40}$/

const SLUG_REGEX = /^[a-z0-9-]{3,40}$/

const RESERVED_SLUGS = [
  'www', 'api', 'app', 'admin', 'hub', 'mail', 'static',
  'cdn', 'signup', 'login', 'superadmin', '__system__',
]

// Schema names are SQL identifiers — they cannot be parameter-bound, so the only
// safe construction is a strict allowlist on the derived name. Every caller feeds
// this straight into raw DDL, so the guard lives here rather than at each call site.
export function slugToSchemaName(slug: string): string {
  const schemaName = `tenant_${slug.replace(/-/g, '_')}`
  if (!SCHEMA_NAME_REGEX.test(schemaName)) {
    throw new ValidationError('tenant.invalid_slug', `Slug "${slug}" is invalid — must match ${SLUG_REGEX.toString()}`)
  }
  return schemaName
}

export async function withTenant<T>(
  prisma: PrismaClient,
  slug: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!SLUG_REGEX.test(slug)) {
    throw new ValidationError('tenant.invalid_slug', `Slug "${slug}" is invalid — must match ${SLUG_REGEX.toString()}`)
  }

  if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
    throw new ValidationError('tenant.reserved_slug', `Slug "${slug}" is reserved`)
  }

  const schemaName = slugToSchemaName(slug)

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET search_path TO ${schemaName}, public`)
    return fn(tx)
  })
}
