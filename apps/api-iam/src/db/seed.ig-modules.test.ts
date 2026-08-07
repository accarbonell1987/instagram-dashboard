import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, it, expect } from 'vitest';

// `seed.ts` throws at import time if DATABASE_URL is unset (module-level env
// guard), so it can't be imported directly here. Instead this asserts the
// literal plan-module wiring in both places that must agree — seed.ts (fresh
// databases) and the migration (existing databases) — so a pricing mistake
// in either file fails loudly instead of silently diverging.
const dir = dirname(fileURLToPath(import.meta.url));
const seedSource = readFileSync(join(dir, 'seed.ts'), 'utf-8');
const migrationSource = readFileSync(
  join(
    dir,
    '../../prisma/migrations/20260806130000_add_ig_audience_content_intelligence_modules/migration.sql',
  ),
  'utf-8',
);

describe('ig-audience / ig-content-intelligence plan assignment', () => {
  it('seed.ts grants ig-audience to professional and enterprise, not starter', () => {
    expect(seedSource).toMatch(/professional: \[[^\]]*'ig-audience'[^\]]*\]/);
    expect(seedSource).not.toMatch(/starter: \[[^\]]*'ig-audience'[^\]]*\]/);
    // enterprise is `BASE_MODULES.map((m) => m.id)` — covered by the
    // BASE_MODULES membership assertion below.
  });

  it('seed.ts does NOT grant ig-content-intelligence to professional or starter', () => {
    expect(seedSource).not.toMatch(/professional: \[[^\]]*'ig-content-intelligence'[^\]]*\]/);
    expect(seedSource).not.toMatch(/starter: \[[^\]]*'ig-content-intelligence'[^\]]*\]/);
  });

  it('seed.ts registers both new modules in BASE_MODULES (enterprise gets every BASE_MODULES id)', () => {
    expect(seedSource).toContain("id: 'ig-audience'");
    expect(seedSource).toContain("id: 'ig-content-intelligence'");
  });

  it('migration grants ig-audience to professional and enterprise only', () => {
    expect(migrationSource).toContain("('professional', 'ig-audience')");
    expect(migrationSource).toContain("('enterprise', 'ig-audience')");
    expect(migrationSource).not.toContain("('starter', 'ig-audience')");
  });

  it('migration grants ig-content-intelligence to enterprise only', () => {
    expect(migrationSource).toContain("('enterprise', 'ig-content-intelligence')");
    expect(migrationSource).not.toContain("('professional', 'ig-content-intelligence')");
    expect(migrationSource).not.toContain("('starter', 'ig-content-intelligence')");
  });
});
