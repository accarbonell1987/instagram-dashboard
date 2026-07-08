# Webapp Architecture — Mandatory Rules for AI Agents

> **Audience**: AI agents creating, modifying, or reviewing code under `apps/**` or `internal/webapp-example/**`.
> **Reference implementation**: `internal/webapp-example/` — read it before writing code.
> **Status**: Authoritative. If a rule here conflicts with general guidance elsewhere, this file wins for webapp work.

---

## Rationale

The CORE monorepo ships shared packages (`@core/core`, `@core/ui`, `@core/shared`, `@core/config`) so every webapp gets:

- A consistent design system with dual theming (dark/light + color-theme).
- A typed service layer (`createCoreServices` + `CrudService` + `ServiceExtender`).
- A canonical composition root and feature folder layout (Screaming Architecture).

When a webapp diverges from this contract without a documented reason, the value of the shared packages collapses: every app becomes its own snowflake, refactors get expensive, and the CLI generator stops being a useful starting point. **The rules below exist to keep that value intact.**

---

## Compliance Levels

- **MUST** — Non-negotiable. A pull request that breaks a MUST rule is rejected unless it ships an exemption entry (see §Exemptions).
- **SHOULD** — Strong default. Document the reason in the app's `CLAUDE.md` when deviating.
- **MAY** — Optional. Use when it helps, skip when it doesn't.

---

## §1 Composition Root — MUST

Every webapp under `apps/**` (and `internal/webapp-example/`) MUST have:

### 1.1 `src/lib/services.ts`

- MUST call `createCoreServices(...)` from `@core/core/services` exactly once.
- MUST export `coreServices` and the trio `{ store, useServices, useServicesStore }` returned by `createServicesStore()` from `@core/core/react`.
- MUST source `baseUrl` from `process.env['NEXT_PUBLIC_API_URL']` with a sensible localhost fallback.
- MUST NOT call `axios.create(...)` directly. The Axios instance lives inside `coreServices.httpClient`.

### 1.2 `src/services/domain-services.ts`

- MUST expose a `getDomainServices()` singleton that builds entity services via `coreServices.createService<...>(path, extend?)`.
- MUST expose `resetDomainServices()` for tests and auth context resets.
- MUST place ServiceExtenders (custom non-CRUD methods) under `src/services/extensions/` as factory functions named `create{Entity}Extensions`.
- Extensions MUST use `type`, never `interface` (required by the `E extends Record<string, unknown>` constraint).

### 1.3 `src/providers/services-provider.tsx` (or `ServicesProvider.tsx`)

- MUST be a client component (`'use client'`).
- MUST initialize the services store via a **module-level guard** (not `useRef`) to survive React Strict Mode remounts.
- MUST return `null` until initialized — no spinner.

### 1.4 `src/app/layout.tsx`

- MUST wrap `{children}` with, in this order from outside to inside: `ThemeProvider` → `TooltipProvider` (from `@core/ui`) → `ServicesProvider`.
- MUST pass `attribute="class"`, `defaultTheme`, `enableSystem`, and `defaultColorTheme` to `ThemeProvider` (imported from `@core/shared/providers`).
- MUST include `<Toaster />` from `@core/ui` inside `ServicesProvider`.

---

## §2 Theming — MUST

- MUST use `ThemeProvider` from `@core/shared/providers` for both dark/light (`next-themes`) and color-theme (`ColorThemeContext`) — they are orthogonal.
- MUST consume color-theme via `useColorTheme()` from `@core/shared`, never reimplement it.
- MUST NOT add a second theme system, a custom `ThemeContext`, or duplicate the dark-mode switch logic.
- MUST import design tokens via `@import "@core/config/styles/globals.css"` in `app/globals.css`. Choose a strategy (`ds-tokens`, `shadcn-fixed`, `shadcn-dynamic`, `custom`, `hybrid`) per `ThemeStrategy` and document it in the app's `CLAUDE.md`.

---

## §3 UI Components — MUST

- MUST import primitives from `@core/ui` (Button, Input, Table, Dialog, Card, Badge, Toaster, TooltipProvider, etc.).
- MUST NOT recreate primitives locally. If a needed primitive is missing, add it to `@core/ui` (`pnpm ui:add <name>` from the root) — do not inline it in the app.
- SHOULD compose reusable layouts in `src/shared/components/` (`CrudPageLayout`, `DataTable`, `SearchInput`, etc.).
- MUST NOT use `cva` + `forwardRef` + `cn()` patterns at app level — those belong in `@core/ui` atoms.
- MUST NOT import internal paths from `@core/ui` (e.g. `@core/ui/src/atoms/button`). Use the package barrel: `import { Button } from '@core/ui'`.

---

## §4 HTTP & Errors — MUST

- MUST route every API call through a service built by `coreServices.createService(...)` or its extensions.
- MUST NOT call `fetch(...)` or `axios.create(...)` directly from feature/app code. The only exceptions are documented in §Exemptions (auth bootstrap, cookie-based refresh, server-side rendering with no service yet).
- MUST NOT wrap services in `try/catch` internally. Services throw `ServiceError` from `@core/core/errors`; React Query, hooks, or error boundaries handle it.
- MUST never reimplement CRUD. Extend with `ServiceExtender` instead.

---

## §5 Folder Layout (Screaming Architecture) — MUST

```
apps/{app}/src/
├── app/                       # Next.js App Router (thin wrappers, ≤ 5 lines per page.tsx)
├── features/{feature}/        # Domain features
│   ├── index.ts               # Barrel
│   ├── page.tsx
│   ├── {feature}.types.ts
│   ├── {feature}.constants.ts
│   ├── hooks/
│   └── components/
├── shared/
│   ├── hooks/                 # useCrudPage, useDebouncedValue, ...
│   └── components/            # CrudPageLayout, DataTable, ...
├── lib/
│   └── services.ts            # Composition root
├── services/
│   ├── index.ts
│   ├── types.ts               # DomainServices interface
│   ├── domain-services.ts
│   └── extensions/
├── hooks/
│   └── use-domain-services.ts
├── types/
│   └── entities.ts
└── providers/
    └── services-provider.tsx
```

- `app/{feature}/page.tsx` MUST be a thin re-export: `export { FooPage as default } from '@/features/foo';`.

---

## §6 Naming & Imports — MUST

- Files: `kebab-case` (`crud-service.ts`). Components and classes: `PascalCase`.
- Factories: `create*` prefix (`createCoreServices`, `createUserExtensions`).
- Singleton getters: `get*` prefix (`getDomainServices`).
- Hooks: `use*` prefix.
- `import type` is mandatory for type-only imports (`verbatimModuleSyntax: true`).
- Always import from package barrels (`@core/ui`, `@core/core/services`), never internal paths.
- Local alias: `@/*` → `./src/*`.

---

## §7 Module-Level Guards & Singletons — MUST

- The services store init MUST use a module-level boolean guard, not `useRef`. Strict Mode remounts the component but not the module.
- `getDomainServices()` MUST cache its return value in a module-level variable; `resetDomainServices()` clears it.

---

## §8 Mock Adapter — MAY

- MAY use `createMockAdapter` from `@core/core/mocks` for unit-testing services in isolation.
- MUST NOT use it for flows that depend on Authorization / Cookie / Idempotency-Key headers — it operates at the Axios adapter level and bypasses headers. Use MSW for those flows.

---

## §Exemptions

Some apps legitimately diverge from these rules. The current exemption list lives in `.atl/webapp-architecture-exemptions.json`. Any new exemption MUST:

1. Add an entry to that file with `app`, `rules` (list of rule IDs from this doc, e.g. `["§1.3", "§4"]`), `reason`, and `since` (date).
2. Update the app's local `CLAUDE.md` to point to the exemption and explain consumer-facing implications.
3. Be reviewed by the architecture-oracle agent or a human reviewer before merge.

Current known divergences (already exempt):

| App                 | Rules diverged | Why                                                              |
| ------------------- | -------------- | ---------------------------------------------------------------- |
| `apps/hub`          | §1, §4         | OAuth / cookie httpOnly + tokenHolder; ServicesProvider replaced by `auth-context`; custom Bearer interceptor on `coreServices.httpClient`. Domain services not yet defined — review by 2026-08-01. |
| `apps/landing-page` | §1, §4, §5     | Marketing site — does not consume services or expose CRUD.        |

---

## §Checklist for AI Agents

Before completing any task that creates or modifies files under `apps/**` or `internal/webapp-example/**`, run this checklist mentally:

- [ ] Did I read `internal/webapp-example/` for the canonical pattern of what I'm about to add?
- [ ] Does my change introduce a new `axios.create` / `fetch(` outside `lib/api/`? If yes, is it exempt?
- [ ] Does my change introduce a new theme provider, dark-mode toggle, or color-theme system? If yes, stop — use `@core/shared`.
- [ ] Does my change recreate a primitive that already exists in `@core/ui`? If yes, stop — use it from there.
- [ ] Is my new service built via `coreServices.createService(...)` and registered in `getDomainServices()`?
- [ ] Are my new files in the right Screaming Architecture folder?
- [ ] If I broke a MUST rule on purpose, did I add an exemption entry?

---

## §Reference Files (read these first)

- `internal/webapp-example/src/lib/services.ts`
- `internal/webapp-example/src/services/domain-services.ts`
- `internal/webapp-example/src/services/extensions/user.extensions.ts`
- `internal/webapp-example/src/providers/ServicesProvider.tsx`
- `internal/webapp-example/src/app/layout.tsx`
- `.claude/context/PATTERNS.md` (general patterns)
- `.claude/context/ARCHITECTURE.md` (monorepo map)
