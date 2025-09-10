/**
 * File Processing Utilities
 *
 * Handles file reading, glob pattern resolution, and input data processing for CLI commands.
 * Provides a clean abstraction over file I/O operations with proper error handling and
 * progress reporting capabilities.
 *
 * @module cli/utilities/file-processor
 */

import type {
  ReadInputsOptions,
  ReadInputsResult,
} from '../../utils/file-io.js';

/**
 * File processing configuration options
 */
export interface FileProcessorOptions extends ReadInputsOptions {
  /** Enable verbose logging during file processing */
  readonly verbose?: boolean;
  /** Progress callback for file processing updates */
  readonly onProgress?: (current: number, total: number, file: string) => void;
}

/**
 * Result of file processing operation
 */
export interface FileProcessorResult extends ReadInputsResult {
  /** Processing time in milliseconds */
  readonly processingTimeMs: number;
  /** Files that failed to process */
  readonly failedFiles: readonly string[];
}

/**
 * File validation result for schema compatibility
 */
export interface FileValidationResult {
  /** Whether file format is supported */
  readonly isSupported: boolean;
  /** Detected file format */
  readonly format: 'json' | 'yaml' | 'unknown';
  /** File size in bytes */
  readonly size: number;
  /** Validation errors if any */
  readonly errors: readonly string[];
}

/**
 * Process input files and patterns to extract data for pipeline processing
 *
 * Handles glob pattern expansion, file reading, and data extraction with proper
 * error handling and progress reporting. Supports JSON and YAML formats with
 * automatic format detection.
 *
 * @param inputPattern - Glob pattern or file path to process
 * @param options - Processing options and configuration
 * @returns Promise resolving to processed file data and metadata
 */
export async function processInputFiles(
  inputPattern: string,
  options: FileProcessorOptions = {}
): Promise<FileProcessorResult> {
  const startTime = Date.now();
  const failedFiles: string[] = [];
  const { verbose = false, onProgress, ...readOptions } = options;

  try {
    // Import the file-io utilities dynamically to avoid circular deps
    const { readInputs } = await import('../../utils/file-io.js');
    const { consola } = await import('consola');

    if (verbose) {
      consola.debug(`Processing input pattern: ${inputPattern}`);
    }

    // Configure read options with defaults for CLI usage
    const finalOptions = {
      flattenArrays: true, // Flatten arrays from multiple files for batch processing
      allowEmpty: false, // Throw error if no files found
      ...readOptions,
    };

    // Process files with progress reporting if callback provided
    const result = await readInputs(inputPattern, finalOptions);

    // Report progress if callback provided
    if (onProgress) {
      result.files.forEach((file, index) => {
        onProgress(index + 1, result.files.length, file.filePath);
      });
    }

    if (verbose) {
      consola.debug(
        `Found ${result.fileCount} file(s), ${result.data.length} items total`
      );
      for (const file of result.files) {
        consola.debug(
          `  • ${file.filePath} (${file.format}, ${file.size} bytes)`
        );
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      ...result,
      processingTimeMs,
      failedFiles,
    };
  } catch (error) {
    // Convert file-io errors to CLI-friendly messages
    if ((error as { type?: string }).type === 'file_io') {
      const { convertFileError } = await import('./error-handler.js');
      const cliError = convertFileError(error, inputPattern, 'read');
      throw new Error(cliError.message);
    }
    throw error;
  }
}

/**
 * Validate file format and compatibility with pipeline requirements
 *
 * Checks if files can be processed by the pipeline, validates format compatibility,
 * and provides detailed validation results for error reporting.
 *
 * @param filePath - Path to file to validate
 * @returns Promise resolving to validation results
 */
export async function validateInputFile(
  filePath: string
): Promise<FileValidationResult> {
  const errors: string[] = [];
  let format: 'json' | 'yaml' | 'unknown' = 'unknown';
  let size = 0;

  try {
    const { stat, readFile } = await import('node:fs/promises');
    const { extname } = await import('node:path');

    // Check file exists and get size
    const stats = await stat(filePath);
    size = stats.size;

    if (!stats.isFile()) {
      errors.push('Path is not a regular file');
      return {
        isSupported: false,
        format,
        size,
        errors,
      };
    }

    // Determine format from extension
    const ext = extname(filePath).toLowerCase();
    if (ext === '.json') {
      format = 'json';
    } else if (ext === '.yaml' || ext === '.yml') {
      format = 'yaml';
    } else {
      errors.push(
        `Unsupported file extension: ${ext}. Expected .json, .yaml, or .yml`
      );
      return {
        isSupported: false,
        format,
        size,
        errors,
      };
    }

    // Validate file can be parsed
    const content = await readFile(filePath, 'utf-8');

    if (format === 'json') {
      try {
        JSON.parse(content);
      } catch (parseError) {
        errors.push(`Invalid JSON format: ${(parseError as Error).message}`);
      }
    } else if (format === 'yaml') {
      try {
        // Use file-io utility for YAML parsing (it handles the yaml import)
        const { readInputs } = await import('../../utils/file-io.js');
        // Test parse by attempting to read the file
        await readInputs(filePath, { allowEmpty: true });
      } catch (parseError) {
        errors.push(`Invalid YAML format: ${(parseError as Error).message}`);
      }
    }

    const isSupported = errors.length === 0;
    return {
      isSupported,
      format,
      size,
      errors,
    };
  } catch (error) {
    errors.push(`Failed to validate file: ${(error as Error).message}`);
    return {
      isSupported: false,
      format,
      size,
      errors,
    };
  }
}

/**
 * Calculate processing statistics for multiple files
 *
 * Provides summary statistics about file processing operations including
 * total files, data items, processing time, and success/failure rates.
 *
 * @param results - Array of file processing results
 * @returns Aggregated processing statistics
 */
export function calculateFileProcessingStats(
  results: readonly FileProcessorResult[]
): {
  readonly totalFiles: number;
  readonly totalItems: number;
  readonly totalTime: number;
  readonly successRate: number;
  readonly failureRate: number;
} {
  if (results.length === 0) {
    return {
      totalFiles: 0,
      totalItems: 0,
      totalTime: 0,
      successRate: 1.0,
      failureRate: 0.0,
    };
  }

  const totalFiles = results.reduce((sum, result) => sum + result.fileCount, 0);
  const totalItems = results.reduce(
    (sum, result) => sum + result.data.length,
    0
  );
  const totalTime = results.reduce(
    (sum, result) => sum + result.processingTimeMs,
    0
  );
  const totalFailures = results.reduce(
    (sum, result) => sum + result.failedFiles.length,
    0
  );

  const successRate =
    totalFiles > 0 ? (totalFiles - totalFailures) / totalFiles : 1.0;
  const failureRate = totalFiles > 0 ? totalFailures / totalFiles : 0.0;

  return {
    totalFiles,
    totalItems,
    totalTime,
    successRate,
    failureRate,
  };
}

/**
 * Format file processing errors for CLI display
 *
 * Converts file I/O errors into user-friendly messages with actionable guidance
 * for resolution. Handles common error scenarios like missing files, permission
 * issues, and format problems.
 *
 * @param error - Error from file processing operation
 * @param filePath - Path of file that caused the error
 * @returns Formatted error message for CLI display
 */
export function formatFileProcessingError(
  error: unknown,
  filePath: string
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  if (
    lowerMessage.includes('no such file or directory') ||
    lowerMessage.includes('enoent')
  ) {
    return `File not found: ${filePath}\nPlease check the file path and ensure the file exists.`;
  }

  if (
    lowerMessage.includes('permission denied') ||
    lowerMessage.includes('eacces')
  ) {
    return `Permission denied: ${filePath}\nPlease check file permissions and ensure you have read access.`;
  }

  if (
    lowerMessage.includes('is a directory') ||
    lowerMessage.includes('eisdir')
  ) {
    return `Expected file but found directory: ${filePath}\nPlease specify a file path, not a directory.`;
  }

  if (
    lowerMessage.includes('invalid json') ||
    lowerMessage.includes('unexpected token')
  ) {
    return `Invalid JSON format in: ${filePath}\nPlease check the JSON syntax and fix any formatting errors.`;
  }

  if (
    lowerMessage.includes('yaml') &&
    (lowerMessage.includes('parse') || lowerMessage.includes('invalid'))
  ) {
    return `Invalid YAML format in: ${filePath}\nPlease check the YAML syntax and fix any formatting errors.`;
  }

  if (
    lowerMessage.includes('file too large') ||
    lowerMessage.includes('emfile')
  ) {
    return `File is too large: ${filePath}\nConsider processing smaller files or increasing system limits.`;
  }

  if (
    lowerMessage.includes('no matching files') ||
    lowerMessage.includes('glob')
  ) {
    return `No files match the pattern: ${filePath}\nPlease check your glob pattern and ensure matching files exist.`;
  }

  // Generic error fallback
  return `Failed to process file: ${filePath}\nError: ${errorMessage}`;
}
