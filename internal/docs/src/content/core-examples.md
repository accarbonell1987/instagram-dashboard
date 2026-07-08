---
title: 'Guia de Integracion de @core/core'
description: 'Como configurar servicios, autenticacion y mock backend en una aplicacion Next.js'
order: 6
date: 2026-02-13
readTime: 12 min
---

# Guia de Integracion de @core/core

Esta guia recorre paso a paso como integrar `@core/core` en una aplicacion Next.js. Usa `internal/webapp-example` como referencia funcional: al finalizar tendras un CRUD completo de usuarios conectado a un mock backend.

---

## Requisitos previos

Antes de comenzar, tu app necesita:

1. La dependencia en `package.json`:

```json
{
  "dependencies": {
    "@core/core": "workspace:*"
  }
}
```

2. El transpile en `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  transpilePackages: ['@core/ui', '@core/config', '@core/shared', '@core/core'],
};
```

Sin `transpilePackages`, Next.js no puede compilar el TypeScript de `@core/core` porque es un paquete interno del monorepo que exporta `.ts` directamente.

---

## Paso 1: Configurar los servicios

El archivo `src/lib/services.ts` es el punto de entrada. Aqui se decide:

- **Como se autentica** la aplicacion (estrategia de auth)
- **A donde apuntan** las peticiones HTTP (URL base)
- **Como se exponen** los servicios a los componentes React (store + hooks)

### La interfaz `CoreServicesConfig`

```typescript
interface CoreServicesConfig {
  auth: AuthConfig; // Estrategia de autenticacion
  baseUrl: string; // URL base del API (ej: 'https://api.example.com/v1')
  timeout?: number; // Timeout en ms (default: 30000)
  headers?: Record<string, string>; // Headers adicionales
  storage?: TokenStorage; // Donde persistir tokens (default: memoria)
  storagePrefix?: string; // Prefijo para las keys en storage (default: 'auth')
}
```

### Estrategias de autenticacion

`@core/core` soporta tres estrategias. Se elige una segun el backend:

#### OAuth2 (`type: 'oauth'`)

Para servidores que implementan el flujo `client_credentials` + `refresh_token`:

```typescript
import { createCoreServices } from '@core/core/services';

const coreServices = createCoreServices({
  auth: {
    type: 'oauth',
    config: {
      url: 'https://auth.example.com/oauth/token',
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
    },
  },
  baseUrl: 'https://api.example.com/v1',
  timeout: 15000,
});
```

`OAuthStrategy` hace un POST al `url` con `grant_type=client_credentials` para obtener el token inicial, y `grant_type=refresh_token` para renovarlo.

#### API simple (`type: 'api'`)

Para servidores con endpoints de login y refresh propios:

```typescript
const coreServices = createCoreServices({
  auth: {
    type: 'api',
    config: {
      loginUrl: '/auth/login',
      refreshUrl: '/auth/refresh',
      credentials: {
        email: 'admin@example.com',
        password: 'secret',
      },
    },
  },
  baseUrl: 'https://api.example.com/v1',
});
```

`ApiAuthStrategy` hace un POST a `loginUrl` con las credenciales para obtener el token, y un POST a `refreshUrl` con el refresh token para renovarlo. Ambos endpoints deben devolver `{ accessToken, refreshToken, expiresIn }`.

#### Custom (`type: 'custom'`)

Para casos donde ninguna de las estrategias anteriores aplica, o para mocks y testing:

```typescript
import type { AuthStrategy, TokenResponse } from '@core/core/auth';

const myStrategy: AuthStrategy = {
  requestToken: (): Promise<TokenResponse> =>
    Promise.resolve({
      accessToken: 'my-token',
      refreshToken: 'my-refresh',
      expiresIn: 3600,
    }),
  refreshToken: (currentRefreshToken: string): Promise<TokenResponse> =>
    fetch('/my-custom-refresh', {
      method: 'POST',
      body: JSON.stringify({ token: currentRefreshToken }),
    }).then((response) => response.json()),
};

const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: myStrategy },
  baseUrl: 'https://api.example.com/v1',
});
```

La interfaz `AuthStrategy` solo requiere dos metodos:

- `requestToken()` — obtener un token nuevo (login inicial)
- `refreshToken(currentRefreshToken)` — renovar un token existente

Ambos deben devolver `{ accessToken: string, refreshToken: string, expiresIn: number }`.

### El objeto `CoreServices`

`createCoreServices()` retorna un objeto con tres propiedades:

| Propiedad       | Tipo                          | Descripcion                                                                                                                      |
| --------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `tokenProvider` | `ITokenProvider`              | Acceso al token actual, refresh, expiracion, logout                                                                              |
| `httpClient`    | `AxiosInstance`               | Instancia Axios con auth interceptor (Bearer token automatico) y error interceptor (refresh en 401, errores como `ServiceError`) |
| `createService` | `<T>(path) => CrudService<T>` | Factory para crear servicios CRUD tipados                                                                                        |

### Crear el store de React

Los componentes necesitan acceder a los servicios via hooks. `createServicesStore()` crea un store Zustand con dos hooks:

```typescript
// src/lib/services.ts
import { createCoreServices } from '@core/core/services';
import { createServicesStore } from '@core/core/react';

const coreServices = createCoreServices({
  auth: {
    type: 'api',
    config: {
      /* ... */
    },
  },
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
});

export const { store, useServices, useServicesStore } = createServicesStore();
export { coreServices };
```

| Export                       | Proposito                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `store`                      | Store Zustand raw. Se usa para inicializar (`store.getState().initialize(...)`) y resetear (`store.getState().reset()`) |
| `useServices()`              | Hook que devuelve `CoreServices`. Lanza error si no se ha inicializado                                                  |
| `useServicesStore(selector)` | Hook generico para leer estado parcial (ej: `useServicesStore(s => s.initialized)`)                                     |

---

## Paso 2: Crear el provider

El provider inicializa el store la primera vez que se monta. Debe envolver toda la app para que `useServices()` funcione en cualquier componente hijo.

```tsx
// src/providers/ServicesProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { coreServices, store } from '@/lib/services';

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      store.getState().initialize(coreServices);
      initialized.current = true;
    }
  }, []);

  return <>{children}</>;
}
```

El `useRef` evita que se inicialice dos veces en React Strict Mode (desarrollo). En produccion el effect solo corre una vez.

---

## Paso 3: Conectar en el layout

El provider se agrega en `src/app/layout.tsx`, envolviendo el contenido de la app:

```tsx
// src/app/layout.tsx
import { ServicesProvider } from '@/providers/ServicesProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServicesProvider>{children}</ServicesProvider>
      </body>
    </html>
  );
}
```

Si la app usa otros providers (tema, tooltips, etc.), `ServicesProvider` puede ir en cualquier posicion del arbol. No tiene dependencias sobre otros providers.

---

## Paso 4: Consumir servicios en componentes

Con el provider en su lugar, cualquier Client Component puede usar `useServices()`:

### Ejemplo basico: listar datos

```tsx
'use client';

import { useServices } from '@/lib/services';
import { useEffect, useMemo, useState } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
}

export function ProductList() {
  const services = useServices();
  const productsService = useMemo(() => services.createService<Product>('/products'), [services]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    productsService.getAll().then(setProducts);
  }, [productsService]);

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {product.name} — ${product.price}
        </li>
      ))}
    </ul>
  );
}
```

El `useMemo` sobre `createService` es importante: evita crear una instancia nueva del servicio en cada render, lo que provocaria efectos infinitos.

### Ejemplo completo: CRUD con paginacion

`internal/webapp-example/src/app/users/page.tsx` implementa un CRUD completo. Estos son los patrones clave:

#### Definir los tipos de la entidad

```typescript
import type { User } from '@core/core/mocks';

// TCreate: los campos que el usuario llena al crear (sin id ni createdAt)
type UserCreate = Omit<User, 'id' | 'createdAt'>;

// Crear el servicio con tipos explicitos
const usersService = services.createService<User, UserCreate>('/users');
```

`CrudService` acepta hasta tres genericos:

- `T` — la entidad completa (lo que devuelve el servidor). Debe tener `id: string | number`
- `TCreate` — payload para crear. Default: `Omit<T, 'id'>`
- `TUpdate` — payload para actualizar. Default: `Partial<TCreate>`

#### Obtener datos con paginacion y busqueda

```typescript
const fetchUsers = useCallback(async () => {
  setLoading(true);
  try {
    const filterParams: FilterParams = { page, pageSize: 5 };
    if (search) filterParams.search = search;
    const result = await usersService.filter(filterParams);
    setUsers(result.data); // User[]
    setTotal(result.total); // total de registros (para calcular paginas)
  } finally {
    setLoading(false);
  }
}, [usersService, page, search]);
```

`filter()` devuelve `PaginatedResponse<T>`:

```typescript
interface PaginatedResponse<T> {
  data: T[]; // registros de la pagina actual
  total: number; // total de registros que matchean los filtros
  page: number; // pagina actual
  pageSize: number; // tamanio de pagina
}
```

#### Crear, editar y eliminar

```typescript
// Crear
await usersService.create({ name: 'Alice', email: 'alice@example.com', role: 'editor' });

// Actualizar (parcial: solo los campos que cambian)
await usersService.update(userId, { name: 'Alice Updated' });

// Eliminar
await usersService.remove(userId);
```

Despues de cada mutacion, se vuelve a llamar `fetchUsers()` para refrescar la tabla.

---

## CrudService: uso directo vs. extensiones

### Uso directo

Cuando la entidad solo necesita CRUD estandar, no hace falta crear una clase:

```typescript
const usersService = core.createService<User>('/users');
const productsService = core.createService<Product>('/products');
```

Ambos tienen los mismos 6 metodos: `getAll`, `getById`, `create`, `update`, `remove`, `filter`.

### Extension Callback (recomendado)

Si una entidad necesita operaciones adicionales, usa el patron de extensiones:

```typescript
import type { HttpHelpers } from '@core/core/services';

// 1. Define el tipo de extensiones
type OrderExtensions = {
  getByStatus: (status: 'pending' | 'shipped' | 'delivered') => Promise<Order[]>;
  markAsShipped: (id: number) => Promise<Order>;
};

// 2. Crea la funcion factory
function createOrderExtensions(http: HttpHelpers, basePath: string): OrderExtensions {
  return {
    getByStatus: async (status) => {
      return http.get<Order[]>(`${basePath}/status/${status}`);
    },
    markAsShipped: async (id) => {
      return http.put<Order>(`${basePath}/${id}/ship`, {});
    },
  };
}

// 3. Usa createService con la extension
const ordersService = core.createService<Order, OrderCreate, OrderUpdate, OrderExtensions>(
  '/orders',
  createOrderExtensions
);

// 4. Ahora tienes CRUD + metodos custom
const allOrders = await ordersService.getAll(); // CRUD
const pending = await ordersService.getByStatus('pending'); // Extension
await ordersService.markAsShipped(123); // Extension
```

#### HttpHelpers

El callback de extension recibe `HttpHelpers` con estos metodos tipados:

| Metodo   | Signature                                                           |
| -------- | ------------------------------------------------------------------- |
| `get`    | `<R>(path: string, params?: Record<string, unknown>) => Promise<R>` |
| `post`   | `<R>(path: string, data?: unknown) => Promise<R>`                   |
| `put`    | `<R>(path: string, data?: unknown) => Promise<R>`                   |
| `patch`  | `<R>(path: string, data?: unknown) => Promise<R>`                   |
| `delete` | `<R>(path: string) => Promise<R>`                                   |

Estos helpers ya incluyen la configuracion de auth e interceptores del `httpClient`.

### Herencia (alternativa)

Si prefieres el patron de herencia clasico, tambien funciona:

```typescript
import { CrudService } from '@core/core/services';
import type { AxiosInstance } from 'axios';

class OrdersService extends CrudService<Order> {
  constructor(http: AxiosInstance) {
    super(http, '/orders');
  }

  async getByStatus(status: Order['status']): Promise<Order[]> {
    return this.get(`/status/${status}`);
  }

  async markAsShipped(id: number): Promise<Order> {
    return this.put(`/${id}/ship`, {});
  }
}

// Instanciar con httpClient directamente
const ordersService = new OrdersService(core.httpClient);
```

Los metodos protegidos disponibles desde `HttpService` son: `get`, `post`, `put`, `patch`, `delete`, `postForm` y `getBlob`.

### Cuando usar cada patron

| Patron                 | Usar cuando...                                                 |
| ---------------------- | -------------------------------------------------------------- |
| **Extension callback** | Metodos de dominio especificos (batch, assign, custom queries) |
| **Herencia**           | Comportamiento cross-cutting o reuso en multiples servicios    |
| **Uso directo**        | Solo necesitas CRUD estandar                                   |

---

## Mock backend para desarrollo

El sistema de mocks permite trabajar sin un servidor real. Intercepta todas las peticiones HTTP a nivel del adapter de Axios y responde con datos en memoria.

### Como funciona

```
Componente → usersService.getAll()
  → CrudService.get('/users')
    → Axios httpClient.get('/users')
      → mockAdapter intercepta → matchea handler GET /users
        → retorna datos en memoria
```

El mock adapter reemplaza el transporte de Axios. Los interceptores (auth, error) siguen funcionando normalmente.

### Configurar el mock

```typescript
// src/lib/services.ts
import type { AuthStrategy, TokenResponse } from '@core/core/auth';
import { createMockAdapter, createUsersMockHandlers } from '@core/core/mocks';
import { createServicesStore } from '@core/core/react';
import { createCoreServices } from '@core/core/services';

// 1. Auth noop — no necesitamos tokens reales para el mock
const noopAuthStrategy: AuthStrategy = {
  requestToken: (): Promise<TokenResponse> =>
    Promise.resolve({
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      expiresIn: 99999,
    }),
  refreshToken: (): Promise<TokenResponse> =>
    Promise.resolve({
      accessToken: 'mock-token-refreshed',
      refreshToken: 'mock-refresh-2',
      expiresIn: 99999,
    }),
};

// 2. Crear los handlers del mock (Users viene incluido en @core/core/mocks)
const { handlers: userHandlers, store: usersStore } = createUsersMockHandlers();
const mockAdapter = createMockAdapter(userHandlers);

// 3. Crear core con custom strategy
const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: 'https://mock.api',
});

// 4. Inyectar el mock adapter
coreServices.httpClient.defaults.adapter = mockAdapter;

// 5. Store + hooks para React
export const { store, useServices, useServicesStore } = createServicesStore();
export { coreServices, usersStore };
```

`createUsersMockHandlers()` devuelve:

- `handlers` — array de `MockHandler[]` que implementan GET/POST/PUT/DELETE sobre `/users`
- `store` — acceso directo al store en memoria (util para tests o para resetear datos)

El mock incluye 10 usuarios seed y soporta paginacion, busqueda por nombre/email, y filtro por rol.

### Crear handlers para otras entidades

Cada `MockHandler` define un metodo HTTP, un patron de URL (con `:params`), y una funcion que retorna la respuesta:

```typescript
import { createMockAdapter } from '@core/core/mocks';
import type { MockHandler } from '@core/core/mocks';

const products = [
  { id: 1, name: 'Widget', price: 9.99 },
  { id: 2, name: 'Gadget', price: 19.99 },
];

const productHandlers: MockHandler[] = [
  {
    method: 'GET',
    urlPattern: '/products',
    handler: () => ({ status: 200, data: products }),
  },
  {
    method: 'GET',
    urlPattern: '/products/:id',
    handler: (request) => {
      const product = products.find((p) => p.id === Number(request.pathParams['id']));
      return product
        ? { status: 200, data: product }
        : { status: 404, data: { message: 'Not found' } };
    },
  },
  {
    method: 'POST',
    urlPattern: '/products',
    handler: (request) => {
      const body = request.body as Omit<(typeof products)[0], 'id'>;
      const newProduct = { ...body, id: products.length + 1 };
      products.push(newProduct);
      return { status: 201, data: newProduct };
    },
  },
];
```

Para combinar handlers de varias entidades en un solo adapter:

```typescript
const adapter = createMockAdapter([...userHandlers, ...productHandlers]);
coreServices.httpClient.defaults.adapter = adapter;
```

Los handlers se evaluan en orden: el primer match de metodo + URL gana. Si ningun handler matchea, el adapter lanza un error 404.

### Transicion a un backend real

Cuando el backend esta listo, el cambio es minimo. Solo se modifica `src/lib/services.ts`:

```typescript
// Antes (mock):
const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: 'https://mock.api',
});
coreServices.httpClient.defaults.adapter = mockAdapter;

// Despues (real):
const coreServices = createCoreServices({
  auth: {
    type: 'api',
    config: {
      loginUrl: '/auth/login',
      refreshUrl: '/auth/refresh',
      credentials: { email: 'admin@example.com', password: 'secret' },
    },
  },
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
});
```

Se elimina la estrategia noop, los handlers y la linea del adapter. Los componentes no cambian porque dependen de `useServices()` y `CrudService<T>`, no de la implementacion concreta.

---

## Referencia rapida

### Imports disponibles

| Import path           | Que contiene                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@core/core/services` | `createCoreServices`, `CrudService`, `CoreServices`, `CoreServicesConfig`, `PaginatedResponse`, `FilterParams`, `HttpHelpers`, `ServiceExtender` |
| `@core/core/auth`     | `Token`, `OAuthStrategy`, `ApiAuthStrategy`, tipos (`AuthStrategy`, `ITokenProvider`, `TokenResponse`, `TokenStorage`)                           |
| `@core/core/http`     | `HttpService`, `createHttpClient`, `createAuthInterceptor`, `createErrorInterceptor`                                                             |
| `@core/core/errors`   | `ServiceError`                                                                                                                                   |
| `@core/core/react`    | `createServicesStore`, tipos (`ServicesStore`, `ServicesState`)                                                                                  |
| `@core/core/mocks`    | `createMockAdapter`, `createUsersMockHandlers`, `createUsersStore`, tipos (`MockHandler`, `MockResponse`, `User`)                                |
| `@core/core/config`   | `apiUrls`, `env`                                                                                                                                 |

### Estructura recomendada

```
src/
├── lib/
│   └── services.ts              # createCoreServices + createServicesStore
├── providers/
│   └── ServicesProvider.tsx      # Inicializa el store en mount
├── app/
│   ├── layout.tsx               # Envuelve con ServicesProvider
│   └── users/
│       └── page.tsx             # useServices() → createService<User>('/users')
```
