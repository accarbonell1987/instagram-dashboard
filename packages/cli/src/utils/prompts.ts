/**
 * Interactive Prompts Utilities
 * @core/cli
 */

import chalk from 'chalk';
import prompts from 'prompts';
import type { PromptObject } from 'prompts';

import type {
  AppType,
  ApiGeneratorOptions,
  WebappGeneratorOptions,
  ApiGeneratorInput,
  WebappGeneratorInput,
} from '../types.js';

import { appExists } from './files.js';
import { validateKebabCase } from './templates.js';

/**
 * Prompt for application name if not provided
 */
export async function promptForName(
  providedName: string | undefined,
  type: AppType
): Promise<string> {
  if (providedName) {
    validateKebabCase(providedName);
    return providedName;
  }

  const response = await prompts({
    type: 'text',
    name: 'name',
    message: `Enter the ${type} name (kebab-case):`,
    validate: (value: string) => {
      try {
        validateKebabCase(value);
        return true;
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid name';
      }
    },
  });

  if (!response.name) {
    throw new Error('Name is required');
  }

  return response.name as string;
}

/**
 * Confirm if user wants to overwrite existing app
 */
export async function confirmOverwrite(name: string): Promise<boolean> {
  const exists = await appExists(name);

  if (!exists) {
    return true;
  }

  console.log(chalk.yellow(`\nApp "${name}" already exists.`));

  const response = await prompts({
    type: 'confirm',
    name: 'overwrite',
    message: 'Do you want to overwrite it?',
    initial: false,
  });

  return response.overwrite === true;
}

/**
 * Prompt for API-specific options
 */
export async function promptApiOptions(options: ApiGeneratorInput): Promise<ApiGeneratorOptions> {
  const name = await promptForName(options.name, 'api');

  const questions: PromptObject[] = [];

  // Only prompt if value is truly undefined (not false from --no-database)
  if (typeof options.database !== 'boolean') {
    questions.push({
      type: 'confirm',
      name: 'database',
      message: 'Include Prisma database setup?',
      initial: true,
    });
  }

  // Only prompt if value is truly undefined (not false from --no-auth)
  if (typeof options.auth !== 'boolean') {
    questions.push({
      type: 'confirm',
      name: 'auth',
      message: 'Include authentication scaffolding?',
      initial: false,
    });
  }

  const answers: Record<string, unknown> = questions.length > 0 ? await prompts(questions) : {};

  return {
    name,
    port: options.port,
    targetDir: options.targetDir,
    database:
      typeof options.database === 'boolean'
        ? options.database
        : (answers['database'] as boolean | undefined),
    auth:
      typeof options.auth === 'boolean' ? options.auth : (answers['auth'] as boolean | undefined),
  };
}

/**
 * Prompt for webapp-specific options
 */
export async function promptWebappOptions(
  options: WebappGeneratorInput
): Promise<WebappGeneratorOptions> {
  const name = await promptForName(options.name, 'webapp');

  const questions: PromptObject[] = [];

  if (options.apiUrl === undefined) {
    questions.push({
      type: 'text',
      name: 'apiUrl',
      message: 'API URL to connect to (leave empty for none):',
      initial: 'http://localhost:3010',
    });
  }

  if (options.theme === undefined) {
    questions.push({
      type: 'select',
      name: 'theme',
      message: 'Select initial theme:',
      choices: [
        { title: 'Zinc (default)', value: 'zinc' },
        { title: 'Minimal', value: 'minimal' },
        { title: 'Dark', value: 'dark' },
      ],
      initial: 0,
    });
  }

  const answers: Record<string, unknown> = questions.length > 0 ? await prompts(questions) : {};

  return {
    name,
    port: options.port,
    targetDir: options.targetDir,
    apiUrl: options.apiUrl ?? (answers['apiUrl'] as string | undefined),
    theme: options.theme ?? (answers['theme'] as string | undefined),
  };
}

/**
 * Display a formatted success message
 */
export function showSuccess(message: string): void {
  console.log(chalk.green(`\n${message}`));
}

/**
 * Display a formatted error message
 */
export function showError(message: string): void {
  console.log(chalk.red(`\nError: ${message}`));
}

/**
 * Display a formatted warning message
 */
export function showWarning(message: string): void {
  console.log(chalk.yellow(`\nWarning: ${message}`));
}

/**
 * Display next steps after generation
 */
export function showNextSteps(appName: string, steps: string[]): void {
  console.log(chalk.cyan('\nNext steps:'));
  steps.forEach((step, index) => {
    console.log(chalk.white(`  ${String(index + 1)}. ${step}`));
  });
  console.log('');
}
