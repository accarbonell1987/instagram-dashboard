import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}))

describe('runTenantMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws for invalid schema name (not matching tenant_ prefix pattern)', async () => {
    const { runTenantMigrations } = await import('./migration-runner.js')
    const tx = { $executeRawUnsafe: vi.fn() } as unknown as Parameters<typeof runTenantMigrations>[0]

    await expect(runTenantMigrations(tx, 'invalid_schema')).rejects.toThrow('failed validation')
    await expect(runTenantMigrations(tx, 'public')).rejects.toThrow()
  })

  it('replaces __SCHEMA__ placeholder with schema name', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    vi.mocked(readdirSync).mockReturnValue(['001_create_tenant_schema.sql'] as unknown as ReturnType<typeof readdirSync>)
    vi.mocked(readFileSync).mockReturnValue('CREATE TABLE __SCHEMA__.test (id SERIAL PRIMARY KEY);')

    const { runTenantMigrations } = await import('./migration-runner.js')
    const executeRawUnsafe = vi.fn().mockResolvedValue(undefined)
    const tx = { $executeRawUnsafe: executeRawUnsafe } as unknown as Parameters<typeof runTenantMigrations>[0]

    await runTenantMigrations(tx, 'tenant_acme')

    // Statements are split on ';' and the trailing semicolon is stripped
    expect(executeRawUnsafe).toHaveBeenCalledWith(
      'CREATE TABLE tenant_acme.test (id SERIAL PRIMARY KEY)'
    )
  })

  it('executes files in alphabetical order', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    vi.mocked(readdirSync).mockReturnValue(
      ['003_third.sql', '001_first.sql', '002_second.sql'] as unknown as ReturnType<typeof readdirSync>
    )
    // Use real SQL statements (not just comments, which are stripped before execution)
    vi.mocked(readFileSync).mockImplementation((path) => {
      const name = String(path).split('/').pop() ?? 'unknown'
      return `SELECT '${name}'`
    })

    const { runTenantMigrations } = await import('./migration-runner.js')
    const calls: string[] = []
    const tx = {
      $executeRawUnsafe: vi.fn().mockImplementation((sql: string) => {
        calls.push(sql)
        return Promise.resolve(undefined)
      }),
    } as unknown as Parameters<typeof runTenantMigrations>[0]

    await runTenantMigrations(tx, 'tenant_acme')

    expect(calls[0]).toContain('001_first.sql')
    expect(calls[1]).toContain('002_second.sql')
    expect(calls[2]).toContain('003_third.sql')
  })

  it('throws when a migration statement fails', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    vi.mocked(readdirSync).mockReturnValue(['001_failing.sql'] as unknown as ReturnType<typeof readdirSync>)
    vi.mocked(readFileSync).mockReturnValue('CREATE TABLE __SCHEMA__.bad;')

    const { runTenantMigrations } = await import('./migration-runner.js')
    const tx = {
      $executeRawUnsafe: vi.fn().mockRejectedValue(new Error('syntax error')),
    } as unknown as Parameters<typeof runTenantMigrations>[0]

    await expect(runTenantMigrations(tx, 'tenant_acme')).rejects.toThrow('Migration "001_failing.sql" failed')
  })
})
