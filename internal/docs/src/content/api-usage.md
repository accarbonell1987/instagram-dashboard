---
title: 'Guia de Uso del API'
description: 'Como arrancar la API, explorar endpoints y trabajar con los distintos modos de datos'
order: 11
date: 2026-02-26
readTime: 6 min
---

# Guía de Uso del API

Esta guía explica cómo arrancar el API, explorar su documentación interactiva y hacer las primeras peticiones.

## Requisitos

- **Node.js** 22 o superior
- **pnpm** 9.x
- Dependencias instaladas: `pnpm install`

---

## Arrancar el API

El API tiene tres modos de datos seleccionables con la variable de entorno `DATA_SOURCE`. El modo por defecto es `memory` — no requiere ninguna configuración.

### Modo memory (recomendado para desarrollo)

Datos en RAM, precargados con seed data. Sin base de datos, sin archivos. Ideal para desarrollar y probar.

```bash
pnpm dev --filter api-example
# o explícito:
DATA_SOURCE=memory pnpm dev --filter api-example
```

El servidor arranca en **http://localhost:3001**.

### Modo file (persistencia sin base de datos)

Los datos se guardan en archivos JSON dentro de `./data/`. Los cambios sobreviven reinicios del servidor.

```bash
DATA_SOURCE=file DATA_DIR=./data pnpm dev --filter api-example
```

Los archivos se crean automáticamente en el primer arranque:

```
internal/api-example/data/
├── users.json
├── roles.json
└── parties.json
```

### Modo prisma (PostgreSQL)

Requiere una base de datos PostgreSQL y la variable `DATABASE_URL`.

```bash
# 1. Configurar la base de datos
DATABASE_URL="postgresql://user:pass@localhost:5432/core" pnpm db:push

# 2. Arrancar
DATA_SOURCE=prisma DATABASE_URL="postgresql://..." pnpm dev --filter api-example
```

---

## Variables de entorno

| Variable       | Por defecto   | Descripción                                          |
| -------------- | ------------- | ---------------------------------------------------- |
| `PORT`         | `3001`        | Puerto del servidor                                  |
| `DATA_SOURCE`  | `memory`      | Fuente de datos: `memory` \| `file` \| `prisma`      |
| `DATA_DIR`     | `./data`      | Directorio para archivos JSON (solo modo `file`)     |
| `DATABASE_URL` | —             | Connection string de PostgreSQL (solo modo `prisma`) |
| `CORS_ORIGIN`  | `*`           | Origen permitido en CORS                             |
| `NODE_ENV`     | `development` | Entorno: `development` \| `production` \| `test`     |

Crea un archivo `.env` en `internal/api-example/` para no tener que exportar las variables en cada comando:

```bash
# internal/api-example/.env
DATA_SOURCE=memory
PORT=3001
```

---

## Documentación interactiva

Una vez arrancado el servidor, abre en el navegador:

```
http://localhost:3001/docs
```

Swagger UI muestra todos los endpoints agrupados por recurso, con sus schemas de request y response. Desde ahí puedes ejecutar peticiones directamente contra el servidor en ejecución.

Para obtener la especificación OpenAPI en formato JSON (útil para generar clientes o importar en Postman/Insomnia):

```
http://localhost:3001/openapi.json
```

---

## Endpoints disponibles

### Health

| Método | Ruta            | Descripción               |
| ------ | --------------- | ------------------------- |
| `GET`  | `/health`       | Estado del servicio       |
| `GET`  | `/health/ready` | Comprobación de readiness |

### Users

| Método   | Ruta             | Descripción                |
| -------- | ---------------- | -------------------------- |
| `GET`    | `/api/users`     | Lista paginada de usuarios |
| `GET`    | `/api/users/:id` | Usuario por ID             |
| `POST`   | `/api/users`     | Crear usuario              |
| `PUT`    | `/api/users/:id` | Actualizar usuario         |
| `DELETE` | `/api/users/:id` | Eliminar usuario           |

### Roles

| Método   | Ruta             | Descripción             |
| -------- | ---------------- | ----------------------- |
| `GET`    | `/api/roles`     | Lista paginada de roles |
| `GET`    | `/api/roles/:id` | Rol por ID              |
| `POST`   | `/api/roles`     | Crear rol               |
| `PUT`    | `/api/roles/:id` | Actualizar rol          |
| `DELETE` | `/api/roles/:id` | Eliminar rol            |

### Parties

| Método   | Ruta               | Descripción               |
| -------- | ------------------ | ------------------------- |
| `GET`    | `/api/parties`     | Lista paginada de parties |
| `GET`    | `/api/parties/:id` | Party por ID              |
| `POST`   | `/api/parties`     | Crear party               |
| `PUT`    | `/api/parties/:id` | Actualizar party          |
| `DELETE` | `/api/parties/:id` | Eliminar party            |

### Parámetros de filtrado (GET listas)

Todos los endpoints de listado aceptan los mismos query params:

| Parámetro   | Tipo            | Descripción                             |
| ----------- | --------------- | --------------------------------------- |
| `page`      | number          | Página (default: 1)                     |
| `pageSize`  | number          | Ítems por página, máx 100 (default: 20) |
| `search`    | string          | Búsqueda en texto                       |
| `sortBy`    | string          | Campo por el que ordenar                |
| `sortOrder` | `asc` \| `desc` | Dirección del orden                     |

---

## Ejemplos con curl

### Listar usuarios con seed data

```bash
curl http://localhost:3001/api/users
```

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "user-001",
        "email": "alice@example.com",
        "name": "Alice Smith",
        "partyId": "party-001",
        "createdAt": "2026-02-26T15:00:00.000Z",
        "updatedAt": "2026-02-26T15:00:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  }
}
```

### Crear una party

```bash
curl -X POST http://localhost:3001/api/parties \
  -H "Content-Type: application/json" \
  -d '{"type": "person", "displayName": "Carlos García", "email": "carlos@example.com"}'
```

### Crear un usuario vinculado a una party

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "carlos@example.com", "name": "Carlos García", "partyId": "party-003"}'
```

### Filtrar y paginar

```bash
# Página 2, 5 por página, ordenado por email descendente
curl "http://localhost:3001/api/users?page=2&pageSize=5&sortBy=email&sortOrder=desc"

# Buscar por texto
curl "http://localhost:3001/api/users?search=alice"
```

---

## Formato de errores

Todos los errores siguen el mismo formato:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with id 'xyz' not found"
  }
}
```

Para errores de validación Zod, el campo `details` incluye los issues:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "code": "invalid_string",
        "path": ["email"],
        "message": "Invalid email"
      }
    ]
  }
}
```

### Códigos de error

| Código             | HTTP | Cuándo ocurre                                            |
| ------------------ | ---- | -------------------------------------------------------- |
| `NOT_FOUND`        | 404  | El recurso con ese ID no existe                          |
| `CONFLICT`         | 409  | Ya existe un recurso con ese valor único (email, nombre) |
| `VALIDATION_ERROR` | 400  | El body o los query params no pasan la validación Zod    |
| `UNAUTHORIZED`     | 401  | Falta o es inválido el token de autenticación            |
| `FORBIDDEN`        | 403  | El usuario no tiene permisos para esa acción             |
| `INTERNAL_ERROR`   | 500  | Error no esperado en el servidor                         |

---

## Seed data (modo memory y file)

Al arrancar en modo `memory`, la API carga datos de ejemplo predefinidos:

| Recurso | IDs disponibles                                              |
| ------- | ------------------------------------------------------------ |
| Parties | `party-001`, `party-002`, `party-003`                        |
| Users   | `user-001` (alice@example.com), `user-002` (bob@example.com) |
| Roles   | `role-001` (admin), `role-002` (viewer)                      |

Estos datos permiten hacer peticiones inmediatamente sin configurar nada.

---

## Verificar que todo funciona

```bash
# 1. Arrancar
DATA_SOURCE=memory pnpm dev --filter api-example

# 2. Health check
curl http://localhost:3001/health
# → {"status":"ok","timestamp":"..."}

# 3. Listar usuarios
curl http://localhost:3001/api/users
# → {"success":true,"data":{"data":[...],"total":2,...}}

# 4. Error handling
curl http://localhost:3001/api/users/nonexistent
# → {"success":false,"error":{"code":"NOT_FOUND","message":"..."}}

# 5. Documentación interactiva
open http://localhost:3001/docs
```
