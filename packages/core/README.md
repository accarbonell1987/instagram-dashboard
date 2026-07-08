# @core/core

Lógica de negocio reutilizable del monorepo: servicios genéricos CRUD, extensiones de servicios, cliente HTTP, autenticación, sistema de mocks y store Zustand.

Todos los servicios de dominio en `internal/webapp-example` se construyen sobre este package.

---

## Módulos

```
@core/core            → barrel principal
@core/core/services   → CrudService, ServiceExtender, createCoreServices
@core/core/react      → createServicesStore (Zustand factory)
@core/core/http       → HttpService, createHttpClient, interceptors
@core/core/auth       → Token, OAuthStrategy, ApiAuthStrategy
@core/core/mocks      → createMockAdapter, usersMock
@core/core/errors     → ServiceError
@core/core/config     → apiUrls, env helpers
```

---

## Uso principal

### Inicializar servicios

```ts
import { createCoreServices } from '@core/core';
import { createMockAdapter } from '@core/core/mocks';

// Desarrollo / tests — datos en memoria con seed
const adapter = createMockAdapter();
const services = createCoreServices({ adapter });

// Producción — conecta al API real
const services = createCoreServices({ baseUrl: 'https://api.example.com' });
```

### Store Zustand para React

```ts
// lib/services.ts — composition root del webapp
import { createCoreServices } from '@core/core';
import { createServicesStore } from '@core/core/react';
import { createMockAdapter } from '@core/core/mocks';

export const coreServices = createCoreServices({ adapter: createMockAdapter() });
export const useServicesStore = createServicesStore(coreServices);
```

```tsx
// En cualquier Client Component
'use client';
import { useServicesStore } from '@/lib/services';

function UserList() {
  const { userService } = useServicesStore();
  // userService expone getAll, getById, create, update, delete + extensiones
}
```

### Extender un servicio — ServiceExtender

Para añadir métodos custom sin herencia de clases:

```ts
import type { ServiceExtender } from '@core/core';

interface UserExtensions {
  activateUser(id: string): Promise<User>;
}

export const userExtensions: ServiceExtender<User, UserExtensions> = (helpers) => ({
  async activateUser(id: string) {
    await helpers.getById(id); // valida existencia, lanza ServiceError si no existe
    return helpers.update(id, { active: true });
  },
});
```

### Errores

```ts
import { ServiceError } from '@core/core/errors';

try {
  await userService.getById(id);
} catch (e) {
  if (e instanceof ServiceError) {
    // e.message, e.statusCode
  }
}
```

---

## CrudService — métodos disponibles

Todo servicio creado con `createCoreServices()` expone:

| Método              | Descripción                                        |
| ------------------- | -------------------------------------------------- |
| `getAll(filters?)`  | Lista con paginación y filtros opcionales          |
| `getById(id)`       | Obtiene por ID — lanza `ServiceError` si no existe |
| `create(input)`     | Crea un nuevo recurso                              |
| `update(id, input)` | Actualiza un recurso existente                     |
| `delete(id)`        | Elimina un recurso                                 |

Más los métodos custom definidos en las extensiones (`ServiceExtender`).

---

## Testing

```bash
pnpm --filter @core/core test          # Vitest
pnpm --filter @core/core test:coverage # Con cobertura
```

Los tests son co-locados con el fuente (`*.test.ts` junto a `*.ts`).
