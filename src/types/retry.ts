/**
 * Retry System Types
 *
 * Type definitions for the retry system, including configuration, attempt tracking,
 * and context management for handling validation failures and provider errors.
 */

import type { PersuaderError } from './errors.js';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxAttempts: number;

  /** Initial delay between retries in milliseconds */
  readonly initialDelay: number;

  /** Backoff strategy for retry delays */
  readonly backoffStrategy: 'fixed' | 'linear' | 'exponential';

  /** Maximum delay between retries in milliseconds */
  readonly maxDelay: number;

  /** Jitter factor to add randomness to delays (0-1) */
  readonly jitter: number;

  /** Types of errors that should trigger retries */
  readonly retryableErrors: readonly string[];

  /** Custom retry condition function */
  readonly shouldRetry?: (error: PersuaderError, attempt: number) => boolean;
}

/**
 * Information about a retry attempt
 */
export interface RetryAttempt {
  /** Attempt number (1-based) */
  readonly attemptNumber: number;

  /** Error that triggered this retry */
  readonly error: PersuaderError;

  /** Delay before this attempt in milliseconds */
  readonly delayMs: number;

  /** Timestamp when attempt started */
  readonly attemptedAt: Date;

  /** Whether this was the final attempt */
  readonly finalAttempt: boolean;
}

/**
 * Retry context for tracking retry state
 */
export interface RetryContext {
  /** Configuration for retries */
  readonly config: RetryConfig;

  /** All retry attempts made */
  readonly attempts: readonly RetryAttempt[];

  /** Current attempt number */
  readonly currentAttempt: number;

  /** Total time spent on retries */
  readonly totalRetryTimeMs: number;

  /** Whether retries are exhausted */
  readonly exhausted: boolean;
}

/**
 * ENHANCED: Session priming configuration for intelligent LLM preparation
 */
export interface SessionPrimingConfig {
  /** Enable session priming with schema preparation */
  readonly enabled: boolean;

  /** Use separate priming conversation before main request */
  readonly usePrimingConversation: boolean;

  /** Include domain context in priming (e.g., yoga poses, recipes, etc.) */
  readonly includeDomainContext: boolean;

  /** Provide example outputs during priming */
  readonly includeExamples: boolean;

  /** Maximum tokens to spend on priming */
  readonly maxPrimingTokens: number;
}

/**
 * ENHANCED: Intelligent retry coordinator configuration
 */
export interface IntelligentRetryConfig extends RetryConfig {
  /** Session priming settings */
  readonly sessionPriming: SessionPrimingConfig;

  /** Enable progressive refinement strategy */
  readonly enableProgressiveRefinement: boolean;

  /** Minimum attempts before strategy escalation */
  readonly minAttemptsBeforeEscalation: number;

  /** Enable detailed error analysis and classification */
  readonly enableErrorAnalysis: boolean;

  /** Provide schema-specific feedback */
  readonly enableSchemaFeedback: boolean;

  /** Include validation examples in retry prompts */
  readonly includeValidationExamples: boolean;
}

/**
 * ENHANCED: Session priming stages for multi-step preparation
 */
export type SessionPrimingStage =
  | 'schema_introduction' // Introduce schema structure and requirements
  | 'domain_context' // Provide domain knowledge and background
  | 'format_demonstration' // Show expected JSON format with examples
  | 'constraint_explanation' // Explain validation rules and constraints
  | 'edge_case_handling'; // Discuss error handling and edge cases

/**
 * ENHANCED: Priming conversation result
 */
export interface PrimingResult {
  /** Whether priming was successful */
  readonly success: boolean;

  /** Stages that were completed */
  readonly completedStages: readonly SessionPrimingStage[];

  /** Token usage for priming */
  readonly tokenUsage: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  };

  /** Time spent on priming */
  readonly primingTimeMs: number;

  /** Error if priming failed */
  readonly error?: PersuaderError;

  /** Session state after priming */
  readonly sessionState: 'primed' | 'partially_primed' | 'failed';
}

/**
 * ENHANCED: Retry attempt with enhanced context and analysis
 */
export interface EnhancedRetryAttempt extends RetryAttempt {
  /** Strategy used for this attempt */
  readonly strategy: import('./errors.js').RetryStrategy;

  /** Failure mode from previous attempt */
  readonly previousFailureMode?: import('./errors.js').ErrorFailureMode;

  /** Feedback provided to LLM for this attempt */
  readonly feedbackProvided: {
    readonly summary: string;
    readonly specificInstructions: readonly string[];
    readonly exampleCorrection?: string;
  };

  /** Analysis of what changed from previous attempt */
  readonly attemptAnalysis?: {
    readonly strategyChange: boolean;
    readonly feedbackStrength: 'light' | 'moderate' | 'aggressive';
    readonly contextEnhancement: boolean;
    readonly schemaReinforcement: boolean;
  };
}
