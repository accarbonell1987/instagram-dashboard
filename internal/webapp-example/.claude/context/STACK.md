# Stack: webapp-example
> Última actualización: 2026-02-23

## Runtime
Node.js >=22.0.0 (requerido por el monorepo). pnpm 9.15.4 como package manager.

## Lenguaje
TypeScript 5.7.3. Configuración extendida desde `@repo/config/typescript/nextjs` (strict mode). Path alias `@/*` → `./src/*`.

## Frameworks principales

| Framework | Versión | Propósito |
|-----------|---------|-----------|
| Next.js | ^15.1.6 | Framework React con App Router, SSR/SSG |
| React | ^19.0.0 | UI library |
| React DOM | ^19.0.0 | Renderer web |
| Tailwind CSS | ^4.0.6 | Utility-first CSS (v4 — sin config file, solo CSS) |
| Turborepo | 2.x | Build system del monorepo (scripts raíz) |

## Dependencias clave

| Dependencia | Versión | Por qué se usa |
|-------------|---------|----------------|
| `@repo/ui` | workspace:* | Design system (átomos, moléculas, organismos) |
| `@repo/core` | workspace:* | Servicios CRUD, HTTP client, mock system, Zustand store |
| `@repo/shared` | workspace:* | ThemeProvider, hooks de theming, tipos compartidos |
| `@repo/config` | workspace:* | Config TypeScript/ESLint, tokens CSS, registro de temas |
| next-themes | ^0.4.6 | Gestión dark/light mode con SSR |
| clsx | ^2.1.1 | Concatenación de clases CSS |
| tailwind-merge | ^2.6.0 | Merge inteligente de clases Tailwind |
| tw-animate-css | ^1.4.0 | Animaciones CSS predefinidas para Tailwind |
| lucide-react | ^0.469.0 | Librería de iconos SVG |

**Dependencias de `@repo/core` (disponibles en la app):**

| Dependencia | Versión | Por qué se usa |
|-------------|---------|----------------|
| axios | ^1.7.9 | HTTP client (con mock adapter) |
| zustand | ^5.0.3 | Estado global para el services store |

**Dependencias de `@repo/ui` (disponibles en la app):**

| Dependencia | Versión | Por qué se usa |
|-------------|---------|----------------|
| Radix UI primitives | ~2.x | ~20 primitivos UI accesibles (Dialog, Select, Tooltip...) |
| class-variance-authority | ^0.7.1 | Variantes de componentes (CVA) |
| cmdk | ^1.x | Command palette |
| react-hook-form | ^7.x | Formularios |
| recharts | ^2.x | Gráficos |
| sonner | ^2.x | Toasts |
| vaul | ^1.x | Drawer component |
| embla-carousel-react | ^8.x | Carousel |

## Herramientas de desarrollo

| Herramienta | Versión | Propósito |
|-------------|---------|-----------|
| Turbopack | integrado en Next.js 15 | Bundler dev (reemplaza Webpack en dev) |
| ESLint | ^9.18.0 | Linting (config de `@repo/config`) |
| Prettier | ^3.x | Formatting (config del monorepo) |
| prettier-plugin-tailwindcss | ^0.x | Ordena clases Tailwind automáticamente |
| Vitest | ^3.0.5 | Testing (en `@repo/core`, no en la app directamente) |
| Playwright | presente en monorepo | E2E testing |
| PostCSS | ^8.5.1 | Procesado CSS para Tailwind v4 |
| @tailwindcss/postcss | ^4.0.6 | Plugin PostCSS de Tailwind v4 |

## Scripts disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `next dev --turbopack --port 3004` | Servidor de desarrollo con Turbopack en puerto 3004 |
| `build` | `next build` | Build de producción |
| `start` | `next start --port 3004` | Servidor de producción en puerto 3004 |
| `lint` | `next lint` | Linting con ESLint |
| `type-check` | `tsc --noEmit` | Verificación de tipos TypeScript |

**Scripts del monorepo (desde raíz):**

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Arranca todas las apps en paralelo |
| `pnpm build` | Build de todos los packages y apps |
| `pnpm test` | Ejecuta tests en todos los packages |
| `pnpm ui:add <componente>` | Añade un componente shadcn al `@repo/ui` |
| `pnpm db:generate` | Genera el cliente Prisma |
| `pnpm db:push` | Sincroniza el schema con la DB |
| `pnpm db:studio` | Abre Prisma Studio |

## Configuración de Next.js notable

```ts
// next.config.ts
{
  transpilePackages: ['@repo/ui', '@repo/config', '@repo/shared', '@repo/core'],
  outputFileTracingRoot: path.join(__dirname, '../../'),  // para Docker
  experimental: {
    optimizePackageImports: ['@repo/ui', 'lucide-react'],  // tree-shaking agresivo
  }
}
```

## Configuración CSS (Tailwind v4)

Tailwind v4 **no tiene `tailwind.config.ts`**. Toda la config va en CSS:
- `@repo/config/styles/tailwind-theme.css` — mapea CSS variables → utilidades Tailwind
- `@repo/config/styles/globals.css` — tokens base del design system
- `@repo/config/styles/themes.css` — definiciones de todos los temas de color
- `@repo/config/styles/radius-calc.css` — border-radius dinámico

La app necesita `@source "../../../../packages/ui/src/**/*.{ts,tsx}"` en `globals.css` para que Tailwind escanee los templates de `@repo/ui`.

## Variables de entorno

No existen variables de entorno definidas. No hay `.env.example` ni `.env.local`.

| Variable | Requerida | Descripción | Estado |
|----------|-----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | No (debería ser Sí) | URL base de la API REST | **Hardcodeada** como `'https://mock.api'` en `lib/services.ts` |

**Nota:** En un entorno de producción real, la URL base debería moverse a `NEXT_PUBLIC_API_URL` y eliminarse el mock adapter.
