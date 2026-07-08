---
title: Webapp Architecture
description: Screaming Architecture pattern implemented in webapp-example
order: 8
date: 2026-03-16
readTime: 10 min
---

# Webapp Architecture

This guide documents the **Screaming Architecture** pattern implemented in `webapp-example`. The architecture makes the domain visible at the folder level — when you look at the folder structure, the application "screams" what it does.

## Architecture Overview

```
internal/webapp-example/src/
├── app/                      # Next.js App Router (thin wrappers)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── users/page.tsx        # Re-exports @/features/users
│   ├── parties/page.tsx      # Re-exports @/features/parties
│   └── roles/page.tsx        # Re-exports @/features/roles
│
├── features/                 # 🎯 Domain features (Screaming Architecture)
│   ├── users/
│   │   ├── index.ts          # Barrel file with public exports
│   │   ├── page.tsx          # Feature page component
│   │   ├── users.types.ts    # User-specific types and transformers
│   │   ├── users.constants.ts # Feature constants (PAGE_SIZE, EMPTY_FORM)
│   │   ├── hooks/
│   │   │   ├── index.ts
│   │   │   └── use-users.ts  # Feature-specific hook wrapping useCrudPage
│   │   └── components/
│   │       ├── index.ts
│   │       ├── users-table.tsx
│   │       ├── user-form.tsx
│   │       └── user-form-dialog.tsx
│   ├── parties/              # Same structure
│   └── roles/                # Same structure
│
├── shared/                   # 🔧 Reusable hooks and components
│   ├── index.ts
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── use-crud-page.ts  # Generic CRUD state management
│   │   └── use-debounced-value.ts
│   └── components/
│       ├── index.ts
│       ├── crud-page-layout.tsx
│       ├── data-table.tsx
│       ├── pagination.tsx
│       ├── search-input.tsx
│       └── delete-confirmation-dialog.tsx
│
├── lib/                      # Core infrastructure
│   └── services.ts           # Composition root (coreServices)
│
├── services/                 # Domain services layer
│   ├── index.ts              # Barrel exports
│   ├── types.ts              # DomainServices interface
│   ├── domain-services.ts    # Service registry (singleton)
│   └── extensions/           # Custom methods beyond CRUD
│       └── index.ts          # Extensions barrel
│
├── hooks/
│   └── useDomainServices.ts  # Hook to access domain services
│
├── types/
│   └── entities.ts           # Entity types (User, Party, Role)
│
└── providers/                # React context providers
```

## Key Concepts

### 1. Screaming Architecture

The `features/` folder is organized by **domain concept**, not by technical concern:

```
features/
├── users/         # Everything about users
├── parties/       # Everything about parties
└── roles/         # Everything about roles
```

Each feature module is self-contained with its own:

- **Types** (`users.types.ts`) — Entity types, form types, transformers
- **Constants** (`users.constants.ts`) — Feature-specific constants
- **Hooks** (`hooks/`) — State management for the feature
- **Components** (`components/`) — UI components for the feature
- **Page** (`page.tsx`) — Main feature page component

### 2. Thin App Router Pages

App Router pages are **thin wrappers** that delegate to feature modules:

```tsx
// src/app/users/page.tsx
export { UsersPage as default } from '@/features/users';
```

This keeps routing separate from business logic and makes features testable in isolation.

### 3. Shared Components & Hooks

The `shared/` folder contains **reusable, generic** utilities:

| Component/Hook             | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `useCrudPage`              | Generic CRUD state management with pagination, search, dialogs   |
| `useDebouncedValue`        | Debounce hook for search inputs                                  |
| `CrudPageLayout`           | Consistent page structure with header, search, table, pagination |
| `DataTable`                | Generic table with loading and empty states                      |
| `Pagination`               | Page navigation with previous/next buttons                       |
| `SearchInput`              | Accessible search input with debounce support                    |
| `DeleteConfirmationDialog` | Reusable delete confirmation modal                               |

---

## Domain Services Pattern

### Service Layer Structure

Services are organized in a **modular folder structure**:

```
src/services/
├── index.ts              # Public API (barrel)
├── types.ts              # DomainServices interface
├── domain-services.ts    # Orchestrator (creates/caches services)
└── extensions/           # Custom methods beyond CRUD
    ├── index.ts          # Extensions barrel
    └── user.extensions.ts # Example: User-specific methods
```

### Basic Service Registry

For standard CRUD services:

```typescript
// src/services/types.ts
export interface DomainServices {
  users: CrudService<User, UserCreate, UserUpdate>;
  parties: CrudService<Party, PartyCreate, PartyUpdate>;
  roles: CrudService<Role, RoleCreate, RoleUpdate>;
}

// src/services/domain-services.ts
export function getDomainServices(): DomainServices {
  if (!_services) {
    const { createService } = coreServices;
    _services = {
      users: createService<User, UserCreate, UserUpdate>('/users'),
      parties: createService<Party, PartyCreate, PartyUpdate>('/parties'),
      roles: createService<Role, RoleCreate, RoleUpdate>('/roles'),
    };
  }
  return _services;
}
```

### Extending Services with Custom Methods

When you need methods beyond CRUD (batch operations, assignments, etc.), use the **extension pattern**:

```typescript
// src/services/extensions/user.extensions.ts
import type { HttpHelpers } from '@core/core/services';

export type UserExtensions = {
  batchCreate: (data: BatchCreateUsersInput) => Promise<BatchCreateResult<User>>;
  assignRole: (userId: string, data: AssignRoleInput) => Promise<User>;
};

export function createUserExtensions(http: HttpHelpers, basePath: string): UserExtensions {
  return {
    batchCreate: async (data) => {
      const response = await http.post<{ success: true; data: BatchCreateResult<User> }>(
        `${basePath}/batch`,
        data
      );
      return response.data;
    },
    assignRole: async (userId, data) => {
      const response = await http.post<{ success: true; data: User }>(
        `${basePath}/${userId}/assign-role`,
        data
      );
      return response.data;
    },
  };
}
```

Then use it in the registry:

```typescript
// src/services/types.ts
type ExtendedUserService = CrudService<User, UserCreate, UserUpdate> & UserExtensions;

export interface DomainServices {
  users: ExtendedUserService; // Now includes custom methods
  // ...
}

// src/services/domain-services.ts
import { createUserExtensions, type UserExtensions } from './extensions';

_services = {
  users: createService<User, UserCreate, UserUpdate, UserExtensions>(
    '/users',
    createUserExtensions // Extension callback
  ),
  // ...
};
```

### Using Services in Components

Use the `useDomainServices` hook to access services:

```typescript
// In a feature hook
import { useDomainServices } from '@/hooks/useDomainServices';

export function useUsers() {
  const { users: usersService } = useDomainServices();

  // Standard CRUD via useCrudPage
  const crud = useCrudPage({ service: usersService, pageSize: 5 }, EMPTY_FORM);

  // Custom methods available directly
  const handleBatchCreate = async (users: UserCreate[]) => {
    return usersService.batchCreate({ users });
  };

  return { ...crud, handleBatchCreate };
}
```

### Entity Types

Entity types mirror the API schemas and are defined in `types/entities.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  name?: string | undefined;
  partyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreate {
  email: string;
  name?: string | undefined;
  partyId: string;
}

export type UserUpdate = Partial<UserCreate>;
```

---

## The `useCrudPage` Hook

This is the **core abstraction** for CRUD pages. It manages:

- Pagination state (page, pageSize, totalPages)
- Search with debounce
- Loading and error states
- Dialog states (create, edit, delete)
- Form data
- CRUD operations

### Usage

```typescript
const crud = useCrudPage<
  User, // Entity type
  UserFormData, // Form data type
  UserCreate, // Create input type
  UserUpdate // Update input type
>(
  {
    service: usersService,
    pageSize: 5,
    searchDebounce: 300,
  },
  EMPTY_FORM
);

// Returns
crud.state; // { items, total, page, loading, error, createOpen, ... }
crud.actions; // { setSearch, setPage, openCreate, openEdit, ... }
crud.operations; // { create, update, remove }
```

### Return Structure

```typescript
interface UseCrudPageReturn<T, TFormData, TCreate, TUpdate> {
  state: {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    search: string;
    loading: boolean;
    error: string | null;
    createOpen: boolean;
    editOpen: boolean;
    deleteOpen: boolean;
    selectedItem: T | null;
    formData: TFormData;
    mutating: boolean;
  };
  actions: {
    setSearch: (search: string) => void;
    setPage: (page: number) => void;
    previousPage: () => void;
    nextPage: () => void;
    openCreate: () => void;
    openEdit: (item: T, formData: TFormData) => void;
    openDelete: (item: T) => void;
    closeDialogs: () => void;
    setFormData: (data: TFormData) => void;
    refresh: () => Promise<void>;
    clearError: () => void;
  };
  operations: {
    create: (data: TCreate) => Promise<boolean>;
    update: (id: string, data: TUpdate) => Promise<boolean>;
    remove: (id: string) => Promise<boolean>;
  };
}
```

---

## Feature Module Structure

Each feature follows a consistent pattern:

### 1. Types File (`users.types.ts`)

```typescript
// Re-export entity types for convenience
export type { User, UserCreate, UserUpdate } from '@/types/entities';

// Feature-specific form type
export interface UserFormData {
  email: string;
  name: string;
  partyId: string;
}

// Transformers: Entity <-> Form
export function toUserFormData(user: User): UserFormData {
  return {
    email: user.email,
    name: user.name ?? '',
    partyId: user.partyId,
  };
}

export function toUserCreate(form: UserFormData): UserCreate {
  return {
    email: form.email,
    name: form.name || undefined,
    partyId: form.partyId,
  };
}
```

### 2. Constants File (`users.constants.ts`)

```typescript
export const PAGE_SIZE = 5;

export const EMPTY_FORM: UserFormData = {
  email: '',
  name: '',
  partyId: '',
};
```

### 3. Feature Hook (`hooks/use-users.ts`)

```typescript
export function useUsers() {
  const { users: usersService } = useDomainServices();

  const crud = useCrudPage<User, UserFormData, UserCreate, UserUpdate>(
    { service: usersService, pageSize: PAGE_SIZE },
    EMPTY_FORM
  );

  // Wrap operations with form transformers
  const handleCreate = async () => {
    const createData = toUserCreate(crud.state.formData);
    return crud.operations.create(createData);
  };

  return {
    ...crud,
    handlers: { create: handleCreate, update: handleUpdate, delete: handleDelete },
  };
}
```

### 4. Feature Page (`page.tsx`)

```tsx
export function UsersPage() {
  const { state, actions, handlers } = useUsers();

  return (
    <>
      <CrudPageLayout
        icon={<UsersIcon />}
        title="Users"
        onCreateClick={actions.openCreate}
        searchInput={<SearchInput value={state.search} onChange={actions.setSearch} />}
        pagination={<Pagination page={state.page} totalPages={state.totalPages} />}
      >
        <UsersTable users={state.items} onEdit={handlers.openEdit} />
      </CrudPageLayout>

      <UserFormDialog open={state.createOpen} onSubmit={handlers.create} />
      <DeleteConfirmationDialog open={state.deleteOpen} onConfirm={handlers.delete} />
    </>
  );
}
```

---

## API Integration

The webapp connects to the real API (no mocks in production):

### HttpService Configuration

The `HttpService` in `@core/core` includes an API envelope unwrapper:

```typescript
// Response from API: { success: true, data: T }
// HttpService returns: T (unwrapped)
```

This means components receive clean data without needing to unwrap the envelope.

### Filter Endpoint

Services use the `/filter` endpoint for paginated, searchable queries:

```typescript
// CrudService.filter() calls:
// POST /users/filter { page, pageSize, search }
```

---

## Adding a New Feature

1. **Create feature folder**:

   ```
   features/my-feature/
   ├── index.ts
   ├── page.tsx
   ├── my-feature.types.ts
   ├── my-feature.constants.ts
   ├── hooks/
   │   ├── index.ts
   │   └── use-my-feature.ts
   └── components/
       ├── index.ts
       └── ...
   ```

2. **Add entity type** in `types/entities.ts`

3. **Register service** in `services/domain-services.ts`:

   ```typescript
   _services = {
     ...existingServices,
     myFeature: createService<MyEntity, MyCreate, MyUpdate>('/my-feature'),
   };
   ```

   And update the interface in `services/types.ts`:

   ```typescript
   export interface DomainServices {
     // ...existing
     myFeature: CrudService<MyEntity, MyCreate, MyUpdate>;
   }
   ```

4. **Create thin page** in `app/my-feature/page.tsx`:
   ```typescript
   export { MyFeaturePage as default } from '@/features/my-feature';
   ```

---

## Component Usage Rules

When building UI, always check in this order:

### Hierarchy

| Level | Location                         | Purpose                           | Examples                                  |
| ----- | -------------------------------- | --------------------------------- | ----------------------------------------- |
| 1     | `@core/ui`                       | Primitives (atomic components)    | Button, Input, Table, Dialog, Card, Badge |
| 2     | `shared/components/`             | Compositions (combine primitives) | DataTable, SearchInput, CrudPageLayout    |
| 3     | `features/{feature}/components/` | Feature-specific only             | UsersTable, UserForm, RoleSelector        |

### Do's

- ✅ Import primitives from `@core/ui`
- ✅ Create compositions that combine multiple primitives
- ✅ Put feature-specific components in the feature folder

### Don'ts

- ❌ Never recreate a component that exists in @core/ui
- ❌ Don't put generic components in features/
- ❌ Don't import from @core/ui internal paths

### Example

```tsx
// ✅ Correct - use primitives from @core/ui
import { Button, Input, Table, TableBody, TableCell } from '@core/ui';

// ✅ Correct - use shared compositions
import { DataTable, SearchInput } from '@/shared/components';

// ✅ Correct - feature-specific component in feature folder
import { UsersTable } from './components/users-table';

// ❌ Wrong - recreating Button locally
const MyButton = ({ children }) => <button>{children}</button>;

// ❌ Wrong - importing from internal path
import { Button } from '@core/ui/src/components/atoms/button/button';
```

### Decision Flowchart

```
Need a UI component?
    │
    ├─> Does it exist in @core/ui? ─── YES ──> Use it
    │                                    │
    │                                   NO
    │                                    │
    ├─> Is it generic (usable in 2+ features)? ─── YES ──> Create in shared/components/
    │                                                 │
    │                                                NO
    │                                                 │
    └─────────────────────────────────────────────> Create in features/{feature}/components/
```

---

## Best Practices

1. **Features are self-contained** — All feature code lives in one folder
2. **Thin App Router pages** — Only re-export, no business logic
3. **Use shared components** — Don't duplicate common UI patterns
4. **Transformers handle conversion** — Keep form types separate from entity types
5. **Constants in dedicated file** — Easy to find and modify
6. **Barrel files everywhere** — Clean imports with `@/features/users`
