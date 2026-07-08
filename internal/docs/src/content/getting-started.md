---
title: Primeros Pasos
description: Guia rapida para comenzar a trabajar con el monorepo
order: 0
date: 2026-01-30
readTime: 5 min
---

# Primeros Pasos

Bienvenido a la documentacion del monorepo. Esta guia te ayudara a configurar tu entorno de desarrollo y comenzar a trabajar.

## Requisitos Previos

Antes de comenzar, asegurate de tener instalado:

- **Node.js** >=22.0.0
- **pnpm** 9.15.4
- **Git**

## Instalacion

Clona el repositorio e instala las dependencias:

```bash
git clone <repository-url>
cd monorepo-template
pnpm install
```

## Estructura del Proyecto

Este monorepo es una **plataforma de desarrollo** que incluye implementaciones de referencia y paquetes compartidos reutilizables:

```
monorepo-template/
├── apps/                         # Aplicaciones desplegables
│   ├── api-example/              # Implementacion de referencia API (Hono 4.x)
│   ├── webapp-example/           # Implementacion de referencia webapp (Next.js 15)
│   └── docs/                     # Portal de documentacion (este sitio)
│
├── packages/                     # Paquetes compartidos
│   ├── core/                     # Logica de negocio, servicios, auth
│   ├── ui/                       # Design system - shadcn/ui
│   ├── shared/                   # Utilidades, tipos, providers
│   ├── database/                 # Prisma ORM
│   └── config/                   # ESLint, TypeScript, Tailwind, themes
│
├── e2e/                          # Tests E2E con Playwright
├── turbo.json                    # Configuracion de Turborepo
└── package.json                  # Dependencias raiz
```

> **Nota**: `api-example` y `webapp-example` son **implementaciones de referencia** que sirven como base para los templates del CLI generador (en desarrollo).

### Apps (`/apps`)

Aplicaciones independientes que pueden ser desplegadas:

| App              | Descripcion                                                | Puerto |
| ---------------- | ---------------------------------------------------------- | ------ |
| `api-example`    | Implementacion de referencia API REST (Hono 4.x)           | 3001   |
| `docs`           | Portal de documentacion (este sitio)                       | 3002   |
| `webapp-example` | Implementacion de referencia webapp (Next.js 15, React 19) | 3004   |

### Packages (`/packages`)

Paquetes compartidos entre las aplicaciones:

| Package          | Descripcion                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `@core/core`     | Logica de negocio reutilizable, servicios, autenticacion           |
| `@core/ui`       | Design system basado en shadcn/ui (atomic design)                  |
| `@core/shared`   | Utilidades, tipos y providers compartidos                          |
| `@core/database` | Prisma ORM (cliente de base de datos)                              |
| `@core/config`   | Configuraciones compartidas (ESLint, TypeScript, Tailwind, themes) |

---

## Scripts Disponibles

### Desarrollo

Ejecuta todas las aplicaciones en modo desarrollo:

```bash
pnpm dev
```

Ejecuta una aplicacion especifica:

```bash
pnpm dev --filter docs
pnpm dev --filter api-example
pnpm dev --filter webapp-example
```

### Build

Construye todas las aplicaciones:

```bash
pnpm build
```

Construye una aplicacion especifica:

```bash
pnpm build --filter docs
```

### Linting y Formateo

```bash
# Ejecutar ESLint
pnpm lint

# Formatear codigo con Prettier
pnpm format

# Verificar tipos con TypeScript
pnpm type-check
```

---

## Arquitectura del Design System

El monorepo incluye un Design System completo basado en:

- **Tailwind CSS v4** con `@theme inline` para CSS variables
- **shadcn/ui** como base de componentes
- **Theme Registry** para gestion centralizada de temas

```
packages/config/styles/
├── tailwind-theme.css      # Mapeo CSS vars -> Tailwind utilities
├── globals.css             # Tokens semanticos base
└── themes/
    ├── registry.ts         # Registro central de temas
    ├── all.css             # Todos los temas combinados
    ├── shadcn/             # 12 temas oficiales shadcn/ui
    │   ├── zinc.css
    │   ├── slate.css
    │   └── ...
    └── custom/             # Temas personalizados
        └── ambar.css
```

Para configurar theming en tu app, consulta la [Guia de Theming](./theming-guide).

---

## Crear una Nueva Aplicacion

> **Proximamente**: CLI generador para scaffolding de nuevas APIs y webapps.
>
> Por ahora, usa `api-example` y `webapp-example` como referencia para crear nuevas aplicaciones manualmente.

---

## Explorar la Documentacion

Ahora que tienes el proyecto configurado, explora las guias disponibles:

| Guia                                         | Descripcion                                   |
| -------------------------------------------- | --------------------------------------------- |
| [Webapp Architecture](./webapp-architecture) | Screaming Architecture en webapp-example      |
| [API Architecture](./api-architecture)       | Repository pattern y servicios en api-example |
| [Design System](./design-system)             | Variables CSS, colores y tokens base          |
| [Guia de Theming](./theming-guide)           | Como personalizar temas para tus apps         |
| [Tokens y Theming](./tokens-y-theming)       | Arquitectura detallada del sistema            |
| [Turborepo](./turbo-skills)                  | Configuracion y mejores practicas             |

---

## Proximos Pasos

1. Lee la [Webapp Architecture](./webapp-architecture) para entender el Screaming Architecture pattern
2. Revisa el [Design System](./design-system) para aprender sobre las variables CSS disponibles
3. Lee la [Guia de Theming](./theming-guide) si necesitas personalizar tu tema
4. Explora las implementaciones de referencia en `internal/api-example/` y `internal/webapp-example/`
5. Revisa los paquetes compartidos en `/packages`

## Ayuda y Soporte

Si encuentras algun problema:

1. Revisa la documentacion existente
2. Consulta los issues en GitHub
3. Contacta al equipo de desarrollo

---

> **Tip**: Usa `pnpm why <package>` para ver por que un paquete esta instalado y donde se usa.
