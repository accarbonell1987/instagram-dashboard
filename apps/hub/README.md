# Corehub HUB

Portal centralizado de aplicaciones empresariales con Single Sign-On.

## Stack Tecnológico

- **Framework:** Next.js 15.5 con App Router
- **Lenguaje:** TypeScript 5
- **Estilos:** TailwindCSS 4 + Carbon Design System
- **Autenticación:** Keycloak SSO
- **Componentes:** Radix UI / @core/ui

## Requisitos

- Node.js 20+
- pnpm 9+
- Keycloak server configurado

## Instalación

```bash
# Clonar repositorio (monorepo)
git clone <monorepo-url>
cd front-corehub-core/apps/hub

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores
```

## Configuración

Editar `.env.local` con los valores de tu entorno:

```env
NEXT_PUBLIC_KEYCLOAK_URL=https://tu-servidor-keycloak.com
NEXT_PUBLIC_KEYCLOAK_REALM=TU_REALM
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=hub-app
```

## Desarrollo

```bash
pnpm dev
```

Abrir [http://localhost:3001](http://localhost:3001)

## Estructura del Proyecto

```
apps/hub/
├── src/
│   ├── app/              # App Router (páginas y layouts)
│   ├── components/       # Componentes React
│   ├── contexts/         # Contextos de React (Auth)
│   ├── lib/              # Utilidades y configuración
│   └── providers/        # Providers
├── public/               # Assets estáticos
└── ...config files
```

## Aplicaciones Integradas

El hub provee acceso a las siguientes aplicaciones:

1. Buscador de Clientes
2. Facturación Electrónica
3. Recursos Humanos
4. Reportes Gerenciales
5. Control de Inventario
6. Configuración
7. Solicitud de Vacaciones

El acceso a cada aplicación se controla mediante roles de Keycloak.

## Scripts Disponibles

| Comando      | Descripción            |
| ------------ | ---------------------- |
| `pnpm dev`   | Servidor de desarrollo |
| `pnpm build` | Build de producción    |
| `pnpm start` | Iniciar en producción  |
| `pnpm lint`  | Ejecutar ESLint        |
