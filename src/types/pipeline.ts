/**
 * Core Pipeline Types
 *
 * Type definitions for the main Persuader pipeline operations,
 * including options, results, execution metadata, and token usage tracking.
 */

import type { z } from 'zod';
import type { LogLevel } from '../utils/logger.js';
import type { ProviderError, ValidationError } from './errors.js';

/**
 * Main options interface for running the Persuader pipeline
 *
 * @template T The expected output type after schema validation
 */
export interface Options<T = unknown> {
  /** Zod schema that defines the expected output structure */
  readonly schema: z.ZodSchema<T>;

  /** Input data to be processed by the LLM */
  readonly input: unknown;

  /** Global context to maintain across the session */
  readonly context?: string;

  /** Lens/perspective to apply to the processing */
  readonly lens?: string;

  /** Session ID for context persistence and token reduction */
  readonly sessionId?: string;

  /** Maximum number of retry attempts on validation failures */
  readonly retries?: number;

  /** LLM model identifier to use */
  readonly model?: string;

  /** Output file path for results */
  readonly output?: string;

  /** Additional provider-specific options */
  readonly providerOptions?: Record<string, unknown>;

  /** Logging level for framework operations */
  readonly logLevel?: LogLevel;

  /**
   * Optional concrete example of valid output to guide LLM formatting
   *
   * Providing a concrete example significantly improves LLM output reliability by:
   * - Demonstrating exact enum value formatting (e.g., "good" vs "Good")
   * - Showing proper nested object structures
   * - Illustrating array length requirements
   * - Providing realistic content that meets character constraints
   *
   * The example will be validated against the schema before use. If validation
   * fails, an error will be thrown immediately before any LLM calls.
   *
   * If not provided, Persuader will automatically generate a basic example
   * from the schema structure.
   *
   * @example
   * ```typescript
   * const result = await persuade({
   *   schema: z.object({
   *     rating: z.enum(['good', 'bad']),
   *     score: z.number().min(1).max(10)
   *   }),
   *   input: "Rate this product...",
   *   exampleOutput: {
   *     rating: "good",  // Shows exact enum formatting
   *     score: 8         // Shows realistic numeric value
   *   }
   * });
   * ```
   */
  readonly exampleOutput?: T;
}

/**
 * Result of a Persuader pipeline execution
 *
 * @template T The validated output type
 */
export interface Result<T = unknown> {
  /** Whether the operation succeeded */
  readonly ok: boolean;

  /** The validated output value (only present if ok is true) */
  readonly value?: T;

  /** Error information if operation failed */
  readonly error?: ValidationError | ProviderError;

  /** Number of attempts made during execution */
  readonly attempts: number;

  /** Session ID used during execution */
  readonly sessionId?: string;

  /** Execution metadata */
  readonly metadata: ExecutionMetadata;
}

/**
 * Execution metadata for tracking pipeline performance and debugging
 */
export interface ExecutionMetadata {
  /** Total execution time in milliseconds */
  readonly executionTimeMs: number;

  /** Token usage statistics if available */
  readonly tokenUsage?: TokenUsage;

  /** Timestamp when execution started */
  readonly startedAt: Date;

  /** Timestamp when execution completed */
  readonly completedAt: Date;

  /** Provider used for execution */
  readonly provider: string;

  /** Model used for execution */
  readonly model?: string;
}

/**
 * Token usage statistics for cost and performance tracking
 */
export interface TokenUsage {
  /** Number of input tokens consumed */
  readonly inputTokens: number;

  /** Number of output tokens generated */
  readonly outputTokens: number;

  /** Total tokens used */
  readonly totalTokens: number;

  /** Estimated cost in USD if available */
  readonly estimatedCost?: number;
}

/**
 * Options for initializing a schema-free session
 *
 * Enables flexible session creation without schema validation requirements,
 * supporting context setup, exploratory interactions, and multi-step workflows.
 */
export interface InitSessionOptions {
  /** Global context to maintain across the session */
  readonly context: string;

  /** Optional initial prompt to send during session creation */
  readonly initialPrompt?: string;

  /** Existing session ID to reuse, or omit to create new session */
  readonly sessionId?: string;

  /** Provider adapter to use for session creation */
  readonly provider?: import('./provider.js').ProviderAdapter;

  /** LLM model identifier to use */
  readonly model?: string;

  /** Additional provider-specific options */
  readonly providerOptions?: Record<string, unknown>;
}

/**
 * Result of schema-free session initialization
 *
 * Contains session identifier for future operations and optional response
 * if initial prompt was provided during session creation.
 */
export interface InitSessionResult {
  /** Session ID for continuing conversations */
  readonly sessionId: string;

  /** Raw response if initialPrompt was provided */
  readonly response?: string;

  /** Execution metadata for performance tracking */
  readonly metadata: Pick<ExecutionMetadata, 'executionTimeMs' | 'startedAt' | 'completedAt' | 'provider' | 'model'>;
}
