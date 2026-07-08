---
title: "Quick Start — Corehub IAM"
description: "Levanta el servicio IAM en local en 8 pasos: Docker, claves RSA, migraciones y seed."
category: "API: Corehub IAM"
order: 101
date: "2026-05-05"
---

# Quick Start

## Prerequisitos

- Node.js >= 22.0.0
- pnpm >= 9.15.4
- Docker + Docker Compose

## Pasos

### 1. Instalar dependencias

Desde la raíz del monorepo:

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cd apps/api-iam
cp .env.example .env
```

Edita `.env` y configura al menos:

- `DATABASE_URL` — ya apunta al Postgres local de Docker; cambia si es necesario
- `BANCARD_WEBHOOK_SECRET` — cualquier string de 16+ caracteres es válido para desarrollo local

### 3. Generar claves RSA

```bash
npx tsx src/scripts/generate-dev-keys.ts
```

Esto crea `apps/api-iam/keys/private.pem` y `apps/api-iam/keys/public.pem`.

Actualiza `.env`:

```env
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACTIVE_KID=key-2026-01
```

### 4. Levantar la base de datos

```bash
# Desde apps/api-iam/
docker compose up -d
```

Espera a que el health check pase (~5 segundos):

```bash
docker compose ps  # Status: healthy
```

### 5. Generar el Prisma client

```bash
pnpm --filter @corehub/api-iam db:generate
```

### 6. Ejecutar migraciones y seed

```bash
pnpm --filter @corehub/api-iam db:migrate
pnpm --filter @corehub/api-iam db:seed
```

El seed crea:

- Tres planes: `starter`, `professional`, `enterprise`
- Tenant sistema (`__system__`) con plan `enterprise`
- Usuario SuperAdmin (email/password configurables via env, defaults: `admin@corehub.com` / `Change-me-in-production!`)
- Fixtures de desarrollo (`NODE_ENV=development`): tenant `dev-tenant` con token de invitación fijo `dev-invitation-token-fixed`

### 7. Arrancar el servidor

```bash
pnpm --filter @corehub/api-iam dev
```

### 8. Verificar

```bash
curl http://localhost:8080/healthz
# Expected: {"status":"ok","service":"iam"}
```

## Conectar el frontend

Para apuntar `apps/hub` al IAM real en lugar de los mocks MSW:

```env
# apps/hub/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
```

No se necesitan cambios de código en el frontend. La capa MSW se bypasea automáticamente cuando esta variable está configurada.

> **Nota de puertos**: `apps/hub` corre en el puerto 3001, igual que `@internal/api-example`. No ejecutes ambos simultáneamente. El servicio IAM corre en el puerto 8080.

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm --filter @corehub/api-iam dev` | Servidor con hot reload |
| `pnpm --filter @corehub/api-iam build` | Build de producción |
| `pnpm --filter @corehub/api-iam type-check` | Verificación de tipos TypeScript |
| `pnpm --filter @corehub/api-iam test` | Tests (una vez) |
| `pnpm --filter @corehub/api-iam test:watch` | Tests en modo watch |
| `pnpm --filter @corehub/api-iam db:generate` | Genera el Prisma client |
| `pnpm --filter @corehub/api-iam db:migrate` | Ejecuta migraciones Prisma |
| `pnpm --filter @corehub/api-iam db:seed` | Carga datos de desarrollo |

## Arquitectura local

```
Node.js (local)          Docker
───────────────          ──────
apps/api-iam  ──────────> PostgreSQL 16 (:5432)
  :8080                   Adminer (:8081)
```

Adminer (UI de base de datos) disponible en **http://localhost:8081**:

| Campo | Valor |
|-------|-------|
| System | PostgreSQL |
| Server | `postgres` |
| Username | `corehub` |
| Password | `corehub_dev_password` |
| Database | `corehub_iam` |

## Problemas comunes

**Puerto 8080 en uso** — cambia via env: `PORT=8090`

**Prisma client no generado** — ejecuta `pnpm --filter @corehub/api-iam db:generate` tras cualquier cambio en `prisma/schema.prisma`

**Claves JWT no encontradas** — ejecuta `npx tsx src/scripts/generate-dev-keys.ts` y actualiza las rutas en `.env`

**Conexión a base de datos rechazada** — verifica que Docker esté corriendo y el contenedor esté healthy: `docker compose ps`

Para resetear la base de datos desde cero:

```bash
docker compose down -v && docker compose up -d
```
