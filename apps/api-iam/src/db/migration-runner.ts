import type { Prisma } from '../generated/prisma/client.js'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { InternalError } from '../errors.js'
import { SCHEMA_NAME_REGEX } from './with-tenant.js'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations-tenant')

export async function runTenantMigrations(
  tx: Prisma.TransactionClient,
  schemaName: string
): Promise<void> {
  if (!SCHEMA_NAME_REGEX.test(schemaName)) {
    throw new InternalError(
      'tenant.invalid_schema_name',
      `Schema name "${schemaName}" failed validation`
    )
  }

  let files: string[]
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch (error) {
    throw new InternalError(
      'tenant.migrations_dir_unreadable',
      `Cannot read migrations directory: ${String(error)}`
    )
  }

  for (const file of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    const hydrated = raw.replaceAll('__SCHEMA__', schemaName)

    // $executeRawUnsafe does not support multi-statement strings in prepared statement mode.
    // Split on semicolons, strip comment-only lines, and execute each statement individually.
    const statements = hydrated
      .split(';')
      .map((s) => s.replace(/--[^\n]*/g, '').trim())
      .filter((s) => s.length > 0)

    try {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement)
      }
    } catch (error) {
      throw new InternalError(
        'tenant.migration_failed',
        `Migration "${file}" failed: ${String(error)}`
      )
    }
  }
}
