/**
 * API Resource Template
 * Generates one markdown file per tag (users.md, roles.md, etc.)
 * @core/cli
 */

import type { OpenApiEndpoint, OpenApiParameter, ResponseSchema } from '../../../types.js';

import {
  schemaToMarkdownTable,
  parametersToMarkdownTable,
  schemaToJsonCodeBlock,
} from './schema-formatter.js';

// ============================================================================
// Types
// ============================================================================

/** Options for generating a resource page */
export interface ApiResourceOptions {
  /** Order value for frontmatter */
  order?: number | undefined;
  /** Date for frontmatter (defaults to current date) */
  date?: string | undefined;
  /** Include JSON examples in response sections */
  includeExamples?: boolean | undefined;
  /** API name for category grouping */
  apiName?: string | undefined;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get current date in ISO format (YYYY-MM-DD)
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0] ?? '2026-03-13';
}

/**
 * Convert tag to title case for display
 */
function tagToTitle(tag: string): string {
  return tag
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get method badge (bold text)
 */
function getMethodBadge(method: string): string {
  return `**${method.toUpperCase()}**`;
}

/**
 * Highlight path parameters in a path
 * /api/users/{id} -> /api/users/`{id}`
 */
function highlightPathParams(path: string): string {
  return path.replace(/\{([^}]+)\}/g, '`{$1}`');
}

/**
 * Generate anchor ID from method and path
 */
function generateAnchorId(method: string, path: string): string {
  const cleanPath = path.replace(/[{}]/g, '').replace(/\//g, '-').replace(/^-|-$/g, '');
  return `${method.toLowerCase()}${cleanPath}`;
}

// ============================================================================
// Frontmatter Generation
// ============================================================================

/**
 * Generate YAML frontmatter for the resource page
 */
function generateFrontmatter(
  tag: string,
  endpoints: OpenApiEndpoint[],
  options: ApiResourceOptions
): string {
  const apiName = options.apiName ?? 'api';
  const title = `API Reference: ${tagToTitle(tag)}`;
  // Use first endpoint's description or generate one
  const firstEndpoint = endpoints[0];
  const description =
    firstEndpoint?.description?.split('.')[0] ??
    `Endpoints for ${tagToTitle(tag).toLowerCase()} management`;
  const order = options.order ?? 10;
  const date = options.date ?? getCurrentDate();
  const category = `API: ${apiName}`;

  return `---
title: "${title}"
description: "${description}"
category: "${category}"
order: ${String(order)}
date: "${date}"
generated: true
---
`;
}

// ============================================================================
// Parameter Sections
// ============================================================================

/**
 * Group parameters by location (path, query, header)
 */
function groupParameters(parameters: OpenApiParameter[] | undefined): {
  path: OpenApiParameter[];
  query: OpenApiParameter[];
  header: OpenApiParameter[];
} {
  const groups = {
    path: [] as OpenApiParameter[],
    query: [] as OpenApiParameter[],
    header: [] as OpenApiParameter[],
  };

  if (!parameters) return groups;

  for (const param of parameters) {
    const location = param.in;
    if (location === 'path') {
      groups.path.push(param);
    } else if (location === 'query') {
      groups.query.push(param);
    } else {
      // location === 'header'
      groups.header.push(param);
    }
  }

  return groups;
}

/**
 * Generate parameters section for an endpoint
 */
function generateParametersSection(parameters: OpenApiParameter[] | undefined): string {
  if (!parameters || parameters.length === 0) {
    return '';
  }

  const groups = groupParameters(parameters);
  const lines: string[] = [];

  // Path parameters
  if (groups.path.length > 0) {
    lines.push('**Path Parameters**\n');
    lines.push(parametersToMarkdownTable(groups.path));
  }

  // Query parameters
  if (groups.query.length > 0) {
    lines.push('**Query Parameters**\n');
    lines.push(parametersToMarkdownTable(groups.query));
  }

  // Header parameters
  if (groups.header.length > 0) {
    lines.push('**Headers**\n');
    lines.push(parametersToMarkdownTable(groups.header));
  }

  return lines.join('\n');
}

// ============================================================================
// Request Body Section
// ============================================================================

/**
 * Generate request body section
 */
function generateRequestBodySection(
  requestSchema: Record<string, unknown> | undefined,
  includeExamples: boolean
): string {
  if (!requestSchema) {
    return '';
  }

  const lines: string[] = [];

  lines.push('**Request Body**\n');
  lines.push(schemaToMarkdownTable(requestSchema));

  if (includeExamples) {
    lines.push('**Example Request**\n');
    lines.push(schemaToJsonCodeBlock(requestSchema));
  }

  return lines.join('\n');
}

// ============================================================================
// Response Section
// ============================================================================

/**
 * Sort status codes (2xx first, then 4xx, then 5xx)
 */
function sortStatusCodes(codes: string[]): string[] {
  return codes.sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    // Default is last
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });
}

/**
 * Generate response section for an endpoint
 */
function generateResponseSection(
  responseSchemas: Record<string, ResponseSchema>,
  includeExamples: boolean
): string {
  const codes = sortStatusCodes(Object.keys(responseSchemas));
  const lines: string[] = [];

  lines.push('**Responses**\n');

  for (const code of codes) {
    const response = responseSchemas[code];
    if (!response) continue;

    const codeLabel = code === 'default' ? 'Default' : code;
    lines.push(`#### Response ${codeLabel}\n`);
    lines.push(`${response.description}\n`);

    if (response.schema) {
      lines.push(schemaToMarkdownTable(response.schema));

      if (includeExamples) {
        lines.push('**Example Response**\n');
        lines.push(schemaToJsonCodeBlock(response.schema));
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Endpoint Section
// ============================================================================

/**
 * Generate markdown for a single endpoint
 */
function generateEndpointSection(endpoint: OpenApiEndpoint, includeExamples: boolean): string {
  const lines: string[] = [];

  // Heading with method and path
  const anchorId = generateAnchorId(endpoint.method, endpoint.path);
  const method = getMethodBadge(endpoint.method);
  const path = highlightPathParams(endpoint.path);

  lines.push(`### ${method} ${path} {#${anchorId}}\n`);

  // Summary/description
  if (endpoint.summary) {
    lines.push(`${endpoint.summary}\n`);
  }

  if (endpoint.description && endpoint.description !== endpoint.summary) {
    lines.push(`${endpoint.description}\n`);
  }

  // Operation ID (useful for SDK generation)
  if (endpoint.operationId) {
    lines.push(`> Operation ID: \`${endpoint.operationId}\`\n`);
  }

  // Parameters
  const paramsSection = generateParametersSection(endpoint.parameters);
  if (paramsSection) {
    lines.push(paramsSection);
  }

  // Request body
  const requestSection = generateRequestBodySection(endpoint.requestSchema, includeExamples);
  if (requestSection) {
    lines.push(requestSection);
  }

  // Responses
  lines.push(generateResponseSection(endpoint.responseSchemas, includeExamples));

  lines.push('---\n');

  return lines.join('\n');
}

// ============================================================================
// Table of Contents
// ============================================================================

/**
 * Generate table of contents for endpoints
 */
function generateTableOfContents(endpoints: OpenApiEndpoint[]): string {
  const lines: string[] = [];

  lines.push('## Endpoints\n');
  lines.push('| Method | Path | Description |');
  lines.push('|--------|------|-------------|');

  for (const endpoint of endpoints) {
    const anchorId = generateAnchorId(endpoint.method, endpoint.path);
    const method = `**${endpoint.method}**`;
    const path = `[\`${endpoint.path}\`](#${anchorId})`;
    const summary = endpoint.summary || '-';

    lines.push(`| ${method} | ${path} | ${summary} |`);
  }

  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate markdown for a resource (tag) page
 * One file per tag with all endpoints in that group
 */
export function generateResourceMarkdown(
  tag: string,
  endpoints: OpenApiEndpoint[],
  options: ApiResourceOptions = {}
): string {
  const lines: string[] = [];
  const includeExamples = options.includeExamples ?? true;

  // Frontmatter
  lines.push(generateFrontmatter(tag, endpoints, options));

  // Title
  const title = tagToTitle(tag);
  lines.push(`# ${title}\n`);

  // Intro text
  const firstEndpoint = endpoints[0];
  const intro =
    firstEndpoint?.description?.split('.')[0] ??
    `Endpoints for managing ${title.toLowerCase()} in the system.`;
  lines.push(`${intro}.\n`);

  // Table of contents
  lines.push(generateTableOfContents(endpoints));

  // Each endpoint
  for (const endpoint of endpoints) {
    lines.push(generateEndpointSection(endpoint, includeExamples));
  }

  return lines.join('\n');
}
