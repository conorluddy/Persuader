/**
 * Validation Logger Module
 * 
 * Specialized logging utilities for validation failures with visual diffs,
 * actual content display, and detailed error analysis. Provides enhanced
 * visibility into what the LLM actually returned versus what was expected.
 */

import chalk from 'chalk';
import type { ValidationError } from '../types/errors.js';
import type { z } from 'zod';
import { diffLines } from 'diff';

/**
 * Configuration for validation logging
 */
export interface ValidationLogConfig {
  maxContentLength?: number;
  showDiff?: boolean;
  showSuggestions?: boolean;
  showRawContent?: boolean;
  formatJson?: boolean;
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
  } = config;

  // Create a structured failure report
  console.log(chalk.red.bold('\n━━━ VALIDATION FAILURE REPORT ━━━'));
  console.log(chalk.yellow(`Attempt ${attemptNumber} failed validation`));
  
  // Show error type and code
  console.log(chalk.dim('\nError Details:'));
  console.log(`  ${chalk.red('Type:')} ${error.type}`);
  console.log(`  ${chalk.red('Code:')} ${error.code}`);
  console.log(`  ${chalk.red('Message:')} ${error.message}`);

  // Show the actual content that failed
  if (showRawContent && rawContent) {
    console.log(chalk.dim('\n📄 Actual LLM Response:'));
    const displayContent = formatContent(rawContent, maxContentLength, formatJson);
    console.log(createContentBox(displayContent, 'red'));
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
    try {
      const actualObj = JSON.parse(rawContent);
      const expectedStructure = generateExpectedStructure(error.issues || []);
      if (expectedStructure) {
        console.log(chalk.dim('\n📊 Structural Diff:'));
        showStructuralDiff(actualObj, expectedStructure);
      }
    } catch {
      // Not JSON or can't parse, skip diff
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
 * Format content for display with optional JSON prettification
 */
function formatContent(content: string, maxLength: number, formatJson: boolean): string {
  let displayContent = content;
  
  // Try to format as JSON if requested
  if (formatJson) {
    try {
      const parsed = JSON.parse(content);
      displayContent = JSON.stringify(parsed, null, 2);
    } catch {
      // Not JSON, use as-is
    }
  }

  // Truncate if too long
  if (displayContent.length > maxLength) {
    const truncated = displayContent.substring(0, maxLength);
    return `${truncated}\n${chalk.yellow('... (truncated)')}`;
  }

  return displayContent;
}

/**
 * Create a visual box around content
 */
function createContentBox(content: string, color: 'red' | 'green' | 'yellow' = 'red'): string {
  const lines = content.split('\n');
  const maxLineLength = Math.max(...lines.map(l => l.length));
  const boxWidth = Math.min(maxLineLength + 4, 80);
  
  const colorFn = color === 'red' ? chalk.red : 
                   color === 'green' ? chalk.green : 
                   chalk.yellow;
  
  const result: string[] = [];
  result.push(colorFn('┌' + '─'.repeat(boxWidth - 2) + '┐'));
  
  lines.forEach(line => {
    const paddedLine = line.padEnd(boxWidth - 4);
    result.push(colorFn('│ ') + paddedLine + colorFn(' │'));
  });
  
  result.push(colorFn('└' + '─'.repeat(boxWidth - 2) + '┘'));
  
  return result.join('\n');
}

/**
 * Format a single validation issue with visual emphasis
 */
function formatValidationIssue(issue: z.ZodIssue, index: number): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
  const lines: string[] = [];
  
  lines.push(chalk.red(`  ${index}. `) + chalk.yellow(path));
  lines.push(chalk.dim('     └─ ') + issue.message);
  
  // Add additional context if available
  if (issue.code === 'invalid_type') {
    lines.push(chalk.dim(`        Expected: ${chalk.green((issue as any).expected)}`));
    lines.push(chalk.dim(`        Received: ${chalk.red((issue as any).received)}`));
  } else if ((issue as any).code === 'invalid_enum_value') {
    const options = (issue as any).options;
    if (options && options.length < 10) {
      lines.push(chalk.dim(`        Valid options: ${chalk.green(options.join(', '))}`));
    } else if (options) {
      lines.push(chalk.dim(`        Valid options: ${chalk.green(`${options.length} choices available`)}`));
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate expected structure from validation issues
 */
function generateExpectedStructure(issues: z.ZodIssue[]): Record<string, any> | null {
  try {
    const structure: Record<string, any> = {};
    
    for (const issue of issues) {
      if (issue.path.length === 0) continue;
      
      let current = structure;
      for (let i = 0; i < issue.path.length - 1; i++) {
        const key = issue.path[i];
        if (typeof key === 'string' || typeof key === 'number') {
          if (!(key in current)) {
            current[String(key)] = {};
          }
          current = current[String(key)];
        }
      }
      
      const lastKey = issue.path[issue.path.length - 1];
      if (typeof lastKey === 'string' || typeof lastKey === 'number') {
        const keyStr = String(lastKey);
        if (issue.code === 'invalid_type') {
          current[keyStr] = `<${(issue as any).expected}>`;
        } else if ((issue as any).code === 'invalid_enum_value') {
          const options = (issue as any).options;
          if (options && options.length < 5) {
            current[keyStr] = `<${options.join(' | ')}>`;
          } else {
            current[keyStr] = `<enum>`;
          }
        } else {
          current[keyStr] = `<${issue.message}>`;
        }
      }
    }
    
    return Object.keys(structure).length > 0 ? structure : null;
  } catch {
    return null;
  }
}

/**
 * Show structural diff between actual and expected
 */
function showStructuralDiff(actual: any, expected: any): void {
  try {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    
    const diff = diffLines(expectedStr, actualStr, { ignoreWhitespace: false });
    
    diff.forEach(part => {
      if (part.added) {
        // Lines in actual but not expected (extra fields)
        const lines = part.value.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          console.log(chalk.green(`  + ${line}`));
        });
      } else if (part.removed) {
        // Lines in expected but not actual (missing fields)
        const lines = part.value.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          console.log(chalk.red(`  - ${line}`));
        });
      } else {
        // Common lines (correct structure)
        const lines = part.value.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          console.log(chalk.dim(`    ${line}`));
        });
      }
    });
  } catch {
    console.log(chalk.yellow('  Unable to generate diff'));
  }
}

/**
 * Create a visual comparison table
 */
export function createComparisonTable(
  expected: Record<string, any>,
  actual: Record<string, any>
): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold('\n  Field Comparison:'));
  lines.push(chalk.dim('  ─'.repeat(60)));
  lines.push(chalk.dim('  Field                    Expected            Actual'));
  lines.push(chalk.dim('  ─'.repeat(60)));
  
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  
  for (const key of allKeys) {
    const expectedVal = key in expected ? JSON.stringify(expected[key]) : 'undefined';
    const actualVal = key in actual ? JSON.stringify(actual[key]) : 'undefined';
    
    const keyStr = key.padEnd(24).substring(0, 24);
    const expStr = expectedVal.padEnd(20).substring(0, 20);
    const actStr = actualVal.substring(0, 20);
    
    const match = expectedVal === actualVal;
    const line = `  ${keyStr} ${match ? chalk.green(expStr) : chalk.yellow(expStr)} ${match ? chalk.green(actStr) : chalk.red(actStr)}`;
    lines.push(line);
  }
  
  lines.push(chalk.dim('  ─'.repeat(60)));
  
  return lines.join('\n');
}

/**
 * Log validation success for contrast and learning
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
  } catch {
    // Can't preview, skip
  }
  
  console.log('');
}

export type { ValidationError };