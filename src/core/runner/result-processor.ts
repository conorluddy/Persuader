/**
 * Result Processor for Runner Pipeline
 *
 * Handles the final processing, formatting, and metadata collection for
 * pipeline execution results. Transforms execution engine results into
 * the standardized Result interface with comprehensive metadata tracking.
 */

import type {
  ExecutionMetadata,
  ProviderAdapter,
  ProviderError,
  Result,
  ValidationError,
} from '../../types/index.js';
import { info, error as logError } from '../../utils/logger.js';
import type { ExecutionResult } from './execution-engine.js';

/**
 * Processes execution engine results into final pipeline result
 *
 * Transforms the internal execution result format into the public Result
 * interface, adding comprehensive metadata and ensuring consistent error
 * handling and logging.
 *
 * @template T The expected output type
 * @param executionResult Result from the execution engine
 * @param sessionId Session ID used during execution
 * @param startTime Pipeline start timestamp
 * @param provider Provider adapter used for execution
 * @returns Formatted pipeline result with metadata
 */
export function processResult<T>(
  executionResult: ExecutionResult<T>,
  sessionId: string | undefined,
  startTime: number,
  provider: ProviderAdapter
): Result<T> {
  const endTime = Date.now();
  const executionMetadata = createExecutionMetadata(
    startTime,
    endTime,
    provider
  );

  if (executionResult.success && executionResult.value !== undefined) {
    return processSuccessResult(executionResult, sessionId, executionMetadata);
  } else {
    return processErrorResult(executionResult, sessionId, executionMetadata);
  }
}

/**
 * Processes successful execution results
 *
 * @template T The expected output type
 * @param executionResult Successful execution result
 * @param sessionId Session ID used during execution
 * @param metadata Execution metadata
 * @returns Success result with metadata
 */
function processSuccessResult<T>(
  executionResult: ExecutionResult<T>,
  sessionId: string | undefined,
  metadata: ExecutionMetadata
): Result<T> {
  info('Pipeline execution completed successfully', {
    attempts: executionResult.attempts,
    executionTimeMs: metadata.executionTimeMs,
    provider: metadata.provider,
    model: metadata.model,
    sessionId,
  });

  const result: Result<T> = {
    ok: true,
    value: executionResult.value as T,
    attempts: executionResult.attempts,
    metadata,
    ...(sessionId && { sessionId }),
  };

  return result;
}

/**
 * Processes failed execution results
 *
 * @template T The expected output type
 * @param executionResult Failed execution result
 * @param sessionId Session ID used during execution
 * @param metadata Execution metadata
 * @returns Error result with metadata
 */
function processErrorResult<T>(
  executionResult: ExecutionResult<T>,
  sessionId: string | undefined,
  metadata: ExecutionMetadata
): Result<T> {
  // Ensure we have an error when the result is not successful
  const error: ValidationError | ProviderError =
    executionResult.error || createFallbackError();

  logError('Pipeline execution failed after all retry attempts', {
    attempts: executionResult.attempts,
    executionTimeMs: metadata.executionTimeMs,
    errorType: error.type,
    errorCode: error.code,
    errorMessage: error.message,
  });

  const result: Result<T> = {
    ok: false,
    error,
    attempts: executionResult.attempts,
    metadata,
    ...(sessionId && { sessionId }),
  };

  return result;
}

/**
 * Creates execution metadata for result tracking
 *
 * @param startTime Pipeline start timestamp
 * @param endTime Pipeline end timestamp
 * @param provider Provider adapter used
 * @returns Execution metadata object
 */
function createExecutionMetadata(
  startTime: number,
  endTime: number,
  provider: ProviderAdapter
): ExecutionMetadata {
  return {
    executionTimeMs: endTime - startTime,
    startedAt: new Date(startTime),
    completedAt: new Date(endTime),
    provider: provider.name,
  };
}

/**
 * Creates a fallback error for cases where execution failed but no error was provided
 *
 * @returns Fallback validation error
 */
function createFallbackError(): ValidationError {
  return {
    type: 'validation' as const,
    code: 'unknown_error',
    message: 'Unknown error occurred during processing',
    timestamp: new Date(),
    retryable: false,
    issues: [],
    rawValue: undefined,
    suggestions: ['Please try again or contact support'],
    failureMode: 'context_confusion',
    retryStrategy: 'session_reset',
    structuredFeedback: {
      problemSummary: 'Unknown error occurred during processing',
      specificIssues: [],
      correctionInstructions: ['Please try again or contact support'],
    },
  };
}

/**
 * Get execution statistics from a pipeline result
 *
 * Extracts key metrics and statistics from a pipeline result for
 * monitoring, debugging, and performance analysis.
 *
 * @template T The result value type
 * @param result Result from pipeline execution
 * @returns Execution statistics for monitoring and debugging
 */
export function getExecutionStats<T>(result: Result<T>): {
  successful: boolean;
  attempts: number;
  executionTime: number;
  provider: string;
  model?: string;
  errorType?: string;
  hasSession: boolean;
} {
  const stats = {
    successful: result.ok,
    attempts: result.attempts,
    executionTime: result.metadata.executionTimeMs,
    provider: result.metadata.provider,
    hasSession: Boolean(result.sessionId),
  };

  return {
    ...stats,
    ...(result.metadata.model && { model: result.metadata.model }),
    ...(!result.ok && result.error && { errorType: result.error.type }),
  };
}

/**
 * Formats result metadata for logging and debugging
 *
 * @template T The result value type
 * @param result Pipeline result
 * @returns Formatted metadata for logging
 */
export function formatResultMetadata<T>(result: Result<T>): {
  duration: string;
  attempts: number;
  provider: string;
  status: 'success' | 'error';
  errorSummary?: string;
} {
  const duration = `${result.metadata.executionTimeMs}ms`;

  const formatted = {
    duration,
    attempts: result.attempts,
    provider: result.metadata.provider,
    status: result.ok ? ('success' as const) : ('error' as const),
  };

  if (!result.ok && result.error) {
    return {
      ...formatted,
      errorSummary: `${result.error.type}:${result.error.code} - ${result.error.message}`,
    };
  }

  return formatted;
}
