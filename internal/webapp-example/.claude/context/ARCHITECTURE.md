# Arquitectura: webapp-example

> Última actualización: 2026-02-23

## Visión general

`webapp-example` es una aplicación Next.js 15 con App Router que sirve como showcase interactivo del design system y la arquitectura de servicios del monorepo CORE. Demuestra el uso completo de `@repo/ui` (componentes UI), `@repo/core` (servicios CRUD + mock) y `@repo/shared` (theming), orientada a desarrolladores que integran el monorepo.

## Estructura de directorios

```
internal/webapp-example/
├── src/
│   ├── app/                    # Next.js App Router — rutas de la aplicación
│   │   ├── layout.tsx          # Root layout: providers globales + fuentes Google
│   │   ├── page.tsx            # Página home (Server Component)
│   │   ├── globals.css         # CSS entry point: Tailwind v4 + imports de tokens
│   │   ├── colors/page.tsx     # Showcase del design system de colores
│   │   ├── components/page.tsx # Galería de componentes UI interactivos
│   │   └── users/page.tsx      # Demo CRUD completo con paginación (Client Component)
│   ├── components/             # Componentes locales de la app (no reutilizables)
│   │   ├── example.tsx         # Wrapper de presentación para galería de componentes
│   │   ├── field-examples.tsx  # Demo del sistema Field/Form (Client Component)
│   │   ├── showcase-nav.tsx    # Navbar sticky con selector de tema (Client Component)
│   │   ├── theme-info.tsx      # Componente informativo de tema activo (Client Component)
│   │   └── theme-selector.tsx  # Panel flotante para cambiar color-theme (Client Component)
│   ├── lib/
│   │   ├── services.ts         # Composition root: configura core services + store + mock
│   │   └── utils.ts            # Utilidad cn() = clsx + tailwind-merge
│   ├── providers/
│   │   └── ServicesProvider.tsx # Client provider que inicializa el services store
│   └── styles/
│       ├── theme.css           # App-specific CSS overrides (actualmente vacío)
│       └── theme.ts            # Config programática del tema "Creative" (solo metadata)
├── .claude/                    # Contexto de Claude AI
├── next.config.ts              # Transpila packages del monorepo
├── tsconfig.json               # Extiende @repo/config/typescript/nextjs, alias @/*
└── package.json
```

## Capas de la arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                   internal/webapp-example                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  app/      │  │  components/ │  │  providers/      │ │
│  │  (Routes)  │  │  (Local UI)  │  │  (ServicesProvider)│ │
│  └────────────┘  └──────────────┘  └──────────────────┘ │
│            ↓              ↓                  ↓           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │    src/lib/services.ts  (Composition Root)          │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────────────┬─────────────┘
              ↓                              ↓
┌─────────────────────┐       ┌──────────────────────────┐
│    @repo/core       │       │    @repo/shared          │
│  - CrudService<T>   │       │  - ThemeProvider         │
│  - createCoreServices│      │  - useColorTheme         │
│  - createServicesStore│     │  - ColorThemeSelector    │
│  - createMockAdapter│       │  - types, utils          │
│  - ServiceError     │       └──────────────┬───────────┘
│  - HttpService      │                      ↓
└─────────────────────┘       ┌──────────────────────────┐
              ↓               │    @repo/ui              │
┌─────────────────────┐       │  - atoms (Button, Input) │
│    @repo/config     │       │  - molecules (Card, etc) │
│  - Theme registry   │       │  - organisms (Sidebar)   │
│  - CSS tokens       │       │  - cn(), useMobile       │
│  - tailwind-theme.css│      └──────────────────────────┘
└─────────────────────┘
```

**Regla de dependencias (unidireccional):**

- `webapp-example` → todos los packages
- `@repo/shared` → `@repo/ui`, `@repo/config`
- `@repo/ui` → `@repo/config`
- `@repo/core` → NO importa packages UI

## Módulos / Features principales

| Módulo                 | Descripción                                         | Archivos clave                                                              |
| ---------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| **Theming**            | Sistema dual (dark/light + color-theme)             | `layout.tsx`, `globals.css`, `theme-selector.tsx`, `@repo/shared/providers` |
| **Services**           | Composition root + mock adapter                     | `lib/services.ts`, `providers/ServicesProvider.tsx`                         |
| **CRUD demo**          | Lista paginada de usuarios con create/edit/delete   | `app/users/page.tsx`                                                        |
| **Component showcase** | Galería interactiva de todos los átomos y moléculas | `app/components/page.tsx`, `components/field-examples.tsx`                  |
| **Colors showcase**    | Visualización del design system de colores          | `app/colors/page.tsx`                                                       |

## Flujos principales

### Flujo 1: Theming (color-theme + dark mode)

1. `RootLayout` renderiza `<ThemeProvider defaultColorTheme="zinc" attribute="class" enableSystem>`.
2. `ThemeProvider` (`@repo/shared`) envuelve `NextThemesProvider` (dark/light) y monta `ColorThemeContext`.
3. Al montar: lee `localStorage.getItem('color-theme')` y aplica `document.documentElement.classList.add('theme-zinc')`.
4. next-themes gestiona la clase `dark` en `<html>`. `suppressHydrationWarning` evita errores de hidratación.
5. `globals.css` importa `@repo/config/styles/themes.css` — contiene las definiciones `.theme-{name} { ... }` y `.dark { ... }`.
6. Las CSS custom properties (`--primary`, `--background`, etc.) cambian según ambas clases en `<html>`.
7. Tailwind v4 mapea `--color-primary: hsl(var(--primary))` → utilidades `bg-primary`, `text-primary`.
8. Usuario cambia tema via `ThemeSelector` (llama `setColorTheme(name)`) o el toggle dark/light.

### Flujo 2: Consumo de servicios desde la UI (UsersPage)

1. `ServicesProvider` ejecuta `store.getState().initialize(coreServices)` exactamente una vez (guard en módulo).
2. `ServicesProvider` retorna `null` hasta que `initialized === true` (evita render sin servicios).
3. `useServices()` devuelve `CoreServices` del store Zustand. Lanza error si no está inicializado.
4. `UsersPage` llama `services.createService<User, UserCreate>('/users')` → retorna `CrudService<User>`.
5. `usersService.filter({ page, pageSize: 5 })` → `HttpService.get<PaginatedResponse<User>>('/filter', params)`.
6. El `mockAdapter` inyectado en `httpClient.defaults.adapter` intercepta la llamada Axios.
7. `createUsersMockHandlers` despacha al handler `GET /users/filter`, devuelve datos del in-memory store.
8. Componente actualiza estado local con `setUsers(result.data)`.

### Flujo 3: Renderizado SSR → Client hydration

1. Next.js 15 renderiza `RootLayout` (Server Component) en servidor.
2. Layout aplica fuentes Google (Inter + Sora) via `next/font/google` — sin requests en runtime.
3. Providers marcados con `'use client'` se hidratan en cliente: `ThemeProvider`, `TooltipProvider`, `ServicesProvider`.
4. Páginas Server Component (`/`, `/colors`, `/components`) se renderizan en servidor — no usan hooks.
5. Páginas Client Component (`/users`) tienen `'use client'` y acceden a hooks React en cliente.

## Puntos de entrada

### `src/app/layout.tsx` — Root Layout (Server Component)

Jerarquía de providers:

```tsx
<ThemeProvider defaultColorTheme="zinc" attribute="class" enableSystem>
  <TooltipProvider>
    {' '}
    // Radix UI Tooltip global
    <ServicesProvider>
      {' '}
      // Inicializa Zustand store con core services
      <ShowcaseNav /> // Nav sticky en todas las páginas
      {children}
    </ServicesProvider>
  </TooltipProvider>
</ThemeProvider>
```

### `src/lib/services.ts` — Composition Root

Único lugar donde se crean dependencias concretas. Exporta:
`{ store, useServices, useServicesStore, coreServices, usersStore }`

### `src/app/globals.css` — CSS Entry Point

Orden crítico de imports:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@source "../../../../packages/ui/src/**/*.{ts,tsx}"; /* Tailwind v4 scanning */
@import '@repo/config/styles/tailwind-theme.css'; /* vars → utilities */
@import '@repo/config/styles/globals.css'; /* tokens base */
@import '@repo/config/styles/themes.css'; /* todos los temas */
@import '@repo/config/styles/radius-calc.css'; /* border-radius dinámico */
@import '../styles/theme.css'; /* overrides locales */
```

## Integraciones externas

| Integración      | Propósito                 | Cómo se usa                                              |
| ---------------- | ------------------------- | -------------------------------------------------------- |
| Google Fonts     | Tipografía (Inter + Sora) | `next/font/google` en layout — carga en build time       |
| Radix UI         | Primitivos UI accesibles  | Via `@repo/ui` — ~20 primitivos                          |
| Mock API interna | Simular backend REST      | `createMockAdapter` intercepta Axios a nivel de adapter  |
| localStorage     | Persistir color-theme     | `@repo/shared` ThemeProvider lee/escribe `'color-theme'` |

No existen variables de entorno (`NEXT_PUBLIC_*`). La URL base `'https://mock.api'` está hardcodeada en `lib/services.ts`.

## Decisiones arquitectónicas notables

- **Composition Root en `lib/services.ts`**: centraliza toda la configuración de dependencias. Los componentes nunca instancian servicios directamente.
- **`ServicesProvider` guarda con `null`**: evita renders con servicios no inicializados, sin loading spinner.
- **Mock adapter en Axios**: intercepta a nivel de transport layer — la UI no sabe si habla con servidor real o mock. Se configura en `lib/services.ts`, no en los tests.
- **Theming ortogonal**: dark/light y color-theme son independientes. Se pueden combinar libremente. Implementado con dos contextos distintos que ambos escriben clases en `<html>`.
- **Tailwind v4 sin config file**: toda la config va en CSS (`@theme` directives en `tailwind-theme.css`). No existe `tailwind.config.ts`.
- **`@source` directive**: necesaria para que Tailwind v4 escanee los templates de `@repo/ui` desde la app.

## Changelog

### 2026-02-23 — Análisis inicial generado por /analyze

- Mapeada arquitectura completa de webapp-example
- Documentados flujos de theming, servicios y renderizado SSR
- Identificadas integraciones y anti-patrones
