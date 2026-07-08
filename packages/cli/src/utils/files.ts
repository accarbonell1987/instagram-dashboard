/**
 * File System Utilities
 * @core/cli
 */

import path from 'node:path';

import fsExtra from 'fs-extra';

// fs-extra re-exports all of fs, so we use it directly
const fs = fsExtra;
import type { TemplateVariables, TemplateFile } from '../types.js';

import { processTemplate, processPathTemplate } from './templates.js';

/**
 * Get the root directory of the monorepo
 */
export function getMonorepoRoot(): string {
  // Walk up from current directory to find package.json with "mono-template" name
  let currentDir = process.cwd();

  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = fs.readJsonSync(packageJsonPath) as {
          name?: string;
        };
        if (packageJson.name === 'mono-template') {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }

    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not find monorepo root. Make sure you are inside the monorepo.');
}

/**
 * Get the templates directory path
 */
export function getTemplatesDir(): string {
  return path.join(getMonorepoRoot(), 'templates');
}

/**
 * Get the apps directory path
 */
export function getAppsDir(): string {
  return path.join(getMonorepoRoot(), 'apps');
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if an app with the given name already exists
 */
export async function appExists(name: string): Promise<boolean> {
  const appPath = path.join(getAppsDir(), name);
  return directoryExists(appPath);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Copy a file with optional template processing
 */
export async function copyTemplateFile(
  sourcePath: string,
  destPath: string,
  variables: TemplateVariables,
  processContent: boolean
): Promise<void> {
  await ensureDir(path.dirname(destPath));

  if (processContent) {
    const content = await fs.readFile(sourcePath, 'utf-8');
    const processedContent = processTemplate(content, variables);
    await fs.writeFile(destPath, processedContent, 'utf-8');
  } else {
    await fs.copy(sourcePath, destPath);
  }
}

/**
 * Copy all template files according to manifest
 */
export async function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  files: TemplateFile[],
  variables: TemplateVariables
): Promise<string[]> {
  const createdFiles: string[] = [];

  for (const file of files) {
    const sourcePath = path.join(templateDir, file.source);
    const destPath = path.join(targetDir, processPathTemplate(file.destination, variables));

    await copyTemplateFile(sourcePath, destPath, variables, file.process);
    createdFiles.push(destPath);
  }

  return createdFiles;
}

/**
 * Read a JSON file and parse it
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  return fs.readJson(filePath) as Promise<T>;
}

/**
 * Write a JSON file with formatting
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * Get list of existing apps in the monorepo
 */
export async function getExistingApps(): Promise<string[]> {
  const appsDir = getAppsDir();

  if (!(await directoryExists(appsDir))) {
    return [];
  }

  const entries = await fs.readdir(appsDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** Package.json structure for port extraction */
interface PackageJsonWithScripts {
  scripts?: {
    dev?: string;
  };
}

/**
 * Read package.json from an app directory
 */
export async function readAppPackageJson(appName: string): Promise<{ port?: number } | null> {
  const packageJsonPath = path.join(getAppsDir(), appName, 'package.json');

  try {
    const packageJson = await readJsonFile<PackageJsonWithScripts>(packageJsonPath);
    // Try to extract port from scripts
    const devScript = packageJson.scripts?.dev;
    if (devScript) {
      const portMatch = /--port[=\s]+(\d+)/.exec(devScript);
      if (portMatch?.[1]) {
        return { port: parseInt(portMatch[1], 10) };
      }
    }
    return {};
  } catch {
    return null;
  }
}
