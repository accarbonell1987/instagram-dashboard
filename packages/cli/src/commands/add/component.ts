/**
 * 'core add component' Command
 * Adds a component to an existing webapp
 * @core/cli
 */

import path from 'path';

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs-extra';
import prompts from 'prompts';

import { showSuccess, showError, showWarning, getMonorepoRoot } from '../../utils/index.js';

interface AddComponentOptions {
  appDir?: string;
  variant?: 'atom' | 'molecule' | 'organism';
}

/**
 * Validate component name (PascalCase)
 */
function validateComponentName(name: string): string {
  // Convert to PascalCase
  const pascalName = name
    .replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c: string) => c.toUpperCase());

  return pascalName;
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
 * Convert PascalCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Generate component file
 */
async function generateComponentFile(
  webappDir: string,
  componentName: string,
  _options: AddComponentOptions
): Promise<boolean> {
  const componentsDir = path.join(webappDir, 'src', 'components');
  await fs.ensureDir(componentsDir);

  const kebabName = toKebabCase(componentName);
  const componentFilePath = path.join(componentsDir, `${kebabName}.tsx`);

  const componentContent = `import { cn } from '@core/ui/lib';
import type { HTMLAttributes, ReactNode } from 'react';

interface ${componentName}Props extends HTMLAttributes<HTMLDivElement> {
  /** Component children */
  children?: ReactNode;
}

/**
 * ${componentName} component
 * Generated with: core add component ${componentName}
 */
export function ${componentName}({ className, children, ...props }: ${componentName}Props) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
`;

  await fs.writeFile(componentFilePath, componentContent);
  return true;
}

/**
 * Update components index file
 */
async function updateComponentsIndex(webappDir: string, componentName: string): Promise<void> {
  const componentsDir = path.join(webappDir, 'src', 'components');
  const indexPath = path.join(componentsDir, 'index.ts');
  const kebabName = toKebabCase(componentName);

  const exportStatement = `export { ${componentName} } from './${kebabName}.js';`;

  if (fs.existsSync(indexPath)) {
    const content = await fs.readFile(indexPath, 'utf-8');
    if (!content.includes(exportStatement)) {
      await fs.appendFile(indexPath, `\n${exportStatement}\n`);
    }
  } else {
    await fs.writeFile(indexPath, `${exportStatement}\n`);
  }
}

/**
 * Create the 'add component' subcommand
 */
export function createAddComponentCommand(): Command {
  return new Command('component')
    .description('Add a component to an existing webapp')
    .argument('<name>', 'Component name (PascalCase, e.g., "UserCard", "ProductList")')
    .option('--app-dir <path>', 'Path to webapp directory (auto-detected if not specified)')
    .option('--variant <type>', 'Component variant: atom, molecule, organism', 'molecule')
    .action(async (name: string, options: AddComponentOptions) => {
      try {
        console.log(chalk.cyan(`\nAdding component "${name}" to webapp...\n`));

        // Validate and normalize component name
        const componentName = validateComponentName(name);
        const kebabName = toKebabCase(componentName);
        console.log(chalk.gray(`Component name: ${componentName} (${kebabName}.tsx)`));

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

        // Check if component already exists
        const componentPath = path.join(webappDir, 'src', 'components', `${kebabName}.tsx`);
        if (fs.existsSync(componentPath)) {
          showWarning(`Component "${componentName}" already exists at ${componentPath}`);
          const shouldOverwrite = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite the existing component?',
            initial: false,
          });

          if (!shouldOverwrite.overwrite) {
            showWarning('Operation cancelled');
            return;
          }
        }

        // Generate files
        console.log(chalk.gray('Generating component file...'));
        const success = await generateComponentFile(webappDir, componentName, options);

        if (success) {
          // Update index file
          await updateComponentsIndex(webappDir, componentName);

          showSuccess(`Component "${componentName}" added successfully!`);

          console.log(chalk.gray('\nFiles created/updated:'));
          console.log(chalk.gray(`  • src/components/${kebabName}.tsx`));
          console.log(chalk.gray(`  • src/components/index.ts (export added)`));

          console.log(chalk.gray('\nUsage:'));
          console.log(chalk.gray(`  import { ${componentName} } from '@/components';`));
          console.log(chalk.gray(`  <${componentName}>Content</${componentName}>`));
        } else {
          showError('Failed to generate component file');
          process.exit(1);
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
