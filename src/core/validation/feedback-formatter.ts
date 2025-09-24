/**
 * Feedback Formatter Module
 *
 * Formats validation errors into human-readable feedback for LLM retries,
 * with progressive urgency and contextual guidance based on attempt number.
 */

import type { z } from 'zod';
import type { ValidationError } from '../../types/errors.js';
import { debug, getGlobalLogger } from '../../utils/logger.js';
import { logValidationFailure } from '../../utils/validation-logger.js';
import { generateFieldCorrections } from './suggestion-generator.js';

/**
 * Format validation error into human-readable feedback for LLM retry
 *
 * Main entry point for converting validation errors into structured
 * feedback that guides the LLM toward producing valid output.
 *
 * @param error - Validation error to format
 * @param attemptNumber - Current attempt number for progressive urgency
 * @returns Formatted error feedback string for LLM retry
 */
export function formatValidationErrorFeedback(
  error: ValidationError,
  attemptNumber: number = 1,
  rawContent?: string
): string {
  // Log enhanced validation failure details if available and in debug mode
  const logger = getGlobalLogger();
  if (rawContent && (logger.getLevel() === 'debug' || logger.getLevel() === 'verboseDebug')) {
    logValidationFailure(error, rawContent, attemptNumber, {
      maxContentLength: 1000,
      showDiff: true,
      showSuggestions: true,
      showRawContent: false, // Already shown in main logger
      formatJson: true,
    });
  }

  // Enhanced JSON parse error handling with progressive urgency
  if (error.code === 'json_parse') {
    return formatJsonParseErrorFeedback(error, attemptNumber);
  }

  // Enhanced schema validation error handling with field-specific guidance
  if (error.code === 'schema_validation') {
    return formatSchemaValidationErrorFeedback(error, attemptNumber);
  }

  // Generic error handling
  return `Validation Error: ${error.message}`;
}

/**
 * Format JSON parsing error with progressive urgency
 *
 * Specialized formatter for JSON parsing failures that escalates
 * urgency and specificity based on attempt number.
 *
 * @param error - JSON parsing validation error
 * @param attemptNumber - Current attempt number
 * @returns Formatted JSON parsing error feedback
 */
export function formatJsonParseErrorFeedback(
  error: ValidationError,
  attemptNumber: number
): string {
  const urgency = generateUrgencyPrefix(attemptNumber);
  const instruction = generateAttemptSpecificInstructions(
    attemptNumber,
    'json_parse'
  );

  debug('Formatting JSON parse error feedback', {
    attemptNumber,
    urgency: urgency !== '',
    errorMessage: error.message,
  });

  return `${urgency}JSON Parsing Error: ${error.message}\n\n${instruction}`;
}

/**
 * Format schema validation error with field-specific guidance
 *
 * Specialized formatter for schema validation failures that provides
 * detailed field-level corrections and suggestions.
 *
 * @param error - Schema validation error
 * @param attemptNumber - Current attempt number
 * @returns Formatted schema validation error feedback
 */
export function formatSchemaValidationErrorFeedback(
  error: ValidationError,
  attemptNumber: number
): string {
  const issueLines = formatValidationIssues(error.issues || []);

  // Generate specific field-level corrections
  const fieldCorrections = generateFieldCorrections(error.issues || []);
  const correctionLines = formatFieldCorrections(fieldCorrections);

  const suggestionLines = formatSuggestionsList([...(error.suggestions || [])]);

  // Add visual separator and emphasis for later attempts
  const visualSeparator = attemptNumber >= 2 ? '\n' + '─'.repeat(60) + '\n' : '';
  const urgencyNote = generateFinalAttemptWarning(attemptNumber, 3);

  // Add structured guidance for complex failures
  const structuredGuidance = attemptNumber >= 2 && error.structuredFeedback 
    ? formatStructuredGuidance(error.structuredFeedback)
    : '';

  debug('Formatting schema validation error feedback', {
    attemptNumber,
    issueCount: error.issues?.length || 0,
    hasFieldCorrections: fieldCorrections.length > 0,
    hasSuggestions: (error.suggestions?.length || 0) > 0,
    hasStructuredGuidance: Boolean(structuredGuidance),
    fullErrorDetails: error, // Log complete error for analysis
    formattedFeedback: issueLines + correctionLines + suggestionLines + urgencyNote, // Log what we're sending back
  });

  return `Schema Validation Failed (Attempt ${attemptNumber}):${visualSeparator}\n${issueLines}${correctionLines}${suggestionLines}${structuredGuidance}${urgencyNote}`;
}

/**
 * Generate urgency prefix based on attempt number
 *
 * Creates progressively urgent prefixes for error messages to emphasize
 * the criticality of following corrections as attempts increase.
 *
 * @param attemptNumber - Current attempt number
 * @returns Urgency prefix string (may be empty for early attempts)
 */
export function generateUrgencyPrefix(attemptNumber: number): string {
  if (attemptNumber >= 3) {
    return '🚨 CRITICAL: ';
  }
  if (attemptNumber >= 2) {
    return '⚠️ IMPORTANT: ';
  }
  return '';
}

/**
 * Format validation issues into readable issue list
 *
 * Converts array of Zod issues into a formatted, hierarchical list
 * showing field paths and specific error messages.
 *
 * @param issues - Array of Zod validation issues
 * @returns Formatted multi-line string of issues
 */
export function formatValidationIssues(issues: z.ZodIssue[]): string {
  return issues
    .map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `  • ${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Format field corrections into readable correction list
 *
 * Converts array of field corrections into a formatted, actionable list
 * with clear instructions for each field that needs changes.
 *
 * @param corrections - Array of correction strings
 * @returns Formatted multi-line string of corrections
 */
export function formatFieldCorrections(corrections: string[]): string {
  if (corrections.length === 0) {
    return '';
  }
  return `\nSpecific Corrections Needed:\n${corrections.map(c => `  • ${c}`).join('\n')}`;
}

/**
 * Format suggestions into readable suggestion list
 *
 * Converts array of suggestions into a formatted list with consistent
 * bullet points and clear, actionable guidance.
 *
 * @param suggestions - Array of suggestion strings
 * @returns Formatted multi-line string of suggestions
 */
export function formatSuggestionsList(suggestions: string[]): string {
  if (suggestions.length === 0) {
    return '';
  }
  return `\nGeneral Suggestions:\n${suggestions.map(s => `  • ${s}`).join('\n')}`;
}

/**
 * Generate attempt-specific instructions
 *
 * Creates instructions that become more specific and directive as the
 * attempt number increases, with final attempt being most prescriptive.
 *
 * @param attemptNumber - Current attempt number
 * @param errorType - Type of validation error (for context)
 * @returns Attempt-specific instruction string
 */
export function generateAttemptSpecificInstructions(
  attemptNumber: number,
  errorType: string
): string {
  if (errorType === 'json_parse') {
    if (attemptNumber >= 3) {
      return 'Your response MUST start with "{" and end with "}". No explanatory text before or after the JSON object.';
    }
    return 'The response must be valid JSON. Please ensure proper syntax with matching brackets, quotes, and commas.';
  }

  // Default instructions for other error types
  return 'Please follow the corrections exactly to produce valid output.';
}

/**
 * Generate critical final attempt warning
 *
 * Creates urgent, final attempt messaging when the retry limit is
 * approaching to ensure the LLM takes maximum care.
 *
 * @param attemptNumber - Current attempt number
 * @param maxAttempts - Maximum allowed attempts
 * @returns Critical warning string or empty if not final attempt
 */
export function generateFinalAttemptWarning(
  attemptNumber: number,
  maxAttempts: number
): string {
  if (attemptNumber >= maxAttempts) {
    return '\n🚨 CRITICAL: This is your final attempt. Please follow the corrections exactly.';
  }
  return '';
}

/**
 * Format structured guidance for complex validation failures
 * 
 * Provides hierarchical, actionable guidance based on the structured
 * feedback from the validation system.
 * 
 * @param feedback - Structured feedback from validation
 * @returns Formatted guidance string
 */
export function formatStructuredGuidance(
  feedback: {
    readonly problemSummary: string;
    readonly specificIssues: readonly string[];
    readonly correctionInstructions: readonly string[];
    readonly exampleCorrection?: string;
  }
): string {
  const lines: string[] = [];
  
  lines.push('\n📋 STRUCTURED GUIDANCE:');
  lines.push(`Problem: ${feedback.problemSummary}`);
  
  if (feedback.specificIssues.length > 0) {
    lines.push('\nSpecific Issues:');
    feedback.specificIssues.forEach(issue => {
      lines.push(`  ⚠️  ${issue}`);
    });
  }
  
  if (feedback.correctionInstructions.length > 0) {
    lines.push('\nRequired Corrections:');
    feedback.correctionInstructions.forEach((instruction, index) => {
      lines.push(`  ${index + 1}. ${instruction}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Format generic validation error with basic feedback
 *
 * Fallback formatter for error types that don't have specialized handling.
 * Provides basic error messaging with attempt number context.
 *
 * @param error - Generic validation error
 * @param attemptNumber - Current attempt number
 * @returns Formatted generic error feedback
 */
export function formatGenericErrorFeedback(
  error: ValidationError,
  attemptNumber: number
): string {
  const urgencyPrefix = generateUrgencyPrefix(attemptNumber);
  return `${urgencyPrefix}Validation Error (Attempt ${attemptNumber}): ${error.message}`;
}
