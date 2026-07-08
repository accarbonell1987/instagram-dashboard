/**
 * Docs Generator barrel export
 * @core/cli
 */

// OpenAPI Parser
export {
  fetchOpenApiSpec,
  parseOpenApiSpec,
  loadOpenApiSpec,
  isValidOpenApiVersion,
  groupEndpointsByTag,
} from './openapi-parser.js';

export type { RawOpenApiSpec, OpenApiOperation, OpenApiPathItem } from './openapi-parser.js';

// Markdown Generator
export { generateApiDocs, generateApiDocsFromSource } from './markdown-generator.js';

// Templates (re-export for extensibility)
export {
  generateApiIndexMarkdown,
  generateResourceMarkdown,
  tagToSlug,
  schemaToMarkdownTable,
  parametersToMarkdownTable,
  generateJsonExample,
  schemaToJsonCodeBlock,
} from './templates/index.js';

export type { ApiIndexOptions, ApiResourceOptions } from './templates/index.js';
