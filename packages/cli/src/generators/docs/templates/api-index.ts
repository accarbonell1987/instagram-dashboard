/**
 * API Index Template
 * Generates overview page listing all endpoints grouped by tag
 * @core/cli
 */

import type { ParsedOpenApi, OpenApiEndpoint } from '../../../types.js';

// ============================================================================
// Types
// ============================================================================

/** Options for generating the API index */
export interface ApiIndexOptions {
  /** Override the title */
  title?: string | undefined;
  /** Override the description */
  description?: string | undefined;
  /** Order value for frontmatter */
  order?: number | undefined;
  /** Date for frontmatter (defaults to current date) */
  date?: string | undefined;
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
 * Convert tag to slug for file/anchor naming
 */
export function tagToSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
 * Count endpoints by method
 */
function countByMethod(endpoints: OpenApiEndpoint[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const endpoint of endpoints) {
    const method = endpoint.method.toUpperCase();
    counts[method] = (counts[method] ?? 0) + 1;
  }
  return counts;
}

// ============================================================================
// Frontmatter Generation
// ============================================================================

/**
 * Generate YAML frontmatter for the API index
 */
function generateFrontmatter(spec: ParsedOpenApi, options: ApiIndexOptions): string {
  const apiName = options.apiName ?? 'api';
  const title = options.title ?? `API Reference: ${spec.title}`;
  const description =
    options.description ?? spec.description ?? `Complete API documentation for ${spec.title}`;
  const order = options.order ?? 1;
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
// Content Generation
// ============================================================================

/**
 * Generate resource table with endpoint counts
 */
function generateResourceTable(groups: Map<string, OpenApiEndpoint[]>): string {
  const lines: string[] = [];

  lines.push('## Resources\n');
  lines.push('| Resource | Endpoints | Description |');
  lines.push('|----------|-----------|-------------|');

  for (const [tag, endpoints] of groups) {
    const slug = tagToSlug(tag);
    const title = tagToTitle(tag);
    const count = endpoints.length;
    // Generate description from first endpoint or tag
    const description =
      endpoints[0]?.description?.split('.')[0] ?? `Endpoints for managing ${title.toLowerCase()}`;

    lines.push(`| [${title}](./${slug}.md) | ${String(count)} | ${description} |`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate method summary section
 */
function generateMethodSummary(endpoints: OpenApiEndpoint[]): string {
  const counts = countByMethod(endpoints);
  const lines: string[] = [];

  lines.push('## Overview\n');
  lines.push(
    `This API provides **${String(endpoints.length)}** endpoints across multiple resources.\n`
  );

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const summary = methods
    .filter((m) => counts[m])
    .map((m) => `${String(counts[m] ?? 0)} ${m}`)
    .join(', ');

  if (summary) {
    lines.push(`**Methods:** ${summary}\n`);
  }

  return lines.join('\n');
}

/**
 * Generate base URL section
 */
function generateBaseUrlSection(spec: ParsedOpenApi): string {
  if (!spec.baseUrl) {
    return '';
  }

  return `## Base URL

\`\`\`
${spec.baseUrl}
\`\`\`

`;
}

/**
 * Generate quick reference table with all endpoints
 */
function generateQuickReference(groups: Map<string, OpenApiEndpoint[]>): string {
  const lines: string[] = [];

  lines.push('## Quick Reference\n');

  for (const [tag, endpoints] of groups) {
    const title = tagToTitle(tag);
    const slug = tagToSlug(tag);

    lines.push(`### ${title}\n`);
    lines.push('| Method | Path | Description |');
    lines.push('|--------|------|-------------|');

    for (const endpoint of endpoints) {
      const method = `**${endpoint.method}**`;
      const path = `\`${endpoint.path}\``;
      const summary = endpoint.summary || '-';
      lines.push(`| ${method} | ${path} | ${summary} |`);
    }

    lines.push('');
    lines.push(`[View all ${title} endpoints](./${slug}.md)\n`);
  }

  return lines.join('\n');
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate the API index markdown page
 * Lists all endpoints grouped by tag with navigation
 */
export function generateApiIndexMarkdown(
  spec: ParsedOpenApi,
  groups: Map<string, OpenApiEndpoint[]>,
  options: ApiIndexOptions = {}
): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push(generateFrontmatter(spec, options));

  // Title and intro
  lines.push(`# ${spec.title}\n`);

  if (spec.description) {
    lines.push(`${spec.description}\n`);
  }

  if (spec.version) {
    lines.push(`**Version:** ${spec.version}\n`);
  }

  // Base URL
  lines.push(generateBaseUrlSection(spec));

  // Overview with counts
  lines.push(generateMethodSummary(spec.endpoints));

  // Resource table
  lines.push(generateResourceTable(groups));

  // Quick reference
  lines.push(generateQuickReference(groups));

  return lines.join('\n');
}
