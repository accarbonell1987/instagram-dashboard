/**
 * OpenAPI Parser
 * Fetches and parses OpenAPI specifications into normalized format
 * @core/cli
 */

import fsExtra from 'fs-extra';

import type {
  ParsedOpenApi,
  OpenApiEndpoint,
  OpenApiParameter,
  ResponseSchema,
} from '../../types.js';

const fs = fsExtra;

// ============================================================================
// Raw OpenAPI Types (for parsing)
// ============================================================================

/** Raw OpenAPI 3.x specification structure */
export interface RawOpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: { url: string; description?: string }[];
  paths: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
    securitySchemes?: Record<string, unknown>;
  };
}

/** OpenAPI path item (contains operations for each HTTP method) */
export interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  parameters?: RawOpenApiParameter[];
}

/** Raw OpenAPI operation */
export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: RawOpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: {
      'application/json'?: {
        schema?: Record<string, unknown>;
      };
    };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: {
        'application/json'?: {
          schema?: Record<string, unknown>;
        };
      };
    }
  >;
  security?: Record<string, string[]>[];
}

/** Raw OpenAPI parameter */
interface RawOpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default OpenAPI spec URL */
export const DEFAULT_OPENAPI_URL = 'http://localhost:3001/openapi.json';

/** HTTP methods to extract from paths */
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;

// ============================================================================
// Fetching Functions
// ============================================================================

/**
 * Determine if a source is a URL or file path
 */
function isUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Fetch OpenAPI spec from a URL
 */
async function fetchFromUrl(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error(`Could not fetch OpenAPI spec from ${url}. Is the server running?`);
      }
      throw new Error(`Failed to fetch OpenAPI spec: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Read OpenAPI spec from a file
 */
async function fetchFromFile(filePath: string): Promise<unknown> {
  try {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf-8');

    // Support both JSON and YAML (basic JSON for now)
    if (filePath.endsWith('.json')) {
      return JSON.parse(content) as unknown;
    }

    // For YAML support, we would need to add a yaml parser
    // For now, assume JSON
    return JSON.parse(content) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

/**
 * Fetch OpenAPI spec from URL or file path
 */
export async function fetchOpenApiSpec(source: string): Promise<unknown> {
  if (isUrl(source)) {
    return fetchFromUrl(source);
  }
  return fetchFromFile(source);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if the OpenAPI version is supported (3.0.x or 3.1.x)
 */
export function isValidOpenApiVersion(version: string): boolean {
  return version.startsWith('3.0') || version.startsWith('3.1');
}

/**
 * Validate raw OpenAPI specification structure
 * Throws descriptive errors for invalid specs
 */
function validateOpenApiSpec(raw: unknown): asserts raw is RawOpenApiSpec {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid OpenAPI specification: Expected an object');
  }

  const spec = raw as Record<string, unknown>;

  // Check openapi version field
  if (!('openapi' in spec) || typeof spec['openapi'] !== 'string') {
    throw new Error("Invalid OpenAPI specification: Missing required field 'openapi'");
  }

  const openApiVersion = spec['openapi'];

  // Check version is 3.x
  if (openApiVersion.startsWith('2.')) {
    throw new Error(
      'Unsupported OpenAPI version. Requires OpenAPI 3.0 or later. Found Swagger 2.x specification.'
    );
  }

  if (!isValidOpenApiVersion(openApiVersion)) {
    throw new Error(`Unsupported OpenAPI version: ${openApiVersion}. Requires OpenAPI 3.0 or 3.1.`);
  }

  // Check info field
  if (!('info' in spec) || typeof spec['info'] !== 'object' || spec['info'] === null) {
    throw new Error("Invalid OpenAPI specification: Missing required field 'info'");
  }

  const info = spec['info'] as Record<string, unknown>;
  if (!('title' in info) || typeof info['title'] !== 'string') {
    throw new Error("Invalid OpenAPI specification: Missing required field 'info.title'");
  }

  if (!('version' in info) || typeof info['version'] !== 'string') {
    throw new Error("Invalid OpenAPI specification: Missing required field 'info.version'");
  }

  // Check paths field
  if (!('paths' in spec) || typeof spec['paths'] !== 'object' || spec['paths'] === null) {
    throw new Error("Invalid OpenAPI specification: Missing required field 'paths'");
  }
}

// ============================================================================
// Schema Resolution
// ============================================================================

/**
 * Resolve $ref references within schemas
 * Handles local references like "#/components/schemas/User"
 */
function resolveRef(
  ref: string,
  schemas: Record<string, Record<string, unknown>>
): Record<string, unknown> | undefined {
  // Only handle local component schema refs
  const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
  if (match?.[1]) {
    return schemas[match[1]];
  }
  return undefined;
}

/**
 * Recursively resolve $ref in a schema object
 * Returns a new object with refs expanded (one level deep to avoid cycles)
 */
function resolveSchemaRefs(
  schema: Record<string, unknown>,
  allSchemas: Record<string, Record<string, unknown>>,
  depth = 0
): Record<string, unknown> {
  // Prevent infinite recursion
  if (depth > 3) {
    return schema;
  }

  // Handle $ref at top level
  if ('$ref' in schema && typeof schema['$ref'] === 'string') {
    const resolved = resolveRef(schema['$ref'], allSchemas);
    if (resolved) {
      return resolveSchemaRefs(resolved, allSchemas, depth + 1);
    }
    return schema;
  }

  // Handle arrays with items
  if ('items' in schema && typeof schema['items'] === 'object' && schema['items'] !== null) {
    const items = schema['items'] as Record<string, unknown>;
    if ('$ref' in items && typeof items['$ref'] === 'string') {
      const resolved = resolveRef(items['$ref'], allSchemas);
      if (resolved) {
        return {
          ...schema,
          items: resolveSchemaRefs(resolved, allSchemas, depth + 1),
        };
      }
    }
  }

  // Handle object properties
  if (
    'properties' in schema &&
    typeof schema['properties'] === 'object' &&
    schema['properties'] !== null
  ) {
    const properties = schema['properties'] as Record<string, Record<string, unknown>>;
    const resolvedProperties: Record<string, Record<string, unknown>> = {};

    for (const [key, propSchema] of Object.entries(properties)) {
      if ('$ref' in propSchema && typeof propSchema['$ref'] === 'string') {
        const resolved = resolveRef(propSchema['$ref'], allSchemas);
        if (resolved) {
          resolvedProperties[key] = resolveSchemaRefs(resolved, allSchemas, depth + 1);
        } else {
          resolvedProperties[key] = propSchema;
        }
      } else {
        resolvedProperties[key] = resolveSchemaRefs(propSchema, allSchemas, depth + 1);
      }
    }

    return {
      ...schema,
      properties: resolvedProperties,
    };
  }

  // Handle allOf, oneOf, anyOf
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    if (keyword in schema && Array.isArray(schema[keyword])) {
      const items = schema[keyword] as Record<string, unknown>[];
      return {
        ...schema,
        [keyword]: items.map((item) => {
          if ('$ref' in item && typeof item['$ref'] === 'string') {
            const resolved = resolveRef(item['$ref'], allSchemas);
            return resolved ? resolveSchemaRefs(resolved, allSchemas, depth + 1) : item;
          }
          return resolveSchemaRefs(item, allSchemas, depth + 1);
        }),
      };
    }
  }

  return schema;
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Extract tag from operation, with fallback to path segment
 */
function extractTag(operation: OpenApiOperation, path: string): string {
  // Use first tag if available
  if (operation.tags && operation.tags.length > 0) {
    const firstTag = operation.tags[0];
    if (firstTag !== undefined) {
      return firstTag;
    }
  }

  // Fallback: extract first path segment (e.g., /api/users -> users)
  const segments = path.split('/').filter(Boolean);
  // Skip 'api' prefix if present
  const firstSegment = segments[0] === 'api' ? segments[1] : segments[0];
  return firstSegment ?? 'General';
}

/**
 * Parse parameters from operation
 */
function parseParameters(
  operation: OpenApiOperation,
  pathItem: OpenApiPathItem
): OpenApiParameter[] {
  const params: OpenApiParameter[] = [];
  const seen = new Set<string>();

  // Combine path-level and operation-level parameters
  const allParams = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];

  for (const param of allParams) {
    // Skip duplicates (operation params override path params)
    const key = `${param.in}:${param.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Only include path, query, header (not cookie)
    if (param.in !== 'path' && param.in !== 'query' && param.in !== 'header') {
      continue;
    }

    params.push({
      name: param.name,
      in: param.in,
      required: param.required ?? param.in === 'path', // Path params are always required
      description: param.description,
      schema: param.schema ?? { type: 'string' },
    });
  }

  return params;
}

/**
 * Extract request body schema from operation
 */
function extractRequestSchema(
  operation: OpenApiOperation,
  allSchemas: Record<string, Record<string, unknown>>
): Record<string, unknown> | undefined {
  const jsonContent = operation.requestBody?.content?.['application/json'];
  if (!jsonContent?.schema) {
    return undefined;
  }

  return resolveSchemaRefs(jsonContent.schema, allSchemas);
}

/**
 * Extract response schemas from operation
 */
function extractResponseSchemas(
  operation: OpenApiOperation,
  allSchemas: Record<string, Record<string, unknown>>
): Record<string, ResponseSchema> {
  const responseSchemas: Record<string, ResponseSchema> = {};

  for (const [statusCode, response] of Object.entries(operation.responses)) {
    const jsonContent = response.content?.['application/json'];

    responseSchemas[statusCode] = {
      description: response.description,
      schema: jsonContent?.schema ? resolveSchemaRefs(jsonContent.schema, allSchemas) : undefined,
    };
  }

  return responseSchemas;
}

/**
 * Parse a single operation into normalized endpoint format
 */
function parseOperation(
  method: string,
  path: string,
  operation: OpenApiOperation,
  pathItem: OpenApiPathItem,
  allSchemas: Record<string, Record<string, unknown>>
): OpenApiEndpoint {
  return {
    method: method.toUpperCase(),
    path,
    summary: operation.summary ?? '',
    description: operation.description,
    tag: extractTag(operation, path),
    operationId: operation.operationId,
    parameters: parseParameters(operation, pathItem),
    requestSchema: extractRequestSchema(operation, allSchemas),
    responseSchemas: extractResponseSchemas(operation, allSchemas),
  };
}

/**
 * Parse validated OpenAPI spec into normalized structure
 */
export function parseOpenApiSpec(raw: unknown): ParsedOpenApi {
  // Validate first
  validateOpenApiSpec(raw);

  const spec = raw;
  const allSchemas = spec.components?.schemas ?? {};
  const endpoints: OpenApiEndpoint[] = [];

  // Process each path
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    // Process each HTTP method
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation) {
        endpoints.push(parseOperation(method, path, operation, pathItem, allSchemas));
      }
    }
  }

  return {
    title: spec.info.title,
    version: spec.info.version,
    description: spec.info.description,
    baseUrl: spec.servers?.[0]?.url,
    endpoints,
    schemas: allSchemas,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Group endpoints by their tag
 * Returns a map of tag -> endpoints, sorted alphabetically by tag
 */
export function groupEndpointsByTag(endpoints: OpenApiEndpoint[]): Map<string, OpenApiEndpoint[]> {
  const groups = new Map<string, OpenApiEndpoint[]>();

  for (const endpoint of endpoints) {
    const tag = endpoint.tag;
    if (!groups.has(tag)) {
      groups.set(tag, []);
    }
    const tagEndpoints = groups.get(tag);
    if (tagEndpoints) {
      tagEndpoints.push(endpoint);
    }
  }

  // Sort by tag name and return as new Map
  const sortedTags = Array.from(groups.keys()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const sortedGroups = new Map<string, OpenApiEndpoint[]>();
  for (const tag of sortedTags) {
    const tagEndpoints = groups.get(tag);
    if (tagEndpoints) {
      sortedGroups.set(tag, tagEndpoints);
    }
  }

  return sortedGroups;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Load and parse OpenAPI spec from URL or file
 * This is the main entry point for the parser
 */
export async function loadOpenApiSpec(
  source: string = DEFAULT_OPENAPI_URL
): Promise<ParsedOpenApi> {
  const raw = await fetchOpenApiSpec(source);
  return parseOpenApiSpec(raw);
}
