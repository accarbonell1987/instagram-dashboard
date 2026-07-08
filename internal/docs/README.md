# Documentacion del Monorepo

Sitio de documentacion Next.js para el monorepo.

## Desarrollo

```bash
# Desde la raiz del monorepo
pnpm dev --filter docs

# O desde este directorio
pnpm dev
```

Visita [http://localhost:3001](http://localhost:3001)

## Organizacion de Documentos

Los documentos se organizan por **categoria** en el sidebar. Las categorias se definen en el frontmatter de cada archivo:

```markdown
---
title: Users API
category: 'API: api-example'
---
```

### Categorias

- **Sin categoria**: Documentos generales (Getting Started, Design System, etc.)
- **API: {name}**: Documentacion de API generada automaticamente
- **CLI**: Guias del CLI generador

El sidebar agrupa los documentos por categoria y soporta rutas anidadas como `/docs/api-api-example/users`.

## Documentacion Disponible

### Fundamentos

| Documento                                                | Descripcion                        |
| -------------------------------------------------------- | ---------------------------------- |
| [getting-started.md](./src/content/getting-started.md)   | Primeros pasos con el monorepo     |
| [design-system.md](./src/content/design-system.md)       | Variables CSS, arquitectura del DS |
| [theming-guide.md](./src/content/theming-guide.md)       | Como crear y personalizar temas    |
| [tokens-y-theming.md](./src/content/tokens-y-theming.md) | Arquitectura detallada del sistema |
| [turbo-skills.md](./src/content/turbo-skills.md)         | Configuracion de Turborepo         |

### API Reference (Generada)

La documentacion de API se genera automaticamente con el CLI:

```bash
# Generar docs para api-example
pnpm core docs sync --api --name api-example
```

Los archivos generados van a `src/content/api-{name}/` y aparecen agrupados en el sidebar bajo la categoria correspondiente.

## Agregar Documentacion

### 1. Crear un archivo Markdown

Crea un archivo `.md` en `src/content/`:

```markdown
---
title: Mi Documento
description: Descripcion breve del documento
order: 10
date: 2026-01-30
readTime: 5 min
category: Categoria
---

# Mi Documento

Contenido del documento...
```

### 2. Frontmatter

Propiedades disponibles:

| Propiedad     | Requerido | Descripcion                                       |
| ------------- | --------- | ------------------------------------------------- |
| `title`       | Si        | Titulo del documento                              |
| `description` | No        | Descripcion breve para SEO y cards                |
| `order`       | No        | Numero para ordenar en la lista (menor = primero) |
| `date`        | No        | Fecha de creacion/actualizacion                   |
| `readTime`    | No        | Tiempo estimado de lectura                        |
| `category`    | No        | Categoria del documento                           |

### 3. El archivo aparecera automaticamente

La pagina principal (`/`) lista todos los documentos automaticamente, ordenados por `order`.

## Estructura

```
internal/docs/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Pagina principal (lista de docs)
│   │   └── docs/
│   │       └── [slug]/
│   │           └── page.tsx      # Pagina de documento individual
│   ├── content/                  # Agregar documentos aqui
│   │   ├── getting-started.md
│   │   ├── design-system.md
│   │   ├── theming-guide.md
│   │   ├── tokens-y-theming.md
│   │   └── turbo-skills.md
│   ├── components/               # Componentes React
│   │   └── markdown-renderer.tsx # Renderizador de Markdown
│   └── lib/
│       └── markdown.ts           # Utilidades para procesar Markdown
└── package.json
```

## Personalizacion

### Estilos

Los estilos se heredan del Design System del monorepo:

```css
/* src/app/globals.css */
@import 'tailwindcss';
@import '@core/config/styles/tailwind-theme.css';
@import '@core/config/styles/globals.css';
```

### Componentes

Los componentes de UI vienen del paquete compartido:

```typescript
import { Button } from '@core/ui';
```

## Formato Markdown

### Syntax Highlighting

````markdown
```typescript
const hello = 'world';
```
````

Los bloques de codigo usan `highlight.js` con el tema `github-dark` para buena legibilidad en light y dark mode.

### Tablas

```markdown
| Column 1 | Column 2 |
| -------- | -------- |
| Data 1   | Data 2   |
```

### Callouts

```markdown
> **Tip:**
> Este es un tip util
```

### Enlaces Internos

```markdown
[Texto del enlace](/docs/slug-del-documento)
```

Los enlaces internos deben usar `/docs/[slug]` donde `[slug]` es el nombre del archivo sin `.md`.

## Build y Deploy

```bash
# Build para produccion
pnpm build

# Preview del build
pnpm start
```

## Mejores Practicas

### DO

1. Usa frontmatter completo con titulo, descripcion y order
2. Manten orden logico usando el campo `order`
3. Escribe descripciones claras para las cards
4. Usa categorias para agrupar documentos relacionados
5. Actualiza la fecha cuando modificas el documento

### DONT

1. No uses el mismo `order` en multiples docs
2. No omitas el frontmatter (minimo titulo requerido)
3. No uses paths absolutos en imagenes
4. No hardcodees URLs de localhost

---

**Ultima actualizacion:** 30 de enero de 2026
