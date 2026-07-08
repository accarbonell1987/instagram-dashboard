/**
 * Test fixture seed — creates deterministic data for integration E2E tests.
 *
 * Idempotent: safe to run multiple times (uses upsert throughout).
 *
 * Pre-requisites:
 *   - DB schema applied (prisma db push or migrate)
 *   - Main seed already run (or run this standalone — it is self-contained)
 *
 * Usage:
 *   pnpm --filter @corehub/api-iam db:seed-test
 */
import "dotenv/config";
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ─── Test constants ───────────────────────────────────────────────────────────

const TEST_TENANT_SLUG = 'test-tenant';
const TEST_USER_EMAIL = 'test@corehub.com';
const TEST_USER_PASSWORD = 'Test1234!Secure';
const TEST_USER_FULL_NAME = 'Test User';
const TEST_INVITE_TOKEN = 'test-invite-token';
const TEST_INVITED_EMAIL = 'invited@corehub.com';

// ─── Seed functions ───────────────────────────────────────────────────────────

async function seedTestTenant(): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TEST_TENANT_SLUG },
    update: {
      name: 'Test Tenant',
      status: 'active',
    },
    create: {
      slug: TEST_TENANT_SLUG,
      name: 'Test Tenant',
      schemaName: 'tenant_test_tenant',
      planId: 'professional',
      status: 'active',
    },
  });
  console.log(`✅ Test tenant seeded: slug=${TEST_TENANT_SLUG}, id=${tenant.id}`);
  return tenant.id;
}

async function seedTestUser(tenantId: string): Promise<string> {
  const passwordHash = await hash(TEST_USER_PASSWORD);

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: TEST_USER_EMAIL } },
    update: { passwordHash, status: 'active', fullName: TEST_USER_FULL_NAME },
    create: {
      tenantId,
      email: TEST_USER_EMAIL,
      passwordHash,
      role: 'TenantAdmin',
      fullName: TEST_USER_FULL_NAME,
      status: 'active',
    },
  });
  console.log(`✅ Test user seeded: email=${TEST_USER_EMAIL}, id=${user.id}`);
  return user.id;
}

async function seedTestInvitation(tenantId: string): Promise<void> {
  // Hash the known token so the API can look it up
  const tokenHash = createHash('sha256').update(TEST_INVITE_TOKEN).digest('hex');

  // Check if invitation already exists by tokenHash (unique constraint)
  const existing = await prisma.invitation.findUnique({ where: { tokenHash } });

  if (existing !== null) {
    // Refresh expiry so it doesn't expire during tests
    await prisma.invitation.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000) },
    });
    console.log(`✅ Test invitation refreshed: token=${TEST_INVITE_TOKEN}`);
  } else {
    await prisma.invitation.create({
      data: {
        email: TEST_INVITED_EMAIL,
        tenantId,
        role: 'TenantAdmin',
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      },
    });
    console.log(
      `✅ Test invitation seeded: token=${TEST_INVITE_TOKEN}, email=${TEST_INVITED_EMAIL}`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Starting test fixture seed...');

  // Re-home any tenants still referencing stale test plans before deleting them.
  // This happens when an older seed version set the test tenant to 'test-pro' etc.
  await prisma.tenant.updateMany({
    where: { planId: { in: ['test-basic', 'test-pro', 'test-enterprise'] } },
    data: { planId: 'professional' },
  });

  // Remove stale test plans from previous seed versions
  await prisma.plan.deleteMany({
    where: { id: { in: ['test-basic', 'test-pro', 'test-enterprise'] } },
  });

  const tenantId = await seedTestTenant();
  await seedTestUser(tenantId);
  await seedTestInvitation(tenantId);

  console.log('\n✅ Test seed complete.');
  console.log('  Test user:     test@corehub.com / Test1234!Secure');
  console.log('  Test tenant:   test-tenant');
  console.log('  Invite token:  test-invite-token');
  console.log('  Invited email: invited@corehub.com');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error: unknown) => {
      console.error('❌ Test seed failed:', error);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
