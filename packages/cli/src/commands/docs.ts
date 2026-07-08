/**
 * 'core docs' Command
 * Documentation management commands
 * @core/cli
 */

import path from 'node:path';

import chalk from 'chalk';
import { Command } from 'commander';

import { generateApiDocsFromSource } from '../generators/docs/markdown-generator.js';
import type { DocsSyncOptions } from '../types.js';
import { getMonorepoRoot } from '../utils/files.js';

// ============================================================================
// Constants
// ============================================================================

/** Default OpenAPI source URL */
const DEFAULT_OPENAPI_SOURCE = 'http://localhost:3001/openapi.json';

/** Default output directory relative to monorepo root */
const DEFAULT_OUTPUT_DIR = 'internal/docs/src/content';

/** Default API name */
const DEFAULT_API_NAME = 'api';

// ============================================================================
// Types
// ============================================================================

/** Command options parsed from commander */
interface SyncCommandOptions {
  api?: boolean;
  check?: boolean;
  source?: string;
  dryRun?: boolean;
  verbose?: boolean;
  name?: string;
}

// ============================================================================
// Output Helpers
// ============================================================================

/**
 * Display generation progress for a file
 */
function showFileProgress(file: string, endpointCount?: number): void {
  const suffix = endpointCount ? chalk.gray(` (${String(endpointCount)} endpoints)`) : '';
  console.log(chalk.green(`  ✓ Generated ${file}${suffix}`));
}

/**
 * Display check mode results
 */
function showCheckResults(upToDate: boolean, diff?: string[]): void {
  if (upToDate) {
    console.log(chalk.green('\n✓ Documentation is up to date.\n'));
  } else {
    console.log(chalk.yellow('\n✗ Documentation is out of date:\n'));
    if (diff) {
      for (const change of diff) {
        if (change.startsWith('+')) {
          console.log(chalk.green(`  ${change}`));
        } else if (change.startsWith('~')) {
          console.log(chalk.yellow(`  ${change}`));
        } else {
          console.log(chalk.gray(`  ${change}`));
        }
      }
    }
    console.log(chalk.gray('\nRun "pnpm core docs sync --api" to update.\n'));
  }
}

/**
 * Display success message with file list
 */
function showGenerationSuccess(files: string[], outputDir: string): void {
  console.log(chalk.green('\nAPI documentation generated successfully!'));
  console.log(chalk.gray(`  ${String(files.length)} files written to ${outputDir}/\n`));
}

/**
 * Display next steps after generation
 */
function showDocsNextSteps(outputDir: string): void {
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.white(`  1. Review generated files in ${outputDir}/`));
  console.log(chalk.white("  2. Run 'pnpm dev' in apps/docs to preview"));
  console.log(chalk.white('  3. Commit the generated documentation'));
  console.log('');
}

/**
 * Display dry run notice
 */
function showDryRunNotice(): void {
  console.log(chalk.yellow('\n[Dry Run] No files were written.\n'));
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Determine if a source is a URL
 */
function isUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Resolve source path to absolute if it's a file path
 */
function _resolveSourcePath(source: string): string {
  if (isUrl(source)) {
    return source;
  }

  // If already absolute, return as-is
  if (path.isAbsolute(source)) {
    return source;
  }

  // Resolve relative to current working directory
  return path.resolve(process.cwd(), source);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate sync command options
 */
function validateSyncOptions(options: SyncCommandOptions): void {
  // Currently, --api is the only supported mode
  if (!options.api) {
    console.log(chalk.yellow('\nNo documentation type specified.'));
    console.log(chalk.gray('Use --api to generate API documentation from OpenAPI spec.\n'));
    console.log(chalk.cyan('Example:'));
    console.log(chalk.white('  pnpm core docs sync --api'));
    console.log(
      chalk.white('  pnpm core docs sync --api --source http://localhost:3001/openapi.json\n')
    );
    process.exit(1);
  }
}

// ============================================================================
// Command Handler
// ============================================================================

/**
 * Handle the docs sync command
 */
async function handleDocsSync(cmdOptions: SyncCommandOptions): Promise<void> {
  // Validate options
  validateSyncOptions(cmdOptions);

  const source = cmdOptions.source ?? DEFAULT_OPENAPI_SOURCE;
  const verbose = cmdOptions.verbose ?? false;
  const dryRun = cmdOptions.dryRun ?? false;
  const check = cmdOptions.check ?? false;
  const name = cmdOptions.name ?? DEFAULT_API_NAME;

  // Resolve output directory with API name
  let outputDir: string;
  try {
    const monorepoRoot = getMonorepoRoot();
    outputDir = path.join(monorepoRoot, DEFAULT_OUTPUT_DIR, `api-${name}`);
  } catch {
    console.log(chalk.red('\nError: Could not detect monorepo root.'));
    console.log(chalk.gray('Make sure you are running this command from within the monorepo.\n'));
    process.exit(1);
  }

  // Show mode-specific header
  if (check) {
    console.log(chalk.cyan('\nChecking API documentation status...\n'));
  } else if (dryRun) {
    console.log(chalk.cyan('\nPreviewing API documentation generation...\n'));
  } else {
    console.log(chalk.cyan('\nGenerating API documentation...\n'));
  }

  // Show source info
  console.log(chalk.gray(`Source: ${source}`));
  console.log(chalk.gray(`Output: ${outputDir}/`));
  console.log('');

  // Build options
  const syncOptions: DocsSyncOptions = {
    api: true,
    check,
    source,
    outputDir,
    dryRun,
    verbose,
    name,
  };

  // Execute generation
  try {
    const result = await generateApiDocsFromSource(source, syncOptions);

    if (!result.success) {
      console.log(chalk.red(`\nError: ${result.message}\n`));

      // Provide helpful hints for common errors
      if (result.message.includes('Failed to fetch') || result.message.includes('ECONNREFUSED')) {
        console.log(
          chalk.gray('Hint: Make sure the API server is running at the specified source URL.')
        );
        console.log(chalk.gray('      You can start it with: pnpm --filter api-example dev\n'));
      }

      process.exit(1);
    }

    // Handle check mode
    if (check) {
      showCheckResults(result.upToDate ?? false, result.diff);
      process.exit(result.upToDate ? 0 : 1);
    }

    // Handle dry run mode
    if (dryRun) {
      // The generator already logged detailed output
      showDryRunNotice();
      return;
    }

    // Show generation results
    for (const file of result.files) {
      // Estimate endpoint count from filename (index has none, others vary)
      const isIndex = file === 'index.md';
      showFileProgress(file, isIndex ? undefined : undefined);
    }

    showGenerationSuccess(result.files, outputDir);
    showDocsNextSteps(outputDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`\nUnexpected error: ${message}\n`));
    process.exit(1);
  }
}

// ============================================================================
// Command Creation
// ============================================================================

/**
 * Create the 'docs sync' subcommand
 */
function createSyncCommand(): Command {
  return new Command('sync')
    .description('Sync documentation with current codebase')
    .option('--api', 'Generate API documentation from OpenAPI spec')
    .option('--check', 'Verify docs are up-to-date (exit 1 if stale)')
    .option('--source <url>', `OpenAPI spec source URL or file path`, DEFAULT_OPENAPI_SOURCE)
    .option('--name <name>', 'API name for grouping (e.g., "api-example")', DEFAULT_API_NAME)
    .option('--dry-run', 'Preview changes without writing files')
    .option('--verbose', 'Show detailed progress')
    .action(handleDocsSync);
}

/**
 * Create the 'docs generate' subcommand (alias for sync --api)
 */
function createGenerateCommand(): Command {
  return new Command('generate')
    .description('Generate API documentation from OpenAPI specs (alias for sync --api)')
    .option('--check', 'Verify docs are up-to-date (exit 1 if stale)')
    .option('--source <url>', `OpenAPI spec source URL or file path`, DEFAULT_OPENAPI_SOURCE)
    .option('--name <name>', 'API name for grouping (e.g., "api-example")', DEFAULT_API_NAME)
    .option('--dry-run', 'Preview changes without writing files')
    .option('--verbose', 'Show detailed progress')
    .action(async (cmdOptions: Omit<SyncCommandOptions, 'api'>) => {
      // Treat generate as sync --api
      await handleDocsSync({ ...cmdOptions, api: true });
    });
}

/**
 * Create the 'docs' command with subcommands
 */
export function createDocsCommand(): Command {
  const docsCmd = new Command('docs')
    .description('Documentation management commands')
    .addCommand(createSyncCommand())
    .addCommand(createGenerateCommand());

  return docsCmd;
}
