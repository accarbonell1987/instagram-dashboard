---
title: "Corehub IAM API"
description: "Microservicio de identidad y acceso de la plataforma Corehub. Autenticación JWT RS256, onboarding multi-tenant, pagos Bancard y gestión de planes."
category: "API: Corehub IAM"
order: 100
date: "2026-05-05"
---

# Corehub IAM API

`@corehub/api-iam` es el microservicio de identidad y acceso de la plataforma Corehub. Es la única fuente de verdad para autenticación, sesiones JWT, onboarding de tenants, integración de pagos (Bancard) y generación de documentos (factura + contrato).

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Hono 4.x + `@hono/zod-openapi` |
| Runtime | Node.js 22+ via `@hono/node-server` |
| ORM | Prisma 6.x (PostgreSQL 16) |
| Auth | JWT RS256 con `jose`; hash de contraseñas con `argon2id` |
| IDs | `nanoid` para tokens opacos; UUIDs nativos de PostgreSQL para entidades |
| Testing | Vitest 3 |

## URLs importantes

| URL | Descripción |
|-----|-------------|
| `http://localhost:8080/healthz` | Liveness probe |
| `http://localhost:8080/docs` | Swagger UI interactivo |
| `http://localhost:8080/openapi.json` | Spec OpenAPI 3.1 (auto-generado) |
| `http://localhost:8080/.well-known/jwks.json` | Public JWK set para verificación de JWT |

## Dominios y endpoints

| Dominio | Endpoints | Descripción |
|---------|-----------|-------------|
| [Auth](./authentication.md) | 14 | Login, OTP, refresh tokens, logout, first login, signup rep, password recovery |
| [Onboarding](./endpoints.md#onboarding) | 8 | Draft state machine, resume link, pagos, submit |
| [Webhooks](./endpoints.md#webhooks) | 1 | Webhook de confirmación de pago Bancard |
| [Identity](./endpoints.md#identity) | 1 | Perfil completo del usuario autenticado |
| [Plans](./endpoints.md#plans) | 2 | Listado y detalle de planes disponibles |
| [Invitations](./endpoints.md#invitations) | 2 | Preview y aceptación de invitaciones |
| [Billing](./endpoints.md#billing) | 1 | URL firmada de documentos de facturación |
| [Well-known](./endpoints.md#well-known) | 1 | JWKS para verificación pública de JWT |
| [Health](./endpoints.md#health) | 1 | Liveness probe |
| **Total** | **31** | |

## Páginas de referencia

- [Quick Start](./quick-start.md) — levantar el servicio en local en 8 pasos
- [Autenticación](./authentication.md) — JWT RS256, flujo de login, OTP, refresh rotation
- [Endpoints](./endpoints.md) — referencia completa de los 31 endpoints
- [Cross-cutting](./cross-cutting.md) — idempotencia, auth guard, tenant guard, errores, rate limiting
- [Logging](./logging.md) — Pino v10, categorías de eventos, background jobs
- [Adapters](./adapters.md) — OTP, email, Bancard, PDF y storage swappables
- [Schema por tenant](./schema-tenant.md) — aislamiento PostgreSQL schema-per-tenant
