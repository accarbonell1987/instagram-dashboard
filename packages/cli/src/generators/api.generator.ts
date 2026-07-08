/**
 * API Generator
 * Generates a new Hono API from the api template
 * @core/cli
 */

import path from 'node:path';

import fsExtra from 'fs-extra';
import ora from 'ora';

const fs = fsExtra;

import type { ApiGeneratorOptions, GeneratorResult, TemplateManifest } from '../types.js';
import { DEFAULT_PORT_CONFIG } from '../types.js';
import {
  getTemplatesDir,
  getAppsDir,
  getExistingApps,
  readAppPackageJson,
  directoryExists,
  ensureDir,
  copyTemplateFiles,
  readJsonFile,
  createTemplateVariables,
} from '../utils/index.js';

/**
 * Find the next available port for an API
 */
async function findNextApiPort(): Promise<number> {
  const apps = await getExistingApps();
  let maxPort = DEFAULT_PORT_CONFIG.apiStartPort - 1;

  for (const app of apps) {
    const packageInfo = await readAppPackageJson(app);
    if (packageInfo?.port && packageInfo.port >= DEFAULT_PORT_CONFIG.apiStartPort) {
      maxPort = Math.max(maxPort, packageInfo.port);
    }
  }

  return maxPort + 1;
}

/**
 * Generate a new API application
 */
export async function generateApi(options: ApiGeneratorOptions): Promise<GeneratorResult> {
  const spinner = ora('Generating API...').start();
  const warnings: string[] = [];
  const createdFiles: string[] = [];

  try {
    // Determine target directory
    const targetDir = options.targetDir ?? path.join(getAppsDir(), options.name);

    // Check if directory already exists
    if (await directoryExists(targetDir)) {
      spinner.fail(`Directory already exists: ${targetDir}`);
      return {
        success: false,
        appPath: targetDir,
        message: `Directory already exists: ${targetDir}`,
        createdFiles: [],
        warnings: [],
      };
    }

    // Determine port
    const port = options.port ?? (await findNextApiPort());

    // Get template directory
    const templateDir = path.join(getTemplatesDir(), 'api');

    // Check if template exists
    if (!(await directoryExists(templateDir))) {
      spinner.warn('Template directory not found, creating minimal structure');
      warnings.push(
        'API template not found. Creating minimal structure. Run `pnpm cli:setup-templates` to set up full templates.'
      );

      // Create minimal API structure
      await createMinimalApiStructure(targetDir, options, port, createdFiles);
    } else {
      // Read template manifest
      const manifestPath = path.join(templateDir, 'manifest.json');
      let manifest: TemplateManifest;

      try {
        manifest = await readJsonFile<TemplateManifest>(manifestPath);
      } catch {
        spinner.warn('Template manifest not found, creating minimal structure');
        warnings.push('Template manifest not found. Creating minimal structure.');
        await createMinimalApiStructure(targetDir, options, port, createdFiles);
        spinner.succeed(`API "${options.name}" created at ${targetDir}`);
        return {
          success: true,
          appPath: targetDir,
          message: `API "${options.name}" created successfully`,
          createdFiles,
          warnings,
        };
      }

      // Create template variables
      const variables = createTemplateVariables(options.name, port, {
        database: options.database ? 'true' : 'false',
        auth: options.auth ? 'true' : 'false',
        description: `${options.name} API`,
      });

      // Copy and process template files
      spinner.text = 'Copying template files...';
      const copied = await copyTemplateFiles(templateDir, targetDir, manifest.files, variables);
      createdFiles.push(...copied);
    }

    spinner.succeed(`API "${options.name}" created at ${targetDir}`);

    return {
      success: true,
      appPath: targetDir,
      message: `API "${options.name}" created successfully`,
      createdFiles,
      warnings,
    };
  } catch (error) {
    spinner.fail('Failed to generate API');
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      appPath: '',
      message,
      createdFiles,
      warnings,
    };
  }
}

/**
 * Create minimal API structure when template is not available
 */
async function createMinimalApiStructure(
  targetDir: string,
  options: ApiGeneratorOptions,
  port: number,
  createdFiles: string[]
): Promise<void> {
  // Create directory structure
  await ensureDir(path.join(targetDir, 'src', 'routes'));
  await ensureDir(path.join(targetDir, 'src', 'services'));
  await ensureDir(path.join(targetDir, 'src', 'repositories'));
  await ensureDir(path.join(targetDir, 'src', 'middleware'));

  // Create package.json
  const packageJson = {
    name: options.name,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: `tsx watch --env-file=.env src/index.ts --port ${String(port)}`,
      build: 'tsc',
      start: `node dist/index.js --port ${String(port)}`,
      lint: 'eslint . --max-warnings 0',
      'type-check': 'tsc --noEmit',
    },
    dependencies: {
      '@hono/node-server': '^1.13.8',
      '@hono/zod-openapi': '^0.18.3',
      '@core/core': 'workspace:*',
      '@core/shared': 'workspace:*',
      hono: '^4.6.18',
      zod: '^3.24.1',
      ...(options.database ? { '@core/database': 'workspace:*' } : {}),
    },
    devDependencies: {
      '@core/config': 'workspace:*',
      '@types/node': '^22.10.7',
      eslint: '^9.18.0',
      tsx: '^4.19.2',
      typescript: '^5.7.3',
    },
  };

  const packageJsonPath = path.join(targetDir, 'package.json');
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  createdFiles.push(packageJsonPath);

  // Create tsconfig.json
  const tsconfig = {
    $schema: 'https://json.schemastore.org/tsconfig',
    extends: '@core/config/typescript/node.json',
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src',
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 });
  createdFiles.push(tsconfigPath);

  // Create basic index.ts
  const indexContent = `/**
 * ${options.name} API
 * Generated by @core/cli
 */

import { serve } from '@hono/node-server';
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

// Health check
app.get('/health', (c) => c.json({ status: 'ok', name: '${options.name}' }));

// OpenAPI documentation
app.doc('/docs/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: '${options.name} API',
    version: '1.0.0',
  },
});

const port = ${String(port)};
console.log(\`${options.name} API running on http://localhost:\${port}\`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
`;

  const indexPath = path.join(targetDir, 'src', 'index.ts');
  await fs.writeFile(indexPath, indexContent, 'utf-8');
  createdFiles.push(indexPath);

  // Create .env.example
  const envContent = `# ${options.name} Environment Variables

# Server
PORT=${String(port)}

${options.database ? '# Database\nDATABASE_URL="postgresql://user:password@localhost:5432/db"' : ''}
${options.auth ? '# Authentication\nJWT_SECRET="your-secret-key"' : ''}
`;

  const envPath = path.join(targetDir, '.env.example');
  await fs.writeFile(envPath, envContent, 'utf-8');
  createdFiles.push(envPath);

  // Create .gitignore
  const gitignoreContent = `# Dependencies
node_modules/

# Build output
dist/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/

# Logs
*.log
`;

  const gitignorePath = path.join(targetDir, '.gitignore');
  await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
  createdFiles.push(gitignorePath);
}
