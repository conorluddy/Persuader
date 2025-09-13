/**
 * Utilities Module
 *
 * Shared utility functions and helpers used across the Persuader framework.
 * Provides file I/O, logging, schema analysis, and other common functionality.
 *
 * @module utils
 */

// Internal imports for health checking
import { fileExists } from './file-io.js';
import { info } from './logger.js';
import { extractSchemaInfo } from './schema-analyzer.js';

// File I/O utilities
export {
  fileExists,
  type InputFileMetadata,
  parseFileContent,
  readInputs,
  type WriteOutputOptions,
  writeOutput,
} from './file-io.js';

// Logging utilities
export {
  debug,
  error,
  info,
  type LogContext,
  type LogLevel,
  warn,
} from './logger.js';

// Schema analysis utilities
export {
  extractSchemaInfo,
  getSchemaDescription,
  logSchemaInfo,
  type SchemaInfo,
} from './schema-analyzer.js';

// Schema loading utilities
export { loadSchema, type SchemaLoadResult } from './schema-loader.js';

/**
 * Utility module version and capabilities
 */
export const UTILS_MODULE_VERSION = '1.0.0';

/**
 * Get utility module capabilities
 *
 * @returns Object describing available utility functions
 */
export function getUtilsCapabilities() {
  return {
    version: UTILS_MODULE_VERSION,
    capabilities: {
      fileIO: true,
      logging: true,
      schemaAnalysis: true,
      schemaLoading: true,
    },
    supportedFormats: {
      input: ['.json', '.jsonl', '.yaml', '.yml', '.txt'],
      output: ['.json', '.jsonl'],
      schema: ['.ts', '.js', '.mjs'],
    },
  };
}

/**
 * Check if all utilities are functioning correctly
 *
 * @returns Promise resolving to health check results
 */
export async function checkUtilsHealth(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    // Test basic file operations
    if (typeof fileExists !== 'function') {
      issues.push('File I/O utilities not available');
    }

    // Test logging
    if (typeof info !== 'function') {
      issues.push('Logging utilities not available');
    }

    // Test schema analysis
    if (typeof extractSchemaInfo !== 'function') {
      issues.push('Schema analysis utilities not available');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  } catch (error) {
    return {
      healthy: false,
      issues: [`Utils health check failed: ${error}`],
    };
  }
}
