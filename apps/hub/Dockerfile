# =============================================================================
# Corehub HUB - Dockerfile Multi-stage
# Build optimizado para Next.js 15 con standalone output
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
# TODO: This Dockerfile assumes a standalone app build context.
# After monorepo migration, update to:
# 1. Set Docker build context to the monorepo root
# 2. Use `turbo prune --scope=@corehub/hub --docker` to create a pruned workspace
# 3. Copy pnpm-workspace.yaml and pnpm-lock.yaml from the pruned output (not from this app dir)
# See: https://turbo.build/repo/docs/guides/tools/docker
FROM node:22-alpine AS deps
WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Instalar dependencias (solo producción + dev para build)
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar dependencias del stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments para variables de entorno en build time
ARG NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_KEYCLOAK_REALM
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ARG NEXT_PUBLIC_APP_VACACIONES_URL

# Build de producción
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runner (Producción)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar archivos necesarios del build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
