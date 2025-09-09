/**
 * Validation Utilities
 *
 * Utilities for validating LLM outputs against Zod schemas and providing
 * actionable error feedback for retries.
 */

import type { z } from 'zod';
import type { ValidationError } from '../types/errors.js';
import { debug, logValidation } from '../utils/logger.js';
import {
  extractSchemaInfo,
  getSchemaDescription,
} from '../utils/schema-analyzer.js';

/**
 * Type guards for specific Zod issue types
 */
function isTooSmallIssue(issue: z.ZodIssue): issue is z.ZodIssue & {
  type: 'string' | 'number' | 'array';
  minimum: number;
} {
  return issue.code === 'too_small' && 'type' in issue && 'minimum' in issue;
}

function isTooBigIssue(issue: z.ZodIssue): issue is z.ZodIssue & {
  type: 'string' | 'number' | 'array';
  maximum: number;
} {
  return issue.code === 'too_big' && 'type' in issue && 'maximum' in issue;
}

function hasValidation(issue: z.ZodIssue): issue is z.ZodIssue & {
  validation: string;
} {
  return (
    'validation' in issue &&
    typeof (issue as { validation?: unknown }).validation === 'string'
  );
}

function hasOptions(issue: z.ZodIssue): issue is z.ZodIssue & {
  options: string[];
} {
  return (
    'options' in issue &&
    Array.isArray((issue as { options?: unknown }).options)
  );
}

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
      parsedValue = JSON.parse(rawInput.trim());
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
    const result = schema.safeParse(parsedValue);

    if (result.success) {
      // Log successful validation
      logValidation(true, schema.constructor.name, undefined, {
        inputLength: rawInput.length,
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
      inputLength: rawInput.length,
      issueCount: result.error.issues.length,
      suggestionsCount: suggestions.length,
    });

    return {
      success: false,
      error: createValidationError(
        'schema_validation',
        'Schema validation failed',
        result.error.issues,
        rawInput,
        generateSchemaDescription(schema),
        suggestions
      ),
    };
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
 * Create a structured validation error
 */
function createValidationError(
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
 * Generate helpful suggestions based on validation issues
 */
function generateValidationSuggestions(
  issues: z.ZodIssue[],
  _parsedValue: unknown
): string[] {
  const suggestions: string[] = [];

  if (!issues || !Array.isArray(issues)) {
    return suggestions;
  }

  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';

    switch (issue.code) {
      case 'invalid_type': {
        // Extract received type from issue or message
        let receivedType = 'received' in issue ? issue.received : 'unknown';
        if (!receivedType || receivedType === 'unknown') {
          const match = issue.message.match(/received (\w+)/);
          if (match) {
            receivedType = match[1];
          }
        }
        suggestions.push(
          `Field "${path}": Expected ${issue.expected}, but got ${receivedType}. Please ensure this field contains the correct data type.`
        );
        break;
      }

      case 'too_small': {
        if (isTooSmallIssue(issue)) {
          if (issue.type === 'string') {
            suggestions.push(
              `Field "${path}": String is too short. Minimum length is ${issue.minimum}.`
            );
          } else if (issue.type === 'number') {
            suggestions.push(
              `Field "${path}": Number is too small. Minimum value is ${issue.minimum}.`
            );
          } else if (issue.type === 'array') {
            suggestions.push(
              `Field "${path}": Array has too few items. Minimum length is ${issue.minimum}.`
            );
          }
        }
        break;
      }

      case 'too_big': {
        if (isTooBigIssue(issue)) {
          if (issue.type === 'string') {
            suggestions.push(
              `Field "${path}": String is too long. Maximum length is ${issue.maximum}.`
            );
          } else if (issue.type === 'number') {
            suggestions.push(
              `Field "${path}": Number is too large. Maximum value is ${issue.maximum}.`
            );
          } else if (issue.type === 'array') {
            suggestions.push(
              `Field "${path}": Array has too many items. Maximum length is ${issue.maximum}.`
            );
          }
        }
        break;
      }

      case 'invalid_value': {
        const options =
          (issue as { values?: string[] }).values?.join(', ') ||
          'allowed values';
        suggestions.push(`Field "${path}": Must be one of: ${options}.`);
        break;
      }

      case 'unrecognized_keys': {
        const extraKeys = issue.keys?.join(', ') || 'unknown keys';
        suggestions.push(
          `Unexpected fields found: ${extraKeys}. Please remove these fields or check if they're misspelled.`
        );
        break;
      }

      case 'invalid_union':
        suggestions.push(
          `Field "${path}": Value doesn't match any of the expected types in the union.`
        );
        break;

      default: {
        // Handle extended Zod issue types
        const issueCode = issue.code as string;
        if (issueCode === 'invalid_string' && hasValidation(issue)) {
          if (issue.validation === 'email') {
            suggestions.push(`Field "${path}": Must be a valid email address.`);
          } else if (issue.validation === 'url') {
            suggestions.push(`Field "${path}": Must be a valid URL.`);
          } else if (issue.validation === 'uuid') {
            suggestions.push(`Field "${path}": Must be a valid UUID.`);
          } else {
            suggestions.push(`Field "${path}": String format is invalid.`);
          }
        } else if (issueCode === 'invalid_enum_value' && hasOptions(issue)) {
          const options = issue.options?.join(', ') || 'allowed values';
          suggestions.push(`Field "${path}": Must be one of: ${options}.`);
        } else {
          suggestions.push(`Field "${path}": ${issue.message}`);
        }
        break;
      }
    }
  }

  // Add general suggestions
  if (suggestions.length > 0) {
    suggestions.push(
      'Ensure all required fields are present and have the correct data types.',
      'Double-check field names for typos or incorrect casing.',
      'Verify that the JSON structure matches the expected schema exactly.'
    );
  }

  return suggestions;
}

/**
 * Format validation error into human-readable feedback
 *
 * @param error - Validation error to format
 * @param attemptNumber - Current attempt number for context
 * @returns Formatted error feedback for LLM retry
 */
export function formatValidationErrorFeedback(
  error: ValidationError,
  attemptNumber: number = 1
): string {
  // Enhanced JSON parse error handling with progressive urgency
  if (error.code === 'json_parse') {
    const urgency =
      attemptNumber >= 3
        ? '🚨 CRITICAL: '
        : attemptNumber >= 2
          ? '⚠️ IMPORTANT: '
          : '';
    const instruction =
      attemptNumber >= 3
        ? 'Your response MUST start with "{" and end with "}". No explanatory text before or after the JSON object.'
        : 'The response must be valid JSON. Please ensure proper syntax with matching brackets, quotes, and commas.';

    debug('Formatting JSON parse error feedback', {
      attemptNumber,
      urgency: urgency !== '',
      errorMessage: error.message,
    });

    return `${urgency}JSON Parsing Error: ${error.message}\n\n${instruction}`;
  }

  // Enhanced schema validation error handling with field-specific guidance
  if (error.code === 'schema_validation') {
    const issueLines = (error.issues || [])
      .map(issue => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `  • ${path}: ${issue.message}`;
      })
      .join('\n');

    // Generate specific field-level corrections
    const fieldCorrections = generateFieldCorrections(error.issues || []);
    const correctionLines =
      fieldCorrections.length > 0
        ? `\nSpecific Corrections Needed:\n${fieldCorrections.map(c => `  • ${c}`).join('\n')}`
        : '';

    const suggestionLines =
      error.suggestions && error.suggestions.length > 0
        ? `\nGeneral Suggestions:\n${error.suggestions.map(s => `  • ${s}`).join('\n')}`
        : '';

    const urgencyNote =
      attemptNumber >= 3
        ? '\n🚨 CRITICAL: This is your final attempt. Please follow the corrections exactly.'
        : '';

    debug('Formatting schema validation error feedback', {
      attemptNumber,
      issueCount: error.issues?.length || 0,
      hasFieldCorrections: fieldCorrections.length > 0,
      hasSuggestions: (error.suggestions?.length || 0) > 0,
    });

    return `Schema Validation Failed (Attempt ${attemptNumber}):\n${issueLines}${correctionLines}${suggestionLines}${urgencyNote}`;
  }

  // Generic error handling
  return `Validation Error: ${error.message}`;
}

/**
 * Generate specific field corrections from Zod issues
 */
function generateFieldCorrections(issues: z.ZodIssue[]): string[] {
  const corrections: string[] = [];

  for (const issue of issues) {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : 'root';

    switch (issue.code) {
      case 'invalid_type': {
        const expectedType = 'expected' in issue ? issue.expected : 'unknown';
        const receivedType = 'received' in issue ? issue.received : 'unknown';
        corrections.push(
          `Field "${fieldPath}": Change from ${receivedType} to ${expectedType}`
        );
        break;
      }

      case 'too_small':
        if ('minimum' in issue) {
          const minimum = issue.minimum;
          if ('type' in issue && issue.type === 'string') {
            corrections.push(
              `Field "${fieldPath}": Increase text length to at least ${minimum} characters`
            );
          } else if ('type' in issue && issue.type === 'array') {
            corrections.push(
              `Field "${fieldPath}": Add at least ${minimum} items to the array`
            );
          } else {
            corrections.push(
              `Field "${fieldPath}": Increase value to at least ${minimum}`
            );
          }
        }
        break;

      case 'unrecognized_keys':
        if ('keys' in issue && Array.isArray(issue.keys)) {
          corrections.push(
            `Remove unexpected fields: ${issue.keys.join(', ')}`
          );
        }
        break;

      default:
        // Handle other issue types
        corrections.push(
          `Field "${fieldPath}": ${issue.message || 'Invalid value'}`
        );
        break;
    }
  }

  return corrections;
}

/**
 * Generate a basic schema description (simplified version)
 * This would be expanded in a full implementation
 */
function generateSchemaDescription(schema: z.ZodSchema<unknown>): string {
  try {
    // This is a simplified implementation
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

/**
 * Extract field-level validation errors for detailed feedback
 *
 * @param error - Validation error
 * @returns Array of field-specific error descriptions
 */
export function extractFieldErrors(error: ValidationError): Array<{
  path: string;
  expected: string;
  received: string;
  message: string;
}> {
  return (error.issues || []).map(issue => {
    // Extract received type from message if not directly available
    let received = 'invalid value';
    if ('received' in issue) {
      received = String(issue.received);
    } else {
      // Try to extract from message like "expected string, received number"
      const match = issue.message.match(/received (\w+)/);
      if (match?.[1]) {
        received = match[1];
      }
    }

    return {
      path: issue.path.length > 0 ? issue.path.join('.') : 'root',
      expected: 'expected' in issue ? String(issue.expected) : 'valid value',
      received,
      message: issue.message,
    };
  });
}
