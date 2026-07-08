---
title: Guia de Theming
description: Como crear y personalizar temas para tus aplicaciones con Tailwind CSS v4
order: 2
date: 2026-01-30
readTime: 15 min
category: Guias
---

# Guia de Theming

El monorepo implementa un sistema flexible de theming basado en **Tailwind CSS v4** que permite a cada aplicacion tener su propia identidad visual mientras hereda del Design System base.

---

## Arquitectura del Sistema

### Flujo de Theming

```
1. CSS Variables (Definicion)
   ├── :root { --primary: 38 92% 50%; }     <- globals.css / semantic tokens
   ├── .dark { --primary: ... }             <- dark mode
   └── .theme-ambar { --primary: ... }      <- theme classes

2. Tailwind v4 Mapping (tailwind-theme.css)
   └── @theme inline {
         --color-primary: hsl(var(--primary));  <- Maps CSS var -> Tailwind
       }

3. ThemeProvider (Runtime)
   └── applyThemeClass('ambar')
       └── <html class="light theme-ambar">  <- Adds theme class to DOM

4. CSS Cascade Resolution
   └── .theme-ambar { --primary: 38 92% 50% }  <- WINS (highest specificity)

5. Component Render
   └── <button class="bg-primary">
       └── background-color: hsl(38 92% 50%)  <- Theme color applied!
```

### Estructura de Archivos

```
packages/config/styles/
├── tailwind-theme.css          # CRITICO: Mapea CSS vars -> Tailwind utilities
├── globals.css                 # Tokens semanticos base (:root, .dark)
└── themes/
    ├── registry.ts             # Registro central de temas (TypeScript)
    ├── all.css                 # Importa todos los temas
    ├── shadcn/                 # 12 temas oficiales shadcn/ui
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
    └── custom/                 # Temas personalizados
        ├── index.css
        └── ambar.css           # Tema ambar (default custom)

apps/[app-name]/
└── src/
    ├── app/
    │   └── globals.css         # Importa DS base + temas
    └── styles/
        ├── theme.css           # Overrides de CSS variables
        └── theme.ts            # Configuracion tipada del tema
```

---

## Por Que `tailwind-theme.css` Es Critico

**Tailwind CSS v4** requiere configuracion explicita con `@theme inline` para mapear CSS variables a utilities.

Sin `tailwind-theme.css`, las clases como `bg-primary`, `text-foreground`, etc. **no funcionaran**.

```css
/* packages/config/styles/tailwind-theme.css */
@theme inline {
  /* Mapeo CSS vars -> Tailwind utilities */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... mas colores ... */

  /* Border Radius */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}

/* Dark mode variant para Tailwind v4 */
@custom-variant dark (&:is(.dark *));
```

---

## Orden de Imports (CRITICO)

El orden de imports en `globals.css` es fundamental:

```css
/* apps/my-app/src/app/globals.css */

/* 1. Tailwind CSS v4 base */
@import 'tailwindcss';

/* 2. Tailwind theme mappings (CSS vars -> utilities) */
@import '@core/config/styles/tailwind-theme.css';

/* 3. Base design system (semantic tokens) */
@import '@core/config/styles/globals.css';

/* 4. All themes (shadcn + custom) */
@import '@core/config/styles/themes.css';

/* 5. App-specific overrides */
@import '../styles/theme.css';
```

**Por que este orden?**

1. **Tailwind primero** - Establece la base del framework
2. **Theme mappings** - Para que Tailwind reconozca las CSS vars
3. **Globals** - Establece valores por defecto (:root)
4. **Themes** - Para que `.theme-*` tenga mayor especificidad que `:root`
5. **App overrides** - Maxima especificidad para personalizacion

---

## Estrategias de Theming

### 1. Default (Sin configuracion)

Usa el tema predefinido del Design System sin personalizacion.

**Cuando usar:**
- Quieres empezar rapido
- No necesitas personalizacion
- Maxima consistencia con otras apps

**Setup:**

```css
/* apps/my-app/src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
```

---

### 2. Tema Predefinido de shadcn/ui

Usa uno de los 12 temas predefinidos de shadcn/ui.

**Temas disponibles:**

| Tema | Descripcion |
|------|-------------|
| `zinc` | Gris neutral (default shadcn) |
| `slate` | Gris azulado |
| `stone` | Gris calido |
| `gray` | Gris puro |
| `neutral` | Gris neutral puro |
| `red` | Rojo vibrante |
| `rose` | Rosa elegante |
| `orange` | Naranja energetico |
| `green` | Verde fresco |
| `blue` | Azul profesional |
| `yellow` | Amarillo brillante |
| `violet` | Violeta creativo |

**Setup con tema fijo:**

```css
/* apps/my-app/src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes/shadcn/blue.css';
```

---

### 3. Theme Switcher (Multiples Temas)

Carga multiples temas y permite cambiar entre ellos en runtime.

**Cuando usar:**
- Apps con personalizacion de tema por usuario
- SaaS donde cada cliente tiene su tema
- Necesitas demostrar multiples opciones

**Setup:**

```css
/* apps/my-app/src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
@import '@core/config/styles/themes.css'; /* Todos los temas */
```

```tsx
/* apps/my-app/src/app/layout.tsx */
import { ThemeProvider } from '@core/shared/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider
          defaultColorTheme="ambar"
          attribute="class"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Cambiar tema en runtime:**

```tsx
import { useTheme } from '@core/shared/providers';

function ThemeSwitcher() {
  const { setColorTheme } = useTheme();

  return (
    <select onChange={(e) => setColorTheme(e.target.value)}>
      <option value="ambar">Ambar</option>
      <option value="violet">Violet</option>
      <option value="blue">Blue</option>
    </select>
  );
}
```

---

### 4. Tema Personalizado (Custom)

Crea un tema completamente personalizado con tu paleta de colores.

**Setup completo:**

#### Paso 1: Crea el archivo CSS del tema

```css
/* packages/config/styles/themes/custom/mi-tema.css */

/**
 * Mi Tema Personalizado
 * Descripcion de la paleta y su proposito
 */

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

  --border: 270 20% 88%;
  --input: 270 20% 88%;
  --ring: 271 91% 65%;

  --radius: 0.75rem;
}

/* Dark mode - AMBOS selectores necesarios */
.theme-mi-tema.dark,
.dark .theme-mi-tema {
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;

  --primary: 271 91% 75%;
  --primary-foreground: 0 0% 100%;

  --secondary: 189 94% 55%;
  --secondary-foreground: 0 0% 100%;

  --muted: 270 20% 20%;
  --muted-foreground: 270 10% 60%;

  --border: 270 20% 25%;
  --input: 270 20% 25%;
}
```

#### Paso 2: Registra en el Theme Registry

```typescript
/* packages/config/styles/themes/registry.ts */

export const customThemes: ThemeDefinition[] = [
  { name: 'ambar', label: 'Ambar', source: 'custom', category: 'warm' },
  { name: 'mi-tema', label: 'Mi Tema', source: 'custom', category: 'vibrant' },
];
```

#### Paso 3: Importa en el index

```css
/* packages/config/styles/themes/custom/index.css */
@import './ambar.css';
@import './mi-tema.css';
```

---

## Dark Mode: Selectores CSS

El dark mode con temas requiere **dos selectores CSS** para cubrir todos los casos:

```css
/* Patron correcto para dark mode con themes */
.theme-ambar.dark,    /* <html class="theme-ambar dark"> */
.dark .theme-ambar {  /* <html class="dark"><div class="theme-ambar"> */
  --primary: 38 85% 55%;
  /* ... resto de tokens dark ... */
}
```

**Por que dos selectores?**

- `next-themes` pone ambas clases en `<html>`: `class="theme-ambar dark"`
- El primer selector (`.theme-ambar.dark`) cubre este caso
- El segundo (`.dark .theme-ambar`) es un fallback para estructuras anidadas

---

## Variables CSS Disponibles

### Colores Principales

| Variable | Uso | Formato |
|----------|-----|---------|
| `--primary` | Color de accion principal | `H S% L%` |
| `--primary-foreground` | Texto sobre primary | `H S% L%` |
| `--secondary` | Color secundario | `H S% L%` |
| `--secondary-foreground` | Texto sobre secondary | `H S% L%` |
| `--accent` | Color de acento | `H S% L%` |
| `--accent-foreground` | Texto sobre accent | `H S% L%` |
| `--destructive` | Acciones destructivas | `H S% L%` |
| `--destructive-foreground` | Texto sobre destructive | `H S% L%` |

### Colores de UI

| Variable | Uso |
|----------|-----|
| `--background` | Fondo principal |
| `--foreground` | Texto principal |
| `--card` | Fondo de tarjetas |
| `--card-foreground` | Texto en tarjetas |
| `--popover` | Fondo de popovers |
| `--popover-foreground` | Texto en popovers |
| `--muted` | Fondos sutiles |
| `--muted-foreground` | Texto secundario |
| `--border` | Bordes |
| `--input` | Bordes de inputs |
| `--ring` | Focus rings |

### Sidebar y Charts

```css
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
--chart-1 ... --chart-5
```

> **Nota sobre formato HSL:**
> Las variables usan el formato `H S% L%` (sin `hsl()`) para compatibilidad con Tailwind.
> Al usar en CSS custom: `background: hsl(var(--primary));`

---

## Checklist de Validacion

### 1. Verificar DOM Structure

```javascript
// En DevTools console:
document.documentElement.classList
// Debe mostrar: ["light", "theme-ambar"] o ["dark", "theme-ambar"]
```

### 2. Verificar CSS Variables

```javascript
// En DevTools console:
getComputedStyle(document.documentElement).getPropertyValue('--primary')
// Debe mostrar: "38 92% 50%" (para ambar light)
```

### 3. Verificar Tailwind Utilities

```javascript
// En DevTools, seleccionar un boton con class="bg-primary"
// En Computed styles, background-color debe ser:
// hsl(38, 92%, 50%) = rgb(244, 166, 10) <- Amber
```

### 4. Test de Cambio de Tema

1. Click en "Violet" en theme selector
2. Verificar que `document.documentElement.classList` ahora tiene `theme-violet`
3. Verificar que `--primary` cambio a `262.1 83.3% 57.8%`
4. Verificar que botones cambiaron de color visualmente

---

## Solucion de Problemas

### Tema no cambia visualmente

1. Verificar que `tailwind-theme.css` esta importado
2. Verificar que `@theme inline` tiene todos los colores
3. Verificar que la clase `.theme-*` esta en `<html>`

### Flash of unstyled content (FOUC)

Agregar script en `<head>` para aplicar tema antes del render:

```tsx
<script dangerouslySetInnerHTML={{
  __html: `
    const theme = localStorage.getItem('color-theme') || 'ambar';
    document.documentElement.classList.add('theme-' + theme);
  `
}} />
```

### Dark mode no funciona con tema

Verificar que el CSS tiene ambos selectores:

```css
.theme-ambar.dark, .dark .theme-ambar { ... }
```

### Clases de Tailwind no funcionan

Verificar que `tailwind-theme.css` esta importado DESPUES de `tailwindcss`:

```css
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css'; /* <- Debe estar aqui */
```

---

## FAQ

### Puedo usar Tailwind classes normales?

Si, el sistema es 100% compatible con Tailwind:

```tsx
<div className="bg-primary text-primary-foreground">
  Usando clases de Tailwind
</div>
```

### Como funciona el dark mode?

El sistema detecta automaticamente la clase `.dark` en el html. Todas las variables se ajustan automaticamente.

### Que formato de color debo usar?

**HSL sin `hsl()`**:

```css
--primary: 271 91% 65%;    /* Correcto */
--primary: hsl(271, 91%, 65%);  /* Incorrecto */
```

Esto es necesario para compatibilidad con Tailwind.

### Como accedo a las variables desde JavaScript?

```typescript
// Usando getComputedStyle
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue('--primary');

// O usando el theme registry
import { getTheme } from '@core/config/styles/themes/registry';
const theme = getTheme('ambar');
```

---

## Recursos

- **[Design System](./design-system)** - Tokens base, colores, espaciado
- **[Tokens y Theming](./tokens-y-theming)** - Arquitectura detallada
- **[shadcn/ui Themes](https://ui.shadcn.com/themes)** - Explorador de temas
- **[Tailwind CSS v4](https://tailwindcss.com/docs)** - Documentacion oficial

---

**Ultima actualizacion:** 30 de enero de 2026
