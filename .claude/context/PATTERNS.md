# PATTERNS.md — Code Patterns & Conventions

> Last updated: 2026-05-02 | Derived from full codebase read.

---

## Naming Conventions

| Element              | Convention               | Example                                                               |
| -------------------- | ------------------------ | --------------------------------------------------------------------- |
| Files                | `kebab-case`             | `crud-service.ts`, `use-crud-page.ts`                                 |
| Classes              | `PascalCase`             | `CrudService`, `UserService`, `Token`                                 |
| React components     | `PascalCase`             | `ServicesProvider`, `ThemeProvider`                                   |
| Hooks                | `use` prefix + camelCase | `useServices()`, `useColorTheme()`, `useCrudPage()`                   |
| Factories            | `create` prefix          | `createCoreServices()`, `createMockAdapter()`, `createRepositories()` |
| Getters (singletons) | `get` prefix             | `getDomainServices()`                                                 |
| Interfaces           | `PascalCase`             | `ITokenProvider`, `DomainServices`                                    |
| Type aliases         | `PascalCase`             | `ServiceExtender`, `ExtendedService`                                  |

---

## Import Conventions

### `import type` is mandatory for type-only imports

Enforced by `verbatimModuleSyntax: true` in tsconfig + ESLint `@typescript-eslint/consistent-type-imports`.

```typescript
// ✅ Correct
import type { User, UserCreate } from '@/types/entities';
import { createCoreServices } from '@core/core/services';

// ❌ Wrong — value import for a type
import { User } from '@/types/entities';
```

### Import order (enforced by eslint-plugin-import-x)

1. `builtin` (node:path, node:fs)
2. `external` (npm packages)
3. `internal` (@core/_, @internal/_)
4. `parent` (../)
5. `sibling` (./)
6. `index` (.)

Newlines between groups. Alphabetical within groups.

### Barrel files

- Every folder has `index.ts` that re-exports
- Never import internal paths from external packages:
  ```typescript
  // ✅ Correct
  import { CrudService } from '@core/core/services';
  // ❌ Wrong — internal path
  import { CrudService } from '@core/core/src/services/CrudService';
  ```

### ESM — `.js` extension in relative imports

Required in Node.js ESM context (api-example, cli, packages):

```typescript
import { AppError } from '../errors.js';
import { createRepositories } from './lib/create-repositories.js';
```

In Next.js apps (webapp-example, docs), this is NOT required (bundler handles it).

---

## TypeScript Strictness

All packages use `@core/config/typescript/base.json` which enables:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true` — optional fields are `T | undefined`, never omitted
- `verbatimModuleSyntax: true` — forces `import type`
- `noImplicitOverride: true`
- `noPropertyAccessFromIndexSignature: true`

**`exactOptionalPropertyTypes` gotcha**: You cannot assign `undefined` to an optional field unless explicitly typed as `T | undefined`:

```typescript
// ✅
interface User {
  name?: string | undefined;
}
const u: User = { name: undefined }; // OK

// ❌ (exactOptionalPropertyTypes)
interface User {
  name?: string;
}
const u: User = { name: undefined }; // ERROR — can only be omitted, not set to undefined
```

---

## Service Patterns (`@core/core`)

### CrudService<T, TCreate, TUpdate>

Base class for all HTTP entity services:

```typescript
// File: packages/core/src/services/CrudService.ts
class CrudService<
  T extends { id: string | number },
  TCreate = Omit<T, 'id'>,
  TUpdate = Partial<TCreate>,
> extends HttpService {
  async getAll(): Promise<T[]>;
  async getById(id: T['id']): Promise<T>;
  async create(data: TCreate): Promise<T>;
  async update(id: T['id'], data: TUpdate): Promise<T>;
  async remove(id: T['id']): Promise<void>;
  async filter(params: FilterParams): Promise<PaginatedResponse<T>>;
}
```

**Never reimplent CRUD.** Always use or extend `CrudService`.

### ServiceExtender — custom methods without inheritance

```typescript
// Type: packages/core/src/services/types.ts
type ServiceExtender<T, TCreate, TUpdate, E extends object> = (
  http: HttpHelpers,
  basePath: string
) => E;

// Usage: internal/webapp-example/src/services/extensions/user.extensions.ts
export function createUserExtensions(http: HttpHelpers, basePath: string): UserExtensions {
  return {
    batchCreate: (data) => http.post(`${basePath}/batch`, data),
    assignRole: (userId, data) => http.post(`${basePath}/${userId}/assign-role`, data),
  };
}
```

**Rule**: extensions use `type`, not `interface`, because `createService()` requires `E extends Record<string, unknown>` and interfaces don't implicitly satisfy index signatures.

### createCoreServices — composition root

```typescript
// packages/core/src/services/createCoreServices.ts
const core = createCoreServices({
  auth: { type: 'oauth', config: { url, clientId, clientSecret } },
  // OR: { type: 'api', config: { loginUrl, refreshUrl, credentials: { email, password } } }
  // OR: { type: 'custom', strategy: myAuthStrategy }
  baseUrl: 'https://api.example.com',
  timeout: 30000, // optional, default 30s
  storage: localStorage, // optional, default: in-memory
});

// core exposes:
core.tokenProvider; // ITokenProvider
core.httpClient; // AxiosInstance
core.createService; // <T, TCreate, TUpdate, E>(path, extend?) => CrudService<T> & E
```

### createService — factory for typed services

```typescript
// No extensions (pure CRUD):
const usersService = core.createService<User>('/users');

// With extensions (CRUD + custom methods):
const usersService = core.createService<User, UserCreate, UserUpdate, UserExtensions>(
  '/users',
  createUserExtensions
);
// usersService has: getAll, getById, create, update, remove, filter
//                 + batchCreate, batchDelete, assignRole, assignPerson
```

### Object.assign mixin (no class inheritance)

Internally, `createService` uses `Object.assign(base, extend(httpHelpers, path))`.
This is a mixin pattern — the result is typed as `CrudService<T> & E`.

---

## HTTP Client Patterns

### createHttpClient

```typescript
// packages/core/src/http/createHttpClient.ts
const http = createHttpClient({
  baseUrl: 'https://api.example.com',
  tokenProvider, // ITokenProvider
  timeout, // optional
  headers, // optional
});
```

Interceptors applied in order:

1. **Request**: `authInterceptor` — injects `Authorization: Bearer {token}`
2. **Response (success)**: envelope unwrapper — if `{ success: true, data: ... }` shape detected, unwraps to `data`
3. **Response (error)**: `errorInterceptor` — on 401: refresh + retry; all HTTP errors → `ServiceError`

### HttpService — base class

```typescript
// packages/core/src/http/HttpService.ts
class HttpService {
  constructor(protected http: AxiosInstance, protected baseUrl: string)
  protected get<T>(path, params?, config?): Promise<T>
  protected post<T>(path, data?, config?): Promise<T>
  protected put<T>(path, data?, config?): Promise<T>
  protected patch<T>(path, data?, config?): Promise<T>
  protected delete<T>(path, config?): Promise<T>
  protected postForm<T>(path, formData, config?): Promise<T>
  protected getBlob(path, config?): Promise<Blob>
}
```

---

## Auth Patterns

### Token class — ITokenProvider implementation

```typescript
// packages/core/src/auth/Token.ts
class Token implements ITokenProvider {
  getAccessToken(): Promise<string | null>; // checks cache → refresh → requestNew
  refreshToken(): Promise<string | null>; // single-flight dedup
  isExpired(): boolean; // 30s buffer before actual expiry
  clear(): void;
}
```

**Single-flight**: concurrent `refreshToken()` calls deduplicate via `this.refreshPromise`.
**30-second buffer**: `isExpired()` returns true 30s before actual token expiry to avoid race conditions.

### AuthStrategy types

| Type              | Use case                                                 |
| ----------------- | -------------------------------------------------------- |
| `OAuthStrategy`   | `client_credentials` + `refresh_token` (OAuth2 standard) |
| `ApiAuthStrategy` | POST `/login` + POST `/refresh` (simple API auth)        |
| `custom`          | Pass any `AuthStrategy` implementation                   |

For interactive/OTP login flows, do NOT use these strategies — they assume embedded credentials. Use a `tokenHolder` pattern instead (see #414 in Engram).

---

## Error Patterns

### @internal/api-example errors

```typescript
// src/errors.ts
AppError(statusCode, code, message, details?)
├── NotFoundError(resource, id)        → 404 NOT_FOUND
├── ConflictError(resource, field, val) → 409 CONFLICT
├── ValidationError(message, details?) → 400 VALIDATION_ERROR
├── UnauthorizedError(message?)         → 401 UNAUTHORIZED
├── ForbiddenError(message?)            → 403 FORBIDDEN
└── InternalError(message?)             → 500 INTERNAL_ERROR
```

Services throw `AppError` subtypes. Never catch internally. The `errorHandler` middleware converts to `{ success: false, error: { code, message, details? } }`.

### @core/core errors

```typescript
// packages/core/src/errors/ServiceError.ts
ServiceError(message, status, code, endpoint, originalError?)
// Getters: isClientError, isServerError, isNetworkError, isTimeoutError
//          isUnauthorized, isForbidden, isNotFound, isConflict, isUnprocessable
ServiceError.fromAxiosError(axiosError)  // factory
```

Services in webapp/core NEVER catch internally. Consumers (React Query, hooks, error boundaries) catch `ServiceError`.

---

## Repository Pattern (@internal/api-example)

```typescript
// Repository interface
interface Repository<T extends { id: string }, TCreate, TUpdate> {
  findAll(): Promise<T[]>
  findById(id: string): Promise<T | null>
  create(data: TCreate): Promise<T>
  update(id: string, data: TUpdate): Promise<T | null>
  remove(id: string): Promise<boolean>
  filter(params: FilterParams): Promise<PaginatedResponse<T>>
}

// Three implementations per entity:
UserInMemoryRepository  // default: DATA_SOURCE=memory
UserFileRepository      // DATA_SOURCE=file (JSON files in DATA_DIR)
UserPrismaRepository    // DATA_SOURCE=prisma (PostgreSQL)

// Factory selects implementation:
createRepositories(config, prisma?) → { users, roles, parties }
```

---

## Webapp Patterns

### Composition Root (lib/services.ts)

```typescript
// internal/webapp-example/src/lib/services.ts
const coreServices = createCoreServices({
  auth: { type: 'custom', strategy: noopAuthStrategy },
  baseUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3005/api',
});

export const { store, useServices, useServicesStore } = createServicesStore();
export { coreServices };
```

**noopAuthStrategy**: Used when the API doesn't require authentication. Replace with `OAuthStrategy` or `ApiAuthStrategy` when adding real auth.

### Domain Services Registry (services/domain-services.ts)

```typescript
let _services: DomainServices | null = null;

export function getDomainServices(): DomainServices {
  if (!_services) {
    const { createService } = coreServices;
    _services = {
      users: createService<User, UserCreate, UserUpdate, UserExtensions>(
        '/users',
        createUserExtensions
      ),
      parties: createService<Party, PartyCreate, PartyUpdate>('/parties'),
      roles: createService<Role, RoleCreate, RoleUpdate>('/roles'),
    };
  }
  return _services;
}
```

Singleton pattern with `resetDomainServices()` for testing or auth context changes.

### ServicesProvider — module-level guard

```typescript
// src/providers/ServicesProvider.tsx
let initialized = false;  // MODULE-level — survives React Strict Mode remounts

function ensureInitialized() {
  if (!initialized) {
    store.getState().initialize(coreServices);
    initialized = true;
  }
}

export function ServicesProvider({ children }) {
  const [ready, setReady] = useState(initialized);
  useEffect(() => { ensureInitialized(); setReady(true); }, []);
  if (!ready) return null;  // NOT a spinner — just null
  return <>{children}</>;
}
```

**Gotcha**: Returns `null` (not a spinner) until initialized. This is intentional to avoid flash of unauthenticated content.

### useCrudPage — generic CRUD page hook

```typescript
// src/shared/hooks/use-crud-page.ts
const { state, actions, operations } = useCrudPage(
  { service: myService, pageSize: 5, searchDebounce: 300 },
  emptyFormData
);

// state: items, total, page, totalPages, search, loading, error,
//        createOpen, editOpen, deleteOpen, selectedItem, formData, mutating
// actions: setSearch, setPage, previousPage, nextPage, openCreate, openEdit,
//          openDelete, closeDialogs, setFormData, refresh, clearError
// operations: create, update, remove
```

### Feature structure (Screaming Architecture)

```
features/{feature}/
├── index.ts                # Barrel — re-exports page + public types
├── page.tsx                # Feature page component
├── {feature}.types.ts      # TypeScript types for this feature
├── {feature}.constants.ts  # Constants (empty form data, column defs, etc.)
├── hooks/
│   ├── index.ts
│   └── use-{feature}.ts    # Wraps useCrudPage with feature-specific config
└── components/
    ├── index.ts
    ├── {feature}-table.tsx
    ├── {feature}-form.tsx
    └── {feature}-form-dialog.tsx
```

App Router pages are thin wrappers:

```typescript
// src/app/users/page.tsx
export { UsersPage as default } from '@/features/users';
```

---

## UI Component Patterns (@core/ui)

### CVA + forwardRef pattern (atoms only)

```typescript
// Only in @core/ui atoms — NOT in app-level components
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@core/ui/lib';

const buttonVariants = cva('base-classes', {
  variants: {
    variant: { default: '...', outline: '...', ghost: '...' },
    size: { default: '...', sm: '...', lg: '...' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
```

**Always export**: the component, the `variants` function, and the props type.

### cn() utility

```typescript
// @core/ui/lib
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Theming Patterns

### Dual theming (orthogonal)

| Dimension       | Provider                               | Storage                               | DOM class                  |
| --------------- | -------------------------------------- | ------------------------------------- | -------------------------- |
| Dark/Light mode | `next-themes` (NextThemesProvider)     | `localStorage` under `theme` key      | `dark` on `<html>`         |
| Color theme     | `ColorThemeContext` (in ThemeProvider) | `localStorage` under configurable key | `theme-{name}` on `<html>` |

Both dimensions are completely **orthogonal** — changing dark mode doesn't affect color theme and vice versa.

```tsx
// Usage
import { ThemeProvider } from '@core/shared/providers';
import { useColorTheme } from '@core/shared';

<ThemeProvider defaultTheme="system" defaultColorTheme="ambar">
  {children}
</ThemeProvider>;

// In a component
const { colorTheme, setColorTheme } = useColorTheme();
```

### Theme strategies (from @core/config)

For webapps, choose a strategy in `globals.css`:

```css
/* Option 1: DS tokens (default) */
@import 'tailwindcss';
@import '@core/config/styles/globals.css';

/* Option 2: Fixed shadcn theme */
@import 'tailwindcss';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/blue.css';

/* Option 3: Dynamic theme switching */
@import 'tailwindcss';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/all.css';
/* then add class="theme-blue" on <html> */
```

---

## API Route Patterns (@internal/api-example)

### createRoute + openapi (required for all routes)

```typescript
// src/routes/users/users.routes.ts
export function createUserRoutes(userService: UserService) {
  const routes = new OpenAPIHono();

  const getUser = createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Users'],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: { content: { 'application/json': { schema: UserResponseSchema } }, description: 'OK' },
      404: {
        content: { 'application/json': { schema: ErrorResponseSchema } },
        description: 'Not found',
      },
    },
  });

  routes.openapi(getUser, async (c) => {
    const { id } = c.req.valid('param');
    const user = await userService.findById(id); // throws NotFoundError if missing
    return c.json({ success: true, data: user }, 200);
  });

  return routes;
}
```

**Mandatory**: every route must define both request AND response schemas via `createRoute()`. Never use `app.get()` directly (loses OpenAPI documentation).

### Separate schemas file

```typescript
// src/routes/users/users.schemas.ts
export const UserSchema = z.object({ id, email, name, partyId, ... });
export const UserResponseSchema = z.object({ success: z.literal(true), data: UserSchema });
export const UsersListResponseSchema = z.object({ success: z.literal(true), data: z.object({ data: z.array(UserSchema), total, page, pageSize }) });
export const ErrorResponseSchema = z.object({ success: z.literal(false), error: z.object({ code, message, details: z.unknown().optional() }) });
```

---

## Mock Adapter Pattern

```typescript
// @core/core/mocks
const adapter = createMockAdapter([
  {
    method: 'GET',
    urlPattern: '/users/:id',
    handler: (req) => ({
      status: 200,
      data: { id: req.pathParams.id, name: 'Alice' },
    }),
  },
]);

// Inject into httpClient:
httpClient.defaults.adapter = adapter;
```

**Limitation**: Axios adapter-level — does NOT intercept HTTP headers (Authorization, Cookie, Idempotency-Key). For header-aware testing (auth flows, cookie-based refresh tokens), use MSW instead.

**Rule**: `createMockAdapter` is for unit-testing services in isolation. Production apps that need cookie/header interception should use MSW.

---

## Test Co-location Pattern

Tests live next to their source files:

```
src/services/
├── CrudService.ts
├── CrudService.test.ts      ← co-located
├── createCoreServices.ts
└── createCoreServices.test.ts  ← co-located
```

The `src/__tests__/` directory exists in `@core/core` but is not the preferred pattern for new tests.

---

## @core/config Design Token Pipeline

```
tokens/primitives/**/*.tokens.json    ← color scales, spacing, typography
tokens/semantic/light.tokens.json     ← semantic mappings for light mode
tokens/semantic/dark.tokens.json      ← semantic mappings for dark mode
      ↓ (style-dictionary build.js)
styles/generated/primitives.css       ← :root { --color-zinc-500: ...; }
styles/generated/semantic-light.css   ← :root { --background: ...; }
styles/generated/semantic-dark.css    ← .dark { --background: ...; }
      ↓ (imported by)
styles/globals.css                    ← base styles consumed by all apps
```

Tokens are rebuilt via `pnpm tokens:build` (runs `build.js` using Style Dictionary 4.x).
Apps consume via `@import "@core/config/styles/globals.css"` in their `globals.css`.

---

## Zod Version Split

The monorepo has a Zod version inconsistency:

| Package                 | Zod version | Usage                            |
| ----------------------- | ----------- | -------------------------------- |
| `@internal/api-example` | `^3.24.1`   | Route schemas, config validation |
| `@core/ui` (devDep)     | `^4.3.6`    | Form organism (dev only)         |

**Rule**: Production application code (APIs, webapps) should use Zod v3 (`^3.x`). `@core/ui` uses Zod v4 only as a devDependency for the form organism component. Do NOT import Zod directly from `@core/ui` — it is a devDep only.
