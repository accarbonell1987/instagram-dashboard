# Proyecto: webapp-example

## Tipo de proyecto

Web app — Next.js 15 con App Router, parte del monorepo CORE.

## Arquitectura

**Screaming Architecture** — el dominio es visible a nivel de carpetas:

```
src/
├── app/                      # Next.js App Router (thin wrappers)
├── features/                 # 🎯 Domain features (users, parties, roles)
│   └── {feature}/
│       ├── index.ts          # Barrel exports
│       ├── page.tsx          # Feature page component
│       ├── {feature}.types.ts
│       ├── {feature}.constants.ts
│       ├── hooks/
│       └── components/
├── shared/                   # 🔧 Reusable hooks and components
│   ├── hooks/                # useCrudPage, useDebouncedValue
│   └── components/           # CrudPageLayout, DataTable, etc.
├── lib/
│   └── services.ts           # Composition root (coreServices)
├── services/                 # 🔌 Domain services layer
│   ├── index.ts              # Public API (barrel)
│   ├── types.ts              # DomainServices interface
│   ├── domain-services.ts    # Service registry (singleton)
│   └── extensions/           # Custom methods beyond CRUD
│       └── user.extensions.ts # Batch ops, assignments
├── hooks/
│   └── useDomainServices.ts  # Hook to access domain services
├── types/
│   └── entities.ts           # Entity types
└── providers/
```

## Stack tecnológico

- **Runtime**: Node.js >=22.0.0
- **Lenguaje**: TypeScript 5.7+
- **Framework**: Next.js 15.x con Turbopack (dev)
- **UI**: React 19, Tailwind CSS v4
- **Theming**: next-themes (dark/light) + ColorThemeContext (color-theme)
- **Iconos**: lucide-react
- **Monorepo packages**:
  - `@core/ui` — Design system (shadcn/ui, atomic design)
  - `@core/core` — Lógica de negocio y servicios
  - `@core/shared` — Tipos y utilidades compartidas
  - `@core/config` — Configuraciones TS/ESLint

## Contexto de arquitectura

> Lee estos archivos antes de cualquier tarea en este proyecto.

- `.claude/context/ARCHITECTURE.md` — Mapa completo de la arquitectura y módulos
- `.claude/context/PATTERNS.md` — Patrones de código y convenciones reales del proyecto
- `.claude/context/STACK.md` — Stack completo, dependencias clave y scripts

Si los archivos de contexto no existen o parecen desactualizados, ejecuta `/analyze`.

## Agentes para este proyecto

Usa estos agentes según la tarea:

- **architecture-oracle** → Decisiones arquitectónicas, añadir módulos, refactors grandes
- **analysis-specialist** → Auditoría de calidad, deuda técnica, seguridad, rendimiento
- **qa-tester** → Escribir tests, revisar cobertura, estrategia de testing
- **frontend-developer** → Componentes UI, estado, accesibilidad, Next.js
- **nextjs-architecture-expert** → App Router, Server Components, rendimiento Next.js
- **typescript-pro** → Tipos complejos, generics, configuración TypeScript

## Convenciones específicas de este proyecto

> Detectadas por /analyze el 2026-03-16. Ver detalles en `.claude/context/PATTERNS.md`.

### Screaming Architecture

- **App Router pages son thin wrappers** — solo re-exportan el componente de `@/features/{name}`.
- **features/** — Cada feature es auto-contenido: `index.ts`, `page.tsx`, `*.types.ts`, `*.constants.ts`, `hooks/`, `components/`.
- **shared/** — Hooks y componentes reutilizables genéricos.

### Domain Services

- **services/** — Modular folder structure for domain services.
- **services/domain-services.ts** — Registro centralizado (`getDomainServices()`).
- **services/extensions/** — Custom methods beyond CRUD (batch ops, assignments).
- **hooks/useDomainServices.ts** — Hook React para consumir servicios.
- **types/entities.ts** — Tipos de entidades que reflejan los schemas del API.

Para añadir métodos custom a un servicio (más allá de CRUD), usa el patrón de extensiones:

```typescript
// services/extensions/user.extensions.ts
export function createUserExtensions(http: HttpHelpers, basePath: string): UserExtensions {
  return {
    batchCreate: async (data) => http.post(`${basePath}/batch`, data),
    assignRole: async (userId, data) => http.post(`${basePath}/${userId}/assign-role`, data),
  };
}

// services/domain-services.ts
users: createService<User, UserCreate, UserUpdate, UserExtensions>('/users', createUserExtensions),
```

### Patterns Principales

- **useCrudPage** — Hook genérico para páginas CRUD con paginación, búsqueda, diálogos.
- **useDebouncedValue** — Debounce para inputs de búsqueda.
- **CrudPageLayout** — Layout consistente para páginas CRUD.
- **Feature hooks** (useUsers, useRoles, useParties) — Envuelven useCrudPage con config específica.

### Component Usage Rules

**Hierarchy** (always check in this order):

1. **@core/ui** → Primitives (Button, Input, Table, Dialog, Card, Badge, etc.)
2. **shared/components/** → Compositions (DataTable, SearchInput, CrudPageLayout)
3. **features/{feature}/components/** → Feature-specific only

**Do's:**

- Import primitives from `@core/ui`
- Create compositions that combine multiple primitives
- Put feature-specific components in the feature folder

**Don'ts:**

- Never recreate a component that exists in @core/ui
- Don't put generic components in features/
- Don't import from @core/ui internal paths

```tsx
// Correct - use primitives from @core/ui
import { Button, Input, Table, TableBody, TableCell } from '@core/ui';

// Correct - use shared compositions
import { DataTable, SearchInput } from '@/shared/components';

// Correct - feature-specific component in feature folder
import { UsersTable } from './components/users-table';

// Wrong - recreating Button locally
const MyButton = ({ children }) => <button>{children}</button>;
```

### Convenciones Generales

- **Archivos**: kebab-case (`showcase-nav.tsx`). Componentes y clases: PascalCase.
- **Factories**: prefijo `create` (`createCoreServices`, `getDomainServices`).
- **Hooks**: prefijo `use` (`useServices`, `useCrudPage`, `useDomainServices`).
- **`import type`** obligatorio para imports de solo tipos (ESLint enforced).
- **Barrel files**: siempre importar desde el barrel del package (`@core/ui`), nunca rutas internas.
- **Composition Root**: `lib/services.ts` instancia `coreServices`. `lib/domain-services.ts` instancia servicios de dominio.
- **Servicios no hacen try/catch** — lanzan `ServiceError`. El consumidor gestiona el error.
- **CVA + forwardRef + cn()**: solo en átomos de `@core/ui`, no en componentes locales de la app.
- **Theming dual**: dark/light con `next-themes` (clase `dark`); color-theme con `ColorThemeContext` (clase `theme-{name}`). Son ortogonales.
- **Alias local**: `@/*` → `./src/*`. Siempre usar en imports locales.
- **`ServicesProvider` retorna `null`** hasta inicialización — no usar spinner, simplemente `null`.
- **Tailwind v4 sin config file** — toda la config CSS va en `@core/config/styles/`.

## Reglas de desarrollo

- Antes de modificar un módulo existente, lee su CLAUDE.md local si existe
- Tras cambios que afecten la arquitectura (nuevo módulo, cambio de dependencias, refactor de capas), ejecuta `/sync-context`
- Usar `pnpm` desde la raíz del monorepo para instalar dependencias
- Para añadir componentes UI: `pnpm ui:add <componente>` desde la raíz
- Scripts: `pnpm dev` (puerto 3004), `pnpm build`, `pnpm lint`, `pnpm type-check`
- Path alias: `@/*` → `./src/*`

## Añadir una nueva feature

1. Crear carpeta en `features/{name}/` con estructura estándar
2. Añadir tipos de entidad en `types/entities.ts`
3. Registrar servicio en `lib/domain-services.ts`
4. Crear thin wrapper en `app/{name}/page.tsx`

Ver documentación completa: [Webapp Architecture](../../docs/src/content/webapp-architecture.md)
