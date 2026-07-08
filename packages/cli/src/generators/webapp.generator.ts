/**
 * Webapp Generator
 * Generates a new Next.js webapp from the webapp template
 * @core/cli
 */

import path from 'node:path';

import fsExtra from 'fs-extra';
import ora from 'ora';

const fs = fsExtra;

import type { WebappGeneratorOptions, GeneratorResult, TemplateManifest } from '../types.js';
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
 * Find the next available port for a webapp
 */
async function findNextWebappPort(): Promise<number> {
  const apps = await getExistingApps();
  let maxPort = DEFAULT_PORT_CONFIG.webappStartPort - 1;

  for (const app of apps) {
    const packageInfo = await readAppPackageJson(app);
    if (packageInfo?.port && packageInfo.port >= DEFAULT_PORT_CONFIG.webappStartPort) {
      maxPort = Math.max(maxPort, packageInfo.port);
    }
  }

  return maxPort + 1;
}

/**
 * Generate a new webapp application
 */
export async function generateWebapp(options: WebappGeneratorOptions): Promise<GeneratorResult> {
  const spinner = ora('Generating webapp...').start();
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
    const port = options.port ?? (await findNextWebappPort());

    // Get template directory
    const templateDir = path.join(getTemplatesDir(), 'webapp');

    // Check if template exists
    if (!(await directoryExists(templateDir))) {
      spinner.warn('Template directory not found, creating minimal structure');
      warnings.push(
        'Webapp template not found. Creating minimal structure. Run `pnpm cli:setup-templates` to set up full templates.'
      );

      // Create minimal webapp structure
      await createMinimalWebappStructure(targetDir, options, port, createdFiles);
    } else {
      // Read template manifest
      const manifestPath = path.join(templateDir, 'manifest.json');
      let manifest: TemplateManifest;

      try {
        manifest = await readJsonFile<TemplateManifest>(manifestPath);
      } catch {
        spinner.warn('Template manifest not found, creating minimal structure');
        warnings.push('Template manifest not found. Creating minimal structure.');
        await createMinimalWebappStructure(targetDir, options, port, createdFiles);
        spinner.succeed(`Webapp "${options.name}" created at ${targetDir}`);
        return {
          success: true,
          appPath: targetDir,
          message: `Webapp "${options.name}" created successfully`,
          createdFiles,
          warnings,
        };
      }

      // Create template variables
      const variables = createTemplateVariables(options.name, port, {
        apiUrl: options.apiUrl ?? 'http://localhost:3010',
        theme: options.theme ?? 'zinc',
        description: `${options.name} webapp`,
      });

      // Copy and process template files
      spinner.text = 'Copying template files...';
      const copied = await copyTemplateFiles(templateDir, targetDir, manifest.files, variables);
      createdFiles.push(...copied);
    }

    spinner.succeed(`Webapp "${options.name}" created at ${targetDir}`);

    return {
      success: true,
      appPath: targetDir,
      message: `Webapp "${options.name}" created successfully`,
      createdFiles,
      warnings,
    };
  } catch (error) {
    spinner.fail('Failed to generate webapp');
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
 * Create minimal webapp structure when template is not available
 */
async function createMinimalWebappStructure(
  targetDir: string,
  options: WebappGeneratorOptions,
  port: number,
  createdFiles: string[]
): Promise<void> {
  // Create directory structure
  await ensureDir(path.join(targetDir, 'src', 'app'));
  await ensureDir(path.join(targetDir, 'src', 'components'));
  await ensureDir(path.join(targetDir, 'src', 'lib'));
  await ensureDir(path.join(targetDir, 'public'));

  // Create package.json
  const packageJson = {
    name: options.name,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: `next dev --turbopack --port ${String(port)}`,
      build: 'next build',
      start: `next start --port ${String(port)}`,
      lint: 'next lint',
      'type-check': 'tsc --noEmit',
    },
    dependencies: {
      '@core/ui': 'workspace:*',
      '@core/core': 'workspace:*',
      '@core/shared': 'workspace:*',
      next: '^15.1.4',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'next-themes': '^0.4.5',
    },
    devDependencies: {
      '@core/config': 'workspace:*',
      '@types/node': '^22.10.7',
      '@types/react': '^19.0.7',
      '@types/react-dom': '^19.0.3',
      eslint: '^9.18.0',
      typescript: '^5.7.3',
      tailwindcss: '^4.0.0',
    },
  };

  const packageJsonPath = path.join(targetDir, 'package.json');
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  createdFiles.push(packageJsonPath);

  // Create tsconfig.json
  const tsconfig = {
    $schema: 'https://json.schemastore.org/tsconfig',
    extends: '@core/config/typescript/nextjs.json',
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
      },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  };

  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  await fs.writeJson(tsconfigPath, tsconfig, { spaces: 2 });
  createdFiles.push(tsconfigPath);

  // Create next.config.ts
  const nextConfig = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@core/ui', '@core/core', '@core/shared'],
};

export default nextConfig;
`;

  const nextConfigPath = path.join(targetDir, 'next.config.ts');
  await fs.writeFile(nextConfigPath, nextConfig, 'utf-8');
  createdFiles.push(nextConfigPath);

  // Create layout.tsx
  const layoutContent = `import type { Metadata } from 'next';
import '@core/ui/globals.css';

export const metadata: Metadata = {
  title: '${options.name}',
  description: 'Generated by @core/cli',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
`;

  const layoutPath = path.join(targetDir, 'src', 'app', 'layout.tsx');
  await fs.writeFile(layoutPath, layoutContent, 'utf-8');
  createdFiles.push(layoutPath);

  // Create page.tsx
  const pageContent = `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">${options.name}</h1>
      <p className="text-muted-foreground">
        Welcome to your new webapp. Edit{' '}
        <code className="font-mono bg-muted px-2 py-1 rounded">
          src/app/page.tsx
        </code>{' '}
        to get started.
      </p>
    </main>
  );
}
`;

  const pagePath = path.join(targetDir, 'src', 'app', 'page.tsx');
  await fs.writeFile(pagePath, pageContent, 'utf-8');
  createdFiles.push(pagePath);

  // Create .env.example
  const envContent = `# ${options.name} Environment Variables

# API
NEXT_PUBLIC_API_URL="${options.apiUrl ?? 'http://localhost:3010'}"

# Theme
NEXT_PUBLIC_DEFAULT_THEME="${options.theme ?? 'zinc'}"
`;

  const envPath = path.join(targetDir, '.env.example');
  await fs.writeFile(envPath, envContent, 'utf-8');
  createdFiles.push(envPath);

  // Create .gitignore
  const gitignoreContent = `# Dependencies
node_modules/

# Next.js
.next/
out/

# Environment
.env
.env.local
.env*.local

# IDE
.vscode/
.idea/

# Debug
npm-debug.log*

# Vercel
.vercel
`;

  const gitignorePath = path.join(targetDir, '.gitignore');
  await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
  createdFiles.push(gitignorePath);
}
