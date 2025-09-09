/**
 * Error and Validation Types
 *
 * Type definitions for all error conditions that can occur in the Persuader framework,
 * including validation errors, provider errors, session errors, and configuration errors.
 */

import type { z } from 'zod';

/**
 * Base error interface for Persuader errors
 */
export interface PersuaderError {
  /** Error type identifier */
  readonly type: string;

  /** Human-readable error message */
  readonly message: string;

  /** Error code for programmatic handling */
  readonly code: string;

  /** Additional error context */
  readonly details?: Record<string, unknown>;

  /** Timestamp when error occurred */
  readonly timestamp: Date;

  /** Whether this error is retryable */
  readonly retryable: boolean;
}

/**
 * Classification of error failure modes for intelligent retry
 */
export type ErrorFailureMode =
  | 'json_parse_failure' // Raw output is not valid JSON
  | 'schema_validation' // Valid JSON but doesn't match schema
  | 'incomplete_response' // Response was truncated or incomplete
  | 'wrong_format' // Expected JSON but got plain text
  | 'hallucinated_structure' // JSON with completely wrong structure
  | 'field_type_mismatch' // Correct structure but wrong data types
  | 'missing_required_fields' // Missing required schema fields
  | 'extra_unknown_fields' // Has fields not in schema
  | 'constraint_violation' // Values violate schema constraints (min, max, enum, etc.)
  | 'nested_validation' // Errors in nested objects/arrays
  | 'provider_refusal' // LLM refused to generate the requested format
  | 'context_confusion'; // LLM misunderstood the task context;

/**
 * Retry strategy classification based on error analysis
 */
export type RetryStrategy =
  | 'demand_json_format' // Non-JSON → Explicitly demand JSON structure
  | 'provide_field_guidance' // Schema errors → Give specific field requirements
  | 'fix_structure' // Wrong structure → Show expected structure
  | 'clarify_constraints' // Constraint violations → Explain specific limits
  | 'simplify_request' // Too complex → Break down into simpler parts
  | 'add_examples' // Confusion → Provide concrete examples
  | 'reinforce_context' // Context issues → Strengthen context priming
  | 'progressive_refinement' // Multiple issues → Step-by-step improvement
  | 'session_reset'; // Persistent failures → Start fresh session;

/**
 * Enhanced validation errors with detailed failure analysis
 */
export interface ValidationError extends PersuaderError {
  readonly type: 'validation';

  /** Zod validation issues */
  readonly issues: z.ZodIssue[];

  /** Raw value that failed validation */
  readonly rawValue: unknown;

  /** Schema that was used for validation */
  readonly schemaDescription?: string;

  /** Suggestions for fixing the validation error */
  readonly suggestions?: readonly string[];

  /** ENHANCED: Specific failure mode classification */
  readonly failureMode: ErrorFailureMode;

  /** ENHANCED: Recommended retry strategy */
  readonly retryStrategy: RetryStrategy;

  /** ENHANCED: Field-specific analysis for targeted feedback */
  readonly fieldAnalysis?: {
    readonly missingRequired: readonly string[];
    readonly extraFields: readonly string[];
    readonly typeMismatches: readonly {
      readonly field: string;
      readonly expected: string;
      readonly received: string;
    }[];
    readonly constraintViolations: readonly {
      readonly field: string;
      readonly constraint: string;
      readonly expected: string;
      readonly received: unknown;
    }[];
  };

  /** ENHANCED: Structured feedback for LLM consumption */
  readonly structuredFeedback: {
    readonly problemSummary: string;
    readonly specificIssues: readonly string[];
    readonly correctionInstructions: readonly string[];
    readonly exampleCorrection?: string;
  };
}

/**
 * Provider-related errors
 */
export interface ProviderError extends PersuaderError {
  readonly type: 'provider';

  /** Provider that generated the error */
  readonly provider: string;

  /** HTTP status code if applicable */
  readonly statusCode?: number;

  /** Provider-specific error code */
  readonly providerCode?: string;

  /** Rate limit information if applicable */
  readonly rateLimitInfo?: RateLimitInfo;
}

/**
 * Session management errors
 */
export interface SessionError extends PersuaderError {
  readonly type: 'session';

  /** Session ID that caused the error */
  readonly sessionId?: string;

  /** Session operation that failed */
  readonly operation: 'create' | 'get' | 'update' | 'delete' | 'list';
}

/**
 * Configuration errors
 */
export interface ConfigurationError extends PersuaderError {
  readonly type: 'configuration';

  /** Configuration field that caused the error */
  readonly field?: string;

  /** Expected value or format */
  readonly expected?: string;

  /** Actual value received */
  readonly received?: unknown;
}

/**
 * File I/O errors
 */
export interface FileIOError extends PersuaderError {
  readonly type: 'file_io';

  /** File path that caused the error */
  readonly filePath: string;

  /** File system operation that failed */
  readonly operation: 'read' | 'write' | 'stat' | 'mkdir' | 'glob';

  /** System error code if applicable */
  readonly systemError?: string;

  /** Whether this is a permissions issue */
  readonly isPermissionError?: boolean;

  /** Whether the file or directory exists */
  readonly exists?: boolean;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Requests remaining in current window */
  readonly remaining: number;

  /** Total requests allowed in window */
  readonly limit: number;

  /** Time until rate limit resets (seconds) */
  readonly resetIn: number;

  /** Rate limit window duration (seconds) */
  readonly windowSize: number;
}

/**
 * Union of all possible error types
 */
export type AnyPersuaderError =
  | ValidationError
  | ProviderError
  | SessionError
  | ConfigurationError
  | FileIOError;

/**
 * Type guard for validation errors
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'validation'
  );
}

/**
 * Type guard for provider errors
 */
export function isProviderError(error: unknown): error is ProviderError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'provider'
  );
}

/**
 * Type guard for session errors
 */
export function isSessionError(error: unknown): error is SessionError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'session'
  );
}

/**
 * Type guard for configuration errors
 */
export function isConfigurationError(
  error: unknown
): error is ConfigurationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'configuration'
  );
}

/**
 * Type guard for file I/O errors
 */
export function isFileIOError(error: unknown): error is FileIOError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'file_io'
  );
}
