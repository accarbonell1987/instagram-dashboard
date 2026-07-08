# STACK.md — Complete Technology Stack

> Last updated: 2026-06-27 | Updated: reconciled testing & CI sections with measured reality (test suites in api-iam, api-instagram-analytics and hub were undercounted; CI now runs type-check/lint/test).

---

## Runtime & Toolchain

| Tool           | Version    | Config                           |
| -------------- | ---------- | -------------------------------- |
| **Node.js**    | `>=22.0.0` | `package.json#engines`           |
| **pnpm**       | `9.15.4`   | `package.json#packageManager`    |
| **Turborepo**  | `^2.3.3`   | `turbo.json`                     |
| **TypeScript** | `^5.7.3`   | `@core/config/typescript/*.json` |

---

## Core Package Versions

### @core/core

| Dependency               | Version        | Purpose                            |
| ------------------------ | -------------- | ---------------------------------- |
| `axios`                  | `^1.7.9`       | HTTP client                        |
| `zustand`                | `^5.0.3`       | Services store                     |
| `react` (peer)           | `^18 \|\| ^19` | React hooks in createServicesStore |
| `vitest`                 | `^3.0.5`       | Unit testing                       |
| `jsdom`                  | `^25.0.1`      | Test environment                   |
| `@testing-library/react` | `^16.1.0`      | React hook testing                 |
| `@vitest/coverage-v8`    | `^3.0.5`       | Coverage provider                  |
| `vite`                   | `^7.3.1`       | Dev tooling for vitest             |

### @core/ui

| Dependency                 | Version                 | Purpose                                 |
| -------------------------- | ----------------------- | --------------------------------------- |
| Radix primitives           | various `^1.x` / `^2.x` | Unstyled accessible components          |
| `class-variance-authority` | `^0.7.1`                | CVA for variants                        |
| `clsx`                     | `^2.1.1`                | Conditional class names                 |
| `tailwind-merge`           | `^2.6.0`                | Merge tailwind classes safely           |
| `lucide-react`             | `^0.511.0`              | Icon library                            |
| `react-hook-form`          | `^7.71.1`               | Form management (used in form organism) |
| `cmdk`                     | `^1.1.1`                | Command palette                         |
| `date-fns`                 | `^4.1.0`                | Date utilities                          |
| `embla-carousel-react`     | `^8.6.0`                | Carousel                                |
| `input-otp`                | `^1.4.2`                | OTP input                               |
| `react-day-picker`         | `^9.13.0`               | Calendar                                |
| `react-resizable-panels`   | `^4.5.5`                | Resizable panels                        |
| `recharts`                 | `^2.15.4`               | Charts                                  |
| `sonner`                   | `^2.0.7`                | Toast notifications                     |
| `vaul`                     | `^1.1.2`                | Drawer                                  |
| `zod` (devDep)             | `^4.3.6`                | Used in form organism                   |

> **Note**: `zod` in `@core/ui` devDependencies is v4, but `@internal/api-example` uses `^3.24.1`. Applications should be consistent about which Zod version they use.

### @core/shared

| Dependency    | Version       | Purpose                             |
| ------------- | ------------- | ----------------------------------- |
| `next-themes` | `^0.4.6`      | Dark/light theme management         |
| `@core/ui`    | `workspace:*` | UI components used in ThemeSelector |

### @core/database

| Dependency        | Version  | Purpose                  |
| ----------------- | -------- | ------------------------ |
| `@prisma/client`  | `^6.2.1` | Generated Prisma client  |
| `prisma` (devDep) | `^6.2.1` | CLI for schema/migration |

### @core/config

| Dependency                    | Version    | Purpose                         |
| ----------------------------- | ---------- | ------------------------------- |
| `tailwindcss`                 | `^4.0.6`   | Tailwind CSS                    |
| `typescript-eslint`           | `^8.21.0`  | TypeScript ESLint rules         |
| `@eslint/js`                  | `^9.18.0`  | ESLint JS rules                 |
| `eslint-plugin-import-x`      | `^4.6.1`   | Import ordering/deduplication   |
| `globals`                     | `^15.14.0` | Browser/Node global definitions |
| `eslint-config-prettier`      | `^10.0.1`  | Disable formatting rules        |
| `prettier-plugin-tailwindcss` | `^0.6.11`  | Auto-sort Tailwind classes      |
| `style-dictionary`            | `^4.2.0`   | Design token build system       |
| `@next/eslint-plugin-next`    | `^15.1.6`  | Next.js ESLint rules            |
| `eslint-plugin-react`         | `^7.37.4`  | React ESLint rules              |
| `eslint-plugin-react-hooks`   | `^5.1.0`   | Hooks linting                   |

### @core/cli

| Dependency  | Version   | Purpose               |
| ----------- | --------- | --------------------- |
| `chalk`     | `^5.4.1`  | Terminal colors       |
| `commander` | `^13.1.0` | CLI framework         |
| `fs-extra`  | `^11.3.0` | File system utilities |
| `ora`       | `^8.2.0`  | Terminal spinner      |
| `prompts`   | `^2.4.2`  | Interactive prompts   |

---

## Production Apps

### @corehub/api-iam

IAM microservice — port 8080 | PostgreSQL 16 on port 5432 (Docker) | Adminer on 8081.

| Dependency             | Version     | Purpose                              |
| ---------------------- | ----------- | ------------------------------------ |
| `hono`                 | `^4.x`      | HTTP framework                       |
| `@hono/node-server`    | `^1.x`      | Node.js adapter                      |
| `@hono/zod-openapi`    | `^0.x`      | OpenAPI + validation                 |
| `@hono/swagger-ui`     | `^0.x`      | Swagger UI endpoint                  |
| `zod`                  | `^3.x`      | Schema validation                    |
| `@prisma/client`       | `^6.0.0`    | ORM client                           |
| `jose`                 | `^5.x`      | JWT RS256 sign/verify                |
| `argon2`               | `^0.43.0`   | Password hashing (argon2id)          |
| `nanoid`               | `^5.x`      | Opaque token ID generation           |
| `node-cron`            | `^3.x`      | Background cron jobs (5 jobs)        |
| `resend`               | `^4.x`      | Email sending (adapter)              |
| `pino`                 | `^10.0.0`   | Structured logging                   |
| `prisma` (devDep)      | `^6.0.0`    | CLI for schema/migration             |
| `pino-pretty` (devDep) | `^11.0.0`   | Pretty console output in development |
| `vitest` (devDep)      | `^3.x`      | Unit testing                         |
| `tsx` (devDep)         | `^4.x`      | TypeScript execution for dev         |

**Dev script**: `tsx watch src/index.ts`
**Test script**: `vitest`
**Logging env vars**: `LOG_LEVEL`, `LOG_TO_CONSOLE`, `LOG_FILE_PATH`, `LOG_FORMAT`

---

### @corehub/api-instagram-analytics

Instagram Analytics API — port 3003 | PostgreSQL.

| Dependency          | Version   | Purpose                                          |
| ------------------- | --------- | ------------------------------------------------ |
| `hono`              | `^4.x`    | HTTP framework                                   |
| `@hono/node-server` | `^1.x`    | Node.js adapter                                  |
| `@hono/zod-openapi` | `^0.x`    | OpenAPI + validation                             |
| `@hono/swagger-ui`  | `^0.x`    | Swagger UI at `/docs`                            |
| `zod`               | `^3.x`    | Schema validation (imported from `@hono/zod-openapi`) |
| `@prisma/client`    | `^6.x`    | ORM client                                       |
| `jose`              | `^5.x`    | JWT verification against api-iam JWKS            |
| `recharts`          | `^2.x`    | (frontend) Chart library used in hub dashboard   |
| `prisma` (devDep)   | `^6.x`    | CLI for schema/migration                         |
| `vitest` (devDep)   | `^3.x`    | Unit testing                                     |
| `tsx` (devDep)      | `^4.x`    | TypeScript execution for dev                     |

**Dev script**: `tsx watch src/index.ts`
**Env vars críticas**: `DATABASE_URL`, `IAM_JWKS_URL` (ej. `http://localhost:8080`), `IG_APP_ID`, `IG_APP_SECRET`, `IG_REDIRECT_URI`, `ENCRYPTION_KEY` (64-char hex)
**Swagger docs**: `http://localhost:3003/docs`

---

## Internal Apps

### @internal/api-example

| Dependency          | Version       | Purpose                      |
| ------------------- | ------------- | ---------------------------- |
| `hono`              | `^4.6.17`     | HTTP framework               |
| `@hono/node-server` | `^1.13.8`     | Node.js adapter              |
| `@hono/zod-openapi` | `^0.18.0`     | OpenAPI + validation         |
| `@hono/swagger-ui`  | `^0.5.0`      | Swagger UI endpoint          |
| `zod`               | `^3.24.1`     | Schema validation            |
| `@core/database`    | `workspace:*` | Prisma client (optional)     |
| `@core/shared`      | `workspace:*` | Shared utilities             |
| `tsx` (devDep)      | `^4.19.2`     | TypeScript execution for dev |

**Dev script**: `tsx watch src/index.ts` (no port flag — reads from config.ts / `.env`)
**Build script**: `tsc` → `dist/`
**Start script**: `node dist/index.js`

### @internal/webapp-example

| Dependency                      | Version       | Purpose                      |
| ------------------------------- | ------------- | ---------------------------- |
| `next`                          | `^15.1.6`     | App framework                |
| `react`                         | `^19.0.0`     | UI library                   |
| `react-dom`                     | `^19.0.0`     | DOM renderer                 |
| `@core/core`                    | `workspace:*` | HTTP client + services       |
| `@core/ui`                      | `workspace:*` | Design system                |
| `@core/shared`                  | `workspace:*` | ThemeProvider                |
| `@core/config`                  | `workspace:*` | Configs                      |
| `next-themes`                   | `^0.4.6`      | Dark/light mode              |
| `lucide-react`                  | `^0.511.0`    | Icons                        |
| `clsx`                          | `^2.1.1`      | Class utilities              |
| `tailwind-merge`                | `^2.6.0`      | Merge Tailwind classes       |
| `sonner`                        | `^2.0.7`      | Toast notifications          |
| `tw-animate-css`                | `^1.4.0`      | Tailwind animation utilities |
| `tailwindcss` (devDep)          | `^4.0.6`      | Tailwind CSS v4              |
| `@tailwindcss/postcss` (devDep) | `^4.0.6`      | PostCSS integration          |

**Dev script**: `next dev --turbopack --port 3004`
**Note**: Tailwind CSS v4 — configuration is via CSS imports, NOT a `tailwind.config.ts` (no plugins, no `extend`). The existing `tailwind.config.ts` in this app is a legacy artifact and may conflict.

### @internal/docs

| Dependency                 | Version       | Purpose                    |
| -------------------------- | ------------- | -------------------------- |
| `next`                     | `^15.1.6`     | App framework              |
| `@core/ui`                 | `workspace:*` | UI components              |
| `@core/config`             | `workspace:*` | Configs                    |
| `react-markdown`           | `^10.1.0`     | Markdown rendering         |
| `rehype-highlight`         | `^7.0.2`      | Code syntax highlight      |
| `rehype-slug`              | `^6.0.0`      | Auto-generate heading IDs  |
| `rehype-autolink-headings` | `^7.1.0`      | Link heading anchors       |
| `remark-gfm`               | `^4.0.1`      | GitHub Flavored Markdown   |
| `gray-matter`              | `^4.0.3`      | Frontmatter parsing        |
| `highlight.js`             | `^11.11.1`    | Syntax highlighting engine |

**Dev script**: `next dev --turbopack --port 3002`

---

## Dev Ports

| App                               | Port                               |
| --------------------------------- | ---------------------------------- |
| `apps/api-iam`                    | 8080                               |
| `apps/api-instagram-analytics`    | 3003                               |
| `@internal/api-example`           | 3005 (default PORT in config.ts)   |
| `@internal/docs`                  | 3002                               |
| `@internal/webapp-example`        | 3004 (consumes api-example :3005)  |
| apps/hub (production)             | 3001                               |
| apps/landing-page                 | 3000 (Next.js default)             |
| CLI-generated APIs                | 3010+ (auto-incremented)           |
| CLI-generated webapps             | 3021+ (auto-incremented)           |

---

## Scripts Reference

### Root (delegates to Turborepo)

```bash
pnpm dev                    # All packages + apps (parallel)
pnpm dev:apps               # Only apps/*
pnpm dev:internal           # Only internal/*
pnpm dev:webapp             # @internal/webapp-example
pnpm dev:api                # @internal/api-example
pnpm dev:docs               # @internal/docs

pnpm build                  # Full build (respects dependency order)
pnpm build:apps             # Build apps/* only
pnpm build:internal         # Build internal/* only

pnpm test                   # Run all tests (Vitest only — @core/core)
pnpm test:coverage          # With coverage report
pnpm test:e2e               # Playwright E2E (delegates to apps/hub via turbo)
pnpm test:e2e:ui            # Playwright UI mode (apps/hub)
pnpm test:e2e:debug         # Playwright debug mode (apps/hub)

pnpm lint                   # Lint all packages
pnpm lint:fix               # Lint + auto-fix
pnpm type-check             # TypeScript type checking

pnpm format                 # Prettier write
pnpm format:check           # Prettier check

pnpm db:generate            # Generate Prisma client (all packages)
pnpm db:push                # Push schema to DB
pnpm db:studio              # Open Prisma Studio

pnpm core                   # Run @core/cli (CLI generator)
pnpm ui:add <component>     # Add shadcn component to @core/ui

pnpm clean                  # Clean .turbo + node_modules
pnpm clean-absolute         # Deep clean everything
```

### @core/core specific

```bash
pnpm --filter=@core/core test          # Run tests once
pnpm --filter=@core/core test:watch    # Watch mode
pnpm --filter=@core/core test:coverage # Coverage report
```

### @core/cli specific

```bash
pnpm core new api <name>    # Generate new Hono API
pnpm core new webapp <name> # Generate new Next.js webapp
pnpm core add route <name>  # Add route to existing API
pnpm core add page <name>   # Add page to existing webapp
pnpm core add component <n> # Add component to existing app
```

---

## Testing Strategy

| Layer      | Framework       | Location                                          | Status                                  |
| ---------- | --------------- | ------------------------------------------------- | --------------------------------------- |
| Unit tests | Vitest 3        | `packages/core/src/**/*.test.ts`                  | Active (~16 test files)                 |
| Unit tests | Vitest 3        | `apps/api-iam/src/**/*.test.ts`                   | Active (~57 test files / 249 sources)   |
| Unit tests | Vitest 3        | `apps/api-instagram-analytics/src/**/*.test.ts`   | Active (~23 test files / 84 sources)    |
| Unit/comp. | Vitest 3        | `apps/hub/src/**/*.test.{ts,tsx}`                 | Active (~92 test files)                 |
| Unit tests | Vitest 3        | `internal/api-example/src/**/*.test.ts`           | Active (user.service.test.ts)           |
| E2E tests  | Playwright 1.50 | `apps/hub/e2e/`                                   | Active (login, wizard, a11y; MSW-backed)|

> **Counts are approximate** (measured 2026-06-27 via shell glob) and drift as the suite grows — treat them as orders of magnitude, not exact figures. The earlier claim that only `@core/core` and `api-example` had tests was outdated: the production apps carry the bulk of the suite.

**Coverage thresholds** (enforced in `@core/core`):

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**No React Query** in current codebase. Data fetching uses manual `useEffect` + `useCrudPage` hook pattern.

---

## TypeScript Configurations

### base.json (used by library packages)

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noPropertyAccessFromIndexSignature": true,
  "noFallthroughCasesInSwitch": true,
  "moduleResolution": "bundler",
  "module": "ESNext",
  "target": "ES2022",
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```

### nextjs.json (used by Next.js apps)

Extends base + `"jsx": "preserve"`, `"noEmit": true`, `"allowJs": true`, `"incremental": true`, next plugin.

### library.json (for packages that compile to dist/)

Extends base + `"jsx": "react-jsx"`, `"outDir": "dist"`, `"rootDir": "src"`.

### node.json (for Node.js CLI/server)

Extends base without DOM types.

---

## ESLint Configurations

### base.js (all packages)

- `typescript-eslint` strict + stylistic + type-checked
- `eslint-config-prettier` (disables formatting rules)
- `import-x` ordering (groups, newlines, alphabetical)
- `@typescript-eslint/consistent-type-imports` → enforces `import type`
- `@typescript-eslint/no-unused-vars` → ignores `_` prefix

### nextjs.js (Next.js apps)

Extends base + `@next/eslint-plugin-next` + `eslint-plugin-react` + `eslint-plugin-react-hooks`

### library.js (packages)

Same as base, optimized for library packages.

### node.js (api-example, cli)

Same as base, node globals.

---

## Vercel Deployment

```json
// vercel.json (at monorepo root)
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && npx turbo build --filter=@corehub/landing-page",
  "outputDirectory": ".next"
}
```

Deploys `apps/landing-page` only. Hub has separate deployment configuration (not yet committed to root vercel.json).

**CI/CD**: three workflows under `.github/workflows/`

- `ci.yml` — on every PR + push to `main`/`develop`: `pnpm db:generate` → `type-check` → `lint` → `test` (runs the full Vitest suite via Turborepo).
- `webapp-architecture.yml` — on PRs touching `apps/**`/`internal/webapp-example/**`: runs `scripts/check-webapp-architecture.mjs` compliance gate.
- `deploy-develop.yml` — `develop` → Vercel preview, `main` → Vercel production (deploy only, no gating).

---

## Key Versions Summary Table

| Package          | Version  |
| ---------------- | -------- |
| TypeScript       | ^5.7.3   |
| React            | ^19.0.0  |
| Next.js          | ^15.1.6  |
| Hono             | ^4.6.17  |
| Tailwind CSS     | ^4.0.6   |
| Axios            | ^1.7.9   |
| Zustand          | ^5.0.3   |
| Zod (api)        | ^3.24.1  |
| Zod (ui dev)     | ^4.3.6   |
| Prisma           | ^6.2.1   |
| Vitest           | ^3.0.5   |
| Playwright       | ^1.50.0  |
| ESLint           | ^9.18.0  |
| Prettier         | ^3.4.2   |
| Turborepo        | ^2.3.3   |
| Style Dictionary | ^4.2.0   |
| pnpm             | 9.15.4   |
| Node.js          | >=22.0.0 |
