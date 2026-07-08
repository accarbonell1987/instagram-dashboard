/**
 * Docs Templates barrel export
 * @core/cli
 */

// Schema formatter utilities
export {
  flattenSchema,
  schemaToMarkdownTable,
  parametersToMarkdownTable,
  generateJsonExample,
  schemaToJsonCodeBlock,
} from './schema-formatter.js';

// API index template
export { generateApiIndexMarkdown, tagToSlug } from './api-index.js';
export type { ApiIndexOptions } from './api-index.js';

// API resource template
export { generateResourceMarkdown } from './api-resource.js';
export type { ApiResourceOptions } from './api-resource.js';
