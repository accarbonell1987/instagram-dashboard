/**
 * Generators barrel export
 * @core/cli
 */

export { generateApi } from './api.generator.js';
export { generateWebapp } from './webapp.generator.js';

// Docs generators
export {
  fetchOpenApiSpec,
  parseOpenApiSpec,
  loadOpenApiSpec,
  isValidOpenApiVersion,
  groupEndpointsByTag,
} from './docs/index.js';

export type { RawOpenApiSpec, OpenApiOperation, OpenApiPathItem } from './docs/index.js';
