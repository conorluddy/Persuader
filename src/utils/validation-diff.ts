/**
 * Validation Diff Module
 * 
 * Utilities for generating and displaying structural diffs
 * between expected and actual validation results.
 */

import chalk from 'chalk';
import { diffLines } from 'diff';
import type { z } from 'zod';

/**
 * Generate expected structure from validation issues
 * 
 * @param issues - Zod validation issues
 * @returns Expected structure object or null
 */
export function generateExpectedStructure(issues: z.ZodIssue[]): Record<string, any> | null {
  try {
    const structure: Record<string, any> = {};
    
    for (const issue of issues) {
      if (!issue || !issue.path || issue.path.length === 0) continue;
      
      let current = structure;
      for (let i = 0; i < issue.path.length - 1; i++) {
        const key = issue.path[i];
        if (typeof key === 'string' || typeof key === 'number') {
          const keyStr = String(key);
          if (!current || typeof current !== 'object') {
            break; // Invalid structure, skip this issue
          }
          if (!(keyStr in current)) {
            current[keyStr] = {};
          }
          current = current[keyStr];
        }
      }
      
      const lastKey = issue.path[issue.path.length - 1];
      if (current && typeof current === 'object' && (typeof lastKey === 'string' || typeof lastKey === 'number')) {
        const keyStr = String(lastKey);
        // Use safe access for extended properties
        const extendedIssue = issue as any;
        
        if (issue.code === 'invalid_type' && 'expected' in extendedIssue) {
          current[keyStr] = `<${extendedIssue.expected}>`;
        } else if ('code' in extendedIssue && extendedIssue.code === 'invalid_enum_value' && 'options' in extendedIssue) {
          if (extendedIssue.options.length < 5) {
            current[keyStr] = `<${extendedIssue.options.join(' | ')}>`;
          } else {
            current[keyStr] = `<enum>`;
          }
        } else {
          current[keyStr] = `<${issue.message}>`;
        }
      }
    }
    
    return Object.keys(structure).length > 0 ? structure : null;
  } catch (structureError) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('Failed to generate expected structure:', structureError);
    }
    return null;
  }
}

/**
 * Show structural diff between actual and expected
 * 
 * @param actual - Actual object structure
 * @param expected - Expected object structure
 */
export function showStructuralDiff(actual: unknown, expected: unknown): void {
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
 * Generate a detailed diff report
 * 
 * @param actual - Actual value
 * @param expected - Expected value
 * @returns Formatted diff report string
 */
export function generateDiffReport(actual: unknown, expected: unknown): string {
  try {
    const actualStr = JSON.stringify(actual, null, 2);
    const expectedStr = JSON.stringify(expected, null, 2);
    
    const diff = diffLines(expectedStr, actualStr, { ignoreWhitespace: false });
    const lines: string[] = [];
    
    lines.push('Structural Differences:');
    lines.push('─'.repeat(40));
    
    let hasChanges = false;
    diff.forEach(part => {
      if (part.added) {
        hasChanges = true;
        lines.push('+ Unexpected fields:');
        part.value.split('\n').filter(l => l.trim()).forEach(line => {
          lines.push(`  + ${line}`);
        });
      } else if (part.removed) {
        hasChanges = true;
        lines.push('- Missing fields:');
        part.value.split('\n').filter(l => l.trim()).forEach(line => {
          lines.push(`  - ${line}`);
        });
      }
    });
    
    if (!hasChanges) {
      lines.push('  No structural differences found');
    }
    
    return lines.join('\n');
  } catch {
    return 'Unable to generate diff report';
  }
}