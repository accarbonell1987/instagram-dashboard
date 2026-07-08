# Patrones del proyecto: webapp-example

> Última actualización: 2026-02-23

## Convenciones de nombrado

| Tipo                          | Patrón             | Ejemplos                                                                                    |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Archivos de componentes       | kebab-case         | `showcase-nav.tsx`, `theme-selector.tsx`, `field-examples.tsx`                              |
| Archivos de lib/utils         | kebab-case         | `services.ts`, `utils.ts`                                                                   |
| Componentes React             | PascalCase         | `ShowcaseNav`, `ThemeSelector`, `ServicesProvider`                                          |
| Hooks                         | prefijo `use`      | `useServices`, `useServicesStore`, `useColorTheme`, `useMobile`                             |
| Factories                     | prefijo `create`   | `createCoreServices`, `createServicesStore`, `createMockAdapter`, `createUsersMockHandlers` |
| Handlers de eventos           | prefijo `handle`   | `handleCreate`, `handleEdit`, `handleDelete`, `handlePageChange`                            |
| Variables de estado booleanas | prefijo `is`/`has` | `isLoading`, `isOpen`, `initialized`                                                        |

## Estructura por tipo de artefacto

### Página (Server Component — default)

```tsx
// app/colors/page.tsx — sin 'use client', sin hooks
import { Badge } from '@repo/ui';

export default function ColorsPage() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold">Colors</h1>
      {/* render estático */}
    </main>
  );
}
```

### Página (Client Component)

```tsx
// app/users/page.tsx — con estado, efectos, hooks
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useServices } from '@/lib/services';
import type { User } from '@repo/core/mocks';

export default function UsersPage() {
  const services = useServices();
  const [users, setUsers] = useState<User[]>([]);
  const usersService = useMemo(
    () => services.createService<User, UserCreate>('/users'),
    [services]
  );
  // ...
}
```

### Componente local (showcase/presentación)

```tsx
// components/example.tsx — sin CVA, extiende HTMLAttributes
interface ExampleProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
}
export function Example({ title, className, children, ...props }: ExampleProps) {
  return (
    <div className={cn('rounded-lg border p-4', className)} {...props}>
      {title && <h3 className="mb-2 text-sm font-medium">{title}</h3>}
      {children}
    </div>
  );
}
```

### Provider (Client Component)

```tsx
// providers/ServicesProvider.tsx
'use client';
import { useEffect, useState } from 'react';
import { store, coreServices } from '@/lib/services';

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    store.getState().initialize(coreServices);
    setInitialized(true);
  }, []);
  if (!initialized) return null;
  return <>{children}</>;
}
```

### Composition Root (`lib/services.ts`)

```ts
// Único lugar donde se instancian dependencias concretas
import { createCoreServices, createServicesStore } from '@repo/core/services';
import { createMockAdapter } from '@repo/core/mocks';
import type { AuthStrategy } from '@repo/core/auth';

const noopAuthStrategy: AuthStrategy = { requestToken: ..., refreshToken: ... };
const { handlers, store: usersStore } = createUsersMockHandlers();
const mockAdapter = createMockAdapter(handlers);
const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: 'https://mock.api',
});
coreServices.httpClient.defaults.adapter = mockAdapter;
export const { store, useServices, useServicesStore } = createServicesStore();
export { coreServices, usersStore };
```

## Patrones de diseño en uso

### Composition Root

`lib/services.ts` es el único lugar donde se crean instancias concretas. Todos los componentes consumen via `useServices()` — nunca instancian directamente.

### Provider Pattern (Zustand + React Context)

`createServicesStore()` de `@repo/core` crea un store Zustand con `useServices` hook incluido. `ServicesProvider` lo inicializa una vez.

### Factory Pattern

Todas las entidades se crean via factories: `createCoreServices`, `createServicesStore`, `createMockAdapter`, `createService`. Nunca `new Service()`.

### Atomic Design (en @repo/ui)

```
atoms/     → Button, Input, Badge, Label, Avatar
molecules/ → Card, Dialog, DropdownMenu, Form, Select
organisms/ → Sidebar, NavigationMenu, DataTable
```

La app usa estos componentes directamente via `import { Button } from '@repo/ui'`.

### CVA (Class Variance Authority) — solo en @repo/ui atoms

```tsx
const buttonVariants = cva('base-classes', {
  variants: { variant: { default: '...', outline: '...' }, size: { sm: '...', lg: '...' } },
  defaultVariants: { variant: 'default', size: 'default' },
});
// Los componentes locales de la app NO usan CVA — solo className + cn()
```

## Manejo de errores

**Servicios no hacen try/catch** — lanzan `ServiceError`. El consumidor gestiona:

```ts
// En UsersPage (patrón incompleto — solo fetchUsers tiene try/catch)
const fetchUsers = async () => {
  try {
    const result = await usersService.filter({ page });
    setUsers(result.data);
  } catch (error) {
    console.error('Error fetching users:', error);
    // TODO: mostrar error en UI
  } finally {
    setIsLoading(false);
  }
};
// handleCreate, handleEdit, handleDelete — sin try/catch (anti-patrón detectado)
```

**Servicios no inicializados:**

```ts
// useServices() lanza si el store no está inicializado
export function useServices(): CoreServices {
  const services = useServicesStore((state) => state.services);
  if (!services) throw new Error('Services not initialized. Wrap with ServicesProvider.');
  return services;
}
```

## Patrones de testing

No existen tests en `internal/webapp-example`. Los tests están en:

- `@repo/core` — tests de servicios con Vitest (co-locados: `Token.ts` → `Token.test.ts`)
- `@repo/ui` — tests de componentes (Vitest + Testing Library)

Comandos: `pnpm test` desde raíz del monorepo delega via Turborepo.

## Patrones de imports

### Reglas generales

```ts
// 1. Packages externos — siempre desde barrel, NUNCA rutas internas
import { Button, Card, Badge } from '@repo/ui'; // ✓
import { Button } from '@repo/ui/src/components/atoms/button'; // ✗

// 2. Sub-exports de packages — path exacto del export configurado
import { ThemeProvider } from '@repo/shared/providers';
import { createCoreServices } from '@repo/core/services';
import type { User } from '@repo/core/mocks';

// 3. Archivos locales de la app — alias @/
import { useServices } from '@/lib/services';
import { ShowcaseNav } from '@/components/showcase-nav';
import { cn } from '@/lib/utils';

// 4. import type obligatorio para solo tipos (ESLint enforced)
import type { User } from '@repo/core/mocks';
import type { AuthStrategy, TokenResponse } from '@repo/core/auth';
```

### Sub-exports disponibles de los packages

**`@repo/core`**: `./http`, `./auth`, `./services`, `./config`, `./errors`, `./react`, `./mocks`

**`@repo/shared`**: `.`, `./utils`, `./types`, `./providers`, `./components`

**`@repo/ui`**: `.`, `./components/atoms`, `./components/molecules`, `./components/organisms`, `./components/atoms/*`, `./lib`

## Anti-patrones identificados

1. **`ColorThemeSelector` de `@repo/shared` desactualizada** — tiene temas hardcodeados (solo shadcn), no refleja el registry central de `@repo/config`. Usar el `ThemeSelector` local de la app.

2. **`src/styles/theme.ts` sin impacto real** — define `createThemeTokens` para tema "Creative" pero ese objeto no se aplica como CSS. Solo sirve de metadata en `ThemeInfo`. No confundir con configuración activa.

3. **URL base hardcodeada** — `'https://mock.api'` en `lib/services.ts`. En producción debería ser `process.env.NEXT_PUBLIC_API_URL`.

4. **Inconsistencia `limit` vs `pageSize`** — `@repo/shared` define `PaginationParams` con `limit`; `@repo/core` usa `pageSize`. La app usa la de `@repo/core`. No mezclar las dos interfaces.

5. **Sub-componentes inline en páginas** — `UsersPage` define `RoleBadge` y `UserFormDialog` en el mismo archivo. Aceptable para demos, problemático si la app crece.

6. **Ausencia de error boundaries** — `handleCreate`, `handleEdit`, `handleDelete` en `UsersPage` son `async` sin `try/catch`. Un `ServiceError` no manejado rompe la UI sin feedback al usuario.
