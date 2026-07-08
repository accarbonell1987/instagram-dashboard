/**
 * 'core add route' Command
 * Adds a CRUD route to an existing API
 * @core/cli
 */

import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import prompts from 'prompts';

import { showSuccess, showError, showWarning, getMonorepoRoot } from '../../utils/index.js';

interface AddRouteOptions {
  name: string;
  appDir?: string;
  skipService?: boolean;
  skipSchema?: boolean;
}

/**
 * Validate route name
 */
function validateRouteName(name: string): string {
  // Convert to kebab-case
  const kebabName = name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

  // Ensure it's plural (common for CRUD routes)
  if (!kebabName.endsWith('s')) {
    return `${kebabName}s`;
  }
  return kebabName;
}

/**
 * Check if we're in an API directory
 */
function isApiDirectory(dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = fs.readJsonSync(packageJsonPath) as Record<string, unknown>;
    const name = packageJson['name'] as string | undefined;
    const deps = packageJson['dependencies'] as Record<string, string> | undefined;
    return name?.includes('api') === true || deps?.['@hono/zod-openapi'] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Find API directory
 */
function findApiDirectory(startDir: string = process.cwd()): string | undefined {
  let currentDir = startDir;

  while (currentDir !== path.parse(currentDir).root) {
    if (isApiDirectory(currentDir)) {
      return currentDir;
    }

    // Check if we're in an apps/* or internal/* directory
    const parentDir = path.dirname(currentDir);
    if (path.basename(parentDir) === 'apps' || path.basename(parentDir) === 'internal') {
      // Check all subdirectories for APIs
      const appsDir = parentDir;
      const subdirs = fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => path.join(appsDir, dirent.name));

      for (const subdir of subdirs) {
        if (isApiDirectory(subdir)) {
          return subdir;
        }
      }
    }

    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Generate route files
 */
async function generateRouteFiles(
  apiDir: string,
  routeName: string,
  options: AddRouteOptions
): Promise<boolean> {
  const routesDir = path.join(apiDir, 'src', 'routes');
  const routeDir = path.join(routesDir, routeName);
  const servicesDir = path.join(apiDir, 'src', 'services');
  const _schemasDir = path.join(apiDir, 'src', 'lib');

  // Create directories
  await fs.ensureDir(routeDir);
  await fs.ensureDir(servicesDir);

  // Generate route name in PascalCase for types
  const pascalName = routeName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // Generate singular name (remove trailing 's')
  const singularName = routeName.endsWith('s') ? routeName.slice(0, -1) : routeName;
  const singularPascalName = singularName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  // 1. Generate schemas file
  if (!options.skipSchema) {
    const schemasContent = `import { z } from 'zod';

export const ${singularPascalName}Schema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const Create${singularPascalName}Schema = ${singularPascalName}Schema.pick({
  name: true,
  description: true,
}).extend({
  // Add any additional fields for creation
});

export const Update${singularPascalName}Schema = Create${singularPascalName}Schema.partial();

export const ${singularPascalName}ResponseSchema = z.object({
  success: z.literal(true),
  data: ${singularPascalName}Schema,
});

export const ${pascalName}ListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    data: z.array(${singularPascalName}Schema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
});

export function ${singularName}ToDTO(entity: any) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
`;

    await fs.writeFile(path.join(routeDir, `${routeName}.schemas.ts`), schemasContent);
  }

  // 2. Generate routes file
  const routesContent = `import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";

import { createApiRouter } from "../../lib/create-openapi-router.js";
import {
  DeleteResponseSchema,
  ErrorResponseSchema,
  FilterQuerySchema,
  IdParamSchema,
} from "../../lib/shared-schemas.js";
import type { ${singularPascalName}Service } from "../../services/${routeName}.service.js";
import {
  Create${singularPascalName}Schema,
  Update${singularPascalName}Schema,
  ${singularPascalName}ResponseSchema,
  ${pascalName}ListResponseSchema,
  ${singularName}ToDTO,
} from "./${routeName}.schemas.js";

const list${pascalName} = createRoute({
  method: "get",
  path: "/",
  tags: ["${pascalName}"],
  summary: "List ${routeName}",
  description: "Returns a paginated, searchable list of ${routeName}.",
  request: { query: FilterQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: ${pascalName}ListResponseSchema } },
      description: "Paginated list of ${routeName}",
    },
  },
});

const get${singularPascalName} = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["${pascalName}"],
  summary: "Get ${singularName} by ID",
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { "application/json": { schema: ${singularPascalName}ResponseSchema } },
      description: "${singularPascalName} found",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "${singularPascalName} not found",
    },
  },
});

const create${singularPascalName} = createRoute({
  method: "post",
  path: "/",
  tags: ["${pascalName}"],
  summary: "Create a ${singularName}",
  request: {
    body: {
      content: { "application/json": { schema: Create${singularPascalName}Schema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: ${singularPascalName}ResponseSchema } },
      description: "${singularPascalName} created",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Validation error",
    },
  },
});

const update${singularPascalName} = createRoute({
  method: "put",
  path: "/{id}",
  tags: ["${pascalName}"],
  summary: "Update a ${singularName}",
  request: {
    params: IdParamSchema,
    body: {
      content: { "application/json": { schema: Update${singularPascalName}Schema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ${singularPascalName}ResponseSchema } },
      description: "${singularPascalName} updated",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "${singularPascalName} not found",
    },
  },
});

const delete${singularPascalName} = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["${pascalName}"],
  summary: "Delete a ${singularName}",
  request: { params: IdParamSchema },
  responses: {
    200: {
      content: { "application/json": { schema: DeleteResponseSchema } },
      description: "${singularPascalName} deleted",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "${singularPascalName} not found",
    },
  },
});

export function create${pascalName}Routes(${singularName}Service: ${singularPascalName}Service): OpenAPIHono {
  const routes = createApiRouter();

  routes.openapi(list${pascalName}, async (c) => {
    const params = c.req.valid("query");
    const result = await ${singularName}Service.filter(params);
    return c.json(
      { success: true, data: { ...result, data: result.data.map(${singularName}ToDTO) } },
      200,
    );
  });

  routes.openapi(get${singularPascalName}, async (c) => {
    const { id } = c.req.valid("param");
    const ${singularName} = await ${singularName}Service.findById(id);
    return c.json({ success: true, data: ${singularName}ToDTO(${singularName}) }, 200);
  });

  routes.openapi(create${singularPascalName}, async (c) => {
    const body = c.req.valid("json");
    const ${singularName} = await ${singularName}Service.create(body);
    return c.json({ success: true, data: ${singularName}ToDTO(${singularName}) }, 201);
  });

  routes.openapi(update${singularPascalName}, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const ${singularName} = await ${singularName}Service.update(id, body);
    return c.json({ success: true, data: ${singularName}ToDTO(${singularName}) }, 200);
  });

  routes.openapi(delete${singularPascalName}, async (c) => {
    const { id } = c.req.valid("param");
    await ${singularName}Service.remove(id);
    return c.json({ success: true, data: null }, 200);
  });

  return routes;
}
`;

  await fs.writeFile(path.join(routeDir, `${routeName}.routes.ts`), routesContent);

  // 3. Generate service file (optional)
  if (!options.skipService) {
    const serviceContent = `import type { FilterParams, PaginatedResponse } from '@core/core';
import { CrudService } from '@core/core';
import type { Create${singularPascalName}Schema, Update${singularPascalName}Schema } from '../routes/${routeName}/${routeName}.schemas.js';
import type { ${singularPascalName}Repository } from '../repositories/interfaces/${routeName}.repository.js';

export type ${singularPascalName}Service = CrudService<
  typeof Create${singularPascalName}Schema,
  typeof Update${singularPascalName}Schema
>;

export function create${singularPascalName}Service(
  repository: ${singularPascalName}Repository
): ${singularPascalName}Service {
  return new CrudService(repository);
}
`;

    await fs.writeFile(path.join(servicesDir, `${routeName}.service.ts`), serviceContent);
  }

  return true;
}

/**
 * Update main routes index
 */
async function updateRoutesIndex(
  apiDir: string,
  routeName: string,
  pascalName: string
): Promise<void> {
  const routesIndexPath = path.join(apiDir, 'src', 'routes', 'index.ts');

  if (!fs.existsSync(routesIndexPath)) {
    // Create index file if it doesn't exist
    const indexContent = `import type { OpenAPIHono } from '@hono/zod-openapi';

export function registerRoutes(app: OpenAPIHono) {
  // Routes will be registered here
}
`;
    await fs.writeFile(routesIndexPath, indexContent);
  }

  const indexContent = await fs.readFile(routesIndexPath, 'utf-8');

  // Check if route is already imported
  const importStatement = `import { create${pascalName}Routes } from './${routeName}/${routeName}.routes.js';`;

  let newContent = indexContent;

  // Add import if not present
  if (!newContent.includes(`from './${routeName}/${routeName}.routes.js'`)) {
    // Find the last import statement
    const importLines = newContent.split('\n').filter((line) => line.trim().startsWith('import'));
    const lastImportLine = importLines[importLines.length - 1];
    if (lastImportLine) {
      const lastImportIndex = newContent.lastIndexOf(lastImportLine);
      const beforeImports = newContent.substring(0, lastImportIndex + lastImportLine.length);
      const afterImports = newContent.substring(lastImportIndex + lastImportLine.length);
      newContent = beforeImports + '\n' + importStatement + afterImports;
    } else {
      // No imports yet, add at top
      newContent = importStatement + '\n' + newContent;
    }
  }

  // Add route registration if not present
  if (!newContent.includes(`app.route('/${routeName}'`)) {
    // Find the registerRoutes function body
    const functionMatch = /export function registerRoutes\(app: OpenAPIHono\) \{([\s\S]*?)\}/.exec(
      newContent
    );
    if (functionMatch?.[1] !== undefined) {
      const functionBody = functionMatch[1];
      const updatedBody =
        functionBody.trim() === ''
          ? `\n  app.route('/${routeName}', create${pascalName}Routes(${routeName}Service));\n`
          : functionBody.replace(/\n\s*$/, '') +
            `\n  app.route('/${routeName}', create${pascalName}Routes(${routeName}Service));\n`;

      newContent = newContent.replace(
        functionMatch[0],
        `export function registerRoutes(app: OpenAPIHono) {${updatedBody}}`
      );
    }
  }

  await fs.writeFile(routesIndexPath, newContent);
}

/**
 * Create the 'add route' subcommand
 */
export function createAddRouteCommand(): Command {
  return new Command('route')
    .description('Add a CRUD route to an existing API')
    .argument('<name>', 'Route name (e.g., "products", "orders")')
    .option('--app-dir <path>', 'Path to API directory (auto-detected if not specified)')
    .option('--skip-service', 'Skip generating service file')
    .option('--skip-schema', 'Skip generating schema file')
    .action(async (name: string, options: AddRouteOptions) => {
      try {
        console.log(chalk.cyan(`\nAdding route "${name}" to API...\n`));

        // Validate and normalize route name
        const routeName = validateRouteName(name);
        console.log(chalk.gray(`Normalized route name: ${routeName}`));

        // Find API directory
        let apiDir = options.appDir;
        if (apiDir) {
          // Resolve relative paths from monorepo root
          const monorepoRoot = getMonorepoRoot();
          apiDir = path.resolve(monorepoRoot, apiDir);
        } else {
          apiDir = findApiDirectory();
          if (!apiDir) {
            showError(
              'Could not find an API directory. Please run this command from within an API directory or specify --app-dir.'
            );
            process.exit(1);
          }
        }

        if (!isApiDirectory(apiDir)) {
          showError(`Directory "${apiDir}" does not appear to be an API.`);
          process.exit(1);
        }

        console.log(chalk.gray(`API directory: ${apiDir}`));

        // Check if route already exists
        const routeDir = path.join(apiDir, 'src', 'routes', routeName);
        if (fs.existsSync(routeDir)) {
          showWarning(`Route "${routeName}" already exists at ${routeDir}`);
          const shouldOverwrite = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite existing files?',
            initial: false,
          });

          if (!shouldOverwrite.overwrite) {
            showWarning('Operation cancelled');
            return;
          }
        }

        // Generate files
        console.log(chalk.gray('Generating route files...'));
        const success = await generateRouteFiles(apiDir, routeName, options);

        if (success) {
          // Update routes index
          const pascalName = routeName
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');

          await updateRoutesIndex(apiDir, routeName, pascalName);

          showSuccess(`Route "${routeName}" added successfully!`);

          console.log(chalk.gray('\nFiles created:'));
          console.log(chalk.gray(`  • src/routes/${routeName}/${routeName}.schemas.ts`));
          console.log(chalk.gray(`  • src/routes/${routeName}/${routeName}.routes.ts`));
          if (!options.skipService) {
            console.log(chalk.gray(`  • src/services/${routeName}.service.ts`));
          }

          console.log(chalk.gray('\nNext steps:'));
          console.log(chalk.gray(`  1. Implement ${routeName}.repository interface`));
          console.log(chalk.gray(`  2. Add ${routeName}Service to your composition root`));
          console.log(chalk.gray(`  3. Test the new endpoints at /${routeName}`));
        } else {
          showError('Failed to generate route files');
          process.exit(1);
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
