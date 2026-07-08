#!/usr/bin/env node
/**
 * CORE CLI
 * CLI generator for the CORE Monorepo Platform
 * @core/cli
 */

import chalk from 'chalk';
import { Command } from 'commander';

import { createNewCommand, createAddCommand, createDocsCommand } from './commands/index.js';

// Package version (updated during build)
const VERSION = '0.0.0';

/**
 * Display the CLI banner
 */
function showBanner(): void {
  console.log(
    chalk.cyan(`
   ____  ___  ____  ____
  / ___|/ _ \\|  _ \\| ___|
 | |   | | | | |_) |  _|
 | |___| |_| |  _ <| |___
  \\____|\\___/|_| \\_\\_____|

  CORE Monorepo Platform CLI v${VERSION}
`)
  );
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('core')
    .description('CLI generator for the CORE Monorepo Platform')
    .version(VERSION, '-v, --version', 'Display version number')
    .addCommand(createNewCommand())
    .addCommand(createAddCommand())
    .addCommand(createDocsCommand());

  // Show banner before help
  program.hook('preAction', () => {
    showBanner();
  });

  // Custom help
  program.addHelpText(
    'after',
    `
${chalk.bold('Examples:')}
  ${chalk.gray('# Create a new API')}
  $ core new api my-service --port 3011 --database

  ${chalk.gray('# Create a new webapp')}
  $ core new webapp my-app --port 3021 --theme zinc

  ${chalk.gray('# Interactive mode (will prompt for options)')}
  $ core new api
  $ core new webapp

${chalk.bold('Documentation:')}
  https://github.com/your-org/core-monorepo
`
  );

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

// Run the CLI
void main();
