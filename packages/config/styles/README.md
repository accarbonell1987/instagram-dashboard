# Design System Styles & Theming

Sistema de estilos basado en **CSS Variables** y **Tailwind CSS v4** que proporciona una base consistente para todas las aplicaciones del monorepo.

> **Documentacion Completa**
> Esta es la guia tecnica del paquete. Para documentacion completa:
>
> - **[Design System](../../../internal/docs/src/content/design-system.md)** - Variables CSS y tokens base
> - **[Guia de Theming](../../../internal/docs/src/content/theming-guide.md)** - Como crear temas personalizados
> - **[Tokens y Theming](../../../internal/docs/src/content/tokens-y-theming.md)** - Arquitectura detallada
>
> **En el sitio de docs:** Ejecuta `pnpm dev --filter docs` y visita `http://localhost:3001/docs`

---

## Quick Start

### Orden de Imports (CRITICO para Tailwind v4)

```css
/* apps/my-app/src/app/globals.css */

/* 1. Tailwind CSS v4 base */
@import 'tailwindcss';

/* 2. Tailwind theme mappings (CSS vars -> utilities) */
@import '@core/config/styles/tailwind-theme.css';

/* 3. Base design system (semantic tokens) */
@import '@core/config/styles/globals.css';

/* 4. All themes (optional - for theme switching) */
@import '@core/config/styles/themes.css';

/* 5. App-specific overrides (optional) */
@import '../styles/theme.css';
```

### Setup Minimo (sin themes)

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
```

### Con un Tema Especifico

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/blue.css';
```

### Con Theme Switcher

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes.css'; /* Todos los temas */
```

---

## Estructura del Paquete

```
packages/config/styles/
├── tailwind-theme.css      # CRITICO: Mapea CSS vars -> Tailwind utilities
├── globals.css             # Tokens semanticos base (:root, .dark)
├── tokens.ts               # API TypeScript para tokens
├── theme-config.ts         # Tipos para configuracion de temas
├── index.ts                # Exports principales
├── generated/              # CSS generado por Style Dictionary
│   ├── primitives.css
│   ├── semantic-light.css
│   └── semantic-dark.css
└── themes/
    ├── registry.ts         # Registro central de temas
    ├── all.css             # Importa todos los temas
    ├── shadcn/             # 12 temas oficiales shadcn/ui
    │   ├── index.css
    │   ├── zinc.css
    │   ├── slate.css
    │   ├── stone.css
    │   ├── gray.css
    │   ├── neutral.css
    │   ├── red.css
    │   ├── rose.css
    │   ├── orange.css
    │   ├── green.css
    │   ├── blue.css
    │   ├── yellow.css
    │   └── violet.css
    └── custom/             # Temas personalizados
        ├── index.css
        └── ambar.css
```

---

## Por Que `tailwind-theme.css` Es Critico

**Tailwind CSS v4** ya no usa `tailwind.config.ts` para definir colores. Requiere `@theme inline` para mapear CSS variables a utilities.

**Sin este archivo, `bg-primary`, `text-foreground`, etc. NO funcionaran.**

```css
/* tailwind-theme.css */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... */
}

@custom-variant dark (&:is(.dark *));
```

---

## Temas Disponibles

### shadcn/ui Themes (12)

| Tema    | Categoria | Archivo                     |
| ------- | --------- | --------------------------- |
| zinc    | Neutral   | `themes/shadcn/zinc.css`    |
| slate   | Neutral   | `themes/shadcn/slate.css`   |
| stone   | Warm      | `themes/shadcn/stone.css`   |
| gray    | Neutral   | `themes/shadcn/gray.css`    |
| neutral | Neutral   | `themes/shadcn/neutral.css` |
| red     | Vibrant   | `themes/shadcn/red.css`     |
| rose    | Vibrant   | `themes/shadcn/rose.css`    |
| orange  | Warm      | `themes/shadcn/orange.css`  |
| green   | Cool      | `themes/shadcn/green.css`   |
| blue    | Cool      | `themes/shadcn/blue.css`    |
| yellow  | Warm      | `themes/shadcn/yellow.css`  |
| violet  | Vibrant   | `themes/shadcn/violet.css`  |

### Custom Themes

| Tema  | Descripcion                        | Archivo                   |
| ----- | ---------------------------------- | ------------------------- |
| ambar | Tema calido ambar/dorado (default) | `themes/custom/ambar.css` |

---

## Theme Registry (TypeScript)

```typescript
import {
  getTheme,
  getAllThemes,
  getThemesBySource,
  getThemesByCategory,
  themeRegistry,
} from '@core/config/styles/themes/registry';

// Obtener un tema
const ambar = getTheme('ambar');

// Listar todos los temas
const allThemes = getAllThemes();

// Filtrar por fuente
const shadcnThemes = getThemesBySource('shadcn');
const customThemes = getThemesBySource('custom');

// Filtrar por categoria
const warmThemes = getThemesByCategory('warm');
```

---

## API TypeScript

### Token Utilities

```typescript
import { hslVar, cssVar } from '@core/config/styles/tokens';

const styles = {
  backgroundColor: hslVar('primary'), // "hsl(var(--primary))"
  padding: cssVar('spacing-4'), // "var(--spacing-4)"
};
```

### Theme Config

```typescript
import { createThemeTokens, getThemeColor } from '@core/config/styles';

const theme = createThemeTokens({
  name: 'Mi Tema',
  colors: {
    primary: {
      light: 'hsl(271, 91%, 65%)',
      dark: 'hsl(271, 91%, 75%)',
    },
  },
  fonts: { sans: 'Inter' },
  radius: '0.5rem',
});

// Obtener color
const primaryLight = getThemeColor(theme, 'primary', 'light');
```

---

## Crear un Tema Nuevo

### 1. Crear archivo CSS

```css
/* themes/custom/mi-tema.css */

.theme-mi-tema {
  --primary: 271 91% 65%;
  --primary-foreground: 0 0% 100%;
  /* ... resto de variables ... */
}

/* Dark mode - AMBOS selectores necesarios */
.theme-mi-tema.dark,
.dark .theme-mi-tema {
  --primary: 271 91% 75%;
  /* ... */
}
```

### 2. Importar en index

```css
/* themes/custom/index.css */
@import './ambar.css';
@import './mi-tema.css';
```

### 3. Registrar en TypeScript

```typescript
/* themes/registry.ts */
export const customThemes: ThemeDefinition[] = [
  { name: 'ambar', label: 'Ambar', source: 'custom', category: 'warm' },
  { name: 'mi-tema', label: 'Mi Tema', source: 'custom', category: 'vibrant' },
];
```

---

## Dark Mode

Los temas deben soportar dark mode con **dos selectores CSS**:

```css
/* Selector 1: Clases en el mismo elemento */
.theme-ambar.dark { ... }

/* Selector 2: Clases anidadas */
.dark .theme-ambar { ... }
```

**Por que dos selectores?**

- `next-themes` pone ambas clases en `<html>`: `class="theme-ambar dark"`
- El primer selector cubre este caso
- El segundo es fallback para estructuras anidadas

---

## Comandos

```bash
# Regenerar CSS desde tokens
pnpm --filter @core/config tokens:build

# Build completo
pnpm build

# Ver cambios en tiempo real
pnpm dev --filter example-creative
```

---

## Migracion desde Tailwind v3

| Aspecto   | Tailwind v3           | Tailwind v4                    |
| --------- | --------------------- | ------------------------------ |
| Config    | `tailwind.config.ts`  | `@theme` en CSS                |
| Colors    | `theme.extend.colors` | `@theme inline { --color-*: }` |
| Dark mode | `darkMode: 'class'`   | `@custom-variant dark`         |
| CSS vars  | Automatico con plugin | Requiere `@theme inline`       |

---

## Enlaces Utiles

- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [HSL Color Picker](https://hslpicker.com/)

---

**Ultima actualizacion:** 30 de enero de 2026
