# @core/config

Configuraciones compartidas del monorepo: ESLint, TypeScript, Prettier, Tailwind CSS, CSS tokens y temas visuales. Todos los packages y apps lo usan como base de configuración.

---

## Módulos

```
@core/config/eslint/base       → ESLint para cualquier package TS
@core/config/eslint/nextjs     → ESLint para apps Next.js
@core/config/eslint/library    → ESLint para packages publicables
@core/config/eslint/node       → ESLint para apps Node.js / Hono

@core/config/typescript/base   → tsconfig base (strict, ESM, exactOptionalPropertyTypes)
@core/config/typescript/nextjs → tsconfig para apps Next.js
@core/config/typescript/library→ tsconfig para packages
@core/config/typescript/node   → tsconfig para apps Node.js

@core/config/prettier          → prettier.config.js compartido
@core/config/tailwind          → tailwind.config.ts base

@core/config/styles/globals.css        → Reset CSS + variables base
@core/config/styles/tailwind-theme.css → Tokens del tema vía @theme CSS
@core/config/styles/themes.css         → Todos los temas (shadcn + custom)
@core/config/styles/themes/shadcn.css  → 19 temas de shadcn/ui
@core/config/styles/themes/custom.css  → Temas custom del proyecto
```

---

## Uso

### tsconfig.json

```json
{ "extends": "@core/config/typescript/base" }
```

```json
{ "extends": "@core/config/typescript/nextjs" }
```

### eslint.config.js

```js
import baseConfig from '@core/config/eslint/base';
export default [...baseConfig];
```

```js
import nextjsConfig from '@core/config/eslint/nextjs';
export default [...nextjsConfig];
```

### prettier.config.js

```js
export { default } from '@core/config/prettier';
```

### CSS (en el globals.css de cada app)

```css
@import '@core/config/styles/globals.css';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/themes.css'; /* todos los temas */
```

### tailwind.config.ts

```ts
import sharedConfig from '@core/config/tailwind';
export default { ...sharedConfig, content: ['./src/**/*.{ts,tsx}'] };
```

---

## TypeScript — flags activados en `base`

| Flag                         | Valor      | Efecto                                  |
| ---------------------------- | ---------- | --------------------------------------- |
| `strict`                     | `true`     | Modo estricto completo                  |
| `exactOptionalPropertyTypes` | `true`     | `prop?: T` → `T \| undefined` explícito |
| `noUncheckedIndexedAccess`   | `true`     | Array access devuelve `T \| undefined`  |
| `verbatimModuleSyntax`       | `true`     | Requiere `import type` para tipos       |
| `noImplicitOverride`         | `true`     | `override` explícito en subclases       |
| `module`                     | `NodeNext` | ESM nativo con extensiones `.js`        |

---

## Temas visuales disponibles

**shadcn/ui** (19 temas): `zinc`, `slate`, `gray`, `neutral`, `red`, `rose`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`

**Custom del proyecto**: `zinc`, y cualquier tema adicional en `styles/themes/custom/`

Cada tema define variables CSS para modo claro y oscuro. Se activa añadiendo la clase `theme-{name}` al elemento `<html>`.
