/**
 * JSON Parser Module
 *
 * Main validation entry point that orchestrates JSON parsing and schema
 * validation with intelligent error handling and feedback generation.
 */

import type { z } from 'zod';
import type { ValidationError } from '../../types/errors.js';
import { debug, logValidation } from '../../utils/logger.js';
import {
  extractSchemaInfo,
  getSchemaDescription,
} from '../../utils/schema-analyzer.js';
import {
  createValidationError,
  generateSchemaDescription,
} from './error-factory.js';
import { generateValidationSuggestions } from './suggestion-generator.js';

/**
 * Result of a validation operation
 */
export type ValidationResult<T> =
  | {
      /** Whether validation succeeded */
      readonly success: true;
      /** Validated value (only present if success is true) */
      readonly value: T;
      /** Validation error details (only present if success is false) */
      readonly error?: never;
    }
  | {
      /** Whether validation succeeded */
      readonly success: false;
      /** Validated value (only present if success is true) */
      readonly value?: never;
      /** Validation error details (only present if success is false) */
      readonly error: ValidationError;
    };

/**
 * Validate JSON string against Zod schema
 *
 * Main entry point for validation that handles both JSON parsing and schema
 * validation with comprehensive error reporting and debugging support.
 *
 * @template T - The expected output type from the schema
 * @param schema - Zod schema to validate against
 * @param rawInput - Raw string input from LLM
 * @returns Validation result with typed value or error details
 */
export function validateJson<T>(
  schema: z.ZodSchema<T>,
  rawInput: string
): ValidationResult<T> {
  // Log schema information for debugging
  try {
    const schemaInfo = extractSchemaInfo(schema as z.ZodSchema<unknown>);
    const schemaDesc = getSchemaDescription(schema as z.ZodSchema<unknown>);

    debug('Starting JSON validation against schema', {
      schemaType: schemaInfo.type,
      schemaName: schemaInfo.name,
      schemaDescription: schemaDesc,
      complexity: schemaInfo.complexity,
      fieldCount: schemaInfo.fieldCount,
      requiredFields: schemaInfo.requiredFields.length,
      optionalFields: schemaInfo.optionalFields.length,
      inputLength: rawInput.length,
      inputPreview:
        rawInput.substring(0, 200) + (rawInput.length > 200 ? '...' : ''),
    });
  } catch (schemaAnalysisError) {
    debug('Failed to analyze schema for logging', {
      error:
        schemaAnalysisError instanceof Error
          ? schemaAnalysisError.message
          : 'Unknown error',
      inputLength: rawInput.length,
    });
  }

  try {
    // First, try to parse the JSON
    let parsedValue: unknown;
    try {
      parsedValue = parseJsonWithEnhancedErrors(rawInput.trim());
    } catch (parseError) {
      return {
        success: false,
        error: createValidationError(
          'json_parse',
          'Invalid JSON format',
          [],
          rawInput,
          undefined,
          [
            `The output is not valid JSON. Error: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
          ]
        ),
      };
    }

    // Then validate against the schema
    return validateParsedJson(schema, parsedValue);
  } catch (error) {
    return {
      success: false,
      error: createValidationError(
        'unexpected_error',
        `Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [],
        rawInput,
        undefined,
        ['Please check the input format and try again']
      ),
    };
  }
}

/**
 * Parse JSON string with enhanced error handling
 *
 * Attempts to parse JSON string with detailed error information for common
 * parsing issues like missing quotes, trailing commas, etc.
 *
 * @param rawInput - Raw JSON string to parse
 * @returns Parsed JSON object or throws descriptive error
 */
export function parseJsonWithEnhancedErrors(rawInput: string): unknown {
  try {
    return JSON.parse(rawInput);
  } catch (parseError) {
    // Re-throw with enhanced error information
    const errorMessage =
      parseError instanceof Error
        ? parseError.message
        : 'Unknown parsing error';
    throw new Error(errorMessage);
  }
}

/**
 * Validate parsed JSON against Zod schema
 *
 * Performs schema validation on already-parsed JSON object with detailed
 * error collection and suggestion generation.
 *
 * @template T - The expected output type from the schema
 * @param schema - Zod schema to validate against
 * @param parsedValue - Pre-parsed JSON object
 * @returns Validation result with typed value or error details
 */
export function validateParsedJson<T>(
  schema: z.ZodSchema<T>,
  parsedValue: unknown
): ValidationResult<T> {
  const result = schema.safeParse(parsedValue);

  if (result.success) {
    // Log successful validation
    logValidation(true, schema.constructor.name, undefined, {
      outputType: typeof result.data,
      hasValue: Boolean(result.data),
    });

    return {
      success: true,
      value: result.data,
    };
  }

  // Create detailed validation error
  const suggestions = generateValidationSuggestions(
    result.error.issues,
    parsedValue
  );

  const validationIssues = result.error.issues.map(
    issue => `${issue.path.join('.')}: ${issue.message}`
  );

  // Log failed validation
  logValidation(false, schema.constructor.name, validationIssues, {
    issueCount: result.error.issues.length,
    suggestionsCount: suggestions.length,
  });

  return {
    success: false,
    error: createValidationError(
      'schema_validation',
      'Schema validation failed',
      result.error.issues,
      parsedValue,
      generateSchemaDescription(schema),
      suggestions
    ),
  };
}
