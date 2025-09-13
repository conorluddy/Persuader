/**
 * Validation Error Factory
 *
 * Provides type-safe functions for creating validation errors from Zod validation issues.
 * Focuses on error construction with detailed feedback generation for LLM retry loops.
 *
 * This module follows the Single Responsibility Principle by handling only error creation
 * and type safety concerns, with no validation logic or external dependencies.
 */

import type { z } from 'zod/v4';
import type { ValidationError } from '../../types/errors.js';

/**
 * Type guard for Zod issues with size constraints (too_small)
 *
 * Safely narrows Zod issues to those containing minimum size information
 * for strings, numbers, and arrays.
 */
export function isTooSmallIssue(issue: z.ZodIssue): issue is z.ZodIssue & {
  type: 'string' | 'number' | 'array';
  minimum: number;
} {
  return issue.code === 'too_small' && 'type' in issue && 'minimum' in issue;
}

/**
 * Type guard for Zod issues with size constraints (too_big)
 *
 * Safely narrows Zod issues to those containing maximum size information
 * for strings, numbers, and arrays.
 */
export function isTooBigIssue(issue: z.ZodIssue): issue is z.ZodIssue & {
  type: 'string' | 'number' | 'array';
  maximum: number;
} {
  return issue.code === 'too_big' && 'type' in issue && 'maximum' in issue;
}

/**
 * Type guard for Zod issues with string validation constraints
 *
 * Safely narrows Zod issues to those containing string validation information
 * such as email, URL, UUID, etc.
 */
export function hasValidation(issue: z.ZodIssue): issue is z.ZodIssue & {
  validation: string;
} {
  return (
    'validation' in issue &&
    typeof (issue as { validation?: unknown }).validation === 'string'
  );
}

/**
 * Type guard for Zod issues with enumeration options
 *
 * Safely narrows Zod issues to those containing enumeration or union options
 * for generating helpful error messages with valid choices.
 */
export function hasOptions(issue: z.ZodIssue): issue is z.ZodIssue & {
  options: string[];
} {
  return (
    'options' in issue &&
    Array.isArray((issue as { options?: unknown }).options)
  );
}

/**
 * Create a structured validation error with comprehensive metadata
 *
 * Constructs a ValidationError with all required fields for intelligent retry logic.
 * Includes structured feedback for LLM consumption and detailed error analysis.
 *
 * @param code - Error classification code for programmatic handling
 * @param message - Human-readable error description
 * @param issues - Array of Zod validation issues providing specific field errors
 * @param rawValue - Original input value that failed validation
 * @param schemaDescription - Optional description of expected schema structure
 * @param suggestions - Optional array of actionable correction suggestions
 * @returns Fully structured ValidationError for retry loop consumption
 */
export function createValidationError(
  code: string,
  message: string,
  issues: z.ZodIssue[],
  rawValue: unknown,
  schemaDescription?: string,
  suggestions?: string[]
): ValidationError {
  const error: ValidationError = {
    type: 'validation',
    code,
    message,
    issues,
    rawValue,
    timestamp: new Date(),
    retryable: true,
    failureMode: 'schema_validation',
    retryStrategy: 'provide_field_guidance',
    structuredFeedback: {
      problemSummary: message,
      specificIssues: suggestions || [],
      correctionInstructions: suggestions || [],
    },
    details: {
      issueCount: issues.length,
      hasJsonParseError: code === 'json_parse',
    },
    ...(schemaDescription && { schemaDescription }),
    ...(suggestions && { suggestions }),
  };

  return error;
}

/**
 * Generate basic schema description from Zod schema type
 *
 * Provides human-readable descriptions of schema expectations for error messages.
 * Uses schema constructor names to infer basic structure information.
 *
 * @param schema - Zod schema to analyze
 * @returns Human-readable description of expected schema structure
 */
export function generateSchemaDescription(
  schema: z.ZodSchema<unknown>
): string {
  try {
    // Basic schema type classification based on constructor name
    const schemaName = schema.constructor.name;
    switch (schemaName) {
      case 'ZodObject':
        return 'JSON object with specified fields';
      case 'ZodArray':
        return 'Array of items';
      case 'ZodString':
        return 'String value';
      case 'ZodNumber':
        return 'Numeric value';
      case 'ZodBoolean':
        return 'Boolean value';
      default:
        return 'Value matching the specified schema';
    }
  } catch (_error) {
    return 'Value matching the specified schema';
  }
}
