/**
 * Generators barrel export
 * @core/cli
 */

export { generateApi } from './api.generator.js';
export { generateWebapp } from './webapp.generator.js';
export { generateProduct } from './product.generator.js';
export type { ProductGeneratorOptions } from './product.generator.js';
export {
  createDefaultProductDeclaration,
  validateProductDeclaration,
} from './product-declaration.js';
export type {
  ProductDeclaration,
  ProductModuleDeclaration,
  ProductPlanDeclaration,
  ProductRoleDeclaration,
  ValidationResult as ProductValidationResult,
} from './product-declaration.js';

// Docs generators
export {
  fetchOpenApiSpec,
  parseOpenApiSpec,
  loadOpenApiSpec,
  isValidOpenApiVersion,
  groupEndpointsByTag,
} from './docs/index.js';

export type { RawOpenApiSpec, OpenApiOperation, OpenApiPathItem } from './docs/index.js';
