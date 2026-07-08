/**
 * Template Processing Utilities
 * @core/cli
 */

import type { TemplateVariables } from '../types.js';

/**
 * Convert a kebab-case string to PascalCase
 * @example kebabToPascal('my-app-name') // 'MyAppName'
 */
export function kebabToPascal(str: string): string {
  return str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Convert a kebab-case string to camelCase
 * @example kebabToCamel('my-app-name') // 'myAppName'
 */
export function kebabToCamel(str: string): string {
  const pascal = kebabToPascal(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Validate that a name is in valid kebab-case format
 * @throws Error if name is invalid
 */
export function validateKebabCase(name: string): void {
  const kebabRegex = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  if (!kebabRegex.test(name)) {
    throw new Error(
      `Invalid name "${name}". Must be kebab-case (lowercase letters, numbers, and hyphens, starting with a letter).`
    );
  }
}

/**
 * Create template variables from a name and port
 */
export function createTemplateVariables(
  name: string,
  port: number,
  additionalVars: Record<string, string> = {}
): TemplateVariables {
  validateKebabCase(name);

  return {
    name,
    packageName: name,
    pascalName: kebabToPascal(name),
    camelName: kebabToCamel(name),
    port: port.toString(),
    ...additionalVars,
  };
}

/**
 * Replace template placeholders in content
 * Supports {{variable}} syntax
 */
export function processTemplate(content: string, variables: TemplateVariables): string {
  let result = content;

  for (const [key, value] of Object.entries(variables)) {
    // Replace all occurrences of {{key}} with value
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(placeholder, value);
  }

  return result;
}

/**
 * Process a file path template (for destination paths)
 */
export function processPathTemplate(path: string, variables: TemplateVariables): string {
  return processTemplate(path, variables);
}

/**
 * Check if content contains any unprocessed template variables
 * Returns the list of unprocessed variables
 */
export function findUnprocessedVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];

  return Array.from(new Set(matches.map((m) => m.slice(2, -2))));
}
