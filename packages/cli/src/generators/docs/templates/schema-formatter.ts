/**
 * Schema Formatter
 * Converts JSON Schema to readable markdown tables and examples
 * @core/cli
 */

// ============================================================================
// Types
// ============================================================================

/** Schema property for table rendering */
interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** Flattened schema for rendering */
interface FlattenedSchema {
  properties: SchemaProperty[];
  hasProperties: boolean;
}

// ============================================================================
// Type Extraction
// ============================================================================

/**
 * Get human-readable type from JSON schema
 */
function getSchemaType(schema: Record<string, unknown>): string {
  // Handle $ref (should be resolved, but fallback)
  if ('$ref' in schema && typeof schema['$ref'] === 'string') {
    const ref = schema['$ref'];
    const match = /#\/components\/schemas\/(.+)$/.exec(ref);
    return match?.[1] ?? 'object';
  }

  // Handle arrays
  if (schema['type'] === 'array') {
    if (schema['items'] && typeof schema['items'] === 'object') {
      const itemType = getSchemaType(schema['items'] as Record<string, unknown>);
      return `${itemType}[]`;
    }
    return 'array';
  }

  // Handle allOf (merge types)
  if ('allOf' in schema && Array.isArray(schema['allOf'])) {
    const types = (schema['allOf'] as Record<string, unknown>[])
      .map((s) => getSchemaType(s))
      .filter(Boolean);
    return types.join(' & ') || 'object';
  }

  // Handle oneOf/anyOf
  if ('oneOf' in schema && Array.isArray(schema['oneOf'])) {
    const types = (schema['oneOf'] as Record<string, unknown>[])
      .map((s) => getSchemaType(s))
      .filter(Boolean);
    return types.join(' | ') || 'object';
  }

  if ('anyOf' in schema && Array.isArray(schema['anyOf'])) {
    const types = (schema['anyOf'] as Record<string, unknown>[])
      .map((s) => getSchemaType(s))
      .filter(Boolean);
    return types.join(' | ') || 'object';
  }

  // Handle enum
  if ('enum' in schema && Array.isArray(schema['enum'])) {
    const enumValues = schema['enum'] as unknown[];
    if (enumValues.length <= 3) {
      return enumValues.map((v) => JSON.stringify(v)).join(' | ');
    }
    return 'enum';
  }

  // Handle nullable
  const baseType = (schema['type'] as string | undefined) ?? 'object';
  if (schema['nullable'] === true) {
    return `${baseType} | null`;
  }

  // Handle format
  if (schema['format'] && typeof schema['format'] === 'string') {
    return `${baseType} (${schema['format']})`;
  }

  return baseType;
}

/**
 * Get description from schema with fallback
 */
function getDescription(schema: Record<string, unknown>): string {
  if (typeof schema['description'] === 'string') {
    return schema['description'];
  }
  if (typeof schema['title'] === 'string') {
    return schema['title'];
  }
  return '-';
}

// ============================================================================
// Schema Flattening
// ============================================================================

/**
 * Flatten schema properties for table rendering
 * Handles nested objects with dot notation (one level deep)
 */
export function flattenSchema(schema: Record<string, unknown>, prefix = ''): FlattenedSchema {
  const properties: SchemaProperty[] = [];

  // Handle allOf by merging
  if ('allOf' in schema && Array.isArray(schema['allOf'])) {
    const merged: Record<string, unknown> = { type: 'object', properties: {} };
    const mergedRequired: string[] = [];

    for (const subSchema of schema['allOf'] as Record<string, unknown>[]) {
      if (subSchema['properties'] && typeof subSchema['properties'] === 'object') {
        Object.assign(merged['properties'] as Record<string, unknown>, subSchema['properties']);
      }
      if (Array.isArray(subSchema['required'])) {
        mergedRequired.push(...(subSchema['required'] as string[]));
      }
    }
    merged['required'] = mergedRequired;
    return flattenSchema(merged, prefix);
  }

  // Get properties
  const schemaProps = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
  const requiredFields = (schema['required'] as string[] | undefined) ?? [];

  if (!schemaProps || typeof schemaProps !== 'object') {
    return { properties: [], hasProperties: false };
  }

  for (const [name, propSchema] of Object.entries(schemaProps)) {
    const fullName = prefix ? `${prefix}.${name}` : name;
    const isRequired = requiredFields.includes(name);

    properties.push({
      name: fullName,
      type: getSchemaType(propSchema),
      required: isRequired,
      description: getDescription(propSchema),
    });

    // Flatten nested objects (one level only to avoid complexity)
    if (
      propSchema['type'] === 'object' &&
      propSchema['properties'] &&
      !prefix // Only flatten top level
    ) {
      const nested = flattenSchema(propSchema, fullName);
      properties.push(...nested.properties);
    }
  }

  return { properties, hasProperties: properties.length > 0 };
}

// ============================================================================
// Markdown Table Generation
// ============================================================================

/**
 * Escape pipe characters for markdown tables
 */
function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Generate markdown table from schema properties
 */
export function schemaToMarkdownTable(schema: Record<string, unknown>): string {
  const { properties, hasProperties } = flattenSchema(schema);

  if (!hasProperties) {
    return '_No properties defined_\n';
  }

  const lines: string[] = [];

  // Table header
  lines.push('| Field | Type | Required | Description |');
  lines.push('|-------|------|----------|-------------|');

  // Table rows
  for (const prop of properties) {
    const name = escapeTableCell(prop.name);
    const type = escapeTableCell(prop.type);
    const required = prop.required ? 'Yes' : 'No';
    const description = escapeTableCell(prop.description);

    lines.push(`| ${name} | ${type} | ${required} | ${description} |`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate markdown table for parameters
 */
export function parametersToMarkdownTable(
  parameters: {
    name: string;
    in: string;
    required: boolean;
    description?: string | undefined;
    schema: Record<string, unknown>;
  }[]
): string {
  if (parameters.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // Table header
  lines.push('| Parameter | Type | Required | Description |');
  lines.push('|-----------|------|----------|-------------|');

  // Table rows
  for (const param of parameters) {
    const name = escapeTableCell(param.name);
    const type = escapeTableCell(getSchemaType(param.schema));
    const required = param.required ? 'Yes' : 'No';
    const description = escapeTableCell(param.description ?? '-');

    lines.push(`| ${name} | ${type} | ${required} | ${description} |`);
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// JSON Example Generation
// ============================================================================

/**
 * Generate example value for a given schema type
 */
function generateExampleValue(schema: Record<string, unknown>, depth = 0): unknown {
  // Prevent deep recursion
  if (depth > 4) {
    return {};
  }

  // Handle $ref (should be resolved)
  if ('$ref' in schema) {
    return {};
  }

  // Handle example if provided
  if ('example' in schema) {
    return schema['example'];
  }

  // Handle default if provided
  if ('default' in schema) {
    return schema['default'];
  }

  // Handle enum
  if ('enum' in schema && Array.isArray(schema['enum'])) {
    const enumValues = schema['enum'] as unknown[];
    return enumValues[0] ?? null;
  }

  // Handle allOf
  if ('allOf' in schema && Array.isArray(schema['allOf'])) {
    const result: Record<string, unknown> = {};
    for (const subSchema of schema['allOf'] as Record<string, unknown>[]) {
      const subExample = generateExampleValue(subSchema, depth + 1);
      if (typeof subExample === 'object' && subExample !== null) {
        Object.assign(result, subExample);
      }
    }
    return result;
  }

  // Handle oneOf/anyOf (use first option)
  if ('oneOf' in schema && Array.isArray(schema['oneOf'])) {
    const first = (schema['oneOf'] as Record<string, unknown>[])[0];
    return first ? generateExampleValue(first, depth + 1) : null;
  }

  if ('anyOf' in schema && Array.isArray(schema['anyOf'])) {
    const first = (schema['anyOf'] as Record<string, unknown>[])[0];
    return first ? generateExampleValue(first, depth + 1) : null;
  }

  const type = schema['type'] as string | undefined;

  switch (type) {
    case 'string': {
      const format = schema['format'] as string | undefined;
      if (format === 'date-time') return '2026-03-13T12:00:00.000Z';
      if (format === 'date') return '2026-03-13';
      if (format === 'email') return 'user@example.com';
      if (format === 'uri' || format === 'url') return 'https://example.com';
      if (format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      return 'string';
    }

    case 'number':
    case 'integer': {
      const min = schema['minimum'] as number | undefined;
      const max = schema['maximum'] as number | undefined;
      if (min !== undefined) return min;
      if (max !== undefined) return Math.min(max, 100);
      return type === 'integer' ? 1 : 1.0;
    }

    case 'boolean':
      return true;

    case 'null':
      return null;

    case 'array': {
      const items = schema['items'] as Record<string, unknown> | undefined;
      if (items) {
        const itemExample = generateExampleValue(items, depth + 1);
        return [itemExample];
      }
      return [];
    }

    case 'object':
    default: {
      const properties = schema['properties'] as
        | Record<string, Record<string, unknown>>
        | undefined;

      if (!properties) {
        return {};
      }

      const result: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        result[key] = generateExampleValue(propSchema, depth + 1);
      }
      return result;
    }
  }
}

/**
 * Generate JSON example from schema
 * Returns formatted JSON string
 */
export function generateJsonExample(schema: Record<string, unknown>): string {
  const example = generateExampleValue(schema);
  return JSON.stringify(example, null, 2);
}

/**
 * Generate JSON code block from schema
 */
export function schemaToJsonCodeBlock(schema: Record<string, unknown>): string {
  const json = generateJsonExample(schema);
  return '```json\n' + json + '\n```\n';
}
