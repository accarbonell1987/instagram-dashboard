/**
 * CLI Types and Interfaces
 * @core/cli
 */

/** Type of application that can be generated */
export type AppType = 'api' | 'webapp';

/** Base options shared by all generators */
export interface BaseGeneratorOptions {
  /** Name of the application (kebab-case) */
  name: string;
  /** Target directory (defaults to apps/{name}) */
  targetDir?: string | undefined;
  /** Port number for the development server */
  port?: number | undefined;
}

/** Options specific to API generation */
export interface ApiGeneratorOptions extends BaseGeneratorOptions {
  /** Include Prisma database setup */
  database?: boolean | undefined;
  /** Include authentication scaffolding */
  auth?: boolean | undefined;
}

/** Options specific to webapp generation */
export interface WebappGeneratorOptions extends BaseGeneratorOptions {
  /** API URL to connect to */
  apiUrl?: string | undefined;
  /** Initial theme name */
  theme?: string | undefined;
}

/**
 * Input types for prompting functions
 * These allow undefined for required fields since they'll be prompted for
 */
export interface ApiGeneratorInput {
  name?: string | undefined;
  targetDir?: string | undefined;
  port?: number | undefined;
  database?: boolean | undefined;
  auth?: boolean | undefined;
}

export interface WebappGeneratorInput {
  name?: string | undefined;
  targetDir?: string | undefined;
  port?: number | undefined;
  apiUrl?: string | undefined;
  theme?: string | undefined;
}

/** Template variable replacements */
export interface TemplateVariables {
  /** Application name in kebab-case */
  name: string;
  /** Package name (e.g., @core/app-name or just app-name) */
  packageName: string;
  /** PascalCase version of name */
  pascalName: string;
  /** camelCase version of name */
  camelName: string;
  /** Port number as string */
  port: string;
  /** Additional custom variables */
  [key: string]: string;
}

/** Result of a generator operation */
export interface GeneratorResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Path to the generated application */
  appPath: string;
  /** Human-readable message */
  message: string;
  /** Files that were created */
  createdFiles: string[];
  /** Any warnings during generation */
  warnings: string[];
}

/** Configuration for a template file */
export interface TemplateFile {
  /** Source path relative to template directory */
  source: string;
  /** Destination path relative to target directory (supports template variables) */
  destination: string;
  /** Whether this file should be processed for variable replacement */
  process: boolean;
}

/** Template manifest configuration */
export interface TemplateManifest {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template type */
  type: AppType;
  /** List of files to copy/process */
  files: TemplateFile[];
  /** Post-generation instructions */
  postInstructions: string[];
}

/** Port allocation configuration */
export interface PortConfig {
  /** Starting port for APIs */
  apiStartPort: number;
  /** Starting port for webapps */
  webappStartPort: number;
}

/** Default port configuration */
export const DEFAULT_PORT_CONFIG: PortConfig = {
  apiStartPort: 3010,
  webappStartPort: 3020,
};

// ============================================================================
// Documentation Sync Types
// ============================================================================

/** Options for docs sync command */
export interface DocsSyncOptions {
  /** Generate API documentation from OpenAPI spec */
  api?: boolean | undefined;
  /** Check if docs are up-to-date without writing */
  check?: boolean | undefined;
  /** OpenAPI spec source (URL or file path) */
  source?: string | undefined;
  /** Output directory (defaults to apps/docs/src/content/generated) */
  outputDir?: string | undefined;
  /** Preview changes without modifying files */
  dryRun?: boolean | undefined;
  /** Show detailed generation progress */
  verbose?: boolean | undefined;
  /** API name for grouping (e.g., "api-example") */
  name?: string | undefined;
}

/** OpenAPI parameter (path, query, or header) */
export interface OpenApiParameter {
  /** Parameter name */
  name: string;
  /** Location of the parameter */
  in: 'path' | 'query' | 'header';
  /** Whether the parameter is required */
  required: boolean;
  /** Parameter description */
  description?: string | undefined;
  /** Parameter schema (JSON Schema) */
  schema: Record<string, unknown>;
}

/** Response schema with description */
export interface ResponseSchema {
  /** Response description */
  description: string;
  /** Response body schema (JSON Schema) */
  schema?: Record<string, unknown> | undefined;
}

/** Normalized OpenAPI endpoint */
export interface OpenApiEndpoint {
  /** HTTP method (GET, POST, PUT, DELETE, PATCH) */
  method: string;
  /** Full path including parameters (e.g., /api/users/{id}) */
  path: string;
  /** Operation summary (short description) */
  summary: string;
  /** Operation description (detailed) */
  description?: string | undefined;
  /** OpenAPI tag for grouping */
  tag: string;
  /** Operation ID (unique identifier) */
  operationId?: string | undefined;
  /** Request body schema (if applicable) */
  requestSchema?: Record<string, unknown> | undefined;
  /** Request parameters (path, query) */
  parameters?: OpenApiParameter[] | undefined;
  /** Response schemas by status code */
  responseSchemas: Record<string, ResponseSchema>;
}

/** Parsed and normalized OpenAPI specification */
export interface ParsedOpenApi {
  /** API title */
  title: string;
  /** API version */
  version: string;
  /** API description */
  description?: string | undefined;
  /** Base URL (from servers array) */
  baseUrl?: string | undefined;
  /** Normalized endpoints */
  endpoints: OpenApiEndpoint[];
  /** Reusable schemas (from components/schemas) */
  schemas: Record<string, Record<string, unknown>>;
}

/** Result of docs sync operation */
export interface DocsSyncResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Files that were created/updated */
  files: string[];
  /** Whether docs were up-to-date (only for --check) */
  upToDate?: boolean | undefined;
  /** Diff summary if not up-to-date */
  diff?: string[] | undefined;
}
