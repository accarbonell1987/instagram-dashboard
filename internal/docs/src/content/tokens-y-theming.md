---
title: Tokens y Theming - Arquitectura Completa
description: Analisis detallado del sistema de tokens, themes y Tailwind CSS v4
order: 3
date: 2026-01-30
readTime: 15 min
category: Fundamentos
---

# Tokens y Theming - Arquitectura Completa

Analisis detallado de como funciona el sistema de tokens y themes con Tailwind CSS v4.

---

## Arquitectura del Design System

El Design System tiene **4 capas** que trabajan juntas:

```
┌─────────────────────────────────────────────────────────────────┐
│                 FLUJO COMPLETO DE THEMING                       │
└─────────────────────────────────────────────────────────────────┘

   TOKENS JSON          STYLE DICTIONARY         CSS VARIABLES
   ─────────────────────────────────────────────────────────────
   colors.json    -->   build.js          -->   primitives.css
   light.json     -->                     -->   semantic-light.css
   dark.json      -->                     -->   semantic-dark.css

                        TAILWIND V4              TAILWIND UTILITIES
   ─────────────────────────────────────────────────────────────
   CSS Variables   -->   @theme inline     -->   bg-primary
   --primary       -->   --color-primary   -->   text-foreground
                                           -->   border-border

                        THEME REGISTRY           RUNTIME
   ─────────────────────────────────────────────────────────────
   registry.ts     -->   ThemeProvider     -->   <html class="theme-ambar">
   themes/*.css    -->                     -->   CSS Cascade Resolution
```

---

## Capa 1: Tokens Primitivos

Ubicacion: `packages/config/tokens/primitives/`

```
├── colors.tokens.json      # Paleta completa (zinc, slate, red, blue, etc.)
├── spacing.tokens.json     # Espaciado (0, 1, 2, 4, 8, etc.)
├── typography.tokens.json  # Tipografia (sans, serif, mono)
├── radius.tokens.json      # Border radius (sm, md, lg, xl)
├── shadows.tokens.json     # Sombras (sm, md, lg, etc.)
└── animations.tokens.json  # Animaciones (duracion, easing)
```

**Que generan:** Variables CSS primitivas como:
- `--color-zinc-500`
- `--spacing-md`
- `--font-size-base`

---

## Capa 2: Tokens Semanticos

Ubicacion: `packages/config/tokens/semantic/`

```
├── light.tokens.json       # Valores para light mode
└── dark.tokens.json        # Valores para dark mode
```

**Que generan:** Variables CSS semanticas en formato HSL (shadcn/ui):

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  /* ... */
}

.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  /* ... */
}
```

---

## Capa 3: Tailwind v4 Mapping (CRITICA)

Ubicacion: `packages/config/styles/tailwind-theme.css`

**Por que es critica?**

Tailwind CSS v4 ya no usa `tailwind.config.ts` para definir colores. Requiere `@theme inline` para mapear CSS variables a utilities.

**Sin este archivo, `bg-primary` y `text-foreground` NO funcionaran.**

```css
@theme inline {
  /* Core Semantic Colors */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  /* Component Colors */
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));

  /* Border & Input */
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  /* Sidebar */
  --color-sidebar: hsl(var(--sidebar-background));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));

  /* Charts */
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));

  /* Border Radius */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Dark mode variant for Tailwind v4 */
@custom-variant dark (&:is(.dark *));
```

---

## Capa 4: Theme Registry

Ubicacion: `packages/config/styles/themes/registry.ts`

Sistema centralizado para gestionar todos los temas disponibles:

```typescript
export interface ThemeDefinition {
  name: string;         // Identificador unico (ej: 'ambar')
  label: string;        // Nombre para UI (ej: 'Ambar')
  source: ThemeSource;  // 'shadcn' | 'custom'
  category: ThemeCategory;  // 'neutral' | 'warm' | 'cool' | 'vibrant'
  isDefault?: boolean;
}

// 12 temas shadcn/ui oficiales
export const shadcnThemes: ThemeDefinition[] = [
  { name: 'zinc', label: 'Zinc', source: 'shadcn', category: 'neutral' },
  { name: 'slate', label: 'Slate', source: 'shadcn', category: 'neutral' },
  { name: 'stone', label: 'Stone', source: 'shadcn', category: 'warm' },
  { name: 'gray', label: 'Gray', source: 'shadcn', category: 'neutral' },
  { name: 'neutral', label: 'Neutral', source: 'shadcn', category: 'neutral' },
  { name: 'red', label: 'Red', source: 'shadcn', category: 'vibrant' },
  { name: 'rose', label: 'Rose', source: 'shadcn', category: 'vibrant' },
  { name: 'orange', label: 'Orange', source: 'shadcn', category: 'warm' },
  { name: 'green', label: 'Green', source: 'shadcn', category: 'cool' },
  { name: 'blue', label: 'Blue', source: 'shadcn', category: 'cool' },
  { name: 'yellow', label: 'Yellow', source: 'shadcn', category: 'warm' },
  { name: 'violet', label: 'Violet', source: 'shadcn', category: 'vibrant' },
];

// Temas personalizados
export const customThemes: ThemeDefinition[] = [
  { name: 'ambar', label: 'Ambar', source: 'custom', category: 'warm', isDefault: true },
];

// API
export function getTheme(name: string): ThemeDefinition | undefined;
export function getAllThemes(): ThemeDefinition[];
export function getThemesBySource(source: ThemeSource): ThemeDefinition[];
export function getThemesByCategory(category: ThemeCategory): ThemeDefinition[];
```

---

## Proceso de Build

### Tokens -> CSS Variables

El script `packages/config/tokens/build.js` usa **Style Dictionary** para transformar tokens JSON en CSS:

```bash
cd packages/config
pnpm run build  # Ejecuta tokens:build
```

**Genera:**

1. `styles/generated/primitives.css` - Tokens primitivos
2. `styles/generated/semantic-light.css` - Tokens semanticos (light mode)
3. `styles/generated/semantic-dark.css` - Tokens semanticos (dark mode)

Estos archivos se importan automaticamente en `@core/config/styles/globals.css`.

---

## Como Usar el Design System

### Opcion A: Solo Base (sin themes)

Usa los tokens semanticos por defecto:

```css
/* src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
```

### Opcion B: Con un Theme Especifico

Aplica un theme de color predefinido:

```css
/* src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/violet.css';
```

### Opcion C: Multi-theme (con selector de theme)

Permite cambiar themes dinamicamente:

```css
/* src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes.css'; /* Todos los temas */
```

```tsx
// En tu componente
<html className="theme-ambar">  {/* o theme-blue, theme-violet, etc. */}
```

### Opcion D: Base + Overrides Personalizados

Combina un theme base con ajustes especificos:

```css
/* src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/violet.css'; /* Base */
@import '../styles/theme.css'; /* Tus overrides */
```

---

## Personalizacion por Theme CSS

### Crear un Theme Nuevo

```css
/* packages/config/styles/themes/custom/mi-tema.css */

/* Light mode */
.theme-mi-tema {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;

  --primary: 271 91% 65%;
  --primary-foreground: 0 0% 100%;

  --secondary: 189 94% 43%;
  --secondary-foreground: 0 0% 100%;

  --accent: 330 81% 60%;
  --accent-foreground: 0 0% 100%;

  --muted: 270 30% 95%;
  --muted-foreground: 270 10% 40%;

  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;

  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;

  --border: 270 20% 88%;
  --input: 270 20% 88%;
  --ring: 271 91% 65%;

  --radius: 0.75rem;

  /* Charts */
  --chart-1: 271 91% 65%;
  --chart-2: 189 94% 43%;
  --chart-3: 330 81% 60%;
  --chart-4: 45 93% 47%;
  --chart-5: 280 70% 50%;

  /* Sidebar */
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5% 26%;
  --sidebar-primary: 271 91% 65%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 5% 96%;
  --sidebar-accent-foreground: 240 6% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: 271 91% 65%;
}

/* Dark mode - AMBOS selectores son necesarios */
.theme-mi-tema.dark,
.dark .theme-mi-tema {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;

  --primary: 271 91% 75%;
  --primary-foreground: 0 0% 100%;

  --secondary: 189 94% 55%;
  --secondary-foreground: 0 0% 100%;

  --accent: 330 81% 70%;
  --accent-foreground: 0 0% 100%;

  --muted: 270 20% 20%;
  --muted-foreground: 270 10% 60%;

  --card: 222 47% 11%;
  --card-foreground: 210 40% 98%;

  --popover: 222 47% 11%;
  --popover-foreground: 210 40% 98%;

  --border: 270 20% 25%;
  --input: 270 20% 25%;
  --ring: 271 91% 75%;

  /* Charts dark */
  --chart-1: 271 91% 75%;
  --chart-2: 189 94% 55%;
  --chart-3: 330 81% 70%;
  --chart-4: 45 93% 57%;
  --chart-5: 280 70% 60%;

  /* Sidebar dark */
  --sidebar-background: 222 47% 11%;
  --sidebar-foreground: 240 5% 84%;
  --sidebar-primary: 271 91% 75%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4% 16%;
  --sidebar-accent-foreground: 240 5% 84%;
  --sidebar-border: 240 4% 16%;
  --sidebar-ring: 271 91% 75%;
}
```

### Registrar el Theme

1. Importar en el index:

```css
/* packages/config/styles/themes/custom/index.css */
@import './ambar.css';
@import './mi-tema.css';
```

2. Agregar al registry:

```typescript
/* packages/config/styles/themes/registry.ts */
export const customThemes: ThemeDefinition[] = [
  { name: 'ambar', label: 'Ambar', source: 'custom', category: 'warm', isDefault: true },
  { name: 'mi-tema', label: 'Mi Tema', source: 'custom', category: 'vibrant' },
];
```

---

## Dark Mode: Selectores CSS

### Por que dos selectores?

El dark mode con temas requiere **dos selectores CSS**:

```css
.theme-ambar.dark,    /* Selector 1 */
.dark .theme-ambar {  /* Selector 2 */
  --primary: 38 85% 55%;
}
```

**Selector 1: `.theme-ambar.dark`**
- Cubre: `<html class="theme-ambar dark">`
- Ambas clases en el mismo elemento
- Este es el caso de `next-themes`

**Selector 2: `.dark .theme-ambar`**
- Cubre: `<html class="dark"><div class="theme-ambar">`
- Clases en elementos anidados
- Fallback para estructuras complejas

---

## Comparacion: Tokens vs Themes CSS

| Aspecto | Tokens (JSON) | Themes CSS |
|---------|---------------|------------|
| **Requiere Build** | Si (`pnpm build`) | No, hot reload |
| **Uso Principal** | Design System base | Variaciones de color |
| **Cambios Globales** | Toda la arquitectura | Solo CSS variables |
| **Multi-tenant** | Requiere rebuild | Switch dinamico |
| **Mantenimiento** | Centralizado, versionado | Multiples archivos |
| **TypeScript Support** | Puede generar tipos | Solo CSS |
| **Hot Reload** | No | Si |
| **Complejidad** | Alta | Baja |

---

## Recomendaciones por Caso de Uso

### Para Desarrollo Rapido de MVP

```css
/* Usa un theme base + overrides */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/violet.css';
@import '../styles/theme.css'; /* Pequenos ajustes */
```

### Para Brand System Completo

```bash
# Edita tokens semanticos
packages/config/tokens/semantic/light.tokens.json
packages/config/tokens/semantic/dark.tokens.json

# Rebuild
cd packages/config && pnpm build
```

### Para Multi-tenant / White-label

```css
/* Carga todos los temas */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes.css';
```

```tsx
// Aplica tema por cliente
<html className={`theme-${clientId}`}>
```

### Para Componentes Reutilizables (Libraries)

```tsx
// Solo usa las variables CSS, sin importar themes
function Button({ variant }) {
  return (
    <button className="bg-primary text-primary-foreground">
      {children}
    </button>
  );
}
```

---

## Troubleshooting

### Los cambios en tokens no se reflejan

```bash
# Rebuild en el package correcto
cd packages/config
pnpm run build

# Si usas turbo, rebuild todo
cd monorepo-root
pnpm build
```

### Los themes no se aplican

Verificar el orden de imports:

```css
@import 'tailwindcss';                              /* 1. Siempre primero */
@import '@core/config/styles/tailwind-theme.css';   /* 2. Mapping */
@import '@core/config/styles/globals.css';          /* 3. Base */
@import '@core/config/styles/themes/violet.css';    /* 4. Theme */
@import '../styles/theme.css';                      /* 5. Overrides */
```

### Tailwind utilities no funcionan (bg-primary, etc.)

Verificar que `tailwind-theme.css` esta importado:

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css'; /* <- CRITICO */
```

### Variables no funcionan en CSS custom

Usa `hsl()` wrapper:

```css
/* Correcto */
.my-element {
  background-color: hsl(var(--primary));
}

/* Incorrecto - falta hsl() */
.my-element {
  background-color: var(--primary);
}
```

### Dark mode no cambia con el tema

Verificar que el CSS tiene ambos selectores:

```css
/* Ambos selectores son necesarios */
.theme-ambar.dark,
.dark .theme-ambar {
  --primary: 38 85% 55%;
}
```

---

## Variables CSS Disponibles

### Formato HSL

Todas las variables de color usan formato HSL sin la funcion:

```css
--primary: 38 92% 50%;    /* Correcto: H S% L% */
--primary: hsl(38, 92%, 50%);  /* Incorrecto */
```

**Por que?** Permite opacidad con Tailwind:

```html
<div class="bg-primary/50">  <!-- 50% opacity -->
```

### Lista Completa

```css
/* Surfaces */
--background
--foreground
--card
--card-foreground
--popover
--popover-foreground

/* Brand Colors */
--primary
--primary-foreground
--secondary
--secondary-foreground
--accent
--accent-foreground

/* States */
--muted
--muted-foreground
--destructive
--destructive-foreground

/* UI Elements */
--border
--input
--ring
--radius

/* Sidebar */
--sidebar-background
--sidebar-foreground
--sidebar-primary
--sidebar-primary-foreground
--sidebar-accent
--sidebar-accent-foreground
--sidebar-border
--sidebar-ring

/* Charts */
--chart-1
--chart-2
--chart-3
--chart-4
--chart-5
```

---

## Referencias

- [Documentacion de shadcn/ui](https://ui.shadcn.com/docs/theming)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

---

**Ultima actualizacion:** 30 de enero de 2026
