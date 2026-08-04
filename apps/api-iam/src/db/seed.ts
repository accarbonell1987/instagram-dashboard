import "dotenv/config";
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { fileURLToPath } from 'node:url';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Para equipos pequeños que están empezando.',
    price: 0,
    currency: 'PYG',
    billingInterval: 'monthly',
    maxUsers: 5,
    features: ['Hasta 5 usuarios', 'Soporte comunitario', '1 GB de almacenamiento'],
    popular: false,
    active: true,
    productId: 'instagram-dashboard',
    displayOrder: 0,
    isDefault: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Para equipos en crecimiento con necesidades avanzadas.',
    price: 350000,
    currency: 'PYG',
    billingInterval: 'monthly',
    maxUsers: 25,
    features: ['Hasta 25 usuarios', 'Soporte por email', '10 GB de almacenamiento', 'Acceso a API'],
    popular: true,
    active: true,
    productId: 'instagram-dashboard',
    displayOrder: 1,
    isDefault: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Para grandes organizaciones con requerimientos personalizados.',
    price: 1200000,
    currency: 'PYG',
    billingInterval: 'monthly',
    maxUsers: 200,
    features: [
      'Usuarios ilimitados',
      'Soporte dedicado',
      'Almacenamiento ilimitado',
      'Acceso a API',
      'SLA 99.9%',
    ],
    popular: false,
    active: true,
    productId: 'instagram-dashboard',
    displayOrder: 2,
    isDefault: false,
  },
];

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }
  console.log('Plans seeded.');
}

async function seedPlanQuotas() {
  const quotas = [
    // Starter
    { planId: 'starter', resourceType: 'deepseek_tokens' as const, limit: 5000, period: 'month' as const },
    { planId: 'starter', resourceType: 'fal_images' as const, limit: 10, period: 'month' as const },
    { planId: 'starter', resourceType: 'chat_sessions' as const, limit: 5, period: 'day' as const },
    // Professional
    { planId: 'professional', resourceType: 'deepseek_tokens' as const, limit: 100000, period: 'month' as const },
    { planId: 'professional', resourceType: 'fal_images' as const, limit: 50, period: 'month' as const },
    { planId: 'professional', resourceType: 'chat_sessions' as const, limit: 30, period: 'day' as const },
    // Enterprise
    { planId: 'enterprise', resourceType: 'deepseek_tokens' as const, limit: 500000, period: 'month' as const },
    { planId: 'enterprise', resourceType: 'fal_images' as const, limit: 200, period: 'month' as const },
    { planId: 'enterprise', resourceType: 'chat_sessions' as const, limit: -1, period: 'unlimited' as const },
  ];

  for (const quota of quotas) {
    await prisma.planQuota.upsert({
      where: {
        planId_resourceType: {
          planId: quota.planId,
          resourceType: quota.resourceType,
        },
      },
      update: { limit: quota.limit, period: quota.period },
      create: {
        planId: quota.planId,
        resourceType: quota.resourceType,
        limit: quota.limit,
        period: quota.period,
      },
    });
  }

  console.log(`Plan quotas seeded: ${quotas.length} quotas across 3 plans.`);
}

async function seedSystemTenant() {
  await prisma.tenant.upsert({
    where: { slug: '__system__' },
    update: {},
    create: {
      slug: '__system__',
      name: 'System',
      schemaName: 'tenant___system__',
      planId: 'enterprise',
      status: 'active',
    },
  });
  console.log('System tenant seeded.');
}

async function seedSuperAdmin() {
  const email = process.env['SUPERADMIN_EMAIL'] ?? 'admin@corehub.com';
  const password = process.env['SUPERADMIN_PASSWORD'] ?? 'Change-me-in-production!';

  const systemTenant = await prisma.tenant.findUnique({ where: { slug: '__system__' } });
  if (!systemTenant) {
    throw new Error('System tenant not found — run seedSystemTenant first');
  }

  const passwordHash = await hash(password);

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email } },
    update: { passwordHash },
    create: {
      tenantId: systemTenant.id,
      email,
      passwordHash,
      role: 'SuperAdmin',
      fullName: 'Super Admin',
      status: 'active',
    },
  });
  console.log(`SuperAdmin seeded: ${email}`);
}

async function seedDevFixtures() {
  if (process.env['NODE_ENV'] !== 'development') return;

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: 'dev-tenant' } });
  if (existingTenant) {
    console.log('Dev fixtures already present, skipping.');
    return;
  }

  const devTenant = await prisma.tenant.create({
    data: {
      slug: 'dev-tenant',
      name: 'Dev Tenant',
      schemaName: 'tenant_dev_tenant',
      planId: 'professional',
      status: 'active',
    },
  });

  const crypto = await import('node:crypto');
  const rawToken = 'dev-invitation-token-fixed';
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.invitation.create({
    data: {
      email: 'invited@dev-tenant.com',
      tenantId: devTenant.id,
      role: 'TenantAdmin',
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Dev fixtures seeded. Dev tenant slug: dev-tenant');
  console.log('Dev invitation token: dev-invitation-token-fixed');
}

const BASE_MODULES = [
  {
    id: 'ig-basic-metrics',
    name: 'Métricas Básicas',
    description: 'Panel de métricas, crecimiento y demografía de tu cuenta',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-publications',
    name: 'Publicaciones',
    description: 'Gestioná y analizá tus publicaciones, reels e historias',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-ai-agent',
    name: 'Agente IA',
    description: 'Asistente inteligente para crecer en Instagram',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-ai-chat',
    name: 'Chat - Agente de Crecimiento',
    description: 'Conversá con el agente IA sobre estrategias de crecimiento',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-ai-suggestions',
    name: 'Sugerencias de Contenido',
    description: 'Recibí ideas de contenido generadas por IA',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-ai-carousels',
    name: 'Carousels - Creación con IA',
    description: 'Creá carousels profesionales con inteligencia artificial',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
];

async function seedModules() {
  for (const module of BASE_MODULES) {
    await prisma.module.upsert({
      where: { id: module.id },
      update: module,
      create: module,
    });
  }
  console.log(`${BASE_MODULES.length} base modules seeded.`);

  const PLAN_MODULE_ASSIGNMENTS: Record<string, string[]> = {
    starter: ['ig-basic-metrics'],
    professional: ['ig-basic-metrics', 'ig-publications'],
    enterprise: BASE_MODULES.map((m) => m.id),
  };

  let totalAssignments = 0;

  for (const [planId, moduleIds] of Object.entries(PLAN_MODULE_ASSIGNMENTS)) {
    for (const moduleId of moduleIds) {
      await prisma.planModule.upsert({
        where: { planId_moduleId: { planId, moduleId } },
        update: {},
        create: { planId, moduleId },
      });
      totalAssignments++;
    }
  }
  console.log(`${totalAssignments} plan-module assignments seeded.`);
}

// 'dashboard-instagram' was never a module — it IS the Instagram product, and
// it kept showing up in the module lists. Its dependants are removed by hand
// before the delete: plan_modules / overrides / role access all cascade, but
// entitlements.module_id is nullable, so a cascade would turn a module-scoped
// grant into a whole-product grant.
async function retireLegacyInstagramModule() {
  const legacyId = 'dashboard-instagram';
  const legacy = await prisma.module.findUnique({ where: { id: legacyId } });
  if (!legacy) return;

  await prisma.$transaction([
    prisma.planModule.deleteMany({ where: { moduleId: legacyId } }),
    prisma.tenantModuleOverride.deleteMany({ where: { moduleId: legacyId } }),
    prisma.entitlement.deleteMany({ where: { moduleId: legacyId } }),
    prisma.roleModuleAccess.deleteMany({ where: { moduleId: legacyId } }),
    prisma.module.delete({ where: { id: legacyId } }),
  ]);
  console.log(`Retired legacy module '${legacyId}' (it is a product, not a module).`);
}

// The instagram-dashboard product API (products/instagram-dashboard/api) gates
// every request with an entitlement guard that resolves access via
// TenantProductSubscription → Plan → PlanModule. Without a Product row, the
// dashboard-instagram module's product_id, and a subscription for the system
// tenant, that guard fails closed (403) even though the module shows in the hub.
async function seedInstagramProduct() {
  // Seeded products ship with trials OFF. A trial is an explicit decision per
  // tenant (backoffice → Trials), never something a fresh install hands out.
  // `update` sets it too, so re-seeding also switches off a product that was
  // created before this rule.
  await prisma.product.upsert({
    where: { id: 'instagram-dashboard' },
    update: { trialEnabled: false },
    create: {
      id: 'instagram-dashboard',
      name: 'Dashboard Instagram',
      description: 'Panel de análisis y métricas de Instagram',
      trialEnabled: false,
    },
  });

  // Link all IG modules to the product and set parent-child relationships.
  const igModules = ['ig-basic-metrics', 'ig-publications', 'ig-ai-agent',
    'ig-ai-chat', 'ig-ai-suggestions', 'ig-ai-carousels'];
  for (const id of igModules) {
    await prisma.module.update({
      where: { id },
      data: {
        productId: 'instagram-dashboard',
        parentId: id.startsWith('ig-ai-') && id !== 'ig-ai-agent' ? 'ig-ai-agent' : null,
      },
    });
  }

  await retireLegacyInstagramModule();

  // Give the system tenant (enterprise plan, which includes dashboard-instagram)
  // an active subscription to the product so the entitlement guard resolves.
  const systemTenant = await prisma.tenant.findUnique({ where: { slug: '__system__' } });
  if (systemTenant) {
    await prisma.tenantProductSubscription.upsert({
      where: { tenantId_productId: { tenantId: systemTenant.id, productId: 'instagram-dashboard' } },
      update: { status: 'active' },
      create: {
        tenantId: systemTenant.id,
        productId: 'instagram-dashboard',
        planId: systemTenant.planId,
        status: 'active',
      },
    });
  }
  console.log('Instagram product + system-tenant subscription seeded.');
}

async function main() {
  // seedPlans upserts, so it is already idempotent. The old count guard skipped
  // it whenever the row count matched, which silently froze plan data — new
  // fields (displayOrder, isDefault) never reached an existing database.
  await seedPlans();

  // PlanQuota seeding: idempotent (upsert by planId + resourceType).
  // Runs every time — only creates/updates quotas that are missing or outdated.
  await seedPlanQuotas();

  await seedSystemTenant();
  await seedSuperAdmin();
  await seedModules();
  await seedInstagramProduct();
  await seedDevFixtures();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
