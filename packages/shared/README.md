# @core/shared

Providers, hooks, componentes y tipos compartidos entre todas las apps del monorepo. Es el package base — no depende de ningún otro `@core/*`.

---

## Módulos

```
@core/shared              → barrel principal
@core/shared/providers    → ThemeProvider, ColorThemeContext
@core/shared/components   → ThemeToggleSelector
@core/shared/hooks        → useColorTheme
@core/shared/types        → tipos utilitarios compartidos
@core/shared/utils        → utilidades generales
```

---

## Uso principal

### ThemeProvider — dark/light + color-theme

```tsx
// En el root layout de cualquier app
import { ThemeProvider } from '@core/shared/providers';

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          defaultColorTheme="zinc"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### useColorTheme — cambiar el color-theme en runtime

```tsx
import { useColorTheme } from '@core/shared/providers';

function ThemeSelector() {
  const { colorTheme, setColorTheme, availableThemes } = useColorTheme();

  return (
    <select value={colorTheme} onChange={(e) => setColorTheme(e.target.value)}>
      {availableThemes.map((t) => (
        <option key={t.name} value={t.name}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
```

### ThemeToggleSelector — componente listo para usar

```tsx
import { ThemeToggleSelector } from '@core/shared/components';

// Selector visual de color-theme con chips de colores
<ThemeToggleSelector />;
```

---

## Theming — dark/light vs color-theme

Son **ortogonales** — operan en dimensiones distintas y se pueden combinar libremente:

| Dimensión       | Implementación      | Clase en `<html>` | Controla                   |
| --------------- | ------------------- | ----------------- | -------------------------- |
| **dark/light**  | `next-themes`       | `dark`            | Contraste claro/oscuro     |
| **color-theme** | `ColorThemeContext` | `theme-{name}`    | Paleta de colores del tema |

Temas de color disponibles: `zinc`, `slate`, `gray`, `red`, `rose`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink` (+ temas custom del proyecto).

---

## Tipos utilitarios

```ts
import type { DeepPartial, RequireKeys, Nullable } from '@core/shared/types';
```

Tipos genéricos reutilizables en cualquier app del monorepo.
