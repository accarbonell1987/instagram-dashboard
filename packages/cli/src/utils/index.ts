/**
 * Utilities barrel export
 * @core/cli
 */

export {
  kebabToPascal,
  kebabToCamel,
  validateKebabCase,
  createTemplateVariables,
  processTemplate,
  processPathTemplate,
  findUnprocessedVariables,
} from './templates.js';

export {
  getMonorepoRoot,
  getTemplatesDir,
  getAppsDir,
  directoryExists,
  appExists,
  ensureDir,
  copyTemplateFile,
  copyTemplateFiles,
  readJsonFile,
  writeJsonFile,
  getExistingApps,
  readAppPackageJson,
} from './files.js';

export {
  promptForName,
  confirmOverwrite,
  promptApiOptions,
  promptWebappOptions,
  showSuccess,
  showError,
  showWarning,
  showNextSteps,
} from './prompts.js';
