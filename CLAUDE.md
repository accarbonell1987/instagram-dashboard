# Proyecto: CORE Monorepo Platform

## Visión del Proyecto

Este monorepo es una **plataforma de desarrollo** que combina:

1. **Packages compartidos** — `@core/ui`, `@core/core`, `@core/database`, `@core/shared`, `@core/config` — reutilizables en todas las apps
2. **CLI Generador** — `pnpm core` — scaffolding de nuevas APIs y webapps desde templates
3. **Documentación viva** — `internal/docs` — portal de documentación en Next.js 15

> Ver `PRD.md` para la visión completa, roadmap y métricas de éxito.

## Tipo de proyecto

Monorepo — múltiples apps y paquetes compartidos gestionados con Turborepo 2.x y pnpm 9.15.4 workspaces.

## Estructura del Monorepo

```
front-corehub-core/
├── apps/                  # 🚀 Apps de PRODUCCIÓN (generadas por CLI o a mano)
├── internal/              # 🔧 Apps de SOPORTE (no productivas)
│   ├── api-example/       # @internal/api-example — API REST de referencia (Hono 4.x, puerto 3001)
│   ├── webapp-example/    # @internal/webapp-example — Webapp de referencia (Next.js 15, puerto 3004)
│   └── docs/              # @internal/docs — Portal de documentación (Next.js 15, puerto 3002)
├── packages/              # 📦 Paquetes compartidos
│   ├── cli/               # @core/cli — CLI generador (commander + prompts)
│   ├── core/              # @core/core — HTTP client, auth, CrudService, ServiceExtender, mocks, Zustand store
│   ├── ui/                # @core/ui — Design system (CVA, atomic design, shadcn/ui)
│   ├── shared/            # @core/shared — ThemeProvider, tipos, utilidades
│   ├── database/          # @core/database — Prisma ORM (PostgreSQL)
│   └── config/            # @core/config — ESLint, TypeScript, Tailwind, design tokens
├── templates/             # 📋 Templates para el CLI (api/ y webapp/)
├── e2e/                   # 🧪 Tests E2E con Playwright (scaffold, WIP)
└── prototypes/            # 🔬 Prototipos experimentales
```

## Stack tecnológico

- **Runtime**: Node.js >=22.0.0 | **Package manager**: pnpm 9.15.4 | **Build**: Turborepo 2.x
- **Lenguaje**: TypeScript 5.7+ (strict, ESM nativo, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`)
- **API**: Hono 4.x + `@hono/zod-openapi` | **Web**: Next.js 15 App Router + React 19 + Turbopack
- **Estilos**: Tailwind CSS v4 | **ORM**: Prisma 6.x (PostgreSQL) | **Validación**: Zod 3.x (api) / 4.x (ui devDep)
- **State**: Zustand 5.x | **HTTP**: Axios 1.x
- **Testing**: Vitest 3 (unit, en `@core/core` y `@internal/api-example`) + Playwright 1.50 (E2E, WIP)
- **Linting**: ESLint 9.x + Prettier 3.x
- **Design tokens**: Style Dictionary 4.x

## Contexto de arquitectura

> Leer SIEMPRE antes de cualquier tarea en este proyecto.

- `.claude/context/ARCHITECTURE.md` — mapa completo de arquitectura y módulos
- `.claude/context/PATTERNS.md` — patrones de código y convenciones reales (con ejemplos de código)
- `.claude/context/STACK.md` — stack completo, dependencias, versiones y scripts

## Agentes para este proyecto

### Agentes locales (incluidos en este repo)

| Agente                 | Usar para...                                   |
| ---------------------- | ---------------------------------------------- |
| **hono-api-developer** | Cualquier tarea en `internal/api-example/`     |
| **webapp-developer**   | Cualquier tarea en `internal/webapp-example/`  |
| **monorepo-architect** | Packages, Turborepo, workspace, CLI, templates |

### Agentes globales (requieren instalación en `~/.config/opencode/agents/`)

| Agente                         | Usar para...                                                |
| ------------------------------ | ----------------------------------------------------------- |
| **architecture-oracle**        | Decisiones arquitectónicas cross-cutting, refactors grandes |
| **analysis-specialist**        | Auditoría de calidad, deuda técnica, seguridad, rendimiento |
| **qa-tester**                  | Tests Vitest/Playwright, cobertura, estrategia de testing   |
| **devops-specialist**          | CI/CD, Docker, deployment, GitHub Actions                   |
| **typescript-pro**             | Tipos complejos, generics, configuración TypeScript         |
| **uiux-designer**              | Diseño con Pencil MCP, wireframes, design system            |
| **nextjs-architecture-expert** | App Router, Server vs Client Components, performance        |

## Arquitectura obligatoria de webapps

> **Lee SIEMPRE `.atl/webapp-architecture.md` antes de crear o modificar cualquier archivo bajo `apps/**` o `internal/webapp-example/**`.**

Toda webapp del monorepo debe seguir el patrón canónico de `internal/webapp-example/`:
`createCoreServices` + `getDomainServices` + `ServicesProvider` con guard module-level + `ThemeProvider` de `@core/shared` + Screaming Architecture. Las divergencias legítimas (auth distinta, sites de marketing) viven en `.atl/webapp-architecture-exemptions.json` con razón y `reviewBy`.

Compliance mecánico: `node scripts/check-webapp-architecture.mjs` (acepta `--app apps/foo` y `--json`). Devuelve `0` si todo pasa, `1` si hay CRITICAL.

## Convenciones específicas de este proyecto

> Ver ejemplos completos en `.claude/context/PATTERNS.md`.

- **Archivos**: `kebab-case` — `crud-service.ts`. Clases y componentes: `PascalCase`.
- **Factories**: prefijo `create` — `createCoreServices()`, `createMockAdapter()`, `createRepositories()`
- **Getters de singletons**: prefijo `get` — `getDomainServices()`
- **Hooks**: prefijo `use` — `useServices()`, `useColorTheme()`, `useServicesStore()`, `useCrudPage()`
- **`import type`** obligatorio para imports de solo tipos (`verbatimModuleSyntax` + ESLint)
- **Barrel files** (`index.ts`) en cada carpeta — nunca importar rutas internas de packages externos
- **Errors**: services lanzan errores, nunca try/catch internos — el consumidor gestiona
  - API (`internal/api-example`): `AppError` → `NotFoundError`, `ConflictError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `InternalError`
  - Core/webapp: `ServiceError` de `@core/core/errors`
- **`CrudService<T>`** — base de todos los servicios. Nunca reimplementar CRUD.
- **`ServiceExtender`** — extensiones custom como mixin (Object.assign), sin herencia de clases. Usar `type`, no `interface`, para las extensiones.
- **Atoms de UI**: CVA + `forwardRef` + `cn()` — exportar también `variants` y el tipo. Solo en `@core/ui`, no en apps.
- **Tests co-locados**: `Token.ts` → `Token.test.ts`. Preferir junto al archivo fuente.
- **`exactOptionalPropertyTypes: true`** — campos opcionales siempre `T | undefined`, no pueden asignarse a `undefined` si no está en el tipo.
- **ESM nativo**: extensión `.js` en todos los imports relativos en Node.js packages (cli, api-example). En Next.js no es necesario.
- **Theming**: dark/light (`next-themes`, clase `dark`) y color-theme (`ColorThemeContext`, clase `theme-{name}`) son **ortogonales** en `@core/shared/providers`.
- **Mock system**: `createMockAdapter()` opera a nivel Axios adapter — NO intercepta headers (auth, cookies). Para flujos con auth/cookies usar MSW.
- **API response envelope**: `{ success: true, data: ... }` en éxito, `{ success: false, error: { code, message, details? } }` en error. El httpClient de `@core/core` unwrapea el envelope automáticamente.
- **ServicesProvider retorna `null`** hasta inicialización (no spinner). Módule-level guard para evitar doble init en React Strict Mode.
- **Design tokens**: `pnpm tokens:build` debe ejecutarse antes de cualquier build. Turborepo lo hace automáticamente vía pipeline.
- **ThemeStrategy** (en `@core/config/styles/theme-config.ts`): `ds-tokens` | `shadcn-fixed` | `shadcn-dynamic` | `custom` | `hybrid` — ver ARCHITECTURE.md
- **Puertos**: `apps/hub` posee el puerto 3001. `@internal/api-example` corre en 3005 (default en `src/config.ts`), y `@internal/webapp-example` (3004) lo consume por defecto. Ya no hay conflicto de puertos entre hub y api-example.

## SDDs activos en paralelo

Este monorepo tiene múltiples sesiones SDD corriendo en paralelo. Ver `PARALLEL-WORK.md`
para las convenciones de coordinación, territorios de cada sesión y el prompt exacto
para arrancar la sesión backend (`iam-bootstrap`).

## SDD Workflow (Spec-Driven Development)

Para cambios sustanciales usa el flujo SDD con estos comandos:

| Comando                | Descripción                                    |
| ---------------------- | ---------------------------------------------- |
| `/sdd-new <name>`      | Inicia un cambio nuevo (explore + proposal)    |
| `/sdd-ff <name>`       | Fast-forward: proposal → spec → design → tasks |
| `/sdd-continue [name]` | Ejecuta la siguiente fase pendiente            |
| `/sdd-apply [name]`    | Implementa las tareas en batches               |
| `/sdd-verify [name]`   | Valida la implementación contra specs          |
| `/sdd-archive [name]`  | Cierra el cambio y persiste el estado final    |
| `/sdd-explore <topic>` | Investigación libre sin crear artefactos       |

Los artefactos SDD se persisten en **Engram** (por defecto). Ver `.atl/skill-registry.md` para skills disponibles.

## Reglas de desarrollo

- Antes de modificar un módulo existente, leer su `CLAUDE.md` local si existe
- Tras cambios que afecten la arquitectura, actualizar `.claude/context/` — ejecutar `/sdd-explore` o actualizar manualmente
- Usar `pnpm` — nunca `npm` ni `yarn`
- Scripts raíz delegan a Turborepo: `pnpm dev`, `pnpm build`, `pnpm test`
- Para añadir componentes shadcn: `pnpm ui:add <componente>`
- Para base de datos: `pnpm db:generate`, `pnpm db:push`, `pnpm db:studio`
- Al modificar templates en `templates/`, verificar que el CLI los procesa correctamente
- **No existe `/analyze` command** — la documentación de contexto se actualiza manualmente o via SDD explore
- Ejecutar `pnpm tokens:build` antes de builds manuales (si los tokens CSS cambiaron)
