/**
 * File I/O Helpers
 *
 * Comprehensive file input/output utilities for the Persuader framework.
 * Provides robust file reading with glob pattern support, intelligent parsing,
 * and flexible output writing with error handling.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import fastGlob from 'fast-glob';
import { JSON_INDENT } from '../shared/constants/index.js';
import type { FileIOError } from '../types/errors.js';

/**
 * Options for reading input files
 */
export interface ReadInputsOptions {
  /** Flatten array inputs from multiple files into a single array */
  readonly flattenArrays?: boolean;

  /** Encoding for text files */
  readonly encoding?: BufferEncoding;

  /** Maximum file size in bytes (default: 100MB) */
  readonly maxFileSize?: number;

  /** Whether to throw on missing files or return empty array */
  readonly allowEmpty?: boolean;
}

/**
 * Options for writing output files
 */
export interface WriteOutputOptions {
  /** Pretty-print JSON with indentation */
  readonly pretty?: boolean;

  /** Append to file instead of overwriting */
  readonly append?: boolean;

  /** Create directories as needed */
  readonly createDir?: boolean;

  /** File encoding */
  readonly encoding?: BufferEncoding;

  /** Custom JSON indentation (overrides pretty option) */
  readonly indent?: number;
}

/**
 * File format type
 */
export type FileFormat = 'json' | 'text' | 'unknown';

/**
 * Input file metadata
 */
export interface InputFileMetadata {
  /** Absolute file path */
  readonly filePath: string;

  /** File format detected from extension and content */
  readonly format: FileFormat;

  /** File size in bytes */
  readonly size: number;

  /** Last modified timestamp */
  readonly mtime: Date;

  /** Whether content was parsed (JSON) or kept as text */
  readonly wasParsed: boolean;
}

/**
 * Result of reading input files
 */
export interface ReadInputsResult<T = unknown> {
  /** Array of parsed/read data */
  readonly data: T[];

  /** Metadata for each processed file */
  readonly files: readonly InputFileMetadata[];

  /** Total number of files processed */
  readonly fileCount: number;

  /** Total bytes processed */
  readonly totalSize: number;
}

/**
 * Create a FileIOError with consistent structure
 */
function createFileIOError(
  message: string,
  filePath: string,
  operation: FileIOError['operation'],
  options?: {
    code?: string;
    systemError?: string;
    isPermissionError?: boolean;
    exists?: boolean;
    retryable?: boolean;
  }
): FileIOError {
  return {
    type: 'file_io',
    message,
    code: options?.code ?? 'FILE_IO_ERROR',
    filePath,
    operation,
    ...(options?.systemError && { systemError: options.systemError }),
    isPermissionError: options?.isPermissionError ?? false,
    ...(options?.exists !== undefined && { exists: options.exists }),
    timestamp: new Date(),
    retryable: options?.retryable ?? false,
    details: {
      filePath,
      operation,
      ...(options?.systemError && { systemError: options.systemError }),
    },
  };
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats safely
 */
export async function getFileStats(
  filePath: string
): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

/**
 * Determine file format from extension and optionally from content
 */
export function detectFileFormat(
  filePath: string,
  content?: string
): FileFormat {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return 'json';
  }

  // Check content if available
  if (content) {
    const trimmed = content.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(content);
        return 'json';
      } catch {
        // Fall through to text
      }
    }
  }

  if (ext === '.txt' || ext === '.md' || ext === '.csv') {
    return 'text';
  }

  return 'unknown';
}

/**
 * Parse file content based on detected format
 */
export function parseFileContent(
  content: string,
  format: FileFormat
): {
  data: unknown;
  wasParsed: boolean;
} {
  if (format === 'json') {
    try {
      return {
        data: JSON.parse(content),
        wasParsed: true,
      };
    } catch (_error) {
      // If JSON parsing fails, treat as text
      return {
        data: content,
        wasParsed: false,
      };
    }
  }

  return {
    data: content,
    wasParsed: false,
  };
}

/**
 * Read and process a single file
 */
async function readSingleFile(
  filePath: string,
  options: ReadInputsOptions
): Promise<{
  data: unknown;
  metadata: InputFileMetadata;
}> {
  const encoding = options.encoding ?? 'utf-8';
  const maxSize = options.maxFileSize ?? 100 * 1024 * 1024; // 100MB

  try {
    // Get file stats first
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw createFileIOError(
        `Path is not a file: ${filePath}`,
        filePath,
        'read',
        { code: 'NOT_A_FILE', exists: true }
      );
    }

    if (stats.size > maxSize) {
      throw createFileIOError(
        `File too large: ${filePath} (${stats.size} bytes > ${maxSize} bytes)`,
        filePath,
        'read',
        { code: 'FILE_TOO_LARGE', exists: true }
      );
    }

    // Read file content
    const content = await fs.readFile(filePath, encoding);

    // Detect format and parse content
    const format = detectFileFormat(filePath, content);
    const { data, wasParsed } = parseFileContent(content, format);

    const metadata: InputFileMetadata = {
      filePath: path.resolve(filePath),
      format,
      size: stats.size,
      mtime: stats.mtime,
      wasParsed,
    };

    return { data, metadata };
  } catch (error) {
    if ((error as { type?: string }).type === 'file_io') {
      throw error;
    }

    const systemError = (error as NodeJS.ErrnoException).code;
    const isPermissionError =
      systemError === 'EACCES' || systemError === 'EPERM';
    const exists = systemError !== 'ENOENT';

    throw createFileIOError(
      `Failed to read file: ${filePath} - ${(error as Error).message}`,
      filePath,
      'read',
      {
        code: systemError || 'READ_FAILED',
        ...(systemError && { systemError }),
        isPermissionError,
        exists,
        retryable: isPermissionError,
      }
    );
  }
}

/**
 * Read input files using glob patterns
 *
 * Supports:
 * - Glob patterns for multiple files
 * - Automatic JSON parsing for .json files
 * - Array flattening for batch processing
 * - Cross-platform compatibility
 *
 * @param pattern - File path or glob pattern
 * @param options - Reading options
 * @returns Promise resolving to ReadInputsResult with data and metadata
 */
export async function readInputs<T = unknown>(
  pattern: string,
  options: ReadInputsOptions = {}
): Promise<ReadInputsResult<T>> {
  if (!pattern || typeof pattern !== 'string') {
    throw createFileIOError(
      'Invalid pattern: must be a non-empty string',
      pattern || '<empty>',
      'glob',
      { code: 'INVALID_PATTERN' }
    );
  }

  try {
    // Use fast-glob to resolve patterns
    const files = await fastGlob(pattern, {
      dot: false, // Don't match hidden files by default
      onlyFiles: true,
      absolute: true,
      followSymbolicLinks: false,
    });

    if (files.length === 0 && !options.allowEmpty) {
      throw createFileIOError(
        `No files found matching pattern: ${pattern}`,
        pattern,
        'glob',
        { code: 'NO_FILES_FOUND', exists: false }
      );
    }

    // Process all files
    const results: Array<{ data: unknown; metadata: InputFileMetadata }> = [];
    let totalSize = 0;

    for (const file of files) {
      const result = await readSingleFile(file, options);
      results.push(result);
      totalSize += result.metadata.size;
    }

    // Extract data and flatten arrays if requested
    const allData: T[] = [];
    const allMetadata: InputFileMetadata[] = [];

    for (const result of results) {
      allMetadata.push(result.metadata);

      if (options.flattenArrays && Array.isArray(result.data)) {
        allData.push(...(result.data as T[]));
      } else {
        allData.push(result.data as T);
      }
    }

    return {
      data: allData,
      files: allMetadata,
      fileCount: files.length,
      totalSize,
    };
  } catch (error) {
    if ((error as { type?: string }).type === 'file_io') {
      throw error;
    }

    const systemError = (error as { code?: string }).code;
    throw createFileIOError(
      `Failed to read inputs with pattern "${pattern}": ${(error as Error).message}`,
      pattern,
      'glob',
      {
        code: 'GLOB_FAILED',
        ...(systemError && { systemError }),
      }
    );
  }
}

/**
 * Ensure directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    const systemError = (error as NodeJS.ErrnoException).code;
    const isPermissionError =
      systemError === 'EACCES' || systemError === 'EPERM';

    throw createFileIOError(
      `Failed to create directory: ${dirPath} - ${(error as Error).message}`,
      dirPath,
      'mkdir',
      {
        code: systemError || 'MKDIR_FAILED',
        ...(systemError && { systemError }),
        isPermissionError,
        retryable: isPermissionError,
      }
    );
  }
}

/**
 * Write output to file with formatting and directory creation
 *
 * Features:
 * - Automatic JSON serialization with pretty-printing
 * - Directory creation for output path
 * - Append mode support
 * - Cross-platform path handling
 * - Comprehensive error handling
 *
 * @param data - Data to write (will be JSON stringified)
 * @param outputPath - Output file path
 * @param options - Write options
 */
export async function writeOutput(
  data: unknown,
  outputPath: string,
  options: WriteOutputOptions = {}
): Promise<void> {
  if (!outputPath || typeof outputPath !== 'string') {
    throw createFileIOError(
      'Invalid output path: must be a non-empty string',
      outputPath || '<empty>',
      'write',
      { code: 'INVALID_PATH' }
    );
  }

  const resolvedPath = path.resolve(outputPath);
  const dir = path.dirname(resolvedPath);
  const encoding = options.encoding ?? 'utf-8';

  try {
    // Create directory if requested (default: true)
    if (options.createDir !== false) {
      await ensureDirectory(dir);
    }

    // Determine indentation
    let indentValue: number | undefined;
    if (options.indent !== undefined) {
      indentValue = options.indent;
    } else if (options.pretty) {
      indentValue = JSON_INDENT;
    }

    // Serialize data to JSON string
    const content =
      indentValue !== undefined
        ? JSON.stringify(data, null, indentValue)
        : JSON.stringify(data);

    // Handle append mode
    if (options.append && (await fileExists(resolvedPath))) {
      // Add newline before appending
      await fs.appendFile(resolvedPath, `\n${content}`, encoding);
    } else {
      await fs.writeFile(resolvedPath, content, encoding);
    }
  } catch (error) {
    if ((error as { type?: string }).type === 'file_io') {
      throw error;
    }

    const systemError = (error as NodeJS.ErrnoException).code;
    const isPermissionError =
      systemError === 'EACCES' || systemError === 'EPERM';

    throw createFileIOError(
      `Failed to write output to: ${resolvedPath} - ${(error as Error).message}`,
      resolvedPath,
      'write',
      {
        code: systemError || 'WRITE_FAILED',
        ...(systemError && { systemError }),
        isPermissionError,
        retryable: isPermissionError,
        exists: await fileExists(resolvedPath),
      }
    );
  }
}

/**
 * Write multiple outputs to separate files
 *
 * @param outputs - Array of { data, path } objects
 * @param options - Write options applied to all files
 */
export async function writeMultipleOutputs<T>(
  outputs: Array<{ data: T; path: string }>,
  options: WriteOutputOptions = {}
): Promise<void> {
  const errors: FileIOError[] = [];

  for (const output of outputs) {
    try {
      await writeOutput(output.data, output.path, options);
    } catch (error) {
      if ((error as { type?: string }).type === 'file_io') {
        errors.push(error as FileIOError);
      } else {
        errors.push(
          createFileIOError(
            `Unexpected error writing to ${output.path}: ${(error as Error).message}`,
            output.path,
            'write',
            { code: 'UNEXPECTED_ERROR' }
          )
        );
      }
    }
  }

  if (errors.length > 0) {
    throw createFileIOError(
      `Failed to write ${errors.length} out of ${outputs.length} files`,
      '<multiple>',
      'write',
      {
        code: 'MULTIPLE_WRITE_FAILURES',
      }
    );
  }
}

/**
 * Copy file with error handling
 */
export async function copyFile(
  sourcePath: string,
  destinationPath: string,
  options: { createDir?: boolean } = {}
): Promise<void> {
  if (!sourcePath || !destinationPath) {
    throw createFileIOError(
      'Source and destination paths must be provided',
      sourcePath || destinationPath || '<empty>',
      'read',
      { code: 'INVALID_PATHS' }
    );
  }

  try {
    // Ensure destination directory exists
    if (options.createDir !== false) {
      const destDir = path.dirname(destinationPath);
      await ensureDirectory(destDir);
    }

    await fs.copyFile(sourcePath, destinationPath);
  } catch (error) {
    const systemError = (error as NodeJS.ErrnoException).code;
    const isPermissionError =
      systemError === 'EACCES' || systemError === 'EPERM';

    throw createFileIOError(
      `Failed to copy file from ${sourcePath} to ${destinationPath}: ${(error as Error).message}`,
      sourcePath,
      'read',
      {
        code: systemError || 'COPY_FAILED',
        ...(systemError && { systemError }),
        isPermissionError,
        retryable: isPermissionError,
      }
    );
  }
}
