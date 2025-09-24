/**
 * Validation Logger Module
 * 
 * Specialized logging utilities for validation failures with visual diffs,
 * actual content display, and detailed error analysis. Provides enhanced
 * visibility into what the LLM actually returned versus what was expected.
 */

import chalk from 'chalk';
import type { ValidationError } from '../types/errors.js';
import { sanitizeContent } from './content-sanitizer.js';
import { getValidationCache } from './validation-cache.js';
import { parseJsonCached } from './json-parse-cache.js';
import {
  createContentBox,
  formatContent,
  formatValidationIssue,
} from './validation-formatter.js';
import {
  generateExpectedStructure,
  showStructuralDiff,
} from './validation-diff.js';

/**
 * Configuration for validation logging
 */
export interface ValidationLogConfig {
  maxContentLength?: number;
  showDiff?: boolean;
  showSuggestions?: boolean;
  showRawContent?: boolean;
  formatJson?: boolean;
  sanitize?: boolean;
  cacheFailures?: boolean;
}

/**
 * Log validation failure with actual content that failed
 * 
 * @param error - Validation error from schema validation
 * @param rawContent - The actual raw content from the LLM that failed
 * @param attemptNumber - Current attempt number for context
 * @param config - Optional configuration for logging behavior
 */
export function logValidationFailure(
  error: ValidationError,
  rawContent: string,
  attemptNumber: number,
  config: ValidationLogConfig = {}
): void {
  const {
    maxContentLength = 2000,
    showDiff = true,
    showSuggestions = true,
    showRawContent = true,
    formatJson = true,
    sanitize = true,
    cacheFailures = true,
  } = config;
  
  // Cache the failure if enabled (prevents memory leaks)
  if (cacheFailures) {
    const cache = getValidationCache();
    cache.add(error, rawContent, attemptNumber);
  }
  
  // Sanitize content for safe display
  const displayContent = sanitize 
    ? sanitizeContent(rawContent, { maxLength: maxContentLength })
    : rawContent;

  // Create a structured failure report
  console.log(chalk.red.bold('\n━━━ VALIDATION FAILURE REPORT ━━━'));
  console.log(chalk.yellow(`Attempt ${attemptNumber} failed validation`));
  
  // Show error type and code
  console.log(chalk.dim('\nError Details:'));
  console.log(`  ${chalk.red('Type:')} ${error.type}`);
  console.log(`  ${chalk.red('Code:')} ${error.code}`);
  console.log(`  ${chalk.red('Message:')} ${error.message}`);

  // Show the actual content that failed
  if (showRawContent && displayContent) {
    console.log(chalk.dim('\n📄 Actual LLM Response:'));
    const formatted = formatContent(displayContent, maxContentLength, formatJson);
    console.log(createContentBox(formatted, 'red'));
  }

  // Show specific validation issues
  if (error.issues && error.issues.length > 0) {
    console.log(chalk.dim('\n❌ Validation Issues:'));
    error.issues.forEach((issue, index) => {
      const issueBox = formatValidationIssue(issue, index + 1);
      console.log(issueBox);
    });
  }

  // Show diff if we can parse the content as JSON
  if (showDiff && error.code === 'schema_validation') {
    const parseResult = parseJsonCached(displayContent);
    if (parseResult.success) {
      const expectedStructure = generateExpectedStructure(error.issues || []);
      if (expectedStructure) {
        console.log(chalk.dim('\n📊 Structural Diff:'));
        showStructuralDiff(parseResult.value, expectedStructure);
      }
    } else if (process.env.NODE_ENV === 'development') {
      // Not JSON or can't parse, log in debug mode
      console.debug('Could not parse content for diff:', parseResult.error);
    }
  }

  // Show suggestions
  if (showSuggestions && error.suggestions && error.suggestions.length > 0) {
    console.log(chalk.dim('\n💡 Suggestions:'));
    error.suggestions.forEach(suggestion => {
      console.log(chalk.cyan(`  • ${suggestion}`));
    });
  }

  console.log(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

/**
 * Log validation success for contrast and learning
 * 
 * @param parsedContent - The successfully validated content
 * @param attemptNumber - The attempt number that succeeded
 */
export function logValidationSuccess(
  parsedContent: any,
  attemptNumber: number
): void {
  console.log(chalk.green.bold('\n✅ VALIDATION SUCCESS'));
  console.log(chalk.dim(`Attempt ${attemptNumber} passed validation`));
  
  // Show a preview of the successful structure
  try {
    const preview = JSON.stringify(parsedContent, null, 2);
    const lines = preview.split('\n').slice(0, 10);
    
    if (lines.length > 0) {
      console.log(chalk.dim('\nValidated Structure Preview:'));
      console.log(createContentBox(lines.join('\n'), 'green'));
    }
  } catch (previewError) {
    // Can't preview, log in debug mode
    if (process.env.NODE_ENV === 'development') {
      console.debug('Could not preview validation success:', previewError);
    }
  }
  
  console.log('');
}

// Re-export utilities from formatter module
export { createComparisonTable } from './validation-formatter.js';
export type { ValidationError };