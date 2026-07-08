#!/usr/bin/env node
/**
 * Webapp Architecture Compliance Check
 *
 * Mechanical assertion of the rules in `.atl/webapp-architecture.md` against
 * every directory under `apps/**` and `internal/webapp-example/`.
 *
 * Honors `.atl/webapp-architecture-exemptions.json`: if an app exempts a rule
 * group (e.g. "§1", "§4"), the corresponding checks are skipped.
 *
 * Exit codes:
 *   0 — all targets compliant (or compliant-with-exemptions).
 *   1 — at least one CRITICAL violation found.
 *   2 — script error (missing files, bad config, etc).
 *
 * Usage:
 *   node scripts/check-webapp-architecture.mjs
 *   node scripts/check-webapp-architecture.mjs --app apps/hub
 *   node scripts/check-webapp-architecture.mjs --json
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXEMPTIONS_FILE = join(ROOT, '.atl', 'webapp-architecture-exemptions.json');

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const onlyAppArg = args.indexOf('--app');
const onlyApp = onlyAppArg >= 0 ? args[onlyAppArg + 1] : null;

// ─── Discovery ──────────────────────────────────────────

async function discoverTargets() {
  const targets = [];
  const candidateRoots = [
    { dir: 'apps', kind: 'production' },
    { dir: 'internal', kind: 'reference', filter: (n) => n === 'webapp-example' },
  ];
  for (const { dir, kind, filter } of candidateRoots) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    const entries = await readdir(abs);
    for (const name of entries) {
      if (filter && !filter(name)) continue;
      const path = join(abs, name);
      const s = await stat(path).catch(() => null);
      if (!s?.isDirectory()) continue;
      // Skip non-Next.js dirs (e.g. apps/api-iam — backend, not a webapp).
      const pkgPath = join(path, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      const isWebapp =
        Boolean(pkg.dependencies?.next) || Boolean(pkg.devDependencies?.next);
      if (!isWebapp) continue;
      targets.push({ id: `${dir}/${name}`, root: path, kind });
    }
  }
  return targets;
}

// ─── Exemptions ─────────────────────────────────────────

async function loadExemptions() {
  if (!existsSync(EXEMPTIONS_FILE)) return new Map();
  const raw = JSON.parse(await readFile(EXEMPTIONS_FILE, 'utf8'));
  const map = new Map();
  for (const e of raw.exemptions ?? []) {
    map.set(e.app, new Set(e.rules ?? []));
  }
  return map;
}

function isExempt(exemptionsForApp, ruleId) {
  if (!exemptionsForApp) return false;
  // An exemption for "§1" covers "§1.1", "§1.2", "§1.3".
  for (const exempted of exemptionsForApp) {
    if (ruleId === exempted) return true;
    if (ruleId.startsWith(exempted + '.')) return true;
  }
  return false;
}

// ─── Helpers ────────────────────────────────────────────

async function tryRead(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

async function* walk(dir, { skip = [] } = {}) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (skip.some((s) => e.name === s)) continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* walk(path, { skip });
    else yield path;
  }
}

function findOneOf(root, names) {
  for (const n of names) {
    const path = join(root, n);
    if (existsSync(path)) return path;
  }
  return null;
}

// ─── Rules ──────────────────────────────────────────────
// Each rule returns an array of findings: { rule, level, message, file? }.
// level: "CRITICAL" | "WARNING" | "INFO"

async function ruleCompositionRoot(ctx) {
  const out = [];
  const servicesPath = join(ctx.root, 'src/lib/services.ts');
  const services = await tryRead(servicesPath);
  if (!services) {
    out.push({ rule: '§1.1', level: 'CRITICAL', message: 'Missing src/lib/services.ts', file: servicesPath });
  } else {
    if (!/createCoreServices\s*\(/.test(services)) {
      out.push({ rule: '§1.1', level: 'CRITICAL', message: 'src/lib/services.ts must call createCoreServices(...)', file: servicesPath });
    }
    if (!/createServicesStore\s*\(/.test(services)) {
      out.push({ rule: '§1.1', level: 'CRITICAL', message: 'src/lib/services.ts must use createServicesStore() and export { store, useServices, useServicesStore }', file: servicesPath });
    }
    if (/axios\.create\s*\(/.test(services)) {
      out.push({ rule: '§1.1', level: 'CRITICAL', message: 'src/lib/services.ts must not call axios.create() — use coreServices.httpClient', file: servicesPath });
    }
  }

  const domainPath = join(ctx.root, 'src/services/domain-services.ts');
  const domain = await tryRead(domainPath);
  if (!domain) {
    out.push({ rule: '§1.2', level: 'CRITICAL', message: 'Missing src/services/domain-services.ts', file: domainPath });
  } else {
    if (!/function\s+getDomainServices\s*\(|getDomainServices\s*=/.test(domain)) {
      out.push({ rule: '§1.2', level: 'CRITICAL', message: 'domain-services.ts must export getDomainServices()', file: domainPath });
    }
    if (!/resetDomainServices/.test(domain)) {
      out.push({ rule: '§1.2', level: 'WARNING', message: 'domain-services.ts should expose resetDomainServices() for tests', file: domainPath });
    }
    if (!/createService\s*</.test(domain)) {
      out.push({ rule: '§1.2', level: 'CRITICAL', message: 'domain-services.ts must build services via coreServices.createService<...>(...)', file: domainPath });
    }
  }

  const providerPath = findOneOf(ctx.root, [
    'src/providers/services-provider.tsx',
    'src/providers/ServicesProvider.tsx',
  ]);
  if (!providerPath) {
    out.push({ rule: '§1.3', level: 'CRITICAL', message: 'Missing ServicesProvider (src/providers/services-provider.tsx or ServicesProvider.tsx)' });
  } else {
    const provider = (await tryRead(providerPath)) ?? '';
    if (!/['"]use client['"]/.test(provider)) {
      out.push({ rule: '§1.3', level: 'CRITICAL', message: 'ServicesProvider must be a client component (\"use client\")', file: providerPath });
    }
    // Module-level guard heuristic: a top-level `let initialized` declaration.
    if (!/^let\s+initialized\b/m.test(provider)) {
      out.push({ rule: '§1.3', level: 'WARNING', message: 'ServicesProvider should use a module-level guard (e.g. `let initialized = false;`) instead of useRef', file: providerPath });
    }
    if (!/return\s+null\s*;?/.test(provider)) {
      out.push({ rule: '§1.3', level: 'WARNING', message: 'ServicesProvider should return null (not a spinner) until initialized', file: providerPath });
    }
  }

  const layoutPath = join(ctx.root, 'src/app/layout.tsx');
  const layout = await tryRead(layoutPath);
  if (!layout) {
    out.push({ rule: '§1.4', level: 'CRITICAL', message: 'Missing src/app/layout.tsx', file: layoutPath });
  } else {
    if (!/<ThemeProvider\b/.test(layout)) {
      out.push({ rule: '§1.4', level: 'CRITICAL', message: 'layout.tsx must wrap children with <ThemeProvider> from @core/shared/providers', file: layoutPath });
    }
    if (!/<ServicesProvider\b/.test(layout)) {
      out.push({ rule: '§1.4', level: 'CRITICAL', message: 'layout.tsx must wrap children with <ServicesProvider>', file: layoutPath });
    }
    if (!/<TooltipProvider\b/.test(layout)) {
      out.push({ rule: '§1.4', level: 'WARNING', message: 'layout.tsx should include <TooltipProvider> from @core/ui', file: layoutPath });
    }
    if (!/<Toaster\b/.test(layout)) {
      out.push({ rule: '§1.4', level: 'WARNING', message: 'layout.tsx should include <Toaster /> from @core/ui', file: layoutPath });
    }
  }

  return out;
}

async function ruleHttpHygiene(ctx) {
  const out = [];
  const srcDir = join(ctx.root, 'src');
  if (!existsSync(srcDir)) return out;
  for await (const file of walk(srcDir, { skip: ['node_modules', '.next', 'dist'] })) {
    if (!/\.(t|j)sx?$/.test(file)) continue;
    const rel = relative(ctx.root, file);
    // The composition root is allowed to touch http internals.
    if (rel.endsWith('lib/services.ts')) continue;
    // Designated escape hatch: lib/api/* (auth bootstrap, cookie refresh).
    if (rel.startsWith('src/lib/api/')) continue;
    const content = await tryRead(file);
    if (!content) continue;
    if (/axios\.create\s*\(/.test(content)) {
      out.push({ rule: '§4', level: 'CRITICAL', message: 'Direct axios.create() outside lib/api/ — must route through coreServices.createService(...)', file });
    }
  }
  return out;
}

async function ruleUiPrimitives(ctx) {
  const out = [];
  const srcDir = join(ctx.root, 'src');
  if (!existsSync(srcDir)) return out;
  for await (const file of walk(srcDir, { skip: ['node_modules', '.next', 'dist'] })) {
    if (!/\.(t|j)sx?$/.test(file)) continue;
    const content = await tryRead(file);
    if (!content) continue;
    if (/from\s+['"]@core\/ui\/src\//.test(content)) {
      out.push({ rule: '§3', level: 'CRITICAL', message: 'Importing internal path from @core/ui — use the package barrel (@core/ui)', file });
    }
  }
  return out;
}

const RULES = [
  { id: 'composition-root', group: '§1', run: ruleCompositionRoot },
  { id: 'ui-primitives', group: '§3', run: ruleUiPrimitives },
  { id: 'http-hygiene', group: '§4', run: ruleHttpHygiene },
];

// ─── Runner ─────────────────────────────────────────────

async function checkTarget(target, exemptions) {
  const exemptedRules = exemptions.get(target.id) ?? new Set();
  const findings = [];
  for (const rule of RULES) {
    if (isExempt(exemptedRules, rule.group)) continue;
    const ruleFindings = await rule.run({ root: target.root });
    // Filter out individual findings whose specific sub-rule is exempt.
    for (const f of ruleFindings) {
      if (isExempt(exemptedRules, f.rule)) continue;
      findings.push(f);
    }
  }
  return { target, exemptedRules: [...exemptedRules], findings };
}

function fmtTarget(report) {
  const lines = [];
  const exempt = report.exemptedRules.length
    ? ` (exempt: ${report.exemptedRules.join(', ')})`
    : '';
  const critical = report.findings.filter((f) => f.level === 'CRITICAL').length;
  const warning = report.findings.filter((f) => f.level === 'WARNING').length;
  const status = critical > 0 ? 'FAIL' : warning > 0 ? 'WARN' : 'OK';
  lines.push(`▸ ${report.target.id}${exempt} — ${status} (${critical} critical, ${warning} warning)`);
  for (const f of report.findings) {
    const where = f.file ? ` — ${relative(ROOT, f.file)}` : '';
    lines.push(`    [${f.level}] ${f.rule}: ${f.message}${where}`);
  }
  return lines.join('\n');
}

async function main() {
  const exemptions = await loadExemptions();
  const allTargets = await discoverTargets();
  const targets = onlyApp ? allTargets.filter((t) => t.id === onlyApp) : allTargets;
  if (!targets.length) {
    console.error(`No webapp targets found${onlyApp ? ` for ${onlyApp}` : ''}.`);
    process.exit(2);
  }

  const reports = [];
  for (const t of targets) reports.push(await checkTarget(t, exemptions));

  if (wantJson) {
    console.log(JSON.stringify({ reports }, null, 2));
  } else {
    console.log('Webapp Architecture Compliance');
    console.log('==============================');
    for (const r of reports) console.log(fmtTarget(r));
  }

  const totalCritical = reports.reduce(
    (n, r) => n + r.findings.filter((f) => f.level === 'CRITICAL').length,
    0
  );
  process.exit(totalCritical > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('check-webapp-architecture: script error');
  console.error(err);
  process.exit(2);
});
