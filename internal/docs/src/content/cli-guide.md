---
title: CLI Generator
description: Guia para usar el CLI generador de CORE Monorepo Platform
order: 1
date: 2026-03-13
readTime: 8 min
---

# CLI Generator

El CLI de CORE Monorepo Platform permite generar nuevas aplicaciones (APIs y webapps) de forma rapida y consistente, siguiendo todos los patrones y convenciones del monorepo.

## Instalacion

El CLI ya esta incluido en el monorepo. Para usarlo:

```bash
# Desde la raiz del monorepo
pnpm core --help
```

## Comandos Disponibles

### Generar una nueva API

```bash
pnpm core new api <nombre> [opciones]
```

**Opciones:**

| Opcion            | Descripcion                          | Default               |
| ----------------- | ------------------------------------ | --------------------- |
| `--port <numero>` | Puerto del servidor                  | Auto-asignado (3010+) |
| `--database`      | Incluir setup de Prisma              | Prompt interactivo    |
| `--no-database`   | Excluir setup de Prisma              | -                     |
| `--auth`          | Incluir scaffolding de autenticacion | Prompt interactivo    |
| `--no-auth`       | Excluir autenticacion                | -                     |

**Ejemplo:**

```bash
# Modo interactivo (pregunta opciones)
pnpm core new api inventory-service

# Modo no-interactivo
pnpm core new api inventory-service --port 3015 --no-database --no-auth
```

**Estructura generada:**

```
apps/inventory-service/
├── src/
│   ├── index.ts          # Entry point con Hono y OpenAPI
│   ├── config.ts         # Configuracion con Zod
│   ├── errors.ts         # Jerarquia de errores
│   └── routes/
│       └── health.ts     # Endpoint de health check
├── package.json
├── tsconfig.json
└── README.md
```

---

### Generar una nueva Webapp

```bash
pnpm core new webapp <nombre> [opciones]
```

**Opciones:**

| Opcion             | Descripcion            | Default               |
| ------------------ | ---------------------- | --------------------- |
| `--port <numero>`  | Puerto del servidor    | Auto-asignado (3020+) |
| `--api <url>`      | URL del API a conectar | Prompt interactivo    |
| `--theme <nombre>` | Tema inicial           | zinc                |

**Ejemplo:**

```bash
# Modo interactivo
pnpm core new webapp admin-panel

# Modo no-interactivo
pnpm core new webapp admin-panel --port 3025 --api http://localhost:3015 --theme zinc
```

**Estructura generada:**

```
apps/admin-panel/
├── src/
│   ├── app/
│   │   ├── layout.tsx    # Layout con ThemeProvider
│   │   ├── page.tsx      # Pagina principal
│   │   └── globals.css   # Estilos Tailwind
│   └── lib/
│       └── utils.ts      # Utilidad cn()
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.cjs
└── README.md
```

---

## Flujo de Trabajo

Despues de generar una aplicacion:

```bash
# 1. Instalar dependencias (desde la raiz del monorepo)
pnpm install

# 2. Crear archivo .env si es necesario
cp apps/mi-app/.env.example apps/mi-app/.env

# 3. Iniciar en modo desarrollo
pnpm dev --filter mi-app
```

---

## Temas Disponibles

Al generar una webapp, puedes elegir entre estos temas:

| Tema     | Descripcion                       |
| -------- | --------------------------------- |
| `zinc` | Tema corporativo Zinc (default) |
| `ambar`  | Tema calido ambar                 |
| `zinc`   | Neutral gris zinc                 |
| `slate`  | Neutral gris slate                |
| `blue`   | Azul vibrante                     |
| `green`  | Verde vibrante                    |
| `red`    | Rojo vibrante                     |
| `violet` | Violeta vibrante                  |

---

## Arquitectura del CLI

El CLI esta construido con:

- **Commander.js** - Framework CLI
- **Chalk** - Colores en terminal
- **Ora** - Spinners
- **Prompts** - Inputs interactivos
- **fs-extra** - Operaciones de archivos

Los templates se encuentran en `templates/api/` y `templates/webapp/`.

---

## Agregar Funcionalidades a Apps Existentes

### Agregar una Ruta CRUD a una API

```bash
pnpm core add route <nombre> [opciones]
```

**Opciones:**

| Opcion             | Descripcion                    | Default        |
| ------------------ | ------------------------------ | -------------- |
| `--app-dir <path>` | Ruta al directorio de la API   | Auto-detectado |
| `--skip-service`   | No generar archivo de servicio | false          |
| `--skip-schema`    | No generar archivo de schemas  | false          |

**Ejemplo:**

```bash
# Auto-detecta la API en el directorio actual
pnpm core add route products

# Especificar directorio de la API
pnpm core add route products --app-dir internal/api-example

# Solo generar ruta sin servicio
pnpm core add route products --skip-service
```

**Archivos generados:**

```
internal/api-example/src/
├── routes/products/
│   ├── products.routes.ts    # Rutas CRUD con OpenAPI
│   └── products.schemas.ts   # Schemas Zod para validacion
└── services/
    └── products.service.ts   # Servicio de negocio
```

---

### Agregar una Pagina a una Webapp

```bash
pnpm core add page <ruta> [opciones]
```

**Opciones:**

| Opcion             | Descripcion                     | Default        |
| ------------------ | ------------------------------- | -------------- |
| `--app-dir <path>` | Ruta al directorio de la webapp | Auto-detectado |
| `--with-layout`    | Generar archivo layout.tsx      | false          |
| `--with-service`   | Incluir ejemplo de integracion  | false          |

**Ejemplo:**

```bash
# Pagina simple
pnpm core add page dashboard --app-dir internal/webapp-example

# Pagina con layout y servicio
pnpm core add page settings/profile --with-layout --with-service

# Ruta anidada
pnpm core add page admin/users --app-dir internal/webapp-example
```

**Archivos generados:**

```
internal/webapp-example/src/app/
└── dashboard/
    ├── page.tsx     # Componente de pagina
    └── layout.tsx   # Layout (si se usa --with-layout)
```

---

### Agregar un Componente a una Webapp

```bash
pnpm core add component <nombre> [opciones]
```

**Opciones:**

| Opcion             | Descripcion                     | Default        |
| ------------------ | ------------------------------- | -------------- |
| `--app-dir <path>` | Ruta al directorio de la webapp | Auto-detectado |
| `--variant <tipo>` | Tipo: atom, molecule, organism  | molecule       |

**Ejemplo:**

```bash
# Componente basico
pnpm core add component UserCard --app-dir internal/webapp-example

# Especificar variante
pnpm core add component DataTable --variant organism
```

**Archivos generados:**

```
internal/webapp-example/src/components/
├── user-card.tsx    # Componente generado
└── index.ts         # Barrel file actualizado
```

**Uso del componente:**

```tsx
import { UserCard } from '@/components';

<UserCard>Contenido</UserCard>;
```

---

## Documentacion Automatica

### Sincronizar Documentacion de API

```bash
pnpm core docs sync --api [opciones]
```

Genera documentacion de API automaticamente desde la especificacion OpenAPI.

**Opciones:**

| Opcion           | Descripcion                                 | Default                              |
| ---------------- | ------------------------------------------- | ------------------------------------ |
| `--source <url>` | URL o archivo de la especificacion OpenAPI  | `http://localhost:3001/openapi.json` |
| `--name <name>`  | Identificador del API (para multiples APIs) | `api`                                |
| `--check`        | Verificar si docs estan actualizados        | false                                |
| `--dry-run`      | Previsualizar cambios sin escribir          | false                                |
| `--verbose`      | Mostrar progreso detallado                  | false                                |

**Ejemplo:**

```bash
# Generar docs desde servidor local (debe estar corriendo)
pnpm core docs sync --api

# Especificar nombre del API (genera en content/api-{name}/)
pnpm core docs sync --api --name api-example

# Usar una fuente especifica con nombre personalizado
pnpm core docs sync --api --source http://localhost:3015/openapi.json --name inventory

# Verificar si los docs estan actualizados (para CI)
pnpm core docs sync --api --check

# Previsualizar sin escribir
pnpm core docs sync --api --dry-run --verbose
```

**Archivos generados:**

El output va a `internal/docs/src/content/api-{name}/`:

```
internal/docs/src/content/api-api-example/
├── index.md      # Vision general con todos los endpoints
├── health.md     # Endpoints de /health
├── users.md      # Endpoints de /api/users
├── roles.md      # Endpoints de /api/roles
└── parties.md    # Endpoints de /api/parties
```

Cada archivo generado incluye frontmatter con `category: "API: {name}"` para agruparse correctamente en la navegacion del sidebar.

**Flujo de trabajo:**

1. Inicia el servidor API: `pnpm --filter api-example dev`
2. Genera los docs: `pnpm core docs sync --api --name api-example`
3. Revisa los archivos generados en `internal/docs/src/content/api-api-example/`
4. Haz commit de los docs generados

**Multiples APIs:**

Si tienes varias APIs en el monorepo, genera docs para cada una con nombres distintos:

```bash
# API principal
pnpm core docs sync --api --name api-example

# API de inventario (en otro puerto)
pnpm core docs sync --api --source http://localhost:3015/openapi.json --name inventory
```

Los docs de cada API apareceran agrupados por categoria en el sidebar:

- `API: api-example` -> Health, Users, Roles, Parties
- `API: inventory` -> Products, Categories

**Para CI:**

```bash
# Falla si los docs no estan actualizados
pnpm core docs sync --api --check
```

---

## Proximos Comandos (Roadmap)

| Comando                 | Descripcion                      | Estado    |
| ----------------------- | -------------------------------- | --------- |
| `core docs sync --ui`   | Generar catalogo de componentes  | Pendiente |
| `core docs sync --core` | Generar referencia de @core/core | Pendiente |

---

## Troubleshooting

### El CLI no encuentra el monorepo

El CLI busca el `package.json` raiz con `name: "mono-template"`. Asegurate de estar ejecutando el comando desde dentro del monorepo.

### Las apps generadas no compilan

Ejecuta `pnpm install` desde la raiz del monorepo para instalar las dependencias del nuevo workspace.

### Los templates no se procesan

Verifica que existe `templates/api/manifest.json` y `templates/webapp/manifest.json` con el formato correcto.
