/**
 * Field Analysis Utilities
 *
 * Functions for analyzing validation errors at the field level,
 * extracting specific field information and error patterns.
 */

import type { ValidationError } from '../../types/errors.js';

/**
 * Extract field-level validation errors for detailed feedback
 *
 * Converts validation issues into structured field-specific error
 * information suitable for detailed analysis and reporting.
 *
 * @param error - Validation error containing Zod issues
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
