---
title: Design System
description: Sistema de diseno basado en CSS Variables y Tailwind CSS v4
order: 1
date: 2026-02-01
readTime: 10 min
category: Fundamentos
---

# Design System

Sistema de diseno basado en **CSS Variables** y **Tailwind CSS v4** como base compartida para todas las aplicaciones del monorepo.

> **Para personalizacion de temas:**
> Consulta la **[Guia de Theming](./theming-guide)** para crear temas personalizados.

---

## Arquitectura

El Design System tiene **4 capas** que trabajan juntas:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DEL DESIGN SYSTEM               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. TOKENS      │ --> │  2. TAILWIND    │ --> │  3. THEMES      │
│  CSS Variables  │     │  @theme inline  │     │  .theme-* class │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     :root                 --color-*              .theme-ambar
   --primary             hsl(var(--*))           --primary: ...
                                                        │
                                                        v
                                            ┌─────────────────┐
                                            │ 4. RADIUS-CALC  │
                                            │ Calcula radius  │
                                            └─────────────────┘
                                              --radius-sm/md/lg
```

### 1. Tokens Semanticos (`globals.css`)

Define las CSS variables base en `:root` y `.dark`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --radius: 0.5rem;
  /* ... */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
}
```

### 2. Tailwind Mapping (`tailwind-theme.css`)

Mapea CSS variables a Tailwind utilities usando `@theme inline`:

```css
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  /* Border Radius con fallbacks */
  --radius-sm: var(--radius-sm, 0.25rem);
  --radius-md: var(--radius-md, 0.375rem);
  --radius-lg: var(--radius-lg, 0.5rem);
  --radius-xl: var(--radius-xl, 0.75rem);
}

/* Dark mode variant para Tailwind v4 */
@custom-variant dark (&:is(.dark *));
```

**Esto permite usar clases como:**
- `bg-primary` -> `background-color: hsl(var(--primary))`
- `text-foreground` -> `color: hsl(var(--foreground))`
- `rounded-md` -> `border-radius: var(--radius-md)`

### 3. Themes (`themes/*.css`)

Sobrescriben los tokens semanticos con clases `.theme-*`:

```css
.theme-ambar {
  --primary: 38 92% 50%;
  --primary-foreground: 0 0% 100%;
  --radius: 0.5rem;
}
```

### 4. Radius Calculations (`radius-calc.css`)

Calcula dinamicamente los valores de radius desde `--radius`:

```css
:root, [class*="theme-"] {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
}
```

---

## Inicio Rapido

### Importar los estilos base

En el `globals.css` de tu app:

```css
@import 'tailwindcss';

/* Content sources para Tailwind v4 */
@source "../../../../packages/ui/src/**/*.{ts,tsx}";

@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes.css';
@import '@core/config/styles/radius-calc.css';
```

Ya tienes acceso a todas las variables CSS del Design System.

### Usar los colores

**Con Tailwind (recomendado):**

```html
<div class="bg-background text-foreground border-border rounded-lg">
  <button class="bg-primary text-primary-foreground rounded-md">
    Accion Principal
  </button>
</div>
```

**Con CSS custom:**

```css
.mi-componente {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border-color: hsl(var(--border));
  border-radius: var(--radius-md);
}
```

---

## Variables CSS Disponibles

### Colores Semanticos

| Token | Uso | Ejemplo Tailwind |
|-------|-----|------------------|
| `--background` | Fondo principal | `bg-background` |
| `--foreground` | Texto principal | `text-foreground` |
| `--card` | Fondo de tarjetas | `bg-card` |
| `--card-foreground` | Texto en tarjetas | `text-card-foreground` |
| `--primary` | Color de accion principal | `bg-primary` |
| `--primary-foreground` | Texto sobre primary | `text-primary-foreground` |
| `--secondary` | Color secundario | `bg-secondary` |
| `--secondary-foreground` | Texto sobre secondary | `text-secondary-foreground` |
| `--muted` | Fondos sutiles | `bg-muted` |
| `--muted-foreground` | Texto secundario | `text-muted-foreground` |
| `--accent` | Acentos y hovers | `bg-accent` |
| `--accent-foreground` | Texto sobre accent | `text-accent-foreground` |
| `--destructive` | Acciones destructivas | `bg-destructive` |
| `--destructive-foreground` | Texto sobre destructive | `text-destructive-foreground` |
| `--border` | Bordes | `border-border` |
| `--input` | Bordes de inputs | `border-input` |
| `--ring` | Focus rings | `ring-ring` |

### Colores para Graficos

```css
--chart-1  /* Color 1 para graficos */
--chart-2  /* Color 2 para graficos */
--chart-3  /* Color 3 para graficos */
--chart-4  /* Color 4 para graficos */
--chart-5  /* Color 5 para graficos */
```

### Sidebar

```css
--sidebar-background
--sidebar-foreground
--sidebar-primary
--sidebar-primary-foreground
--sidebar-accent
--sidebar-accent-foreground
--sidebar-border
--sidebar-ring
```

### Border Radius

El sistema calcula automaticamente las variantes desde `--radius`:

| Tailwind Class | Valor Calculado |
|----------------|-----------------|
| `rounded-sm` | `calc(var(--radius) - 4px)` |
| `rounded-md` | `calc(var(--radius) - 2px)` |
| `rounded-lg` | `var(--radius)` |
| `rounded-xl` | `calc(var(--radius) + 4px)` |
| `rounded-2xl` | `calc(var(--radius) + 8px)` |
| `rounded-3xl` | `calc(var(--radius) + 12px)` |

**Ejemplo:** Si un tema define `--radius: 0.5rem` (8px):
- `rounded-sm` = 4px
- `rounded-md` = 6px
- `rounded-lg` = 8px
- `rounded-xl` = 12px

---

## Dark Mode

El dark mode funciona automaticamente con la clase `.dark`:

```html
<html class="dark theme-ambar">
  <!-- Todo usa colores dark automaticamente -->
</html>
```

No necesitas hacer nada especial. Las variables se actualizan solas.

**Uso con Tailwind:**

```html
<!-- Cambia segun el modo -->
<div class="bg-background dark:bg-background">

<!-- Estilos especificos para dark -->
<div class="bg-white dark:bg-slate-900">
```

---

## Estructura de Archivos

```
packages/config/
├── styles/
│   ├── tailwind-theme.css     # Mapeo CSS vars -> Tailwind (CRITICO)
│   ├── globals.css            # Tokens semanticos base
│   ├── radius-calc.css        # Calculo dinamico de radius (NUEVO)
│   ├── tokens.ts              # Tipos TypeScript
│   ├── index.ts               # Exports principales
│   ├── generated/             # CSS generado por Style Dictionary
│   │   ├── primitives.css
│   │   ├── semantic-light.css
│   │   └── semantic-dark.css
│   └── themes/
│       ├── registry.ts        # Registro de temas (TypeScript)
│       ├── all.css            # Todos los temas
│       ├── shadcn/            # 12 temas shadcn/ui
│       └── custom/            # Temas personalizados
└── tokens/                    # Fuente de verdad (JSON)
    ├── primitives/
    │   ├── colors.tokens.json
    │   ├── typography.tokens.json
    │   ├── spacing.tokens.json
    │   ├── radius.tokens.json    # Solo none, default, full
    │   └── ...
    ├── semantic/
    │   ├── light.tokens.json
    │   └── dark.tokens.json
    └── build.js               # Script de Style Dictionary
```

---

## Tailwind v4: Como Funciona

### El Archivo `tailwind-theme.css`

Este archivo es **critico** para Tailwind CSS v4. Sin el, las clases como `bg-primary` no funcionaran.

```css
/* packages/config/styles/tailwind-theme.css */

@theme inline {
  /* Core Semantic Colors */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... mas colores ... */

  /* Border Radius - con fallbacks para Tailwind */
  --radius-sm: var(--radius-sm, 0.25rem);
  --radius-md: var(--radius-md, 0.375rem);
  --radius-lg: var(--radius-lg, 0.5rem);
  --radius-xl: var(--radius-xl, 0.75rem);
  --radius-2xl: var(--radius-2xl, 1rem);
  --radius-3xl: var(--radius-3xl, 1.5rem);
}

/* Dark mode variant para Tailwind v4 */
@custom-variant dark (&:is(.dark *));
```

### El Archivo `radius-calc.css`

Calcula los valores de radius dinamicamente DESPUES de que los temas definen `--radius`:

```css
/* packages/config/styles/radius-calc.css */

:root, [class*="theme-"] {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
}
```

### Diferencias con Tailwind v3

| Aspecto | Tailwind v3 | Tailwind v4 |
|---------|-------------|-------------|
| Config | `tailwind.config.ts` | `@theme` en CSS |
| Colors | `theme.extend.colors` | `@theme inline { --color-*: }` |
| Dark mode | `darkMode: 'class'` | `@custom-variant dark` |
| CSS vars | Automatico con plugin | Requiere `@theme inline` |
| Content | `content: []` en config | `@source` en CSS |

---

## Personalizar Tokens

### Opcion 1: Override en tu app

Crea un `theme.css` en tu app:

```css
/* apps/mi-app/src/styles/theme.css */

/* Solo para ajustes especificos de la app */
/* NO sobrescribir --radius aqui si quieres que los temas lo controlen */
```

### Opcion 2: Usar un tema predefinido

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/blue.css';
@import '@core/config/styles/radius-calc.css';
```

### Opcion 3: Modificar los tokens JSON

Edita los archivos en `packages/config/tokens/`:

```
tokens/
├── primitives/
│   └── colors.tokens.json    # Paleta de colores
└── semantic/
    ├── light.tokens.json     # Tokens modo light
    └── dark.tokens.json      # Tokens modo dark
```

Luego regenera:

```bash
pnpm --filter @core/config tokens:build
```

---

## TypeScript

Importa tipos para autocompletado:

```typescript
import type {
  SemanticColorToken,
  SpacingToken,
  RadiusToken
} from '@core/config/styles/tokens';

// Helpers
import { hslVar, cssVar } from '@core/config/styles/tokens';

// Uso
const styles = {
  backgroundColor: hslVar('primary'),   // "hsl(var(--primary))"
  padding: cssVar('spacing-4'),          // "var(--spacing-4)"
};
```

---

## Comandos

```bash
# Regenerar CSS desde tokens
pnpm --filter @core/config tokens:build

# Build completo (incluye tokens)
pnpm build

# Ver cambios en tiempo real
pnpm dev --filter webapp-example
```

---

## Recursos

- **[Guia de Theming](./theming-guide)** - Personalizacion de temas
- **[UI Components](./ui-components)** - Componentes @core/ui
- **[Tokens y Theming](./tokens-y-theming)** - Arquitectura detallada
- **[Tailwind CSS v4](https://tailwindcss.com/docs)** - Documentacion oficial
- **[shadcn/ui](https://ui.shadcn.com)** - Componentes base

---

**Ultima actualizacion:** 1 de febrero de 2026
