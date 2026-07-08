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
    id: 'buscador-app',
    name: 'Buscador de Clientes',
    description: 'Consulta y gestión de información de clientes',
    defaultUrl: 'http://localhost:3000',
  },
  {
    id: 'facturacion-app',
    name: 'Facturación Electrónica',
    description: 'Emisión y control de facturas electrónicas',
    defaultUrl: 'http://localhost:3002',
  },
  {
    id: 'rrhh-app',
    name: 'Recursos Humanos',
    description: 'Gestión de personal y nómina',
    defaultUrl: 'http://localhost:3003',
  },
  {
    id: 'reportes-app',
    name: 'Reportes Gerenciales',
    description: 'Informes y dashboards ejecutivos',
    defaultUrl: 'http://localhost:3004',
  },
  {
    id: 'inventario-app',
    name: 'Control de Inventario',
    description: 'Seguimiento y gestión de existencias',
    defaultUrl: 'http://localhost:3005',
  },
  {
    id: 'configuracion-app',
    name: 'Configuración',
    description: 'Parámetros y ajustes del sistema',
    defaultUrl: 'http://localhost:3006',
  },
  {
    id: 'vacaciones-app',
    name: 'Solicitud de Vacaciones',
    description: 'Formulario para solicitar días de vacaciones',
    defaultUrl: 'http://localhost:3010',
  },
  {
    id: 'prueba',
    name: 'Evaluaciones',
    description: 'Creá y administrá cuestionarios, exámenes y pruebas de conocimiento para tu equipo',
    defaultUrl: '/prueba',
  },
  {
    // NOTE: This module serves the frontend dashboard at /dashboard-instagram.
    // The backend API for Instagram Analytics is a separate standalone service
    // (apps/api-instagram-analytics, port 3003) — not registered as a module here.
    // The API uses JWT auth verified against api-iam's JWKS endpoint.
    id: 'dashboard-instagram',
    name: 'Dashboard Instagram',
    description: 'Panel de análisis y métricas de Instagram',
    defaultUrl: '/dashboard-instagram',
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
    starter: ['buscador-app', 'configuracion-app', 'vacaciones-app'],
    professional: [
      'buscador-app',
      'facturacion-app',
      'rrhh-app',
      'reportes-app',
      'inventario-app',
      'configuracion-app',
      'vacaciones-app',
      'prueba',
    ],
    enterprise: BASE_MODULES.map(m => m.id),
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

async function main() {
  const existingPlans = await prisma.plan.count();
  if (existingPlans === PLANS.length) {
    console.log('Plans already seeded, skipping plan seed.');
  } else {
    await seedPlans();
  }

  // PlanQuota seeding: idempotent (upsert by planId + resourceType).
  // Runs every time — only creates/updates quotas that are missing or outdated.
  await seedPlanQuotas();

  await seedSystemTenant();
  await seedSuperAdmin();
  await seedModules();
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
