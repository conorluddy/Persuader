/**
 * Schema Analysis Utilities
 *
 * Provides comprehensive analysis and logging capabilities for Zod schemas
 * to give visibility into what schemas are being passed to the Persuader pipeline.
 */

import { z } from 'zod/v4';

/**
 * Schema information extracted for logging and debugging
 */
export interface SchemaInfo {
  /** Schema name if available */
  name?: string;
  /** Schema type (object, array, string, etc.) */
  type: string;
  /** Schema description if available */
  description?: string;
  /** Number of fields (for objects) */
  fieldCount?: number;
  /** Required field names */
  requiredFields: string[];
  /** Optional field names */
  optionalFields: string[];
  /** Nested object field names */
  nestedObjects: string[];
  /** Array field names */
  arrayFields: string[];
  /** Enum field names */
  enumFields: string[];
  /** Simplified shape description */
  shape?: Record<string, string>;
  /** Complexity score (1-10) */
  complexity: number;
}

/**
 * Extract comprehensive information from a Zod schema for logging
 */
export function extractSchemaInfo(schema: z.ZodSchema<unknown>): SchemaInfo {
  const info: SchemaInfo = {
    type: getSchemaTypeName(schema),
    requiredFields: [],
    optionalFields: [],
    nestedObjects: [],
    arrayFields: [],
    enumFields: [],
    complexity: 1,
  };

  // Extract description if available
  if ('description' in schema && typeof schema.description === 'string') {
    info.description = schema.description;
  }

  // Extract name from schema if available (some schemas have _def.typeName)
  if ('_def' in schema && schema._def && typeof schema._def === 'object') {
    const def = schema._def as unknown as Record<string, unknown>;
    if (typeof def.typeName === 'string') {
      info.name = def.typeName;
    }
  }

  // Handle different schema types
  if (schema instanceof z.ZodObject) {
    analyzeObjectSchema(schema, info);
  } else if (schema instanceof z.ZodArray) {
    analyzeArraySchema(schema as z.ZodArray<z.ZodTypeAny>, info);
  } else if (
    schema instanceof z.ZodEnum ||
    (schema._def &&
      typeof schema._def === 'object' &&
      'typeName' in schema._def &&
      schema._def.typeName === 'ZodNativeEnum')
  ) {
    analyzeEnumSchema(schema, info);
  } else if (schema instanceof z.ZodUnion) {
    analyzeUnionSchema(
      schema as z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>,
      info
    );
  } else if (schema instanceof z.ZodIntersection) {
    analyzeIntersectionSchema(
      schema as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
      info
    );
  }

  // Calculate complexity score
  info.complexity = calculateComplexity(info);

  return info;
}

/**
 * Get the type name of a Zod schema
 */
function getSchemaTypeName(schema: z.ZodSchema<unknown>): string {
  if (schema instanceof z.ZodObject) return 'object';
  if (schema instanceof z.ZodArray) return 'array';
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodEnum) return 'enum';
  if (
    schema._def &&
    typeof schema._def === 'object' &&
    'typeName' in schema._def &&
    schema._def.typeName === 'ZodNativeEnum'
  )
    return 'nativeEnum';
  if (schema instanceof z.ZodUnion) return 'union';
  if (schema instanceof z.ZodIntersection) return 'intersection';
  if (schema instanceof z.ZodOptional) return 'optional';
  if (schema instanceof z.ZodNullable) return 'nullable';
  if (schema instanceof z.ZodDefault) return 'default';
  if (schema instanceof z.ZodLiteral) return 'literal';
  if (schema instanceof z.ZodRecord) return 'record';
  if (schema instanceof z.ZodMap) return 'map';
  if (schema instanceof z.ZodSet) return 'set';
  if (schema instanceof z.ZodTuple) return 'tuple';
  if (schema instanceof z.ZodDate) return 'date';
  if (
    schema._def &&
    typeof schema._def === 'object' &&
    'typeName' in schema._def &&
    schema._def.typeName === 'ZodString' &&
    'checks' in schema._def &&
    Array.isArray(schema._def.checks) &&
    schema._def.checks.some(
      (c: unknown) =>
        typeof c === 'object' && c !== null && 'kind' in c && c.kind === 'uuid'
    )
  )
    return 'uuid';
  if (
    schema instanceof z.ZodString &&
    'checks' in schema._def &&
    Array.isArray(schema._def.checks) &&
    schema._def.checks.some(
      (c: unknown) =>
        typeof c === 'object' && c !== null && 'kind' in c && c.kind === 'email'
    )
  )
    return 'email';
  if (
    schema._def &&
    typeof schema._def === 'object' &&
    'typeName' in schema._def &&
    schema._def.typeName === 'ZodString' &&
    'checks' in schema._def &&
    Array.isArray(schema._def.checks) &&
    schema._def.checks.some(
      (c: unknown) =>
        typeof c === 'object' && c !== null && 'kind' in c && c.kind === 'url'
    )
  )
    return 'url';

  return schema.constructor.name || 'unknown';
}

/**
 * Analyze a Zod object schema
 */
function analyzeObjectSchema(
  schema: z.ZodObject<z.ZodRawShape>,
  info: SchemaInfo
): void {
  try {
    const shape = schema.shape;
    if (!shape || typeof shape !== 'object') return;

    const shapeEntries = Object.entries(shape);
    info.fieldCount = shapeEntries.length;
    info.shape = {};

    for (const [key, fieldSchema] of shapeEntries) {
      if (!fieldSchema || typeof fieldSchema !== 'object') continue;

      const fieldType = getSchemaTypeName(fieldSchema as z.ZodSchema<unknown>);
      info.shape[key] = fieldType;

      // Determine if field is optional
      const isOptional =
        fieldSchema instanceof z.ZodOptional ||
        fieldSchema instanceof z.ZodDefault ||
        (fieldSchema instanceof z.ZodUnion &&
          '_def' in fieldSchema &&
          typeof fieldSchema._def === 'object' &&
          fieldSchema._def !== null &&
          'options' in fieldSchema._def &&
          Array.isArray(fieldSchema._def.options) &&
          fieldSchema._def.options.some(
            (opt: unknown) => opt instanceof z.ZodUndefined
          ));

      if (isOptional) {
        info.optionalFields.push(key);
      } else {
        info.requiredFields.push(key);
      }

      // Categorize field types
      if (fieldSchema instanceof z.ZodObject) {
        info.nestedObjects.push(key);
      } else if (fieldSchema instanceof z.ZodArray) {
        info.arrayFields.push(key);
      } else if (
        fieldSchema instanceof z.ZodEnum ||
        ('_def' in fieldSchema &&
          typeof fieldSchema._def === 'object' &&
          fieldSchema._def !== null &&
          'typeName' in fieldSchema._def &&
          fieldSchema._def.typeName === 'ZodNativeEnum')
      ) {
        info.enumFields.push(key);
      }
    }
  } catch (_error) {
    // Silently handle errors in schema analysis
  }
}

/**
 * Analyze a Zod array schema
 */
function analyzeArraySchema(
  schema: z.ZodArray<z.ZodTypeAny>,
  info: SchemaInfo
): void {
  try {
    const element = schema.element;
    if (element) {
      const elementType = getSchemaTypeName(element);
      info.shape = { element: elementType };

      if (element instanceof z.ZodObject) {
        info.nestedObjects.push('element');
      }
    }
  } catch (_error) {
    // Silently handle errors
  }
}

/**
 * Analyze a Zod enum schema
 */
function analyzeEnumSchema(
  schema: z.ZodSchema<unknown>,
  info: SchemaInfo
): void {
  try {
    if ('options' in schema && Array.isArray(schema.options)) {
      info.shape = { options: schema.options.join(' | ') };
    } else if (
      'enum' in schema &&
      typeof schema.enum === 'object' &&
      schema.enum !== null
    ) {
      const values = Object.values(schema.enum);
      info.shape = { options: values.join(' | ') };
    }
  } catch (_error) {
    // Silently handle errors
  }
}

/**
 * Analyze a Zod union schema
 */
function analyzeUnionSchema(
  schema: z.ZodUnion<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>,
  info: SchemaInfo
): void {
  try {
    if ('options' in schema && Array.isArray(schema.options)) {
      const unionTypes = schema.options.map((option: z.ZodSchema<unknown>) =>
        getSchemaTypeName(option)
      );
      info.shape = { union: unionTypes.join(' | ') };
    }
  } catch (_error) {
    // Silently handle errors
  }
}

/**
 * Analyze a Zod intersection schema
 */
function analyzeIntersectionSchema(
  schema: z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>,
  info: SchemaInfo
): void {
  try {
    const leftType = getSchemaTypeName(schema._def.left);
    const rightType = getSchemaTypeName(schema._def.right);
    info.shape = { intersection: `${leftType} & ${rightType}` };
  } catch (_error) {
    // Silently handle errors
  }
}

/**
 * Calculate complexity score based on schema characteristics
 */
function calculateComplexity(info: SchemaInfo): number {
  let complexity = 1;

  // Base complexity by type
  if (info.type === 'object') complexity += 2;
  if (info.type === 'array') complexity += 1;
  if (info.type === 'union' || info.type === 'intersection') complexity += 3;

  // Add complexity for field count
  if (info.fieldCount) {
    complexity += Math.floor(info.fieldCount / 5); // +1 for every 5 fields
  }

  // Add complexity for nested structures
  complexity += info.nestedObjects.length * 2;
  complexity += info.arrayFields.length;
  complexity += info.enumFields.length * 0.5;

  // Cap at 10
  return Math.min(Math.round(complexity), 10);
}

/**
 * Generate a human-readable summary of the schema
 */
export function getSchemaDescription(schema: z.ZodSchema<unknown>): string {
  try {
    const info = extractSchemaInfo(schema);

    if (info.type === 'object' && info.fieldCount) {
      const fieldDesc = `${info.fieldCount} fields (${info.requiredFields.length} required, ${info.optionalFields.length} optional)`;
      const nestingDesc =
        info.nestedObjects.length > 0
          ? ` with ${info.nestedObjects.length} nested objects`
          : '';
      return `Object with ${fieldDesc}${nestingDesc}`;
    }

    if (info.type === 'array' && info.shape?.element) {
      return `Array of ${info.shape.element}`;
    }

    if (info.type === 'enum' && info.shape?.options) {
      const optionCount = info.shape.options.split(' | ').length;
      return `Enum with ${optionCount} options`;
    }

    if (info.type === 'union' && info.shape?.union) {
      return `Union of ${info.shape.union}`;
    }

    return `${info.type.charAt(0).toUpperCase() + info.type.slice(1)} schema`;
  } catch (_error) {
    return 'Complex schema';
  }
}

/**
 * Log schema information using structured logging
 */
export function logSchemaInfo(
  schema: z.ZodSchema<unknown>,
  context: string = 'Schema Analysis'
): void {
  try {
    const info = extractSchemaInfo(schema);
    console.log(`\n=== ${context} ===`);
    console.log(`Type: ${info.type}`);
    if (info.name) console.log(`Name: ${info.name}`);
    if (info.description) console.log(`Description: ${info.description}`);
    if (info.fieldCount)
      console.log(
        `Fields: ${info.fieldCount} (${info.requiredFields.length} required, ${info.optionalFields.length} optional)`
      );
    if (info.nestedObjects.length)
      console.log(`Nested Objects: ${info.nestedObjects.join(', ')}`);
    if (info.arrayFields.length)
      console.log(`Array Fields: ${info.arrayFields.join(', ')}`);
    if (info.enumFields.length)
      console.log(`Enum Fields: ${info.enumFields.join(', ')}`);
    console.log(`Complexity: ${info.complexity}/10`);
    if (info.shape && Object.keys(info.shape).length > 0) {
      console.log('Shape:', JSON.stringify(info.shape, null, 2));
    }
    console.log('='.repeat(context.length + 8));
  } catch (error) {
    console.warn(
      `Failed to log schema info: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
