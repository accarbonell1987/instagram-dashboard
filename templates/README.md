# CLI Generator Templates

This directory contains templates for the CLI generator to scaffold new apps.

## Template Variables

All template files use the following placeholders that get replaced during generation:

| Variable          | Description            | Example          |
| ----------------- | ---------------------- | ---------------- |
| `{{name}}`        | App name in kebab-case | `my-api`         |
| `{{packageName}}` | Full package name      | `@core/my-api`   |
| `{{pascalName}}`  | PascalCase name        | `MyApi`          |
| `{{port}}`        | Server port number     | `3005`           |
| `{{description}}` | App description        | `My awesome API` |

## Directory Structure

```
templates/
├── api/                          # API template (Hono)
│   ├── package.json.template
│   ├── tsconfig.json.template
│   ├── README.md.template
│   └── src/
│       ├── index.ts.template     # Entry point with server setup
│       ├── config.ts.template    # Zod-validated config
│       ├── errors.ts.template    # Error classes
│       └── routes/
│           └── health.ts.template # Health check endpoint
│
└── webapp/                       # Webapp template (Next.js)
    ├── package.json.template
    ├── tsconfig.json.template
    ├── next.config.ts.template
    ├── postcss.config.cjs.template
    ├── README.md.template
    └── src/
        ├── app/
        │   ├── layout.tsx.template   # Root layout with providers
        │   ├── page.tsx.template     # Home page
        │   └── globals.css.template  # Tailwind CSS v4 setup
        ├── lib/
        │   └── utils.ts.template     # cn() utility
        └── services/                 # Domain services (modular)
            ├── index.ts.template     # Public API barrel
            ├── types.ts.template     # DomainServices interface
            ├── domain-services.ts.template  # Service registry
            └── extensions/
                └── index.ts.template # Extensions barrel (with examples)
```

## Template Features

### API Template

- Hono 4.x framework with Node.js server
- OpenAPI documentation with Swagger UI (`/docs`)
- Zod validation for config and routes
- Error handling structure (AppError hierarchy)
- Health check endpoints (`/health`, `/health/ready`)
- CORS and logging middleware

### Webapp Template

- Next.js 15 with App Router and Turbopack
- React 19 with TypeScript
- Tailwind CSS v4 with @core/config styles
- Theming: dark/light mode + color themes
- Integration with @core/ui design system
- lucide-react icons
- Modular services layer with extension pattern support

## Usage (CLI)

```bash
# Generate a new API
pnpm cli generate api my-api --port 3005

# Generate a new webapp
pnpm cli generate webapp my-webapp --port 3006
```

## Extending Templates

To add new features to templates:

1. Add the template file with `.template` extension
2. Use `{{variable}}` syntax for dynamic values
3. Update this README with the new file
4. Update the CLI generator to process the new file
