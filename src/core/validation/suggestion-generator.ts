/**
 * Validation Suggestion Generator
 *
 * Transforms Zod validation issues into actionable suggestions that enable
 * LLMs to self-correct and generate valid responses through retry loops.
 *
 * This module focuses on transforming technical validation errors into
 * clear, specific guidance that LLMs can follow to fix their outputs.
 */

import type { z } from 'zod';
import { debug, logDetailedValidationError } from '../../utils/logger.js';

/**
 * Structured representation of validation suggestions
 */
export interface ValidationSuggestion {
  /** Field path where the issue occurs */
  readonly path: string;
  /** Type of validation issue */
  readonly issueType: string;
  /** Human-readable suggestion for fixing the issue */
  readonly suggestion: string;
  /** Priority level for addressing this issue */
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Field-specific correction instruction
 */
export interface FieldCorrection {
  /** Path to the field needing correction */
  readonly fieldPath: string;
  /** Current invalid state */
  readonly currentState: string;
  /** Required correction action */
  readonly correctionAction: string;
}

/**
 * Calculate Levenshtein distance between two strings for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = Array(str2.length + 1).fill(0).map(() => Array(str1.length + 1).fill(0));
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[0]![i] = i;
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[j]![0] = j;
  }
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,        // deletion
        matrix[j - 1]![i]! + 1,        // insertion
        matrix[j - 1]![i - 1]! + cost  // substitution
      );
    }
  }
  
  return matrix[str2.length]![str1.length]!;
}

/**
 * Find closest matches using fuzzy string matching
 */
function findClosestMatches(invalidValue: string, validOptions: string[], maxSuggestions = 3): string[] {
  if (!validOptions.length) return [];
  
  const matches = validOptions
    .map(option => ({
      option,
      distance: levenshteinDistance(invalidValue.toLowerCase(), option.toLowerCase()),
      similarity: 1 - levenshteinDistance(invalidValue.toLowerCase(), option.toLowerCase()) / Math.max(invalidValue.length, option.length)
    }))
    .filter(match => match.similarity > 0.3) // Only suggest if at least 30% similar
    .sort((a, b) => b.similarity - a.similarity) // Sort by similarity (highest first)
    .slice(0, maxSuggestions)
    .map(match => match.option);
  
  return matches;
}

/**
 * Type guards for specific Zod issue types that require specialized handling
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
 * Generate helpful suggestions based on validation issues
 *
 * Transforms technical Zod validation issues into actionable guidance
 * that LLMs can understand and act upon in retry loops.
 *
 * @param issues - Array of Zod validation issues from schema parsing
 * @param _parsedValue - The parsed (but invalid) value for context
 * @returns Array of actionable suggestion strings for LLM guidance
 */
export function generateValidationSuggestions(
  issues: z.ZodIssue[],
  _parsedValue: unknown
): string[] {
  const suggestions: string[] = [];

  if (!issues || !Array.isArray(issues)) {
    debug('generateValidationSuggestions called with invalid issues', {
      issues: typeof issues,
      isArray: Array.isArray(issues),
    });
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
          if (match?.[1]) {
            receivedType = match[1] as
              | 'string'
              | 'number'
              | 'bigint'
              | 'boolean'
              | 'symbol'
              | 'undefined'
              | 'object'
              | 'function'
              | 'map'
              | 'nan'
              | 'integer'
              | 'float'
              | 'date'
              | 'null'
              | 'array'
              | 'unknown'
              | 'promise'
              | 'void'
              | 'never'
              | 'set';
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
        suggestions.push(`Field "${path}": Must select from the values provided in the original list.`);
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
          const validOptions = issue.options || [];
          const receivedValue = 'received' in issue ? String(issue.received) : 'unknown value';
          
          // Find closest matches using fuzzy matching
          const closestMatches = receivedValue !== 'unknown value' 
            ? findClosestMatches(receivedValue, validOptions.map(String))
            : [];
            
          // Enhanced debug logging for enum validation failures
          logDetailedValidationError({
            field: path,
            actualValue: receivedValue,
            expectedType: 'enum',
            validOptions: validOptions.map(String),
            closestMatches,
            suggestions: closestMatches.length > 0 
              ? [`Did you mean: ${closestMatches.join(', ')}?`]
              : ['Check the enum values list for exact match'],
            errorCode: 'invalid_enum_value',
            message: issue.message,
          });
          
          if (closestMatches.length > 0) {
            suggestions.push(
              `Field "${path}": Received "${receivedValue}" which is not valid. Please select only from the position perspectives provided in the original list.`,
              `💡 Did you mean: ${closestMatches.join(', ')}?`
            );
          } else {
            suggestions.push(
              `Field "${path}": Must select from the position perspectives provided in the original list. The value "${receivedValue}" is not recognized.`
            );
          }
        } else {
          suggestions.push(`Field "${path}": ${issue.message}`);
        }
        break;
      }
    }
  }

  // Add general suggestions when specific issues are found
  if (suggestions.length > 0) {
    suggestions.push(
      'Ensure all required fields are present and have the correct data types.',
      'Double-check field names for typos or incorrect casing.',
      'Verify that the JSON structure matches the expected schema exactly.'
    );
  }

  debug('Generated validation suggestions', {
    issueCount: issues.length,
    suggestionCount: suggestions.length,
    issueTypes: issues.map(i => i.code),
  });

  return suggestions;
}

/**
 * Generate specific field corrections from Zod issues
 *
 * Creates targeted correction instructions that tell LLMs exactly
 * what changes to make to specific fields, rather than general advice.
 *
 * @param issues - Array of Zod validation issues
 * @returns Array of specific correction instructions
 */
export function generateFieldCorrections(issues: z.ZodIssue[]): string[] {
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
        // Handle other issue types with generic correction
        corrections.push(
          `Field "${fieldPath}": ${issue.message || 'Invalid value'}`
        );
        break;
    }
  }

  debug('Generated field corrections', {
    issueCount: issues.length,
    correctionCount: corrections.length,
    correctionTypes: issues.map(i => i.code),
  });

  return corrections;
}

/**
 * Create structured validation suggestions for programmatic use
 *
 * Provides a more structured alternative to the string-based suggestions,
 * enabling better categorization and prioritization of validation issues.
 *
 * @param issues - Array of Zod validation issues
 * @returns Array of structured validation suggestions
 */
export function createStructuredSuggestions(
  issues: z.ZodIssue[]
): ValidationSuggestion[] {
  const suggestions: ValidationSuggestion[] = [];

  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';

    // Determine priority based on issue severity
    const priority = determineSuggestionPriority(issue);

    suggestions.push({
      path,
      issueType: issue.code,
      suggestion: formatSuggestionForIssue(issue, path),
      priority,
    });
  }

  return suggestions;
}

/**
 * Determine the priority level for addressing a validation issue
 *
 * Critical issues prevent any valid response, while low priority
 * issues are minor formatting or optional field problems.
 */
function determineSuggestionPriority(
  issue: z.ZodIssue
): 'low' | 'medium' | 'high' | 'critical' {
  switch (issue.code) {
    case 'invalid_type':
      return 'critical'; // Wrong type prevents valid parsing
    case 'unrecognized_keys':
      return 'high'; // Extra fields indicate structural misunderstanding
    case 'too_small':
    case 'too_big':
      return 'medium'; // Size constraints are important but not blocking
    case 'invalid_union':
      return 'high'; // Union mismatches indicate type confusion
    default:
      return 'low'; // Other issues are typically minor
  }
}

/**
 * Format a single suggestion message for a specific Zod issue
 */
function formatSuggestionForIssue(issue: z.ZodIssue, _path: string): string {
  switch (issue.code) {
    case 'invalid_type': {
      const receivedType = 'received' in issue ? issue.received : 'unknown';
      return `Expected ${issue.expected}, but got ${receivedType}. Please ensure this field contains the correct data type.`;
    }
    case 'unrecognized_keys': {
      const extraKeys = issue.keys?.join(', ') || 'unknown keys';
      return `Unexpected fields found: ${extraKeys}. Please remove these fields or check if they're misspelled.`;
    }
    default:
      return issue.message;
  }
}
