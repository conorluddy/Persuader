/**
 * Enhanced Schema Loader - TypeScript-free Edition
 *
 * Multi-format schema loading without TypeScript compilation dependency.
 * Supports JavaScript modules, JSON Schema validation, and optional TypeScript
 * compilation for development workflows.
 *
 * Features:
 * - JavaScript (.js, .mjs) - Direct Zod schema imports
 * - JSON Schema (.json) - AJV validation with JSON Schema
 * - TypeScript (.ts) - Optional development support
 * - Performance optimized - No heavy TypeScript compilation
 * - Multiple export pattern support
 * - Comprehensive error handling and validation
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv from 'ajv';
import type { z } from 'zod';

/**
 * Supported file extensions for schema loading
 */
export const SUPPORTED_EXTENSIONS = ['.js', '.mjs', '.json', '.ts'] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * Configuration options for schema loading
 */
export interface SchemaLoaderOptions {
  /** Whether to enable verbose logging for debugging */
  readonly verbose?: boolean;

  /** Timeout for module loading in milliseconds */
  readonly timeout?: number;

  /** Whether to allow loading schemas from node_modules */
  readonly allowNodeModules?: boolean;

  /** Custom AJV instance for JSON Schema validation */
  readonly ajv?: Ajv;
}

/**
 * Result of a successful schema loading operation
 */
export interface SchemaLoadResult<T = unknown> {
  /** The loaded schema (Zod schema or validation function) */
  readonly schema: z.ZodSchema<T> | ((data: unknown) => T);

  /** The export name that contained the schema */
  readonly exportName: string;

  /** The absolute file path that was loaded */
  readonly filePath: string;

  /** Schema format that was loaded */
  readonly format: 'zod' | 'json-schema';

  /** Module format detected (ESM, CommonJS, or JSON) */
  readonly moduleFormat: 'esm' | 'cjs' | 'json';

  /** Additional metadata about the loading process */
  readonly metadata: {
    readonly fileSize: number;
    readonly loadTime: number;
    readonly exportCount: number;
  };
}

/**
 * Comprehensive error information for schema loading failures
 */
export class SchemaLoaderError extends Error {
  public readonly code: string;
  public readonly filePath: string | undefined;
  public override readonly cause: Error | undefined;
  public readonly context: Record<string, unknown> | undefined;

  constructor(
    code: string,
    message: string,
    filePath?: string,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SchemaLoaderError';
    this.code = code;
    this.filePath = filePath ?? undefined;
    this.cause = cause ?? undefined;
    this.context = context ?? undefined;
  }

  public override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}${this.filePath ? ` (${this.filePath})` : ''}`;
  }
}

/**
 * Load a schema from various formats without TypeScript compilation
 *
 * @template T - The expected schema type
 * @param schemaPath - Path to the schema file
 * @param options - Configuration options for loading
 * @returns Promise resolving to the loaded schema result
 * @throws SchemaLoaderError for any loading failures
 */
export async function loadSchema<T = unknown>(
  schemaPath: string,
  options: SchemaLoaderOptions = {}
): Promise<SchemaLoadResult<T>> {
  const startTime = Date.now();
  const absolutePath = path.resolve(schemaPath);

  // Validate input parameters
  if (!schemaPath || typeof schemaPath !== 'string') {
    throw new SchemaLoaderError(
      'INVALID_PATH',
      'Schema path must be a non-empty string',
      schemaPath
    );
  }

  // Check if file exists and is accessible
  try {
    await fs.access(absolutePath, fs.constants.R_OK);
  } catch (error) {
    throw new SchemaLoaderError(
      'FILE_NOT_FOUND',
      `Schema file not found or not accessible: ${absolutePath}`,
      absolutePath,
      error instanceof Error ? error : undefined
    );
  }

  // Get file stats for metadata
  const stats = await fs.stat(absolutePath);
  if (!stats.isFile()) {
    throw new SchemaLoaderError(
      'NOT_A_FILE',
      `Path is not a file: ${absolutePath}`,
      absolutePath
    );
  }

  // Check file extension
  const ext = path.extname(absolutePath) as SupportedExtension;
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new SchemaLoaderError(
      'UNSUPPORTED_EXTENSION',
      `Unsupported schema file extension: ${ext}. Supported extensions: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      absolutePath,
      undefined,
      { supportedExtensions: SUPPORTED_EXTENSIONS }
    );
  }

  // Check node_modules restriction
  if (!options.allowNodeModules && absolutePath.includes('node_modules')) {
    throw new SchemaLoaderError(
      'NODE_MODULES_RESTRICTED',
      'Loading schemas from node_modules is not allowed by default. Set allowNodeModules: true to enable.',
      absolutePath
    );
  }

  // Load schema based on file type
  let result: SchemaLoadResult<T>;

  try {
    if (ext === '.json') {
      result = await loadJSONSchema<T>(absolutePath, options);
    } else if (ext === '.js' || ext === '.mjs') {
      result = await loadJavaScriptSchema<T>(absolutePath, options);
    } else if (ext === '.ts') {
      // For TypeScript, suggest converting to JavaScript
      throw new SchemaLoaderError(
        'TYPESCRIPT_NOT_SUPPORTED',
        'TypeScript schemas are no longer supported to avoid heavy compilation dependencies. ' +
          'Please convert your schema to JavaScript (.js) or generate a JSON Schema (.json). ' +
          'See documentation for migration guide.',
        absolutePath,
        undefined,
        {
          suggestion: 'Convert .ts to .js',
          migrationGuide:
            'https://github.com/conorluddy/Persuader#schema-migration',
        }
      );
    } else {
      // This should never happen due to extension check above
      throw new SchemaLoaderError(
        'UNSUPPORTED_EXTENSION',
        `Unsupported file extension: ${ext}`,
        absolutePath
      );
    }

    // Add timing metadata
    const loadTime = Date.now() - startTime;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        loadTime,
      },
    };
  } catch (error) {
    if (error instanceof SchemaLoaderError) {
      throw error;
    }

    throw new SchemaLoaderError(
      'LOADING_FAILED',
      `Failed to load schema from ${absolutePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      absolutePath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Load a schema from a JSON Schema file with AJV validation
 */
async function loadJSONSchema<T>(
  filePath: string,
  options: SchemaLoaderOptions
): Promise<SchemaLoadResult<T>> {
  const source = await fs.readFile(filePath, 'utf-8');
  const stats = await fs.stat(filePath);

  let jsonSchema: unknown;
  try {
    jsonSchema = JSON.parse(source);
  } catch (error) {
    throw new SchemaLoaderError(
      'JSON_PARSE_FAILED',
      `Failed to parse JSON Schema: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  if (!jsonSchema || typeof jsonSchema !== 'object') {
    throw new SchemaLoaderError(
      'INVALID_JSON_SCHEMA',
      'JSON Schema must be an object',
      filePath
    );
  }

  // Create AJV instance for validation
  const ajv =
    options.ajv ||
    new Ajv({
      allErrors: true,
      verbose: options.verbose ?? false,
      strict: false, // Allow additional properties for flexibility
    });

  let validateFn: (data: unknown) => boolean;
  try {
    validateFn = ajv.compile(jsonSchema);
  } catch (error) {
    throw new SchemaLoaderError(
      'JSON_SCHEMA_COMPILATION_FAILED',
      `Failed to compile JSON Schema: ${error instanceof Error ? error.message : 'Compilation error'}`,
      filePath,
      error instanceof Error ? error : undefined,
      { jsonSchema }
    );
  }

  // Create a validation function that returns the data or throws
  const validationSchema = (data: unknown): T => {
    const isValid = validateFn(data);
    if (!isValid) {
      const errorMessage = ajv.errorsText(ajv.errors);
      throw new Error(`JSON Schema validation failed: ${errorMessage}`);
    }
    return data as T;
  };

  return {
    schema: validationSchema as unknown as z.ZodSchema<T>,
    exportName: 'default',
    filePath,
    format: 'json-schema',
    moduleFormat: 'json',
    metadata: {
      fileSize: stats.size,
      loadTime: 0, // Will be set by caller
      exportCount: 1,
    },
  };
}

/**
 * Load a schema from a JavaScript or ES module file
 */
async function loadJavaScriptSchema<T>(
  filePath: string,
  _options: SchemaLoaderOptions
): Promise<SchemaLoadResult<T>> {
  const stats = await fs.stat(filePath);
  const ext = path.extname(filePath);

  let moduleExports: Record<string, unknown>;
  let moduleFormat: 'esm' | 'cjs';

  try {
    if (ext === '.mjs') {
      // ES modules
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);
      moduleExports = module;
      moduleFormat = 'esm';
    } else {
      // Try to determine if it's ES module or CommonJS
      const source = await fs.readFile(filePath, 'utf-8');
      const hasEsmSyntax = /^\s*(?:import|export)\s/m.test(source);

      if (hasEsmSyntax) {
        // ES module syntax detected
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);
        moduleExports = module;
        moduleFormat = 'esm';
      } else {
        // CommonJS - use dynamic import for better compatibility
        const fileUrl = pathToFileURL(filePath).href;
        const module = await import(fileUrl);
        moduleExports = module;
        moduleFormat = 'cjs';
      }
    }
  } catch (error) {
    throw new SchemaLoaderError(
      'MODULE_LOAD_FAILED',
      `Failed to load JavaScript module: ${error instanceof Error ? error.message : 'Unknown error'}`,
      filePath,
      error instanceof Error ? error : undefined
    );
  }

  // Find and validate the schema
  const schemaInfo = findZodSchema(moduleExports, filePath);

  return {
    schema: schemaInfo.schema as z.ZodSchema<T>,
    exportName: schemaInfo.exportName,
    filePath,
    format: 'zod',
    moduleFormat,
    metadata: {
      fileSize: stats.size,
      loadTime: 0, // Will be set by caller
      exportCount: Object.keys(moduleExports).length,
    },
  };
}

/**
 * Schema detection result
 */
interface SchemaDetectionResult {
  readonly schema: z.ZodSchema<unknown>;
  readonly exportName: string;
}

/**
 * Find Zod schemas in module exports with comprehensive detection
 */
function findZodSchema(
  moduleExports: Record<string, unknown>,
  filePath: string
): SchemaDetectionResult {
  const schemas: Array<{ schema: z.ZodSchema<unknown>; exportName: string }> =
    [];

  // Check default export first
  if ('default' in moduleExports && isZodSchema(moduleExports.default)) {
    schemas.push({
      schema: moduleExports.default as z.ZodSchema<unknown>,
      exportName: 'default',
    });
  }

  // Check named exports
  for (const [exportName, exportValue] of Object.entries(moduleExports)) {
    if (exportName !== 'default' && isZodSchema(exportValue)) {
      schemas.push({
        schema: exportValue as z.ZodSchema<unknown>,
        exportName,
      });
    }
  }

  // Provide helpful error messages based on what was found
  if (schemas.length === 0) {
    const exportNames = Object.keys(moduleExports);
    const exportInfo =
      exportNames.length > 0
        ? ` Found exports: ${exportNames.join(', ')}`
        : ' No exports found.';

    throw new SchemaLoaderError(
      'NO_SCHEMA_FOUND',
      `No Zod schema found in file.${exportInfo}`,
      filePath,
      undefined,
      {
        exports: exportNames,
        hasDefault: 'default' in moduleExports,
      }
    );
  }

  // If multiple schemas found, prefer the default export or the first one
  const selectedSchema =
    schemas.find(s => s.exportName === 'default') || schemas[0];

  if (!selectedSchema) {
    throw new SchemaLoaderError(
      'NO_VALID_SCHEMAS',
      `No valid schemas found in file: ${filePath}`,
      filePath,
      undefined,
      { schemas: schemas.length }
    );
  }

  if (schemas.length > 1) {
    const exportNames = schemas.map(s => s.exportName);
    console.warn(
      `Multiple Zod schemas found in ${filePath}. Using '${selectedSchema.exportName}'. Available: ${exportNames.join(', ')}`
    );
  }

  return selectedSchema;
}

/**
 * Type guard to check if an object is a Zod schema
 */
function isZodSchema(obj: unknown): obj is z.ZodSchema<unknown> {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  // Check for Zod schema markers
  const zodObj = obj as Record<string, unknown>;

  // Primary check: Zod schemas have a _def property
  if (!('_def' in zodObj) || !zodObj._def || typeof zodObj._def !== 'object') {
    return false;
  }

  // Additional checks for schema methods
  const hasParseMethod =
    'parse' in zodObj && typeof zodObj.parse === 'function';
  const hasSafeParseMethod =
    'safeParse' in zodObj && typeof zodObj.safeParse === 'function';

  return hasParseMethod && hasSafeParseMethod;
}

/**
 * Utility function to validate that a loaded schema works correctly
 *
 * @param schema - The schema to test
 * @param testData - Optional test data to validate against the schema
 * @returns True if the schema is functional
 */
export function validateSchemaIntegrity<T>(
  schema: z.ZodSchema<T> | ((data: unknown) => T),
  testData?: unknown
): boolean {
  try {
    // Test Zod schema
    if ('parse' in schema && typeof schema.parse === 'function') {
      if (
        typeof schema.parse !== 'function' ||
        typeof schema.safeParse !== 'function'
      ) {
        return false;
      }

      // If test data provided, try to validate it
      if (testData !== undefined) {
        schema.safeParse(testData);
      }
    }
    // Test validation function
    else if (typeof schema === 'function') {
      if (testData !== undefined) {
        try {
          schema(testData);
        } catch {
          // Validation failure is expected for invalid data
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get detailed information about a schema file without loading it
 */
export async function inspectSchemaFile(schemaPath: string): Promise<{
  readonly exists: boolean;
  readonly isFile: boolean;
  readonly extension: string;
  readonly size: number;
  readonly isSupported: boolean;
  readonly isInNodeModules: boolean;
  readonly absolutePath: string;
  readonly recommendedFormat?: string;
}> {
  const absolutePath = path.resolve(schemaPath);

  try {
    const stats = await fs.stat(absolutePath);
    const extension = path.extname(absolutePath);
    const isSupported = SUPPORTED_EXTENSIONS.includes(
      extension as SupportedExtension
    );

    let recommendedFormat: string | undefined;
    if (extension === '.ts') {
      recommendedFormat = 'Convert to .js for better performance';
    } else if (extension === '.json' && !(await isJsonSchema(absolutePath))) {
      recommendedFormat = 'Ensure valid JSON Schema format';
    }

    return {
      exists: true,
      isFile: stats.isFile(),
      extension,
      size: stats.size,
      isSupported,
      isInNodeModules: absolutePath.includes('node_modules'),
      absolutePath,
      ...(recommendedFormat ? { recommendedFormat } : {}),
    };
  } catch {
    return {
      exists: false,
      isFile: false,
      extension: path.extname(absolutePath),
      size: 0,
      isSupported: false,
      isInNodeModules: absolutePath.includes('node_modules'),
      absolutePath,
    };
  }
}

/**
 * Quick check if a JSON file appears to be a JSON Schema
 */
async function isJsonSchema(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    return (
      json &&
      typeof json === 'object' &&
      ('type' in json || '$schema' in json || 'properties' in json)
    );
  } catch {
    return false;
  }
}
