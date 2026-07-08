/**
 * 'core new' Command
 * Generates new applications (API or webapp)
 * @core/cli
 */

import { Command } from 'commander';

import { generateApi, generateWebapp } from '../generators/index.js';
import type {
  ApiGeneratorOptions as _ApiGeneratorOptions,
  WebappGeneratorOptions as _WebappGeneratorOptions,
} from '../types.js';
import {
  promptApiOptions,
  promptWebappOptions,
  confirmOverwrite,
  showSuccess,
  showError,
  showWarning,
  showNextSteps,
} from '../utils/index.js';

/** Command options parsed from commander */
interface ApiCommandOptions {
  port?: number;
  database?: boolean;
  auth?: boolean;
  targetDir?: string;
}

/** Command options parsed from commander */
interface WebappCommandOptions {
  port?: number;
  api?: string;
  theme?: string;
  targetDir?: string;
}

/**
 * Create the 'new api' subcommand
 */
function createApiCommand(): Command {
  return new Command('api')
    .description('Generate a new Hono API')
    .argument('[name]', 'API name (kebab-case)')
    .option('-p, --port <number>', 'Server port', parseInt)
    .option('-d, --database', 'Include Prisma database setup (default: prompt)')
    .option('--no-database', 'Exclude Prisma database setup')
    .option('-a, --auth', 'Include authentication scaffolding (default: prompt)')
    .option('--no-auth', 'Exclude authentication scaffolding')
    .option('--target-dir <path>', 'Custom target directory')
    .action(async (name: string | undefined, cmdOptions: ApiCommandOptions) => {
      try {
        // Gather options (prompt for missing ones)
        const options = await promptApiOptions({
          name,
          port: cmdOptions.port,
          database: cmdOptions.database,
          auth: cmdOptions.auth,
          targetDir: cmdOptions.targetDir,
        });

        // Confirm if app exists
        const shouldProceed = await confirmOverwrite(options.name);
        if (!shouldProceed) {
          showWarning('Operation cancelled');
          return;
        }

        // Generate the API
        const result = await generateApi(options);

        if (result.success) {
          showSuccess(result.message);

          // Show warnings if any
          for (const warning of result.warnings) {
            showWarning(warning);
          }

          // Show next steps
          showNextSteps(options.name, [
            `cd apps/${options.name}`,
            'pnpm install (from monorepo root)',
            'cp .env.example .env',
            'pnpm dev',
          ]);
        } else {
          showError(result.message);
          process.exit(1);
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}

/**
 * Create the 'new webapp' subcommand
 */
function createWebappCommand(): Command {
  return new Command('webapp')
    .description('Generate a new Next.js webapp')
    .argument('[name]', 'Webapp name (kebab-case)')
    .option('-p, --port <number>', 'Server port', parseInt)
    .option('--api <url>', 'API URL to connect')
    .option('-t, --theme <name>', 'Initial theme (default: zinc)')
    .option('--target-dir <path>', 'Custom target directory')
    .action(async (name: string | undefined, cmdOptions: WebappCommandOptions) => {
      try {
        // Gather options (prompt for missing ones)
        const options = await promptWebappOptions({
          name,
          port: cmdOptions.port,
          apiUrl: cmdOptions.api,
          theme: cmdOptions.theme,
          targetDir: cmdOptions.targetDir,
        });

        // Confirm if app exists
        const shouldProceed = await confirmOverwrite(options.name);
        if (!shouldProceed) {
          showWarning('Operation cancelled');
          return;
        }

        // Generate the webapp
        const result = await generateWebapp(options);

        if (result.success) {
          showSuccess(result.message);

          // Show warnings if any
          for (const warning of result.warnings) {
            showWarning(warning);
          }

          // Show next steps
          showNextSteps(options.name, [
            `cd apps/${options.name}`,
            'pnpm install (from monorepo root)',
            'cp .env.example .env',
            'pnpm dev',
          ]);
        } else {
          showError(result.message);
          process.exit(1);
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}

/**
 * Create the 'new' command with subcommands
 */
export function createNewCommand(): Command {
  const newCmd = new Command('new')
    .description('Generate a new application')
    .addCommand(createApiCommand())
    .addCommand(createWebappCommand());

  return newCmd;
}
