# @core/ui

Design system del monorepo. Componentes reutilizables construidos sobre shadcn/ui con patrón CVA + forwardRef + atomic design.

---

## Estructura

```
atoms/       → Elementos base: Button, Input, Badge, Avatar, Checkbox, Dialog,
               Label, Select, Skeleton, Slider, Switch, Tabs, Textarea, Tooltip, ...
molecules/   → Combinaciones: Card, DropdownMenu, Field (label+input+error),
               Pagination, Separator, Table, ...
organisms/   → Bloques complejos: Form (react-hook-form), Chart (Recharts), Sidebar, ...
hooks/       → useIsMobile
lib/         → cn() (clsx + tailwind-merge)
```

---

## Uso

Importar siempre desde el barrel — nunca desde rutas internas:

```tsx
// ✅ CORRECTO
import { Button, Input, Card } from '@core/ui';
import { cn } from '@core/ui/lib';

// ❌ INCORRECTO — rompe la encapsulación
import { Button } from '@core/ui/src/components/atoms/button/button';
```

---

## Patrón de componentes

Todos los atoms siguen el mismo patrón obligatorio: **CVA + forwardRef + cn()**.

```tsx
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

// 1. Variantes con CVA
export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-input bg-background hover:bg-accent border',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

// 2. Tipo que extiende el elemento nativo + VariantProps
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

// 3. forwardRef obligatorio
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = 'Button';

// 4. Exportar componente, variants Y tipo
export { Button, buttonVariants };
export type { ButtonProps };
```

---

## Añadir componentes shadcn

```bash
# Desde la raíz del monorepo
pnpm ui:add <nombre-componente>
```

El componente se añade en `packages/ui/src/components/atoms/` (o donde corresponda) y debe exportarse desde el barrel del nivel correspondiente.

---

## Theming

Los estilos usan CSS custom properties definidas en `@core/config`:

```css
/* Variables disponibles */
--background   --foreground
--primary      --primary-foreground
--secondary    --secondary-foreground
--muted        --muted-foreground
--accent       --accent-foreground
--destructive  --destructive-foreground
--border       --input  --ring  --radius
```

**dark/light** y **color-theme** son ortogonales — se pueden combinar libremente.

---

## cn() — merge de clases

```ts
import { cn } from '@core/ui/lib';

// Combina clsx + tailwind-merge
// El className del consumidor siempre al final para permitir override
cn(buttonVariants({ variant }), className);
```
