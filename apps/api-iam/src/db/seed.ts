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
    price: 150000,
    currency: 'PYG',
    billingInterval: 'monthly',
    maxUsers: 3,
    features: ['Hasta 3 usuarios', 'Soporte'],
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
    maxUsers: 8,
    features: ['Hasta 8 usuarios', 'Soporte'],
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
    price: 500000,
    currency: 'PYG',
    billingInterval: 'monthly',
    maxUsers: 15,
    features: [
      'Hasta 15 usuarios',
      'Soporte dedicado',
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
    { planId: 'starter', resourceType: 'llm_tokens' as const, limit: 5000, period: 'month' as const },
    { planId: 'starter', resourceType: 'fal_images' as const, limit: 10, period: 'month' as const },
    { planId: 'starter', resourceType: 'chat_sessions' as const, limit: 5, period: 'day' as const },
    // Professional
    { planId: 'professional', resourceType: 'llm_tokens' as const, limit: 100000, period: 'month' as const },
    { planId: 'professional', resourceType: 'fal_images' as const, limit: 50, period: 'month' as const },
    { planId: 'professional', resourceType: 'chat_sessions' as const, limit: 30, period: 'day' as const },
    // Enterprise
    { planId: 'enterprise', resourceType: 'llm_tokens' as const, limit: 500000, period: 'month' as const },
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


// ─── Working-tenant fixtures ────────────────────────────────────────────────
//
// Extracted from the development database so the tenant, its members and the
// product roles survive a reset instead of being rebuilt by hand through the
// UI every time.
//
// Passwords are NOT extracted. The stored hashes belong to real chosen
// passwords, and copying them into the repository would publish them; these
// accounts get a known development password on creation instead, and an
// existing account keeps whatever password it already has.

const WORKING_TENANT = {
  slug: 'publinstagram',
  name: 'PUBLINSTAGRAM',
  schemaName: 'tenant_publinstagram',
  planId: 'professional',
  colorTheme: 'orange',
} as const;

const WORKING_MEMBERS = [
  { email: 'accarbonellpy@gmail.com', role: 'TenantAdmin', fullName: 'Alberto Carlos Carbonell Marce' },
  { email: 'accarbonell1987@gmail.com', role: 'User', fullName: 'Carlos Perez' },
] as const;

// Product roles are global per product — they carry no tenantId — so these are
// the roles every tenant of the Instagram product picks from.
const PRODUCT_ROLES = [
  {
    key: 'user',
    name: 'Usuario',
    modules: ['ig-audience', 'ig-basic-metrics', 'ig-content-intelligence', 'ig-publications'],
  },
  {
    key: 'content-analist',
    name: 'Analista de Contenido',
    modules: [
      'ig-ai-agent', 'ig-ai-chat', 'ig-ai-suggestions',
      'ig-agent-settings', 'ig-agent-topics', 'ig-agent-prompt', 'ig-agent-model',
      'ig-audience', 'ig-basic-metrics', 'ig-content-intelligence', 'ig-publications',
    ],
  },
  {
    key: 'content-creator',
    name: 'Creador de Contenido',
    modules: [
      'ig-ai-agent', 'ig-ai-chat', 'ig-ai-suggestions', 'ig-ai-carousels',
      'ig-agent-settings', 'ig-agent-topics', 'ig-agent-prompt', 'ig-agent-model',
      'ig-agent-image-key', 'ig-agent-image-models', 'ig-agent-image-styles',
      'ig-audience', 'ig-basic-metrics', 'ig-content-intelligence', 'ig-publications',
    ],
  },
] as const;

/** Who holds which product role. A member with none sees everything the plan grants. */
const ROLE_ASSIGNMENTS = [
  { email: 'accarbonell1987@gmail.com', roleKey: 'content-analist' },
] as const;

async function seedWorkingFixtures() {
  if (process.env['NODE_ENV'] !== 'development') return;

  const tenant = await prisma.tenant.upsert({
    where: { slug: WORKING_TENANT.slug },
    update: { name: WORKING_TENANT.name, planId: WORKING_TENANT.planId, status: 'active' },
    create: { ...WORKING_TENANT, status: 'active' },
  });

  const password = process.env['DEV_USER_PASSWORD'] ?? 'Dev-password-1!';
  const passwordHash = await hash(password);
  for (const member of WORKING_MEMBERS) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: member.email } },
      // Deliberately not touching passwordHash: re-seeding must not reset the
      // password of an account someone is already using.
      update: { role: member.role, fullName: member.fullName, status: 'active' },
      create: { tenantId: tenant.id, ...member, passwordHash, status: 'active' },
    });
  }

  await prisma.tenantProductSubscription.upsert({
    where: { tenantId_productId: { tenantId: tenant.id, productId: 'instagram-dashboard' } },
    update: { planId: WORKING_TENANT.planId, status: 'active' },
    create: {
      tenantId: tenant.id,
      productId: 'instagram-dashboard',
      planId: WORKING_TENANT.planId,
      status: 'active',
    },
  });

  for (const role of PRODUCT_ROLES) {
    const saved = await prisma.productRole.upsert({
      where: { productId_key: { productId: 'instagram-dashboard', key: role.key } },
      update: { name: role.name },
      create: { productId: 'instagram-dashboard', key: role.key, name: role.name },
    });
    // Replace rather than merge: the list here is the whole grant, so a module
    // dropped from it has to disappear on the next run.
    await prisma.roleModuleAccess.deleteMany({ where: { productRoleId: saved.id } });
    await prisma.roleModuleAccess.createMany({
      data: role.modules.map((moduleId) => ({ productRoleId: saved.id, moduleId })),
      skipDuplicates: true,
    });
  }

  // Authoritative for this tenant's members, like the module grants above.
  // Merging instead would resurrect a role removed through the UI: an assignment
  // that lives on only in a stale copy of this file silently widens what someone
  // can reach, because a member's effective access is the union of their roles.
  const memberIds = (
    await prisma.user.findMany({ where: { tenantId: tenant.id }, select: { id: true } })
  ).map((member) => member.id);
  await prisma.userProductRole.deleteMany({ where: { userId: { in: memberIds } } });

  for (const assignment of ROLE_ASSIGNMENTS) {
    const user = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: assignment.email } },
    });
    const role = await prisma.productRole.findUnique({
      where: { productId_key: { productId: 'instagram-dashboard', key: assignment.roleKey } },
    });
    if (!user || !role) continue;
    await prisma.userProductRole.create({ data: { userId: user.id, productRoleId: role.id } });
  }

  console.log(
    `Working fixtures seeded: ${WORKING_TENANT.slug} (${String(WORKING_MEMBERS.length)} members, ` +
      `${String(PRODUCT_ROLES.length)} product roles).`,
  );
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
  {
    id: 'ig-agent-settings',
    name: 'Configuraciones del Agente',
    description: 'Ajustes del agente: temas, instrucciones, modelo e imágenes',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  // One module per configurable section of the agent's settings, so a plan can
  // sell them and a product role can narrow them through the machinery that
  // already exists. The role floor that keeps a member away from the tenant's
  // credentials and its token spend is NOT here on purpose: a module is
  // sellable, and no plan should be able to hand a member the API key.
  // See products/instagram-dashboard/api/src/domain/agent-settings-sections.ts.
  {
    id: 'ig-agent-topics',
    name: 'Temas de contenido',
    description: 'Elegir el nicho y las etiquetas sobre las que escribe el agente',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-prompt',
    name: 'Instrucciones personalizadas',
    description: 'Ajustar el tono y las instrucciones que sigue el agente',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-limits',
    name: 'Límites de caracteres',
    description: 'Definir cuánto texto genera cada slide — afecta el consumo de tokens',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-model',
    name: 'Modelo de lenguaje',
    description: 'Elegir el proveedor y el modelo que responde, con su propia API key',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-image-key',
    name: 'API key de fal.ai',
    description: 'Configurar la credencial de generación de imágenes',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-image-models',
    name: 'Modelos de generación de imágenes',
    description: 'Elegir qué modelo genera las imágenes de los carruseles',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-agent-image-styles',
    name: 'Estilo visual por rol de slide',
    description: 'Definir el estilo de portada, desarrollo y llamada a la acción',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-audience',
    name: 'Audiencia',
    description: 'Quién te sigue — edad, género y ubicación',
    defaultUrl: process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010',
  },
  {
    id: 'ig-content-intelligence',
    name: 'Inteligencia de contenido',
    description: 'Qué hace que tu contenido funcione y qué hacer diferente esta semana',
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
    professional: ['ig-basic-metrics', 'ig-publications', 'ig-audience'],
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
/**
 * The product row on its own, because `plans.product_id` points at it. Seeding
 * plans first works against a database that already has the product and fails
 * on an empty one, which is the only case a seed really has to handle.
 */
async function seedProduct() {
  // Seeded products ship with trials OFF. A trial is an explicit decision per
  // tenant (backoffice → Trials), never something a fresh install hands out.
  // `update` sets it too, so re-seeding also switches off a product that was
  // created before this rule.
  const defaultUrl = process.env['INSTAGRAM_DASHBOARD_WEB_URL'] ?? 'http://localhost:3010';
  await prisma.product.upsert({
    where: { id: 'instagram-dashboard' },
    update: { trialEnabled: false, defaultUrl },
    create: {
      id: 'instagram-dashboard',
      name: 'Dashboard Instagram',
      description: 'Panel de análisis y métricas de Instagram',
      trialEnabled: false,
      defaultUrl,
    },
  });
}

async function seedInstagramProduct() {
  // Link all IG modules to the product and set parent-child relationships.
  // Listed rather than derived from the id: the previous prefix test read
  // `ig-ai-*` as "child of the agent", which the settings sections are not.
  // Two levels: the agent's features sit directly under it, and its seven
  // configurable sections sit under one heading rather than as seven more
  // siblings of Chat and Carruseles.
  const IG_AGENT_CHILDREN = ['ig-ai-chat', 'ig-ai-suggestions', 'ig-ai-carousels', 'ig-agent-settings'];
  const IG_SETTINGS_CHILDREN = [
    'ig-agent-topics', 'ig-agent-prompt', 'ig-agent-limits', 'ig-agent-model',
    'ig-agent-image-key', 'ig-agent-image-models', 'ig-agent-image-styles',
  ];
  const parentFor = (id: string): string | null => {
    if (IG_AGENT_CHILDREN.includes(id)) return 'ig-ai-agent';
    if (IG_SETTINGS_CHILDREN.includes(id)) return 'ig-agent-settings';
    return null;
  };
  const igModules = ['ig-basic-metrics', 'ig-publications', 'ig-ai-agent',
    ...IG_AGENT_CHILDREN, ...IG_SETTINGS_CHILDREN, 'ig-audience', 'ig-content-intelligence'];
  for (const id of igModules) {
    await prisma.module.update({
      where: { id },
      data: { productId: 'instagram-dashboard', parentId: parentFor(id) },
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
  // Before the plans: they carry a foreign key to it.
  await seedProduct();
  await seedPlans();

  // PlanQuota seeding: idempotent (upsert by planId + resourceType).
  // Runs every time — only creates/updates quotas that are missing or outdated.
  await seedPlanQuotas();

  await seedSystemTenant();
  await seedSuperAdmin();
  await seedModules();
  await seedInstagramProduct();
  await seedDevFixtures();
  // After the modules exist: the product roles reference them by id.
  await seedWorkingFixtures();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
