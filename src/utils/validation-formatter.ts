/**
 * Validation Formatter Module
 * 
 * Formatting utilities for validation errors and success messages.
 * Handles visual presentation of validation results.
 */

import chalk from 'chalk';
import type { z } from 'zod';

/**
 * Create a visual box around content
 * 
 * @param content - Content to box
 * @param color - Box color theme
 * @returns Boxed content string
 */
export function createContentBox(
  content: string, 
  color: 'red' | 'green' | 'yellow' = 'red'
): string {
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
 * Format content for display with optional JSON prettification
 * 
 * @param content - Raw content to format
 * @param maxLength - Maximum length before truncation
 * @param formatJson - Whether to prettify JSON
 * @returns Formatted content string
 */
export function formatContent(
  content: string, 
  maxLength: number, 
  formatJson: boolean
): string {
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
 * Type guard for invalid type issues
 */
export function isInvalidTypeIssue(issue: z.ZodIssue): boolean {
  return issue.code === 'invalid_type' && 
         'expected' in issue && 
         'received' in issue;
}

/**
 * Type guard for invalid enum issues  
 */
export function isInvalidEnumIssue(issue: z.ZodIssue): boolean {
  const extendedIssue = issue as any;
  return 'code' in extendedIssue && 
         extendedIssue.code === 'invalid_enum_value' && 
         'options' in extendedIssue;
}

/**
 * Format a single validation issue with visual emphasis
 * 
 * @param issue - Zod validation issue
 * @param index - Issue index for numbering
 * @returns Formatted issue string
 */
export function formatValidationIssue(issue: z.ZodIssue, index: number): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
  const lines: string[] = [];
  
  lines.push(chalk.red(`  ${index}. `) + chalk.yellow(path));
  lines.push(chalk.dim('     └─ ') + issue.message);
  
  // Add additional context if available with proper type guards
  if (issue.code === 'invalid_type' && 'expected' in issue && 'received' in issue) {
    const typedIssue = issue as any;
    lines.push(chalk.dim(`        Expected: ${chalk.green(typedIssue.expected)}`));
    lines.push(chalk.dim(`        Received: ${chalk.red(typedIssue.received)}`));
  } else if ('code' in issue) {
    const extendedIssue = issue as any;
    if (extendedIssue.code === 'invalid_enum_value' && 'options' in extendedIssue) {
      const options = extendedIssue.options;
      if (options && options.length < 10) {
        lines.push(chalk.dim(`        Valid options: ${chalk.green(options.join(', '))}`));
      } else if (options) {
        lines.push(chalk.dim(`        Valid options: ${chalk.green(`${options.length} choices available`)}`));
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Create a visual comparison table
 * 
 * @param expected - Expected values
 * @param actual - Actual values
 * @returns Formatted comparison table
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