# @core/database

Cliente Prisma ORM para PostgreSQL. Exporta un singleton de `PrismaClient` y los tipos generados del schema. Usado por `internal/api-example` cuando `DATA_SOURCE=prisma`.

---

## Módulos

```
@core/database         → PrismaClient singleton + tipos generados
@core/database/client  → PrismaClient directo (sin singleton)
```

---

## Uso

### En un repository Prisma

```ts
import { prisma } from '@core/database';
import type { PrismaClient } from '@core/database';

export class UserPrismaRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(): Promise<User[]> {
    const users = await this.db.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(mapToUser);
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.db.user.findUnique({ where: { id } });
    return user ? mapToUser(user) : null;
  }
}

// En el composition root (index.ts del API):
import { prisma } from '@core/database';
const userRepo = new UserPrismaRepository(prisma);
```

### Singleton — importante en desarrollo

El cliente exportado desde `@core/database` es un singleton que evita múltiples conexiones con HMR en desarrollo:

```ts
// packages/database/src/index.ts
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## Schema

El schema Prisma está en `packages/database/prisma/schema.prisma`.

**Modelos actuales**: `Party`, `User`, `Role`, `UserRole`

**Relaciones**:

- `Party` 1:1 `User`
- `User` n:m `Role` (tabla intermedia `UserRole`)

**Convenciones del schema**:

```prisma
model User {
  id        String   @id @default(cuid())  // siempre String + cuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("users")                           // tabla en snake_case
}
```

---

## Comandos

```bash
# Desde la raíz del monorepo
pnpm db:generate   # Regenera el cliente Prisma tras cambiar el schema
pnpm db:push       # Sincroniza el schema con la DB (dev, sin migration file)
pnpm db:studio     # Abre Prisma Studio UI para explorar datos

# Con migration file (para producción)
pnpm --filter @core/database exec prisma migrate dev --name <descripcion>
pnpm --filter @core/database exec prisma migrate deploy
```

---

## Variable de entorno requerida

```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

Solo necesaria si `DATA_SOURCE=prisma` en `internal/api-example`. En desarrollo con `DATA_SOURCE=memory` o `DATA_SOURCE=file`, este package no se usa.
