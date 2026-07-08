---
title: UI Components - Atomic Design
description: Arquitectura de componentes @core/ui basada en Atomic Design con shadcn/ui
order: 2
date: 2025-01-31
readTime: 8 min
category: Components
---

# @core/ui - Atomic Design Component Library

Biblioteca de componentes React construida sobre **shadcn/ui** siguiendo la metodología **Atomic Design**.

## Instalación

```bash
# Los componentes están disponibles desde el workspace
pnpm add @core/ui
```

## Uso Básico

```tsx
// Importación simple - todo desde un punto
import { Button, Card, CardContent, cn } from "@core/ui"

// Importación granular por categoría
import { Button, Input } from "@core/ui/components/atoms"
import { Card } from "@core/ui/components/molecules"
import { Sidebar } from "@core/ui/components/organisms"

// Hooks y utilidades
import { useIsMobile } from "@core/ui/hooks"
import { cn } from "@core/ui/lib"
```

---

## Arquitectura Atomic Design

```
@core/ui/src/
├── components/
│   ├── atoms/        # 32 componentes base
│   ├── molecules/    # 14 composiciones
│   └── organisms/    # 3 componentes complejos
├── hooks/            # Custom hooks
└── lib/              # Utilidades (cn)
```

---

## Atoms (32)

Componentes primitivos sin dependencias internas. Son los bloques de construcción básicos.

| Componente | Exports | Descripción |
|------------|---------|-------------|
| `accordion` | Accordion, AccordionItem, AccordionTrigger, AccordionContent | Paneles colapsables |
| `alert` | Alert, AlertTitle, AlertDescription | Mensajes de alerta |
| `aspect-ratio` | AspectRatio | Contenedor con ratio fijo |
| `avatar` | Avatar, AvatarImage, AvatarFallback | Imagen de perfil |
| `badge` | Badge, badgeVariants | Etiquetas y estados |
| `button` | Button, buttonVariants | Botón con variantes |
| `checkbox` | Checkbox | Input de selección múltiple |
| `collapsible` | Collapsible, CollapsibleTrigger, CollapsibleContent | Contenido colapsable |
| `dialog` | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter | Modal |
| `drawer` | Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter | Panel deslizante |
| `hover-card` | HoverCard, HoverCardTrigger, HoverCardContent | Tarjeta al hover |
| `input` | Input | Campo de texto |
| `kbd` | Kbd | Tecla de teclado |
| `label` | Label | Etiqueta de formulario |
| `popover` | Popover, PopoverTrigger, PopoverContent, PopoverAnchor | Popover flotante |
| `progress` | Progress | Barra de progreso |
| `radio-group` | RadioGroup, RadioGroupItem | Selección única |
| `resizable` | ResizablePanelGroup, ResizablePanel, ResizableHandle | Paneles redimensionables |
| `scroll-area` | ScrollArea, ScrollBar | Área con scroll personalizado |
| `select` | Select, SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectValue, SelectLabel, SelectSeparator | Selector desplegable |
| `separator` | Separator | Línea divisora |
| `skeleton` | Skeleton | Placeholder de carga |
| `slider` | Slider | Control deslizante |
| `sonner` | Toaster | Notificaciones toast |
| `spinner` | Spinner, spinnerVariants | Indicador de carga |
| `switch` | Switch | Toggle on/off |
| `table` | Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption | Tabla de datos |
| `tabs` | Tabs, TabsList, TabsTrigger, TabsContent | Navegación por pestañas |
| `textarea` | Textarea | Campo de texto multilínea |
| `toggle` | Toggle, toggleVariants | Botón toggle |
| `tooltip` | Tooltip, TooltipTrigger, TooltipContent, TooltipProvider | Tooltip informativo |

---

## Molecules (14)

Composiciones de 2+ atoms que forman unidades funcionales.

| Componente | Exports | Descripción |
|------------|---------|-------------|
| `alert-dialog` | AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel | Diálogo de confirmación |
| `breadcrumb` | Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis | Navegación jerárquica |
| `calendar` | Calendar | Selector de fecha |
| `card` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter | Tarjeta contenedora |
| `carousel` | Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext | Carrusel de contenido |
| `command` | Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator | Paleta de comandos |
| `context-menu` | ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuGroup, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuRadioGroup | Menú contextual |
| `dropdown-menu` | DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup | Menú desplegable |
| `input-otp` | InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator | Input de código OTP |
| `menubar` | Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarLabel, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarShortcut | Barra de menú |
| `navigation-menu` | NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport, navigationMenuTriggerStyle | Navegación principal |
| `pagination` | Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext, PaginationEllipsis | Paginación |
| `sheet` | Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose | Panel lateral |
| `toggle-group` | ToggleGroup, ToggleGroupItem | Grupo de toggles |

---

## Organisms (3)

Componentes complejos con estado y múltiples dependencias.

| Componente | Exports | Descripción |
|------------|---------|-------------|
| `chart` | ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, ChartConfig | Gráficos con Recharts |
| `form` | Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField | Formularios con react-hook-form |
| `sidebar` | Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge, SidebarMenuSkeleton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarInset, SidebarInput, SidebarSeparator, SidebarRail, useSidebar | Barra lateral completa |

---

## Hooks

```tsx
import { useIsMobile } from "@core/ui/hooks"

function MyComponent() {
  const isMobile = useIsMobile() // true si viewport < 768px
  return isMobile ? <MobileView /> : <DesktopView />
}
```

---

## Utilidades

### cn() - Class Name Merger

Combina clases de Tailwind de forma inteligente usando `clsx` + `tailwind-merge`.

```tsx
import { cn } from "@core/ui"

// Combina y resuelve conflictos
cn("px-4 py-2", "px-6") // → "py-2 px-6"

// Condicionales
cn("base-class", isActive && "active-class")

// Arrays
cn(["class-1", "class-2"], { "class-3": true })
```

---

## Reglas de Importación (ESLint)

El proyecto incluye reglas ESLint para prevenir imports incorrectos:

```tsx
// ✅ CORRECTO
import { Button, Card } from "@core/ui"

// ❌ ERROR - Deep import
import { Button } from "@core/ui/src/components/atoms/button"

// ❌ ERROR - Local UI path
import { Button } from "@/components/ui/button"
```

---

## Dependencias Principales

| Paquete | Uso |
|---------|-----|
| `@radix-ui/*` | Primitivos accesibles (25 paquetes) |
| `class-variance-authority` | Variantes de componentes |
| `tailwind-merge` | Merge de clases Tailwind |
| `lucide-react` | Iconos |
| `recharts` | Gráficos (Chart) |
| `react-hook-form` | Formularios (Form) |
| `react-day-picker` | Calendario |
| `embla-carousel-react` | Carrusel |
| `cmdk` | Command palette |
| `sonner` | Toast notifications |
| `vaul` | Drawer |

---

## Ejemplo Completo

```tsx
"use client"

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Input,
  Label,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@core/ui"
import { useForm } from "react-hook-form"

export function LoginCard() {
  const form = useForm()

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(console.log)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="tu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
```
