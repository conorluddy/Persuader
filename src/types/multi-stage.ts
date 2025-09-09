/**
 * Multi-Stage Pipeline Types
 *
 * Type definitions for multi-stage pipeline composition, execution flow control,
 * stage management, and orchestration capabilities built on top of the existing
 * Persuader single-stage foundation.
 */

import type { z } from 'zod';
import type { LogLevel } from '../utils/logger.js';
import type { ProviderAdapter } from './provider.js';
import type { ExecutionMetadata, TokenUsage } from './pipeline.js';
import type { ValidationError, ProviderError } from './errors.js';

/**
 * A single stage in a multi-stage pipeline
 *
 * Each stage encapsulates schema validation, context/lens configuration,
 * retry strategies, error recovery, and review requirements while maintaining
 * the same robust foundation as single-stage Persuader operations.
 */
export interface PipelineStage<TInput = unknown, TOutput = unknown> {
  /** Unique identifier for this stage within the pipeline */
  readonly id: string;

  /** Human-readable name for UI display and logging */
  readonly name: string;

  /** Optional description for documentation and CLI display */
  readonly description?: string;

  /** Zod schema for stage output validation */
  readonly schema: z.ZodSchema<TOutput>;

  /** Stage-specific context override (inherits pipeline context if not specified) */
  readonly context?: string;

  /** Stage-specific lens override (inherits pipeline lens if not specified) */
  readonly lens?: string;

  /** Transform function to convert previous stage output to this stage input */
  readonly transformInput?: (
    input: TInput,
    context: PipelineExecutionContext
  ) => unknown | Promise<unknown>;

  /** Stage-specific retry configuration (overrides pipeline defaults) */
  readonly retryConfig?: StageRetryConfig;

  /** Stage-specific provider options (merged with pipeline defaults) */
  readonly providerOptions?: Record<string, unknown>;

  /** Conditional execution predicate - stage only runs if this returns true */
  readonly condition?: (
    input: TInput,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;

  /** Error recovery strategy for handling stage failures */
  readonly errorRecovery?: StageErrorRecovery<TInput, TOutput>;

  /** Stage timeout in milliseconds (overrides pipeline default) */
  readonly timeoutMs?: number;

  /** Whether this stage requires manual review before continuing */
  readonly requiresReview?: boolean;

  /** Review configuration for this stage */
  readonly reviewConfig?: StageReviewConfig;

  /** Optional example output to improve LLM performance */
  readonly exampleOutput?: TOutput;
}

/**
 * Stage-specific retry configuration
 *
 * Extends the robust retry logic from single-stage Persuader with
 * stage-specific overrides and advanced retry strategies.
 */
export interface StageRetryConfig {
  /** Maximum retry attempts for this stage (overrides pipeline default) */
  readonly maxAttempts?: number;

  /** Retry strategy selection */
  readonly strategy?:
    | 'exponential_backoff'
    | 'fixed_delay'
    | 'immediate'
    | 'custom';

  /** Base delay in milliseconds for backoff strategies */
  readonly baseDelayMs?: number;

  /** Maximum delay in milliseconds to cap exponential backoff */
  readonly maxDelayMs?: number;

  /** Custom retry predicate for advanced retry logic */
  readonly shouldRetry?: (
    error: ValidationError | ProviderError,
    attempt: number,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;
}

/**
 * Error recovery configuration for stages
 *
 * Provides sophisticated error handling strategies to maintain pipeline
 * robustness even when individual stages encounter failures.
 */
export interface StageErrorRecovery<TInput, TOutput> {
  /** Recovery strategy selection */
  readonly strategy: 'skip' | 'fallback' | 'retry_with_fallback' | 'custom';

  /** Fallback value to use if stage fails and strategy allows */
  readonly fallbackValue?: TOutput;

  /** Custom recovery function for complex recovery scenarios */
  readonly customRecovery?: (
    error: ValidationError | ProviderError,
    input: TInput,
    context: PipelineExecutionContext
  ) => Promise<TOutput | null>;

  /** Whether to continue pipeline execution after successful recovery */
  readonly continueOnRecovery?: boolean;

  /** Maximum recovery attempts before giving up */
  readonly maxRecoveryAttempts?: number;
}

/**
 * Stage review configuration
 *
 * Configures the review system for quality control and manual oversight
 * of stage outputs before pipeline continuation.
 */
export interface StageReviewConfig {
  /** Confidence threshold below which review is automatically required */
  readonly confidenceThreshold?: number;

  /** Custom review predicate for complex review logic */
  readonly shouldReview?: (
    output: unknown,
    metadata: StageExecutionMetadata,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;

  /** Review timeout in milliseconds */
  readonly timeoutMs?: number;

  /** Whether to auto-approve if review times out */
  readonly autoApproveOnTimeout?: boolean;

  /** Custom review prompt template */
  readonly reviewPrompt?: string;

  /** Review criticality level */
  readonly criticality?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Multi-stage pipeline definition with execution flow control
 *
 * Defines the complete pipeline structure, stage composition, execution flow,
 * and global configuration while maintaining backward compatibility with
 * single-stage operations.
 */
export interface Pipeline<TInput = unknown> {
  /** Unique pipeline identifier */
  readonly id: string;

  /** Human-readable pipeline name */
  readonly name: string;

  /** Optional pipeline description */
  readonly description?: string;

  /** Input schema validation for pipeline entry point */
  readonly inputSchema?: z.ZodSchema<TInput>;

  /** Pipeline stages in logical order */
  readonly stages: ReadonlyArray<PipelineStage>;

  /** Execution flow configuration */
  readonly flow: PipelineFlow;

  /** Global pipeline configuration */
  readonly config: PipelineConfig;

  /** Pipeline-level error handling strategy */
  readonly errorHandling?: PipelineErrorHandling;

  /** Global context shared across stages */
  readonly globalContext?: string;

  /** Global lens shared across stages */
  readonly globalLens?: string;
}

/**
 * Pipeline execution flow configuration
 *
 * Defines how stages are executed in relation to each other,
 * supporting sequential, parallel, conditional, and DAG execution modes.
 */
export interface PipelineFlow {
  /** Execution mode selection */
  readonly mode: 'sequential' | 'parallel' | 'conditional' | 'dag';

  /** Stage dependencies for DAG mode (stage_id -> [dependency_stage_ids]) */
  readonly dependencies?: Record<string, ReadonlyArray<string>>;

  /** Parallel execution groups for parallel mode */
  readonly parallelGroups?: ReadonlyArray<ReadonlyArray<string>>;

  /** Conditional branches for conditional mode */
  readonly branches?: ReadonlyArray<ConditionalBranch>;

  /** Maximum concurrent stage executions for parallel modes */
  readonly maxConcurrency?: number;
}

/**
 * Conditional branch definition
 *
 * Enables dynamic pipeline execution paths based on runtime conditions
 * and stage outputs.
 */
export interface ConditionalBranch {
  /** Branch condition evaluation function */
  readonly condition: (
    input: unknown,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;

  /** Stages to execute if condition evaluates to true */
  readonly ifTrue: ReadonlyArray<string>;

  /** Stages to execute if condition evaluates to false */
  readonly ifFalse?: ReadonlyArray<string>;

  /** Branch name for debugging and logging */
  readonly name?: string;

  /** Branch description for documentation */
  readonly description?: string;
}

/**
 * Global pipeline configuration
 *
 * Defines pipeline-wide settings for execution, session management,
 * progress tracking, and review system operation.
 */
export interface PipelineConfig {
  /** Maximum total pipeline execution time in milliseconds */
  readonly maxExecutionTimeMs?: number;

  /** Whether to stop pipeline on first stage failure */
  readonly stopOnFirstError?: boolean;

  /** Global session management configuration */
  readonly sessionConfig?: PipelineSessionConfig;

  /** Progress tracking configuration */
  readonly progressConfig?: ProgressConfig;

  /** Review system configuration */
  readonly reviewConfig?: PipelineReviewConfig;

  /** Default retry configuration for all stages */
  readonly defaultRetryConfig?: StageRetryConfig;

  /** Global provider options applied to all stages */
  readonly globalProviderOptions?: Record<string, unknown>;
}

/**
 * Pipeline session configuration
 *
 * Manages context and session state across multiple stages to optimize
 * token usage and maintain conversation coherence.
 */
export interface PipelineSessionConfig {
  /** Whether to reuse session across stages */
  readonly reuseSession?: boolean;

  /** Session context management strategy */
  readonly contextStrategy?:
    | 'accumulate'
    | 'sliding_window'
    | 'stage_isolated'
    | 'smart_context';

  /** Maximum context length for accumulated strategy */
  readonly maxContextLength?: number;

  /** Sliding window size for sliding_window strategy */
  readonly windowSize?: number;

  /** Context compression threshold for smart_context strategy */
  readonly compressionThreshold?: number;

  /** Whether to include stage outputs in session context */
  readonly includeStageOutputs?: boolean;
}

/**
 * Progress tracking configuration
 *
 * Configures real-time progress reporting, metrics collection,
 * and user interface elements for pipeline execution monitoring.
 */
export interface ProgressConfig {
  /** Whether to show progress indicators */
  readonly showProgress?: boolean;

  /** Progress update interval in milliseconds */
  readonly updateIntervalMs?: number;

  /** Whether to show detailed metrics during execution */
  readonly showMetrics?: boolean;

  /** Specific metrics to track and display */
  readonly metricsToTrack?: ReadonlyArray<
    'tokens' | 'cost' | 'timing' | 'success_rate' | 'quality' | 'confidence'
  >;

  /** Progress display mode */
  readonly displayMode?: 'basic' | 'detailed' | 'dashboard' | 'minimal';

  /** Whether to show ETA calculations */
  readonly showETA?: boolean;
}

/**
 * Pipeline review system configuration
 *
 * Configures the manual and automated review system for quality control
 * and oversight of pipeline execution.
 */
export interface PipelineReviewConfig {
  /** Whether review system is globally enabled */
  readonly enabled?: boolean;

  /** Default review mode for stages without specific configuration */
  readonly defaultMode?: 'manual' | 'confidence_based' | 'disabled' | 'auto';

  /** Global confidence threshold for automatic review triggering */
  readonly globalConfidenceThreshold?: number;

  /** Review interface configuration */
  readonly interface?: ReviewInterfaceConfig;

  /** Batch review settings */
  readonly batchReview?: {
    /** Whether to batch reviews for efficiency */
    readonly enabled?: boolean;

    /** Maximum reviews to batch together */
    readonly maxBatchSize?: number;

    /** Batch timeout before auto-processing */
    readonly batchTimeoutMs?: number;
  };
}

/**
 * Review interface configuration
 *
 * Configures the user interface elements and interaction patterns
 * for the review system across different interfaces (CLI, web, API).
 */
export interface ReviewInterfaceConfig {
  /** CLI review interface settings */
  readonly cli?: {
    /** Whether to use colored output */
    readonly colorized?: boolean;

    /** Whether to show detailed stage information */
    readonly showDetails?: boolean;

    /** Auto-expand sections in review display */
    readonly autoExpand?: ReadonlyArray<
      'input' | 'output' | 'metadata' | 'errors' | 'history'
    >;

    /** Interactive mode settings */
    readonly interactive?: boolean;

    /** Keyboard shortcuts configuration */
    readonly shortcuts?: Record<string, string>;
  };
}

/**
 * Pipeline error handling configuration
 *
 * Defines pipeline-level error handling strategies and failure recovery
 * mechanisms to ensure robust execution even under adverse conditions.
 */
export interface PipelineErrorHandling {
  /** Overall error handling strategy */
  readonly strategy:
    | 'fail_fast'
    | 'continue_on_error'
    | 'collect_errors'
    | 'adaptive';

  /** Maximum number of failed stages before pipeline termination */
  readonly maxFailedStages?: number;

  /** Error types that should be considered recoverable */
  readonly recoverableErrors?: ReadonlyArray<string>;

  /** Whether to attempt pipeline-level recovery */
  readonly enablePipelineRecovery?: boolean;

  /** Pipeline recovery strategies */
  readonly recoveryStrategies?: ReadonlyArray<PipelineRecoveryStrategy>;
}

/**
 * Pipeline recovery strategy definition
 *
 * Defines specific recovery strategies that can be applied at the
 * pipeline level when multiple stages fail or other critical errors occur.
 */
export interface PipelineRecoveryStrategy {
  /** Strategy name for identification */
  readonly name: string;

  /** Conditions under which this strategy applies */
  readonly condition: (
    error: PipelineError,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;

  /** Recovery implementation */
  readonly recover: (
    error: PipelineError,
    context: PipelineExecutionContext
  ) => Promise<PipelineRecoveryResult>;

  /** Strategy priority (higher numbers take precedence) */
  readonly priority?: number;
}

/**
 * Pipeline execution context
 *
 * Comprehensive execution context shared across all stages, providing
 * access to pipeline state, services, and execution metadata.
 */
export interface PipelineExecutionContext {
  /** Pipeline instance being executed */
  readonly pipeline: Pipeline;

  /** Current execution state */
  readonly state: PipelineExecutionState;

  /** Provider adapter */
  readonly provider: ProviderAdapter;

  /** Session manager for cross-stage session handling */
  readonly sessionManager: PipelineSessionManager;

  /** Execution metadata accumulator */
  readonly metadata: PipelineExecutionMetadata;

  /** Progress tracker */
  readonly progressTracker: ProgressTracker;

  /** Review manager */
  readonly reviewManager: ReviewManager;

  /** Logger instance */
  readonly logger: Logger;

  /** Input data for the pipeline */
  readonly input: unknown;

  /** Execution options */
  readonly options: PipelineExecutionOptions;
}

/**
 * Pipeline execution state
 *
 * Maintains the current state of pipeline execution, including
 * completed stages, failed stages, and overall progress tracking.
 */
export interface PipelineExecutionState {
  /** Current stage being executed */
  readonly currentStage?: string;

  /** Completed stages with their outputs */
  readonly completedStages: Record<string, StageResult>;

  /** Failed stages with error information */
  readonly failedStages: Record<string, StageError>;

  /** Stages waiting for dependencies to complete */
  readonly waitingStages: Set<string>;

  /** Stages currently executing (for parallel mode) */
  readonly executingStages: Set<string>;

  /** Overall pipeline status */
  readonly status: PipelineStatus;

  /** Pipeline execution start time */
  readonly startTime: Date;

  /** Current execution phase */
  readonly phase:
    | 'initializing'
    | 'executing'
    | 'reviewing'
    | 'completing'
    | 'failed'
    | 'cancelled';

  /** Pipeline input data */
  readonly input: unknown;

  /** Accumulated session context */
  readonly sessionContext?: string;
}

/**
 * Pipeline execution status enumeration
 *
 * Defines all possible states of pipeline execution for
 * progress tracking and user interface updates.
 */
export type PipelineStatus =
  | 'pending' // Pipeline created but not yet started
  | 'running' // Pipeline actively executing stages
  | 'paused' // Pipeline execution temporarily suspended
  | 'review_required' // Pipeline waiting for manual review
  | 'completed' // Pipeline successfully completed all stages
  | 'failed' // Pipeline failed and cannot continue
  | 'cancelled'; // Pipeline execution was cancelled by user

/**
 * Stage execution result
 *
 * Captures the complete result of an individual stage execution,
 * including success/failure status, output value, execution metadata,
 * and review information.
 */
export interface StageResult<T = unknown> {
  /** Stage identifier */
  readonly stageId: string;

  /** Stage execution success indicator */
  readonly success: boolean;

  /** Stage output value (only present on success) */
  readonly value?: T;

  /** Stage execution error (only present on failure) */
  readonly error?: ValidationError | ProviderError;

  /** Comprehensive stage execution metadata */
  readonly metadata: StageExecutionMetadata;

  /** Review result if stage was reviewed */
  readonly reviewResult?: ReviewResult;

  /** Stage execution start time */
  readonly startTime: Date;

  /** Stage execution end time */
  readonly endTime: Date;

  /** Input data provided to this stage */
  readonly input?: unknown;
}

/**
 * Stage error information
 *
 * Extended error information for failed stages, including
 * recovery attempts and failure analysis.
 */
export interface StageError {
  /** Stage identifier that failed */
  readonly stageId: string;

  /** Primary error that caused the failure */
  readonly error: ValidationError | ProviderError;

  /** Number of retry attempts made */
  readonly retryAttempts: number;

  /** Recovery attempts made */
  readonly recoveryAttempts?: number;

  /** Error timestamp */
  readonly timestamp: Date;

  /** Whether the error is considered recoverable */
  readonly recoverable: boolean;

  /** Error context and additional details */
  readonly context?: Record<string, unknown>;
}

/**
 * Stage execution metadata
 *
 * Extends base execution metadata with stage-specific metrics,
 * quality assessments, and confidence scoring.
 */
export interface StageExecutionMetadata extends ExecutionMetadata {
  /** Stage-specific performance metrics */
  readonly stageMetrics: StageMetrics;

  /** AI confidence score in output quality (0-1) */
  readonly confidence?: number;

  /** Output quality assessment metrics */
  readonly quality?: QualityMetrics;

  /** Retry history for this stage */
  readonly retryHistory?: ReadonlyArray<RetryAttempt>;

  /** Validation details */
  readonly validationDetails?: ValidationDetails;
}

/**
 * Stage-specific performance metrics
 *
 * Detailed performance metrics for individual stage execution,
 * enabling optimization and monitoring of stage efficiency.
 */
export interface StageMetrics {
  /** Total stage execution duration */
  readonly executionTimeMs: number;

  /** Number of retry attempts made */
  readonly retryAttempts: number;

  /** Number of validation attempts */
  readonly validationAttempts: number;

  /** Time spent on input processing and transformation */
  readonly inputProcessingTimeMs?: number;

  /** Time spent on output validation */
  readonly validationTimeMs?: number;

  /** Time spent on provider communication */
  readonly providerTimeMs?: number;

  /** Time spent waiting for dependencies */
  readonly waitTimeMs?: number;

  /** Memory usage during stage execution */
  readonly memoryUsageMB?: number;
}

/**
 * Quality assessment metrics
 *
 * Comprehensive quality metrics for evaluating the quality
 * and reliability of stage outputs.
 */
export interface QualityMetrics {
  /** Schema compliance score (0-1) */
  readonly schemaCompliance: number;

  /** Output completeness score (0-1) */
  readonly completeness: number;

  /** Output consistency score (0-1) */
  readonly consistency?: number;

  /** Output accuracy score (0-1) */
  readonly accuracy?: number;

  /** Custom quality scores defined by user */
  readonly customScores?: Record<string, number>;

  /** Quality assessment timestamp */
  readonly assessedAt: Date;
}

/**
 * Retry attempt record
 *
 * Records details of each retry attempt for analysis and debugging.
 */
export interface RetryAttempt {
  /** Attempt number */
  readonly attempt: number;

  /** Timestamp of attempt */
  readonly timestamp: Date;

  /** Error that caused the retry */
  readonly error: ValidationError | ProviderError;

  /** Attempt duration */
  readonly durationMs: number;

  /** Token usage for this attempt */
  readonly tokenUsage?: TokenUsage;
}

/**
 * Validation details
 *
 * Detailed information about the validation process and results.
 */
export interface ValidationDetails {
  /** Number of validation rules checked */
  readonly rulesChecked: number;

  /** Number of validation rules passed */
  readonly rulesPassed: number;

  /** Validation errors encountered */
  readonly validationErrors?: ReadonlyArray<ValidationError>;

  /** Validation warnings */
  readonly validationWarnings?: ReadonlyArray<string>;

  /** Validation duration */
  readonly validationTimeMs: number;
}

// Forward declarations for interfaces defined in other modules
export interface PipelineSessionManager {
  createSession(context: string): Promise<string>;
  getSession(sessionId: string): Promise<string | null>;
  updateSession(sessionId: string, newContext: string): Promise<void>;
  cleanup(): Promise<void>;
}

export interface ProgressTracker {
  initialize(): Promise<void>;
  updateProgress(stageId: string, progress: number): Promise<void>;
  finalize(): Promise<void>;
}

export interface ReviewManager {
  requestReview(
    stage: PipelineStage,
    result: StageResult,
    context: PipelineExecutionContext
  ): Promise<ReviewResult>;
  isReviewRequired(
    stage: PipelineStage,
    result: StageResult,
    context: PipelineExecutionContext
  ): Promise<boolean>;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ReviewResult {
  decision: 'approved' | 'rejected' | 'requires_modification' | 'timeout';
  reviewedAt: Date;
  reviewTimeMs: number;
  comments?: string;
}

export interface PipelineExecutionOptions {
  pipeline: Pipeline;
  input: unknown;
  provider?: ProviderAdapter;
  sessionId?: string;
  reviewMode?: 'enabled' | 'disabled' | 'confidence_based';
  progressMode?: 'silent' | 'basic' | 'detailed';
  logLevel?: LogLevel;
  dryRun?: boolean;
}

export interface PipelineExecutionMetadata extends ExecutionMetadata {
  stageCount: number;
  completedStages: number;
  failedStages: number;
  totalTokenUsage?: TokenUsage;
  averageStageTime?: number;
  pipelineEfficiency?: number;
}

export interface PipelineError {
  type: 'pipeline_error';
  code: string;
  message: string;
  timestamp: Date;
  failedStages: ReadonlyArray<string>;
  context?: Record<string, unknown>;
}

export interface PipelineRecoveryResult {
  success: boolean;
  recoveredStages?: ReadonlyArray<string>;
  modifiedPipeline?: Pipeline;
  error?: PipelineError;
}

export interface PipelineResult<T = unknown> {
  success: boolean;
  value?: T;
  error?: PipelineError;
  metadata: PipelineExecutionMetadata;
  stageResults: Record<string, StageResult>;
}
