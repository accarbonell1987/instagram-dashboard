# Product Requirements Document

## CORE Monorepo Platform

**Versión**: 1.3.0
**Última actualización**: 2026-05-02
**Estado**: En desarrollo activo

---

## 1. Visión

**CORE Monorepo Platform** es una plataforma de desarrollo que permite a un equipo crear nuevas aplicaciones (APIs y webapps) completamente integradas con el ecosistema del monorepo ejecutando un único comando, garantizando consistencia arquitectónica y eliminando el setup repetitivo.

Combina tres pilares:

| Pilar                  | Descripción                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo base**      | Packages compartidos (`@core/core`, `@core/ui`, `@core/database`, `@core/shared`, `@core/config`) que todas las apps consumen |
| **CLI generador**      | `pnpm core new api <name>` / `core new webapp <name>` — scaffolding completo desde templates                                  |
| **Documentación viva** | `internal/docs` siempre sincronizado con el código mediante `core docs sync`                                                  |

### Problema que resuelve

| Problema                                  | Solución                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Setup repetitivo al crear nuevas apps     | CLI genera apps pre-configuradas desde templates                        |
| Inconsistencia entre proyectos del equipo | Packages compartidos garantizan convenciones comunes                    |
| Documentación desactualizada              | `core docs sync` actualiza docs desde el código fuente                  |
| Curva de aprendizaje alta                 | `internal/api-example` y `internal/webapp-example` como referencia viva |
| Duplicación de código entre apps          | Design system y servicios centralizados en packages                     |

---

## 2. Audiencia

- **Desarrolladores del equipo** — crean nuevas apps siguiendo las convenciones sin configuración manual
- **Tech Leads** — garantizan consistencia arquitectónica en todos los proyectos
- **Nuevos miembros** — aprenden el ecosistema desde los ejemplos de referencia

---

## 3. Roadmap

### ✅ Etapa 1 — Base consolidada

- Estructura `internal/` con `api-example`, `webapp-example` y `docs`
- Packages: `@core/core`, `@core/ui`, `@core/shared`, `@core/database`, `@core/config`
- Repository Pattern con 3 backends intercambiables (InMemory / File / Prisma)
- `@hono/zod-openapi` — validación bidireccional y OpenAPI automático
- Design System (`@core/ui`) con CVA + forwardRef + atomic design
- Theming dark/light + color-theme (ortogonales)
- Tests unitarios en `@core/core` con Vitest

### ✅ Etapa 2 — CLI base

- Package `@core/cli` con comando `pnpm core`
- `core new api <name>` — genera API Hono desde template
- `core new webapp <name>` — genera webapp Next.js desde template
- Templates en `templates/api/` y `templates/webapp/`
- Integración con Turborepo

### ✅ Etapa 3 — Generadores avanzados

- `core add route <path>` — añade ruta CRUD a una API existente
- `core add page <path>` — añade página a una webapp existente
- `core add component <name>` — añade componente UI

### ✅ Etapa 4 — Documentación automática

- `core docs sync --api` — genera documentación desde OpenAPI spec
- `--name <name>` — identifica el API en los docs (ej: `content/api-example/`)
- Navegación con agrupación por categoría en el portal de docs
- CI check: docs up-to-date en cada PR

### ✅ Etapa 5 — Arquitectura webapp escalable

- Screaming Architecture: `app/` thin wrappers → `features/` con dominio visible
- Domain Services pattern con `ServiceExtender` (extensiones sin herencia)
- `useCrudPage` — hook genérico para páginas CRUD
- Shared components: `CrudPageLayout`, `DataTable`, `SearchInput`, `Pagination`
- Integración real con el API de ejemplo

### 🔲 Etapa 6 — Calidad y CI/CD

| Tarea                                           | Prioridad |
| ----------------------------------------------- | --------- |
| Tests para `@core/cli` (cobertura > 80%)        | Alta      |
| Tests para `internal/api-example`               | WIP       |
| GitHub Actions: lint + typecheck + test + build | Alta      |
| Auto-generación de component catalog en docs    | Alta      |
| Tests para `internal/webapp-example`            | Media     |
| Despliegue automático del portal de docs        | Media     |
| Changelog automático                            | Media     |

### 🔲 Etapa 7 — Features enterprise

| Tarea                                             | Prioridad |
| ------------------------------------------------- | --------- |
| Autenticación completa en CLI (`--auth` flag)     | Alta      |
| Setup de base de datos en CLI (`--database` flag) | Media     |
| Autorización RBAC                                 | Media     |
| Plugin system para CLI                            | Baja      |
| Multi-tenancy support                             | Baja      |

---

## 4. Métricas de éxito

### Developer Experience

| Métrica                                                         | Target   |
| --------------------------------------------------------------- | -------- |
| Tiempo para crear nueva API (desde comando hasta app corriendo) | < 1 min  |
| Tiempo para crear nueva webapp                                  | < 1 min  |
| Tiempo de onboarding (nuevo dev hasta primer PR)                | < 30 min |
| Docs desactualizados en producción                              | 0        |

### Calidad

| Métrica                         | Target |
| ------------------------------- | ------ |
| Cobertura de tests `@core/core` | > 80%  |
| Cobertura de tests `@core/cli`  | > 80%  |
| Errores TypeScript              | 0      |
| Warnings ESLint                 | 0      |

### Consistencia

| Métrica                                     | Target |
| ------------------------------------------- | ------ |
| Apps generadas siguiendo todos los patrones | 100%   |
| Atoms UI con CVA + forwardRef + cn()        | 100%   |
| Barrel exports en todos los packages        | 100%   |

---

## 5. Referencias

La arquitectura detallada, patrones de código y stack técnico completo viven en los archivos de contexto del proyecto — no en este documento:

- `.claude/context/ARCHITECTURE.md` — mapa de arquitectura y módulos
- `.claude/context/PATTERNS.md` — patrones y convenciones reales
- `.claude/context/STACK.md` — stack, dependencias y scripts
- `CLAUDE.md` — guía para agentes y convenciones rápidas

> Este PRD se actualiza cuando cambia la **visión**, el **roadmap** o las **métricas**. Los detalles de implementación van en los archivos de contexto.
