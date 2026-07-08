# Manual Tenant Creation Guide

> For admin/debugging use only. Normally, tenants are created through the onboarding wizard.

---

## When to Use This

- Creating dev fixtures not covered by the seed script
- Migrating a legacy tenant from another system
- Support cases where the onboarding wizard cannot complete (e.g. payment integration unavailable)
- Resetting a tenant to a known state for testing

---

## Prerequisites

- `pnpm --filter @corehub/api-iam db:seed` has been run (the `plans` table must have data)
- Database is accessible (Docker Compose running, or direct DB access in production)
- You have either Prisma Studio or direct SQL access via Adminer

---

## Step-by-Step: Create a Tenant Manually

Use **Prisma Studio** (`pnpm --filter @corehub/api-iam db:studio`) or **Adminer** (http://localhost:8081) for the SQL steps below.

### Step 1 — Choose a plan

```sql
SELECT id, name, price FROM plans WHERE active = true;
```

Note the `id` of the plan you want to assign (e.g. `professional`). The seed creates `starter`, `professional`, and `enterprise`.

### Step 2 — Create the tenant

The `schema_name` column stores the PostgreSQL schema name for this tenant. Derive it from the slug by replacing hyphens with underscores and prefixing with `tenant_`.

```sql
INSERT INTO tenants (id, slug, name, schema_name, plan_id, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'mi-empresa',               -- URL-safe slug (max 40 chars, no spaces)
  'Mi Empresa S.A.',          -- Display name (max 200 chars)
  'tenant_mi_empresa',        -- schema_name: 'tenant_' + slug with hyphens → underscores
  'professional',             -- plan id from Step 1
  'active',                   -- TenantStatus enum: pending | active | suspended
  NOW(),
  NOW()
);
```

Note the generated UUID (`id`) for the next steps.

### Step 3 — Create the tenant PostgreSQL schema

Each tenant owns an isolated schema. Create it and seed the settings table:

```sql
-- Replace 'tenant_mi_empresa' with your actual schema_name from Step 2

CREATE SCHEMA IF NOT EXISTS tenant_mi_empresa;

SET search_path TO tenant_mi_empresa, public;

CREATE TABLE IF NOT EXISTS tenant_settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

> **Tip**: If you are connected via Adminer, run these two statements separately — Adminer sometimes requires one statement per execution.

### Step 4 — Create the TenantAdmin user

Passwords are hashed with `argon2id`. In development you can generate a hash using the Node.js REPL:

```bash
node -e "import('argon2').then(m => m.hash('YourPassword123!').then(console.log))"
```

Then insert the user:

```sql
INSERT INTO users (
  id,
  tenant_id,
  email,
  password_hash,
  role,
  full_name,
  status,
  failed_login_attempts,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '<tenant_id from Step 2>',
  'admin@mi-empresa.com',
  '<argon2id hash>',
  'TenantAdmin',              -- UserRole enum: SuperAdmin | TenantAdmin | User
  'Admin User',               -- optional display name
  'active',                   -- UserStatus: pending_first_login | active | suspended
  0,
  NOW(),
  NOW()
);
```

> **Note**: The `status` column uses `active` (lowercase). The `role` column uses `TenantAdmin` (PascalCase) — these are the PostgreSQL enum values defined in `schema.prisma`.

---

## Verifying the Tenant

Test login with the credentials you just created:

```bash
curl -s -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: test-manual-tenant-1' \
  -d '{
    "email": "admin@mi-empresa.com",
    "password": "YourPassword123!",
    "tenantSlug": "mi-empresa"
  }' | jq .
```

A successful response returns an access token and a refresh token.

---

## Cleanup

To fully remove a manually created tenant, delete in this order to respect foreign key constraints:

```sql
-- 1. Drop the tenant schema (removes all tenant-specific data)
DROP SCHEMA IF EXISTS tenant_mi_empresa CASCADE;

-- 2. Delete the users belonging to this tenant
DELETE FROM users WHERE tenant_id = '<tenant_id>';

-- 3. Delete any invitations
DELETE FROM invitations WHERE tenant_id = '<tenant_id>';

-- 4. Delete the tenant record
DELETE FROM tenants WHERE id = '<tenant_id>';
```

> **Warning**: `DROP SCHEMA ... CASCADE` is irreversible. Double-check the schema name before executing.
