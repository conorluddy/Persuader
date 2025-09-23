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

  /**
   * Optional success feedback message sent to LLM after successful validation
   *
   * Provides positive reinforcement to help the LLM understand what constitutes
   * successful output, especially beneficial in session-based workflows where
   * multiple requests can build on successful patterns.
   *
   * Success feedback is sent when:
   * - Schema validation passes (on any successful attempt)
   * - A sessionId is provided (session-based workflow)
   * - The successMessage parameter is not empty
   *
   * The feedback becomes part of the session context for subsequent requests,
   * helping maintain consistency and quality across the conversation.
   *
   * @example
   * ```typescript
   * // Basic usage with positive reinforcement
   * const result = await persuade({
   *   schema: analysisSchema,
   *   input: "Analyze this data...",
   *   sessionId: "analysis-session",
   *   successMessage: "✅ Perfect! Your analysis format and depth are exactly what we need."
   * });
   *
   * // Session-based workflow with pattern reinforcement
   * const result1 = await persuade({
   *   schema: reportSchema,
   *   input: "Generate report for Q1...",
   *   sessionId: "reporting-session",
   *   successMessage: "Excellent! Continue using this detailed reporting structure."
   * });
   *
   * // Subsequent requests benefit from success reinforcement
   * const result2 = await persuade({
   *   schema: reportSchema,
   *   input: "Generate report for Q2...",
   *   sessionId: "reporting-session", // Same session
   *   successMessage: "Great work! Maintain this level of detail and formatting."
   * });
   * ```
   */
  readonly successMessage?: string;

  /**
   * Optional enhancement rounds configuration
   * 
   * After initial successful validation, attempt to improve the result through
   * additional LLM calls with encouraging prompts. This feature bridges the gap
   * between "acceptable" and "excellent" results while maintaining reliability.
   * 
   * Enhancement rounds only run after the first successful validation - they never
   * compromise the initial valid result. If enhancement attempts fail or produce
   * worse results, the original valid result is returned.
   * 
   * @example
   * ```typescript
   * // Simple enhancement with default strategy
   * const result = await persuade({
   *   schema: TransitionsSchema,
   *   input: "Generate transitions from mount",
   *   enhancementRounds: 2  // Try to improve twice
   * });
   * 
   * // Advanced configuration with custom strategy
   * const result = await persuade({
   *   schema: WorkoutSchema,
   *   input: "Create workout plan",
   *   enhancement: {
   *     rounds: 1,
   *     strategy: 'expand-detail',
   *     minImprovement: 0.25  // Require 25% improvement
   *   }
   * });
   * ```
   */
  readonly enhancement?: number | EnhancementConfiguration;
}

/**
 * Configuration for enhancement rounds
 * 
 * Defines how the system should attempt to improve initial successful results
 * through additional LLM interactions with encouraging prompts.
 */
export interface EnhancementConfiguration {
  /** Number of enhancement rounds to attempt after initial success */
  readonly rounds: number;
  
  /** 
   * Enhancement strategy to use
   * - 'expand-array': Encourage more items in arrays
   * - 'expand-detail': Encourage more detailed descriptions
   * - 'expand-variety': Encourage more diverse content
   * - 'custom': Use customPrompt function
   */
  readonly strategy?: 'expand-array' | 'expand-detail' | 'expand-variety' | 'custom';
  
  /** 
   * Minimum improvement threshold (0-1)
   * Enhancement is only accepted if improvement exceeds this threshold
   * Default: 0.2 (20% improvement)
   */
  readonly minImprovement?: number;
  
  /** 
   * Custom prompt builder for enhancement
   * Receives current result and round number, returns enhancement prompt
   */
  readonly customPrompt?: (currentResult: unknown, round: number) => string;
  
  /** 
   * Custom improvement evaluator
   * Returns improvement score between 0 and 1
   * Return > minImprovement to accept the enhancement
   */
  readonly evaluateImprovement?: (baseline: unknown, enhanced: unknown) => number;
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

/**
 * Options for preloading data into an existing session
 *
 * Provides a streamlined way to load context data, documents, or other
 * information into sessions for later structured extraction. Designed for
 * multi-step workflows where you build rich context before validation.
 */
export interface PreloadOptions {
  /** Input data to be loaded into the session */
  readonly input: unknown;

  /** Existing session ID to load data into (required) */
  readonly sessionId: string;

  /** Optional additional context for this preload operation */
  readonly context?: string;

  /** Lens/perspective to apply during preloading */
  readonly lens?: string;

  /** LLM model identifier to use */
  readonly model?: string;

  /** Optional schema to validate input data before sending to LLM */
  readonly validateInput?: z.ZodSchema<unknown>;

  /** Logging level for framework operations */
  readonly logLevel?: LogLevel;

  /** Additional provider-specific options */
  readonly providerOptions?: Record<string, unknown>;
}

/**
 * Result of a preload operation
 *
 * Contains the raw LLM response and execution metadata without output validation.
 * Designed for context building rather than structured data extraction.
 */
export interface PreloadResult {
  /** Whether the preload operation succeeded */
  readonly ok: boolean;

  /** Session ID that was used for preloading */
  readonly sessionId: string;

  /** Raw LLM response content (only present if ok is true) */
  readonly rawResponse?: string;

  /** Error information if operation failed */
  readonly error?: ValidationError | ProviderError;

  /** Execution metadata for performance tracking */
  readonly metadata: ExecutionMetadata;
}
