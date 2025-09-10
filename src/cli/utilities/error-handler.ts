/**
 * Error Handling Utilities
 *
 * Handles CLI-specific error formatting, recovery suggestions, and user-friendly
 * error reporting. Converts technical errors into actionable guidance for users.
 *
 * @module cli/utilities/error-handler
 */

import chalk from 'chalk';
import { consola } from 'consola';
import type { AnyPersuaderError } from '../../types/errors.js';
import type { ProgressReporter } from './progress-reporter.js';

/**
 * CLI error severity levels
 */
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

/**
 * CLI error with context and recovery information
 */
export interface CLIError {
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** Primary error message */
  readonly message: string;
  /** Detailed technical description */
  readonly details?: string;
  /** Suggested recovery actions */
  readonly suggestions: readonly string[];
  /** Commands that might help resolve the issue */
  readonly helpCommands: readonly string[];
  /** Whether the error is recoverable */
  readonly recoverable: boolean;
  /** Exit code to use when terminating */
  readonly exitCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 10;
}

/**
 * Error context for better error reporting
 */
export interface ErrorContext {
  /** Operation being performed when error occurred */
  readonly operation: string;
  /** File or resource being processed */
  readonly resource?: string;
  /** Additional context data */
  readonly metadata?: Record<string, unknown>;
  /** Whether verbose mode is enabled */
  readonly verbose: boolean;
}

/**
 * Convert pipeline errors to CLI-friendly format
 *
 * Transforms internal pipeline errors into user-friendly messages with
 * actionable suggestions and appropriate exit codes.
 *
 * @param error - Pipeline error to convert
 * @param context - Error context for better messaging
 * @returns CLI error with recovery suggestions
 */
export function convertPipelineError(
  error: AnyPersuaderError,
  context: ErrorContext
): CLIError {
  const suggestions: string[] = [];
  const helpCommands: string[] = [];
  const severity: ErrorSeverity = 'error';
  let exitCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 10 = EXIT_CODES.PIPELINE_ERROR;

  // Analyze error type and generate specific suggestions
  switch (error.type) {
    case 'validation':
      suggestions.push(
        'Check that your input data matches the expected schema format'
      );
      suggestions.push(
        'Review the schema file for required fields and data types'
      );
      if (error.suggestions) {
        suggestions.push(...error.suggestions);
      }
      helpCommands.push('persuader run --dry-run --verbose');
      exitCode = EXIT_CODES.VALIDATION_ERROR;
      break;

    case 'provider':
      suggestions.push(
        'Check that the LLM provider is properly installed and authenticated'
      );
      if (error.provider === 'claude-cli') {
        suggestions.push(
          'Ensure Claude CLI is installed: pip install claude-cli'
        );
        suggestions.push('Verify authentication with: claude --version');
      }
      helpCommands.push('claude --version');
      exitCode = EXIT_CODES.PROVIDER_ERROR;
      break;

    case 'session':
      suggestions.push('Try running without session ID to use a new session');
      suggestions.push('Check if the session ID exists and is valid');
      break;

    case 'configuration':
      suggestions.push('Review your command line arguments and configuration');
      suggestions.push(
        'Use --verbose flag to see detailed configuration validation'
      );
      helpCommands.push('persuader run --help');
      exitCode = EXIT_CODES.INVALID_ARGS;
      break;

    case 'file_io':
      suggestions.push('Check file paths and permissions');
      suggestions.push('Ensure input files exist and are readable');
      exitCode = EXIT_CODES.FILE_ERROR;
      break;
  }

  // Add context-specific suggestions
  if (error.retryable) {
    suggestions.push(
      'This error may be temporary - try running the command again'
    );
  }

  return {
    severity,
    message: `Pipeline execution failed: ${error.message}`,
    ...(context.verbose &&
      error.details && { details: JSON.stringify(error.details, null, 2) }),
    suggestions,
    helpCommands,
    recoverable: error.retryable,
    exitCode,
  };
}

/**
 * Convert file I/O errors to CLI-friendly format
 *
 * Handles common file operation errors like missing files, permission issues,
 * and format problems with specific guidance for resolution.
 *
 * @param error - File I/O error to convert
 * @param filePath - Path of file that caused the error
 * @param operation - File operation that failed
 * @returns CLI error with file-specific suggestions
 */
export function convertFileError(
  error: unknown,
  filePath: string,
  operation: 'read' | 'write' | 'validate'
): CLIError {
  const suggestions: string[] = [];
  const helpCommands: string[] = ['ls -la'];
  let message = `File ${operation} failed`;
  const exitCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 10 = EXIT_CODES.FILE_ERROR;

  // Handle file-io specific errors
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const fileError = error as {
      message: string;
      type?: string;
      operation?: string;
    };

    if (fileError.type === 'file_io') {
      message = `File processing failed: ${fileError.message}`;

      // Extract specific error patterns from message
      if (
        fileError.message.includes('ENOENT') ||
        fileError.message.includes('not found')
      ) {
        suggestions.push(`Check that the file path exists: ${filePath}`);
        suggestions.push('Verify the file path is correct and the file exists');
        suggestions.push(
          "Use absolute paths or ensure you're in the correct directory"
        );
        helpCommands.push(`ls -la "${filePath}"`);
      } else if (
        fileError.message.includes('EACCES') ||
        fileError.message.includes('permission')
      ) {
        suggestions.push(`Check file permissions for: ${filePath}`);
        suggestions.push(
          'Ensure you have read/write access to the file and directory'
        );
        helpCommands.push(`ls -la "${filePath}"`);
        helpCommands.push(`chmod +r "${filePath}"`);
      } else if (fileError.message.includes('EISDIR')) {
        suggestions.push(`Expected a file but found a directory: ${filePath}`);
        suggestions.push('Specify a file path, not a directory');
      } else {
        suggestions.push('Check that the file path is valid and accessible');
      }
    }
  }

  // Add operation-specific suggestions
  switch (operation) {
    case 'read':
      suggestions.push('Ensure the file exists and is readable');
      break;
    case 'write':
      suggestions.push(
        'Check that the output directory exists and is writable'
      );
      suggestions.push("The directory will be created if it doesn't exist");
      break;
    case 'validate':
      suggestions.push('Check that the file contains valid JSON or YAML');
      suggestions.push('Verify the file format matches the expected structure');
      break;
  }

  return {
    severity: 'error',
    message,
    suggestions,
    helpCommands,
    recoverable: false,
    exitCode,
  };
}

/**
 * Convert validation errors to CLI-friendly format
 *
 * Transforms schema validation errors into clear messages with examples
 * and suggestions for fixing invalid data or configuration.
 *
 * @param error - Validation error to convert
 * @param context - Context about what was being validated
 * @returns CLI error with validation guidance
 */
export function convertValidationError(
  error: unknown,
  context: {
    readonly type: 'schema' | 'config' | 'input';
    readonly resource: string;
  }
): CLIError {
  const suggestions: string[] = [];
  const helpCommands: string[] = [];
  let message = `${context.type} validation failed`;
  let exitCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 10 = EXIT_CODES.VALIDATION_ERROR;

  // Handle array of validation errors (from validateRunnerOptions)
  if (Array.isArray(error)) {
    message = `Configuration validation failed (${error.length} error${error.length === 1 ? '' : 's'})`;
    suggestions.push('Fix the following configuration issues:');
    for (const err of error) {
      suggestions.push(`• ${err}`);
    }
    suggestions.push('Use --help to see all available options');
    helpCommands.push('persuader run --help');
    exitCode = EXIT_CODES.INVALID_ARGS;
    return {
      severity: 'error',
      message,
      suggestions,
      helpCommands,
      recoverable: true,
      exitCode,
    };
  }

  // Handle specific validation contexts
  switch (context.type) {
    case 'schema':
      suggestions.push(`Check the schema file: ${context.resource}`);
      suggestions.push('Ensure it exports a valid Zod schema');
      suggestions.push('Verify the schema syntax is correct');
      helpCommands.push('persuader run --dry-run --verbose');
      break;

    case 'config':
      suggestions.push('Review your command line arguments');
      suggestions.push('Check that all required options are provided');
      suggestions.push(
        'Verify numeric values are valid (e.g., retries must be >= 0)'
      );
      helpCommands.push('persuader run --help');
      exitCode = EXIT_CODES.INVALID_ARGS;
      break;

    case 'input':
      suggestions.push(`Check the input data in: ${context.resource}`);
      suggestions.push('Ensure input data matches the schema requirements');
      suggestions.push('Verify JSON/YAML format is valid');
      break;
  }

  return {
    severity: 'error',
    message: `${message} for ${context.resource}`,
    suggestions,
    helpCommands,
    recoverable: true,
    exitCode,
  };
}

/**
 * Convert provider errors to CLI-friendly format
 *
 * Handles LLM provider-specific errors like authentication failures, rate limits,
 * and connection issues with provider-specific resolution steps.
 *
 * @param error - Provider error to convert
 * @param providerName - Name of the provider that failed
 * @returns CLI error with provider-specific suggestions
 */
export function convertProviderError(
  error: unknown,
  providerName: string
): CLIError {
  const suggestions: string[] = [];
  const helpCommands: string[] = [];
  let message = `Provider ${providerName} error`;
  const severity: ErrorSeverity = 'error';
  const exitCode: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 10 = EXIT_CODES.PROVIDER_ERROR;

  // Handle provider health check failures
  if (typeof error === 'object' && error !== null) {
    const healthError = error as {
      healthy?: boolean;
      error?: string;
      details?: unknown;
    };

    if (healthError.healthy === false) {
      message = 'Provider health check failed';
      if (healthError.error) {
        message += `: ${healthError.error}`;
      }
    }
  }

  // Add provider-specific guidance
  switch (providerName) {
    case 'claude-cli':
      suggestions.push('Ensure Claude CLI is installed and authenticated');
      suggestions.push('Install with: pip install claude-cli');
      suggestions.push('Authenticate and test with: claude --version');
      suggestions.push('Check your internet connection');
      helpCommands.push('pip install claude-cli');
      helpCommands.push('claude --version');
      helpCommands.push('claude --help');
      break;

    default:
      suggestions.push(`Check ${providerName} installation and configuration`);
      suggestions.push('Verify authentication credentials are valid');
      suggestions.push('Check internet connection and API endpoints');
      break;
  }

  // Generic provider troubleshooting
  suggestions.push('Try running with --verbose for more details');
  suggestions.push('Check the provider documentation for setup instructions');

  return {
    severity,
    message,
    suggestions,
    helpCommands,
    recoverable: false,
    exitCode,
  };
}

/**
 * Handle and report CLI errors with appropriate formatting
 *
 * Central error handling function that formats errors, reports them to users,
 * stops progress indicators, and exits with appropriate codes.
 *
 * @param error - Error to handle and report
 * @param progressReporter - Optional progress reporter to stop
 * @param context - Error context for better reporting
 */
export function handleCLIError(
  error: unknown,
  progressReporter?: ProgressReporter,
  context?: ErrorContext
): never {
  // Stop any active progress indicators
  if (progressReporter) {
    try {
      progressReporter.stop();
    } catch {
      // Ignore errors when stopping progress reporter
    }
  }

  // Convert error to CLI format
  let cliError: CLIError;

  if (typeof error === 'object' && error !== null && 'type' in error) {
    // Handle known Persuader errors
    const persuaderError = error as AnyPersuaderError;
    cliError = convertPipelineError(
      persuaderError,
      context || {
        operation: 'unknown',
        verbose: false,
      }
    );
  } else {
    // Handle unexpected errors
    cliError = {
      severity: 'fatal',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
      ...(context?.verbose && {
        details:
          error instanceof Error ? error.stack : JSON.stringify(error, null, 2),
      }),
      suggestions: [
        'This is an unexpected error',
        'Try running with --verbose for more details',
        'Check your input files and configuration',
        'Report this issue if the problem persists',
      ],
      helpCommands: ['persuader run --help'],
      recoverable: false,
      exitCode: EXIT_CODES.INTERNAL_ERROR,
    };
  }

  // Report the error
  reportError(cliError, context?.verbose || false);

  // Exit with appropriate code
  process.exit(cliError.exitCode);
}

/**
 * Format error for console display
 *
 * Creates formatted error messages with colors, icons, and structured layout
 * for optimal readability in terminal environments.
 *
 * @param cliError - CLI error to format
 * @param verbose - Whether to include detailed information
 * @returns Formatted error message for display
 */
export function formatErrorForDisplay(
  cliError: CLIError,
  verbose: boolean = false
): string {
  const lines: string[] = [];

  // Error header with icon and severity
  const icon = cliError.severity === 'fatal' ? '💥' : '❌';
  lines.push(`\n${icon} ${cliError.message}`);

  // Add details if verbose and available
  if (verbose && cliError.details) {
    lines.push('');
    lines.push('Details:');
    lines.push(cliError.details);
  }

  // Add suggestions
  if (cliError.suggestions.length > 0) {
    lines.push('');
    lines.push('Suggestions:');
    for (const suggestion of cliError.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
  }

  // Add help commands
  if (cliError.helpCommands.length > 0) {
    lines.push('');
    lines.push('Helpful commands:');
    for (const command of cliError.helpCommands) {
      lines.push(`  $ ${command}`);
    }
  }

  return lines.join('\n');
}

/**
 * Report error to console with formatted output
 *
 * Displays CLI errors with appropriate colors and formatting using consola.
 * Handles different severity levels and includes recovery suggestions.
 *
 * @param cliError - CLI error to report
 * @param verbose - Whether to include verbose details
 */
function reportError(cliError: CLIError, verbose: boolean): void {
  // Format and display the error
  const formattedError = formatErrorForDisplay(cliError, verbose);

  // Apply colors based on severity
  switch (cliError.severity) {
    case 'fatal':
      consola.fatal(chalk.red(formattedError));
      break;
    case 'error':
      consola.error(chalk.red(formattedError));
      break;
    case 'warning':
      consola.warn(chalk.yellow(formattedError));
      break;
    case 'info':
      consola.info(chalk.blue(formattedError));
      break;
  }

  // Add recovery information
  if (cliError.recoverable) {
    consola.info(
      chalk.blue('\nℹ️ This error might be fixable. See suggestions above.')
    );
  }
}

/**
 * Generate error recovery suggestions
 *
 * Analyzes errors and generates specific, actionable suggestions for resolving
 * issues including commands to run, files to check, and configuration changes.
 *
 * @param error - Error to analyze
 * @param context - Error context
 * @returns Array of recovery suggestions
 */
export function generateRecoverySuggestions(
  error: unknown,
  context: ErrorContext
): readonly string[] {
  const suggestions: string[] = [];

  // Basic suggestions based on context
  if (context.resource) {
    suggestions.push(`Check the resource: ${context.resource}`);
  }

  // Operation-specific suggestions
  switch (context.operation) {
    case 'schema-loading':
      suggestions.push(
        'Verify the schema file exists and exports a valid Zod schema'
      );
      suggestions.push("Check the file path and ensure it's accessible");
      break;

    case 'input-processing':
      suggestions.push('Verify input files exist and contain valid JSON/YAML');
      suggestions.push('Check file paths and glob patterns');
      break;

    case 'provider-init':
      suggestions.push('Ensure the LLM provider is properly installed');
      suggestions.push('Check authentication and network connectivity');
      break;

    case 'pipeline-execution':
      suggestions.push('Review the input data and schema compatibility');
      suggestions.push('Try with simpler input data first');
      suggestions.push('Consider adjusting retry settings');
      break;

    default:
      suggestions.push('Review the command arguments and try again');
      break;
  }

  // Error-specific suggestions
  if (error instanceof Error) {
    if (error.message.includes('ENOENT')) {
      suggestions.push('File or directory not found - check the path');
    } else if (error.message.includes('EACCES')) {
      suggestions.push('Permission denied - check file permissions');
    } else if (
      error.message.includes('network') ||
      error.message.includes('connection')
    ) {
      suggestions.push('Network error - check internet connection');
      suggestions.push('Try again in a few moments');
    }
  }

  // Always suggest verbose mode for debugging
  if (!context.verbose) {
    suggestions.push('Use --verbose flag for detailed debugging information');
  }

  return suggestions;
}

/**
 * Check if error is recoverable and suggest retry
 *
 * Analyzes errors to determine if they might be resolved by retrying the operation
 * with different parameters or after addressing the underlying issue.
 *
 * @param error - Error to analyze
 * @returns Whether error is likely recoverable and retry suggestions
 */
export function analyzeErrorRecoverability(error: unknown): {
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly suggestions: readonly string[];
  readonly estimatedFixTime:
    | 'immediate'
    | 'minutes'
    | 'configuration'
    | 'unknown';
} {
  const suggestions: string[] = [];
  let recoverable = false;
  let retryable = false;
  let estimatedFixTime: 'immediate' | 'minutes' | 'configuration' | 'unknown' =
    'unknown';

  // Check if it's a known Persuader error
  if (typeof error === 'object' && error !== null && 'type' in error) {
    const persuaderError = error as AnyPersuaderError;
    recoverable = persuaderError.retryable;
    retryable = persuaderError.retryable;

    switch (persuaderError.type) {
      case 'provider':
        if (persuaderError.message.includes('rate limit')) {
          retryable = true;
          estimatedFixTime = 'minutes';
          suggestions.push('Wait a few minutes for rate limits to reset');
        } else if (
          persuaderError.message.includes('network') ||
          persuaderError.message.includes('connection')
        ) {
          retryable = true;
          estimatedFixTime = 'immediate';
          suggestions.push('Check network connection and try again');
        } else {
          estimatedFixTime = 'configuration';
          suggestions.push('Fix provider installation/authentication issues');
        }
        break;

      case 'validation':
        recoverable = true;
        estimatedFixTime = 'configuration';
        suggestions.push('Fix the validation errors and try again');
        break;

      case 'file_io':
        recoverable = true;
        estimatedFixTime = 'configuration';
        suggestions.push('Fix file path or permission issues');
        break;

      case 'configuration':
        recoverable = true;
        estimatedFixTime = 'immediate';
        suggestions.push('Fix the configuration errors and retry');
        break;

      case 'session':
        retryable = true;
        estimatedFixTime = 'immediate';
        suggestions.push('Try without session ID to create a new session');
        break;
    }
  } else if (error instanceof Error) {
    // Analyze standard JavaScript errors
    if (
      error.message.includes('ENOTFOUND') ||
      error.message.includes('network')
    ) {
      retryable = true;
      estimatedFixTime = 'minutes';
      suggestions.push('Network connectivity issue - try again later');
    } else if (error.message.includes('timeout')) {
      retryable = true;
      estimatedFixTime = 'immediate';
      suggestions.push('Request timed out - try again');
    } else if (error.message.includes('ENOENT')) {
      recoverable = true;
      estimatedFixTime = 'configuration';
      suggestions.push('File not found - check the file path');
    } else if (error.message.includes('EACCES')) {
      recoverable = true;
      estimatedFixTime = 'configuration';
      suggestions.push('Permission denied - check file permissions');
    }
  }

  return {
    recoverable,
    retryable,
    suggestions,
    estimatedFixTime,
  };
}

/**
 * Common exit codes for CLI errors
 */
export const EXIT_CODES = {
  /** Successful execution */
  SUCCESS: 0,
  /** General error */
  GENERAL_ERROR: 1,
  /** Invalid arguments or configuration */
  INVALID_ARGS: 2,
  /** File not found or access denied */
  FILE_ERROR: 3,
  /** Schema validation failed */
  VALIDATION_ERROR: 4,
  /** Provider authentication or connection failed */
  PROVIDER_ERROR: 5,
  /** Pipeline execution failed */
  PIPELINE_ERROR: 6,
  /** Unexpected internal error */
  INTERNAL_ERROR: 10,
} as const;

/**
 * Standard error message templates
 */
export const ERROR_TEMPLATES = {
  FILE_NOT_FOUND:
    'File not found: {path}. Please check the file path and try again.',
  INVALID_SCHEMA:
    'Invalid schema file: {path}. Ensure it exports a valid Zod schema.',
  PROVIDER_UNAVAILABLE:
    'LLM provider "{provider}" is not available. Check installation and authentication.',
  VALIDATION_FAILED:
    'Validation failed for {resource}. See details above for specific issues.',
  PERMISSION_DENIED:
    'Permission denied accessing {resource}. Check file permissions.',
  NETWORK_ERROR:
    'Network error connecting to provider. Check your connection and try again.',
} as const;
