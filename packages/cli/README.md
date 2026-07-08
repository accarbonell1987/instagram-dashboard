# @core/cli

CLI generator for the CORE Monorepo Platform. Scaffolds new APIs and webapps from templates.

## Installation

The CLI is part of the monorepo and is automatically available after running `pnpm install` at the root.

## Usage

### Generate a new API

```bash
# Interactive mode
core new api

# With options
core new api my-service --port 3011 --database --auth
```

**Options:**

- `--port <number>` - Server port (default: auto-assign starting from 3010)
- `--database` - Include Prisma database setup
- `--auth` - Include authentication scaffolding
- `--target-dir <path>` - Custom target directory

### Generate a new Webapp

```bash
# Interactive mode
core new webapp

# With options
core new webapp my-app --port 3021 --api http://localhost:3010 --theme zinc
```

**Options:**

- `--port <number>` - Server port (default: auto-assign starting from 3020)
- `--api <url>` - API URL to connect
- `--theme <name>` - Initial theme (default: zinc)
- `--target-dir <path>` - Custom target directory

### Documentation Commands

```bash
# Sync API documentation from OpenAPI spec
core docs sync --api

# With API name (for multiple APIs)
core docs sync --api --name api-example

# Custom source URL
core docs sync --api --source http://localhost:3015/openapi.json --name inventory

# Check if docs are up-to-date (for CI)
core docs sync --api --check

# Preview changes without writing
core docs sync --api --dry-run --verbose
```

**Options for `docs sync --api`:**

- `--source <url>` - OpenAPI spec URL (default: `http://localhost:3001/openapi.json`)
- `--name <name>` - API identifier, used for output directory (default: `api`)
- `--check` - Verify docs are up-to-date (exits non-zero if outdated)
- `--dry-run` - Preview changes without writing files
- `--verbose` - Show detailed progress

**Output:**

Generated docs go to `internal/docs/src/content/api-{name}/` with:

- `index.md` - API overview with all endpoints
- `{tag}.md` - One file per OpenAPI tag (e.g., `users.md`, `health.md`)

Each file includes `category: "API: {name}"` frontmatter for sidebar grouping.

## Development

```bash
# Build the CLI
pnpm build

# Watch mode
pnpm dev

# Run directly
pnpm start
```

## Project Structure

```
packages/cli/
├── src/
│   ├── index.ts              # Entry point, CLI setup
│   ├── commands/
│   │   ├── index.ts          # Export all commands
│   │   ├── new.ts            # 'core new' command
│   │   └── docs.ts           # 'core docs' command
│   ├── generators/
│   │   ├── index.ts
│   │   ├── api.generator.ts  # Generate API from template
│   │   └── webapp.generator.ts # Generate webapp from template
│   ├── utils/
│   │   ├── index.ts
│   │   ├── templates.ts      # Template processing utilities
│   │   ├── files.ts          # File system utilities
│   │   └── prompts.ts        # Interactive prompts
│   └── types.ts              # Shared types
├── package.json
├── tsconfig.json
└── README.md
```

## Templates

The CLI uses templates from the `templates/` directory at the monorepo root:

- `templates/api/` - API template with Hono setup
- `templates/webapp/` - Webapp template with Next.js setup

Each template directory should contain a `manifest.json` file that describes the template files and their processing rules.

If templates are not found, the CLI will create a minimal structure.

## Naming Conventions

- Application names must be in kebab-case (e.g., `my-service`, `admin-panel`)
- Port numbers are auto-assigned if not specified:
  - APIs start at port 3010
  - Webapps start at port 3020

## License

MIT
