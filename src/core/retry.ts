/**
 * Retry Logic Utilities
 *
 * Implements intelligent retry mechanisms with exponential backoff,
 * error accumulation, and feedback-driven retry strategies.
 */

import {
  BASE_RETRY_DELAY_MS,
  isRetryableHttpStatus,
  MAX_RETRY_DELAY_MS,
  RETRY_DELAY_MULTIPLIER,
} from '../shared/constants/index.js';
import type { ProviderError, ValidationError } from '../types/errors.js';

/**
 * Configuration for retry operations
 */
export interface RetryConfig {
  /** Maximum number of attempts (including initial attempt) */
  readonly maxAttempts: number;

  /** Base delay between retries in milliseconds */
  readonly baseDelay?: number;

  /** Multiplier for exponential backoff */
  readonly delayMultiplier?: number;

  /** Maximum delay between retries in milliseconds */
  readonly maxDelay?: number;

  /** Function to determine if an error is retryable */
  readonly isRetryable?: (error: unknown) => boolean;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  readonly success: boolean;

  /** The successful value (only present if success is true) */
  readonly value?: T;

  /** The final error if operation failed */
  readonly error?: ValidationError | ProviderError;

  /** Number of attempts made */
  readonly attempts: number;

  /** All errors encountered during retry attempts */
  readonly allErrors: Array<ValidationError | ProviderError>;

  /** Total time spent retrying in milliseconds */
  readonly totalRetryTime: number;
}

/**
 * Options for retry with feedback
 */
export interface RetryWithFeedbackOptions {
  /** Maximum number of attempts */
  readonly maxAttempts: number;

  /** Base delay configuration */
  readonly baseDelay?: number;

  /** Operation to retry - receives attempt number and previous error */
  readonly operation: (
    attemptNumber: number,
    previousError?: ValidationError | ProviderError | undefined
  ) => Promise<
    | {
        success: true;
        value: unknown;
        error?: never;
      }
    | {
        success: false;
        value?: never;
        error: ValidationError | ProviderError;
      }
  >;
}

/**
 * Execute an operation with intelligent retry and feedback
 *
 * @template T - The expected return type of the operation
 * @param options - Retry configuration and operation
 * @returns Promise resolving to retry result
 */
export async function retryWithFeedback<T>(
  options: RetryWithFeedbackOptions
): Promise<RetryResult<T>> {
  const { maxAttempts, baseDelay = BASE_RETRY_DELAY_MS, operation } = options;
  const startTime = Date.now();
  const allErrors: Array<ValidationError | ProviderError> = [];

  let lastError: ValidationError | ProviderError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt, lastError);

      if (result.success) {
        return {
          success: true,
          value: result.value as T,
          attempts: attempt,
          allErrors,
          totalRetryTime: Date.now() - startTime,
        };
      }

      // Operation failed, record error
      if (result.error) {
        lastError = result.error;
        allErrors.push(result.error);

        // Check if error is retryable
        if (!isErrorRetryable(result.error) || attempt === maxAttempts) {
          return {
            success: false,
            error: result.error,
            attempts: attempt,
            allErrors,
            totalRetryTime: Date.now() - startTime,
          };
        }

        // Wait before next retry (except on last attempt)
        if (attempt < maxAttempts) {
          const delay = calculateRetryDelay(attempt - 1, baseDelay);
          await sleep(delay);
        }
      }
    } catch (error) {
      // Unexpected error occurred
      const wrappedError: ProviderError = {
        type: 'provider',
        code: 'unexpected_error',
        message: `Unexpected error during retry attempt ${attempt}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: 'unknown',
        timestamp: new Date(),
        retryable: false,
        details: { originalError: error },
      };

      allErrors.push(wrappedError);

      return {
        success: false,
        error: wrappedError,
        attempts: attempt,
        allErrors,
        totalRetryTime: Date.now() - startTime,
      };
    }
  }

  // Should never reach here, but just in case
  const finalError: ProviderError = {
    type: 'provider',
    code: 'max_attempts_exceeded',
    message: `Maximum retry attempts (${maxAttempts}) exceeded`,
    provider: 'unknown',
    timestamp: new Date(),
    retryable: false,
  };

  return {
    success: false,
    error: finalError,
    attempts: maxAttempts,
    allErrors,
    totalRetryTime: Date.now() - startTime,
  };
}

/**
 * Execute an operation with simple retry logic
 *
 * @template T - The expected return type of the operation
 * @param operation - Function to retry
 * @param config - Retry configuration
 * @returns Promise resolving to retry result
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<RetryResult<T>> {
  const {
    maxAttempts,
    baseDelay = BASE_RETRY_DELAY_MS,
    delayMultiplier = RETRY_DELAY_MULTIPLIER,
    maxDelay = MAX_RETRY_DELAY_MS,
    isRetryable = isErrorRetryable,
  } = config;

  const startTime = Date.now();
  const allErrors: Array<ValidationError | ProviderError> = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        value: result,
        attempts: attempt,
        allErrors,
        totalRetryTime: Date.now() - startTime,
      };
    } catch (error) {
      const wrappedError = wrapError(error, attempt);
      allErrors.push(wrappedError);

      // Check if we should retry
      if (!isRetryable(wrappedError) || attempt === maxAttempts) {
        return {
          success: false,
          error: wrappedError,
          attempts: attempt,
          allErrors,
          totalRetryTime: Date.now() - startTime,
        };
      }

      // Calculate delay for next retry
      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelay * delayMultiplier ** (attempt - 1),
          maxDelay
        );
        await sleep(delay);
      }
    }
  }

  // Fallback (should not reach here)
  const finalError = wrapError(new Error('Max attempts exceeded'), maxAttempts);
  return {
    success: false,
    error: finalError,
    attempts: maxAttempts,
    allErrors,
    totalRetryTime: Date.now() - startTime,
  };
}

/**
 * Calculate retry delay with exponential backoff
 */
function calculateRetryDelay(
  attemptNumber: number,
  baseDelay: number = BASE_RETRY_DELAY_MS
): number {
  const delay = baseDelay * RETRY_DELAY_MULTIPLIER ** attemptNumber;
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * Determine if an error is retryable
 */
function isErrorRetryable(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    // Check if error has retryable property
    if ('retryable' in error) {
      return Boolean(error.retryable);
    }

    // Check error type
    if ('type' in error) {
      switch (error.type) {
        case 'validation':
          return true; // Validation errors are always retryable
        case 'provider':
          // Provider errors depend on specific conditions
          if ('statusCode' in error) {
            const statusCode = error.statusCode as number;
            // Retry on server errors (5xx), timeouts, or rate limits
            return isRetryableHttpStatus(statusCode);
          }
          return true; // Default to retryable for provider errors
        case 'session':
          return false; // Session errors are typically not retryable
        case 'configuration':
          return false; // Configuration errors are not retryable
        default:
          return false;
      }
    }
  }

  return false;
}

/**
 * Wrap unknown errors into structured format
 */
function wrapError(
  error: unknown,
  attempt: number
): ValidationError | ProviderError {
  if (error && typeof error === 'object' && 'type' in error) {
    // Already a structured error
    return error as ValidationError | ProviderError;
  }

  // Wrap as provider error
  const message = error instanceof Error ? error.message : String(error);
  return {
    type: 'provider',
    code: 'wrapped_error',
    message: `Error on attempt ${attempt}: ${message}`,
    provider: 'unknown',
    timestamp: new Date(),
    retryable: true,
    details: { originalError: error },
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format retry result for error reporting
 */
export function formatRetryError(result: RetryResult<unknown>): string {
  if (result.success) {
    return `Operation succeeded after ${result.attempts} attempt(s)`;
  }

  const errorSummary = result.allErrors
    .map((error, index) => `  Attempt ${index + 1}: ${error.message}`)
    .join('\n');

  return `Operation failed after ${result.attempts} attempt(s) (${result.totalRetryTime}ms total):\n${errorSummary}`;
}

/**
 * Get retry statistics from result
 */
export function getRetryStats(result: RetryResult<unknown>): {
  totalAttempts: number;
  totalTime: number;
  averageTimePerAttempt: number;
  errorTypes: Record<string, number>;
} {
  const errorTypes: Record<string, number> = {};

  result.allErrors.forEach(error => {
    errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
  });

  return {
    totalAttempts: result.attempts,
    totalTime: result.totalRetryTime,
    averageTimePerAttempt: result.totalRetryTime / result.attempts,
    errorTypes,
  };
}
