/**
 * 'core add page' Command
 * Adds a page to an existing webapp
 * @core/cli
 */

import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import prompts from 'prompts';

import { showSuccess, showError, showWarning, getMonorepoRoot } from '../../utils/index.js';

interface AddPageOptions {
  path: string;
  appDir?: string;
  withLayout?: boolean;
  withService?: boolean;
}

/**
 * Validate page path
 */
function validatePagePath(pagePath: string): string {
  // Remove leading/trailing slashes
  const cleanPath = pagePath.replace(/^\/+|\/+$/g, '');

  // Ensure it's a valid URL path
  const segments = cleanPath.split('/').filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return '/'; // Root page
  }

  return segments.join('/');
}

/**
 * Check if we're in a webapp directory
 */
function isWebappDirectory(dir: string): boolean {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = fs.readJsonSync(packageJsonPath) as Record<string, unknown>;
    const name = packageJson['name'] as string | undefined;
    const deps = packageJson['dependencies'] as Record<string, string> | undefined;
    return (
      name?.includes('webapp') === true ||
      deps?.['next'] !== undefined ||
      deps?.['@core/ui'] !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * Find webapp directory
 */
function findWebappDirectory(startDir: string = process.cwd()): string | undefined {
  let currentDir = startDir;

  while (currentDir !== path.parse(currentDir).root) {
    if (isWebappDirectory(currentDir)) {
      return currentDir;
    }

    // Check if we're in an apps/* or internal/* directory
    const parentDir = path.dirname(currentDir);
    if (path.basename(parentDir) === 'apps' || path.basename(parentDir) === 'internal') {
      // Check all subdirectories for webapps
      const appsDir = parentDir;
      const subdirs = fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => path.join(appsDir, dirent.name));

      for (const subdir of subdirs) {
        if (isWebappDirectory(subdir)) {
          return subdir;
        }
      }
    }

    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Generate page files
 */
async function generatePageFiles(
  webappDir: string,
  pagePath: string,
  options: AddPageOptions
): Promise<boolean> {
  const appDir = path.join(webappDir, 'src', 'app');
  const pageSegments = pagePath === '/' ? [''] : pagePath.split('/');

  // Build directory path
  let currentDir = appDir;
  for (const segment of pageSegments) {
    if (segment) {
      currentDir = path.join(currentDir, segment);
    }
  }

  // Create page directory
  await fs.ensureDir(currentDir);

  // Generate page name for component
  const lastSegment = pageSegments[pageSegments.length - 1] ?? 'home';
  const pageName =
    lastSegment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('') + 'Page';

  // Generate page component
  let pageContent = '';

  if (options.withService) {
    // Page with service integration (CRUD example)
    pageContent = `'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/ui';
import { PlusIcon } from 'lucide-react';

import { useServices } from '@/lib/services';

export default function ${pageName}() {
  const services = useServices();
  
  // Example: create a service for this entity
  // const exampleService = useMemo(
  //   () => services.createService<Example, ExampleCreate>('/examples'),
  //   [services]
  // );

  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)}</h1>
            <p className="text-muted-foreground text-sm">
              Manage your ${lastSegment} here
            </p>
          </div>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            New ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)}
          </Button>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)} Management</CardTitle>
            <CardDescription>
              This is a generated page for managing ${lastSegment}. Connect it to an API service.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground space-y-4">
              <p>
                This page was generated with <code className="text-xs">core add page ${pagePath}</code>.
              </p>
              <p>
                To connect it to an API:
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Create a corresponding API route with <code className="text-xs">core add route ${lastSegment}</code></li>
                <li>Update the service in <code className="text-xs">useServices()</code> hook</li>
                <li>Implement CRUD operations using <code className="text-xs">@core/core</code> services</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
`;
  } else {
    // Simple page without service
    pageContent = `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@core/ui';

export default function ${pageName}() {
  return (
    <main className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)}</h1>
          <p className="text-muted-foreground text-sm">
            ${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)} page
          </p>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>${lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)} Page</CardTitle>
            <CardDescription>
              This page was generated with the CORE CLI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground space-y-2">
              <p>
                Welcome to your new page at <code className="text-xs">/${pagePath}</code>.
              </p>
              <p>
                Edit this file to add your content:
                <code className="text-xs block mt-2 p-2 bg-muted rounded">
                  apps/{path.basename(webappDir)}/src/app/${pagePath}/page.tsx
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
`;
  }

  // Write page file
  const pageFilePath = path.join(currentDir, 'page.tsx');
  await fs.writeFile(pageFilePath, pageContent);

  // Generate layout file if requested
  if (options.withLayout) {
    const layoutContent = `import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Add your layout structure here */}
      {children}
    </div>
  );
}
`;

    const layoutFilePath = path.join(currentDir, 'layout.tsx');
    await fs.writeFile(layoutFilePath, layoutContent);
  }

  return true;
}

/**
 * Create the 'add page' subcommand
 */
export function createAddPageCommand(): Command {
  return new Command('page')
    .description('Add a page to an existing webapp')
    .argument('<path>', 'Page path (e.g., "dashboard", "settings/profile")')
    .option('--app-dir <path>', 'Path to webapp directory (auto-detected if not specified)')
    .option('--with-layout', 'Generate a layout.tsx file for the page')
    .option('--with-service', 'Generate page with service integration example')
    .action(async (pagePath: string, options: AddPageOptions) => {
      try {
        console.log(chalk.cyan(`\nAdding page "${pagePath}" to webapp...\n`));

        // Validate and normalize page path
        const normalizedPath = validatePagePath(pagePath);
        console.log(chalk.gray(`Normalized page path: ${normalizedPath}`));

        // Find webapp directory
        let webappDir = options.appDir;
        if (webappDir) {
          // Resolve relative paths from monorepo root
          const monorepoRoot = getMonorepoRoot();
          webappDir = path.resolve(monorepoRoot, webappDir);
        } else {
          webappDir = findWebappDirectory();
          if (!webappDir) {
            showError(
              'Could not find a webapp directory. Please run this command from within a webapp directory or specify --app-dir.'
            );
            process.exit(1);
          }
        }

        if (!isWebappDirectory(webappDir)) {
          showError(`Directory "${webappDir}" does not appear to be a webapp.`);
          process.exit(1);
        }

        console.log(chalk.gray(`Webapp directory: ${webappDir}`));

        // Check if page already exists
        const appDir = path.join(webappDir, 'src', 'app');
        const pageSegments = normalizedPath === '/' ? [''] : normalizedPath.split('/');
        let checkDir = appDir;
        for (const segment of pageSegments) {
          if (segment) {
            checkDir = path.join(checkDir, segment);
          }
        }

        const pageFilePath = path.join(checkDir, 'page.tsx');
        if (fs.existsSync(pageFilePath)) {
          showWarning(`Page "${normalizedPath}" already exists at ${pageFilePath}`);
          const shouldOverwrite = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite the existing page?',
            initial: false,
          });

          if (!shouldOverwrite.overwrite) {
            showWarning('Operation cancelled');
            return;
          }
        }

        // Generate files
        console.log(chalk.gray('Generating page files...'));
        const success = await generatePageFiles(webappDir, normalizedPath, options);

        if (success) {
          showSuccess(`Page "${normalizedPath}" added successfully!`);

          console.log(chalk.gray('\nFiles created:'));
          const relativePath = path.relative(process.cwd(), pageFilePath);
          console.log(chalk.gray(`  • ${relativePath}`));

          if (options.withLayout) {
            const layoutFilePath = path.join(checkDir, 'layout.tsx');
            const relativeLayoutPath = path.relative(process.cwd(), layoutFilePath);
            console.log(chalk.gray(`  • ${relativeLayoutPath}`));
          }

          console.log(chalk.gray('\nNext steps:'));
          console.log(chalk.gray(`  1. Visit http://localhost:3000/${normalizedPath}`));
          console.log(chalk.gray(`  2. Customize the page content`));
          if (options.withService) {
            console.log(chalk.gray(`  3. Connect to an API service using @core/core`));
          }
        } else {
          showError('Failed to generate page files');
          process.exit(1);
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
