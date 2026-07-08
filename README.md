## CORE Monorepo Platform

Plataforma de desarrollo orientada a **monorepos empresariales**. Permite crear nuevas aplicaciones (APIs y webapps) completamente integradas con el ecosistema del monorepo ejecutando un único comando.

Combina tres pilares:

- **Monorepo base** — packages compartidos (`@core/core`, `@core/ui`, `@core/database`, `@core/shared`, `@core/config`) que todas las apps consumen
- **CLI generador** — `pnpm core new api <name>` / `core new webapp <name>` — scaffolding completo desde templates
- **Documentación viva** — `internal/docs`, siempre sincronizada con el código mediante `core docs sync`

Para la visión completa y roadmap, ver `PRD.md`.

---

## Estructura del repositorio

```text
monorepo-template/
├── apps/                    # Apps de PRODUCCIÓN (generadas por el CLI)
│
├── internal/                # Apps de SOPORTE — no productivas
│   ├── api-example/         # API REST de referencia (Hono 4.x)
│   ├── webapp-example/      # Webapp de referencia (Next.js 15)
│   └── docs/                # Portal de documentación
│
├── packages/
│   ├── cli/                 # @core/cli — CLI generador
│   ├── core/                # @core/core — servicios, CrudService, mocks, auth
│   ├── ui/                  # @core/ui — Design System (atoms, molecules, organisms)
│   ├── shared/              # @core/shared — tipos, providers, utilidades
│   ├── database/            # @core/database — Prisma ORM y modelos
│   └── config/              # @core/config — ESLint, TypeScript, Tailwind, temas
│
└── templates/               # Templates usados por el CLI
    ├── api/                 # Template base para APIs Hono
    └── webapp/              # Template base para webapps Next.js
```

Para el detalle de arquitectura interna de cada módulo, ver `.claude/context/ARCHITECTURE.md`.

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | ≥ 22 |
| Lenguaje | TypeScript | 5.7+ |
| Package manager | pnpm | 9.x |
| Build system | Turborepo | 2.x |
| API framework | Hono | 4.x |
| Web framework | Next.js (App Router) | 15.x |
| UI library | React | 19.x |
| Estilos | Tailwind CSS | v4 |
| ORM | Prisma | 6.x |
| Validación | Zod | 3.x |
| Testing | Vitest + Playwright | — |

---

## Requisitos previos

- Node.js ≥ 22
- pnpm ≥ 9
- PostgreSQL (solo si se usa `DATA_SOURCE=prisma`)

---

## Puesta en marcha

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd monorepo-template
pnpm install

# 2. Lanzar todas las apps en paralelo (Turborepo)
pnpm dev
```

URLs en desarrollo:

| App | URL |
|---|---|
| API de ejemplo | `http://localhost:3001` |
| API docs (OpenAPI) | `http://localhost:3001/docs` |
| Webapp de ejemplo | `http://localhost:3004` |
| Portal de docs | `http://localhost:3002` |

---

## Apps incluidas

### `internal/api-example`

API REST de referencia con Hono 4.x:

- Validación bidireccional con Zod (`@hono/zod-openapi`) — docs OpenAPI en `/docs`
- Repository Pattern con 3 backends intercambiables: `InMemory`, `File`, `Prisma`
- Seleccionable vía `DATA_SOURCE=memory|file|prisma`
- Jerarquía de errores: `AppError` → `NotFoundError`, `ConflictError`, `ValidationError`

### `internal/webapp-example`

Webapp de referencia con Next.js 15 + React 19:

- Screaming Architecture: `app/` thin wrappers → `features/` con dominio visible
- Domain Services con `ServiceExtender` (extensiones sin herencia de clases)
- `useCrudPage` — hook genérico para páginas CRUD
- Theming dark/light + color-theme (ortogonales, vía `next-themes` + `ColorThemeContext`)
- Consume `@core/ui`, `@core/core` y `@core/shared`

### `internal/docs`

Portal de documentación con Next.js 15:

- Lee Markdown desde `internal/docs/src/content/`
- Agrupación automática por categoría en el sidebar
- Sincronizable con `pnpm core docs sync --api`

---

## CLI (`@core/cli`)

Generador de apps y funcionalidades. Ejecutar desde la raíz del monorepo:

```bash
# Crear nueva app
pnpm core new api <name>       # → apps/<name>/ (Hono + Repository Pattern)
pnpm core new webapp <name>    # → apps/<name>/ (Next.js + @core/ui)

# Añadir funcionalidades a apps existentes
pnpm core add route <path>     # Añade ruta CRUD a una API
pnpm core add page <path>      # Añade página a una webapp
pnpm core add component <name> # Añade componente UI

# Documentación
pnpm core docs sync --api      # Genera docs desde la spec OpenAPI del API
```

---

## Design System (`@core/ui`)

Paquete de componentes reutilizables:

- **Patrón obligatorio**: CVA + `forwardRef` + `cn()` para todos los atoms
- **Atomic design**: Atoms → Molecules → Organisms
- **Añadir componente shadcn**: `pnpm ui:add <componente>`

---

## Comandos raíz

```bash
pnpm dev           # Todas las apps en paralelo
pnpm build         # Build de producción
pnpm test          # Tests (Vitest en @core/core)
pnpm lint          # ESLint en todo el monorepo
pnpm typecheck     # TypeScript en todo el monorepo
pnpm ui:add <comp> # Añadir componente shadcn a @core/ui
pnpm db:generate   # Prisma generate
pnpm db:push       # Prisma push (desarrollo)
pnpm db:studio     # Prisma Studio UI
```

---

## Convenciones

- Archivos: **kebab-case** (`crud-service.ts`), clases y componentes: **PascalCase**
- Factories: prefijo `create` — `createCoreServices()`, `createMockAdapter()`
- Hooks: prefijo `use` — `useServices()`, `useColorTheme()`
- `import type` obligatorio para imports de solo tipos
- Tests co-locados con el fuente (`Token.ts` → `Token.test.ts`)
- Services lanzan errores tipados — el consumidor los gestiona, nunca try/catch interno

Para las convenciones completas, ver `CLAUDE.md` y `.claude/context/PATTERNS.md`.
