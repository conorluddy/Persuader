/**
 * Progress Tracking Types
 *
 * Type definitions for pipeline progress tracking, metrics collection,
 * real-time monitoring, and user interface elements for progress display.
 */

import type {
  PipelineExecutionContext,
  PipelineStatus,
  StageResult,
} from './multi-stage.js';
import type { TokenUsage } from './pipeline.js';

/**
 * Progress tracker interface
 *
 * Core interface for tracking pipeline execution progress,
 * collecting metrics, and providing real-time updates.
 */
export interface ProgressTracker {
  /** Initialize progress tracking for a pipeline */
  initialize(context: PipelineExecutionContext): Promise<void>;

  /** Update progress for a specific stage */
  updateStageProgress(stageId: string, progress: StageProgress): Promise<void>;

  /** Update overall pipeline progress */
  updatePipelineProgress(progress: PipelineProgress): Promise<void>;

  /** Record stage completion */
  recordStageCompletion(stageId: string, result: StageResult): Promise<void>;

  /** Record stage failure */
  recordStageFailure(stageId: string, error: unknown): Promise<void>;

  /** Get current progress snapshot */
  getCurrentProgress(): Promise<ProgressSnapshot>;

  /** Finalize progress tracking */
  finalize(): Promise<void>;

  /** Get progress metrics */
  getMetrics(): Promise<ProgressMetrics>;

  /** Subscribe to progress updates */
  onProgressUpdate(callback: ProgressUpdateCallback): void;

  /** Unsubscribe from progress updates */
  offProgressUpdate(callback: ProgressUpdateCallback): void;
}

/**
 * Stage progress information
 *
 * Detailed progress information for an individual stage execution.
 */
export interface StageProgress {
  /** Stage identifier */
  readonly stageId: string;

  /** Current stage status */
  readonly status: StageStatus;

  /** Progress percentage (0-1) */
  readonly progress: number;

  /** Current stage phase */
  readonly phase: StagePhase;

  /** Stage start time */
  readonly startTime?: Date;

  /** Estimated completion time */
  readonly estimatedCompletionTime?: Date;

  /** Current retry attempt number */
  readonly currentAttempt?: number;

  /** Maximum retry attempts */
  readonly maxAttempts?: number;

  /** Current activity description */
  readonly currentActivity?: string;

  /** Stage metrics so far */
  readonly metrics?: Partial<StageProgressMetrics>;

  /** Any warnings or issues */
  readonly warnings?: ReadonlyArray<ProgressWarning>;
}

/**
 * Stage status enumeration
 *
 * Possible states of stage execution for progress tracking.
 */
export type StageStatus =
  | 'pending' // Stage waiting to be executed
  | 'preparing' // Stage preparing for execution (input transformation, etc.)
  | 'executing' // Stage actively executing
  | 'validating' // Stage output being validated
  | 'retrying' // Stage retrying after failure
  | 'reviewing' // Stage output under review
  | 'completed' // Stage completed successfully
  | 'failed' // Stage failed and cannot continue
  | 'skipped' // Stage was skipped due to conditions
  | 'cancelled'; // Stage execution was cancelled

/**
 * Stage execution phase
 *
 * Detailed phases within stage execution for fine-grained progress tracking.
 */
export type StagePhase =
  | 'initializing' // Stage initialization and setup
  | 'transforming' // Input transformation
  | 'prompting' // Building and preparing prompt
  | 'calling_provider' // Making provider API call
  | 'receiving' // Receiving provider response
  | 'validating' // Validating response against schema
  | 'post_processing' // Post-processing output
  | 'reviewing' // Under review (if applicable)
  | 'finalizing' // Final stage cleanup and recording
  | 'error_handling' // Handling errors or retries
  | 'recovering'; // Executing recovery strategies

/**
 * Pipeline progress information
 *
 * Overall progress information for the entire pipeline execution.
 */
export interface PipelineProgress {
  /** Pipeline identifier */
  readonly pipelineId: string;

  /** Overall pipeline status */
  readonly status: PipelineStatus;

  /** Overall progress percentage (0-1) */
  readonly progress: number;

  /** Pipeline start time */
  readonly startTime: Date;

  /** Current time */
  readonly currentTime: Date;

  /** Estimated completion time */
  readonly estimatedCompletionTime?: Date;

  /** Estimated time remaining in milliseconds */
  readonly estimatedTimeRemainingMs?: number;

  /** Number of completed stages */
  readonly completedStages: number;

  /** Number of failed stages */
  readonly failedStages: number;

  /** Total number of stages */
  readonly totalStages: number;

  /** Currently executing stages (for parallel execution) */
  readonly executingStages: ReadonlyArray<string>;

  /** Stages waiting for dependencies */
  readonly waitingStages: ReadonlyArray<string>;

  /** Pipeline execution phase */
  readonly phase:
    | 'initializing'
    | 'executing'
    | 'reviewing'
    | 'completing'
    | 'error_handling';

  /** Overall pipeline metrics */
  readonly metrics: PipelineProgressMetrics;

  /** Execution efficiency score (0-1) */
  readonly efficiency?: number;

  /** Quality score based on completed stages (0-1) */
  readonly qualityScore?: number;
}

/**
 * Progress snapshot
 *
 * Complete snapshot of pipeline and stage progress at a point in time.
 */
export interface ProgressSnapshot {
  /** Snapshot timestamp */
  readonly timestamp: Date;

  /** Overall pipeline progress */
  readonly pipelineProgress: PipelineProgress;

  /** Individual stage progress */
  readonly stageProgress: Record<string, StageProgress>;

  /** Recent activity log */
  readonly recentActivity: ReadonlyArray<ProgressActivity>;

  /** Current warnings and issues */
  readonly warnings: ReadonlyArray<ProgressWarning>;

  /** Performance indicators */
  readonly performance: ProgressPerformanceIndicators;
}

/**
 * Progress activity record
 *
 * Record of recent progress activities for activity tracking and debugging.
 */
export interface ProgressActivity {
  /** Activity timestamp */
  readonly timestamp: Date;

  /** Activity type */
  readonly type: ProgressActivityType;

  /** Stage associated with activity (if applicable) */
  readonly stageId?: string;

  /** Activity description */
  readonly description: string;

  /** Activity metadata */
  readonly metadata?: Record<string, unknown>;

  /** Activity severity */
  readonly severity: 'info' | 'warning' | 'error';
}

/**
 * Progress activity type enumeration
 */
export type ProgressActivityType =
  | 'pipeline_started' // Pipeline execution started
  | 'pipeline_completed' // Pipeline execution completed
  | 'pipeline_failed' // Pipeline execution failed
  | 'stage_started' // Stage execution started
  | 'stage_completed' // Stage execution completed
  | 'stage_failed' // Stage execution failed
  | 'stage_retrying' // Stage retrying after failure
  | 'stage_reviewing' // Stage under review
  | 'stage_skipped' // Stage skipped
  | 'provider_called' // Provider API called
  | 'validation_passed' // Validation succeeded
  | 'validation_failed' // Validation failed
  | 'error_occurred' // Error occurred
  | 'warning_issued' // Warning issued
  | 'milestone_reached' // Progress milestone reached
  | 'configuration_changed'; // Configuration updated

/**
 * Progress warning
 *
 * Warning or issue encountered during pipeline execution.
 */
export interface ProgressWarning {
  /** Warning identifier */
  readonly id: string;

  /** Warning timestamp */
  readonly timestamp: Date;

  /** Warning type */
  readonly type: ProgressWarningType;

  /** Warning severity */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';

  /** Stage associated with warning (if applicable) */
  readonly stageId?: string;

  /** Warning message */
  readonly message: string;

  /** Detailed warning description */
  readonly details?: string;

  /** Suggested actions to address warning */
  readonly suggestedActions?: ReadonlyArray<string>;

  /** Whether warning affects pipeline execution */
  readonly blocking?: boolean;

  /** Warning metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Progress warning type enumeration
 */
export type ProgressWarningType =
  | 'performance_slow' // Execution slower than expected
  | 'high_token_usage' // High token consumption
  | 'low_confidence' // Low AI confidence scores
  | 'validation_issues' // Validation problems
  | 'retry_limit_approaching' // Approaching retry limits
  | 'timeout_risk' // Risk of timeout
  | 'resource_usage_high' // High resource usage
  | 'quality_concern' // Quality metrics below threshold
  | 'dependency_delay' // Dependency causing delays
  | 'provider_issues' // Provider-related issues
  | 'configuration_issue' // Configuration problems
  | 'data_quality_issue' // Input data quality concerns
  | 'security_concern' // Security-related warning
  | 'compliance_issue'; // Compliance or policy violation

/**
 * Progress performance indicators
 *
 * Key performance indicators for pipeline execution efficiency and health.
 */
export interface ProgressPerformanceIndicators {
  /** Average stage execution time in milliseconds */
  readonly avgStageTimeMs: number;

  /** Execution efficiency compared to baseline (0-1) */
  readonly efficiency: number;

  /** Success rate of stages (0-1) */
  readonly successRate: number;

  /** Average retry rate per stage */
  readonly avgRetryRate: number;

  /** Token usage efficiency (output value / tokens used) */
  readonly tokenEfficiency?: number;

  /** Quality vs speed trade-off score (0-1) */
  readonly qualitySpeedBalance?: number;

  /** Resource utilization score (0-1) */
  readonly resourceUtilization?: number;

  /** Overall health score (0-1) */
  readonly overallHealth: number;
}

/**
 * Stage progress metrics
 *
 * Detailed metrics for individual stage progress tracking.
 */
export interface StageProgressMetrics {
  /** Execution time so far in milliseconds */
  readonly executionTimeMs: number;

  /** Number of retries attempted */
  readonly retryCount: number;

  /** Token usage for this stage */
  readonly tokenUsage?: TokenUsage;

  /** Validation attempts count */
  readonly validationAttempts: number;

  /** Provider call count */
  readonly providerCalls: number;

  /** Current confidence score (0-1) */
  readonly confidence?: number;

  /** Quality metrics */
  readonly quality?: StageQualityMetrics;

  /** Performance metrics */
  readonly performance?: StagePerformanceMetrics;
}

/**
 * Stage quality metrics
 */
export interface StageQualityMetrics {
  /** Schema compliance score (0-1) */
  readonly schemaCompliance: number;

  /** Output completeness score (0-1) */
  readonly completeness: number;

  /** Consistency with previous outputs (0-1) */
  readonly consistency?: number;

  /** Accuracy score (0-1) */
  readonly accuracy?: number;
}

/**
 * Stage performance metrics
 */
export interface StagePerformanceMetrics {
  /** Processing speed compared to baseline (0-1) */
  readonly speed: number;

  /** Resource efficiency score (0-1) */
  readonly efficiency: number;

  /** Success rate for this stage type (0-1) */
  readonly successRate: number;

  /** Error rate (0-1) */
  readonly errorRate: number;
}

/**
 * Pipeline progress metrics
 *
 * Comprehensive metrics for overall pipeline progress and performance.
 */
export interface PipelineProgressMetrics {
  /** Total execution time in milliseconds */
  readonly totalExecutionTimeMs: number;

  /** Average stage execution time */
  readonly avgStageExecutionTimeMs: number;

  /** Total token usage across all stages */
  readonly totalTokenUsage?: TokenUsage;

  /** Average token usage per stage */
  readonly avgTokenUsagePerStage?: number;

  /** Total retry attempts across all stages */
  readonly totalRetryAttempts: number;

  /** Average retries per stage */
  readonly avgRetriesPerStage: number;

  /** Overall success rate (0-1) */
  readonly successRate: number;

  /** Pipeline efficiency score (0-1) */
  readonly efficiency: number;

  /** Throughput (stages completed per hour) */
  readonly throughputPerHour?: number;

  /** Cost efficiency metrics */
  readonly costEfficiency?: CostEfficiencyMetrics;

  /** Quality metrics aggregated across stages */
  readonly qualityMetrics?: AggregatedQualityMetrics;
}

/**
 * Cost efficiency metrics
 */
export interface CostEfficiencyMetrics {
  /** Estimated total cost in USD */
  readonly totalEstimatedCost?: number;

  /** Cost per successful stage */
  readonly costPerSuccessfulStage?: number;

  /** Cost efficiency compared to baseline */
  readonly costEfficiencyScore?: number;

  /** Token cost breakdown by stage */
  readonly tokenCostBreakdown?: Record<string, number>;
}

/**
 * Aggregated quality metrics
 */
export interface AggregatedQualityMetrics {
  /** Average schema compliance across stages */
  readonly avgSchemaCompliance: number;

  /** Average completeness across stages */
  readonly avgCompleteness: number;

  /** Average consistency across stages */
  readonly avgConsistency?: number;

  /** Average accuracy across stages */
  readonly avgAccuracy?: number;

  /** Overall quality score (0-1) */
  readonly overallQuality: number;
}

/**
 * Progress metrics
 *
 * Complete metrics package for progress analysis and optimization.
 */
export interface ProgressMetrics {
  /** Basic progress metrics */
  readonly basic: BasicProgressMetrics;

  /** Detailed stage metrics */
  readonly stages: Record<string, StageProgressMetrics>;

  /** Pipeline-level metrics */
  readonly pipeline: PipelineProgressMetrics;

  /** Performance analysis */
  readonly performance: ProgressPerformanceAnalysis;

  /** Historical comparison */
  readonly historical?: HistoricalComparison;

  /** Benchmarking data */
  readonly benchmarks?: BenchmarkComparison;
}

/**
 * Basic progress metrics
 */
export interface BasicProgressMetrics {
  /** Total stages */
  readonly totalStages: number;

  /** Completed stages */
  readonly completedStages: number;

  /** Failed stages */
  readonly failedStages: number;

  /** Skipped stages */
  readonly skippedStages: number;

  /** Overall progress percentage */
  readonly progressPercentage: number;

  /** Elapsed time in milliseconds */
  readonly elapsedTimeMs: number;

  /** Estimated time remaining */
  readonly estimatedTimeRemainingMs?: number;
}

/**
 * Progress performance analysis
 */
export interface ProgressPerformanceAnalysis {
  /** Bottleneck stages identification */
  readonly bottlenecks: ReadonlyArray<BottleneckAnalysis>;

  /** Optimization opportunities */
  readonly optimizationOpportunities: ReadonlyArray<OptimizationOpportunity>;

  /** Performance trends */
  readonly trends: PerformanceTrends;

  /** Efficiency analysis */
  readonly efficiency: EfficiencyAnalysis;
}

/**
 * Bottleneck analysis
 */
export interface BottleneckAnalysis {
  /** Stage causing bottleneck */
  readonly stageId: string;

  /** Bottleneck type */
  readonly type:
    | 'execution_time'
    | 'token_usage'
    | 'retry_count'
    | 'validation_time'
    | 'dependency_wait';

  /** Bottleneck severity (0-1) */
  readonly severity: number;

  /** Impact on overall pipeline */
  readonly impactDescription: string;

  /** Suggested improvements */
  readonly suggestions: ReadonlyArray<string>;
}

/**
 * Optimization opportunity
 */
export interface OptimizationOpportunity {
  /** Opportunity type */
  readonly type:
    | 'parallel_execution'
    | 'session_reuse'
    | 'prompt_optimization'
    | 'retry_reduction'
    | 'caching';

  /** Potential improvement (0-1) */
  readonly potentialImprovement: number;

  /** Implementation difficulty (0-1) */
  readonly difficulty: number;

  /** Opportunity description */
  readonly description: string;

  /** Implementation steps */
  readonly implementationSteps?: ReadonlyArray<string>;
}

/**
 * Performance trends
 */
export interface PerformanceTrends {
  /** Execution time trend */
  readonly executionTimeTrend: TrendDirection;

  /** Success rate trend */
  readonly successRateTrend: TrendDirection;

  /** Quality trend */
  readonly qualityTrend: TrendDirection;

  /** Efficiency trend */
  readonly efficiencyTrend: TrendDirection;
}

/**
 * Trend direction enumeration
 */
export type TrendDirection = 'improving' | 'declining' | 'stable' | 'volatile';

/**
 * Efficiency analysis
 */
export interface EfficiencyAnalysis {
  /** Time efficiency score (0-1) */
  readonly timeEfficiency: number;

  /** Token efficiency score (0-1) */
  readonly tokenEfficiency: number;

  /** Resource efficiency score (0-1) */
  readonly resourceEfficiency: number;

  /** Overall efficiency score (0-1) */
  readonly overallEfficiency: number;

  /** Efficiency compared to baseline */
  readonly baselineComparison?: number;
}

/**
 * Historical comparison
 */
export interface HistoricalComparison {
  /** Number of historical runs compared */
  readonly historicalRuns: number;

  /** Performance vs historical average */
  readonly vsHistoricalAverage: ComparisonMetrics;

  /** Performance vs best historical run */
  readonly vsBestRun: ComparisonMetrics;

  /** Trend over time */
  readonly trend: TrendDirection;
}

/**
 * Benchmark comparison
 */
export interface BenchmarkComparison {
  /** Benchmark dataset used */
  readonly benchmarkName: string;

  /** Performance vs benchmark */
  readonly vsBenchmark: ComparisonMetrics;

  /** Percentile ranking (0-100) */
  readonly percentileRanking?: number;
}

/**
 * Comparison metrics
 */
export interface ComparisonMetrics {
  /** Execution time comparison (-1 to 1) */
  readonly executionTime: number;

  /** Success rate comparison (-1 to 1) */
  readonly successRate: number;

  /** Quality comparison (-1 to 1) */
  readonly quality: number;

  /** Efficiency comparison (-1 to 1) */
  readonly efficiency: number;

  /** Overall comparison score (-1 to 1) */
  readonly overall: number;
}

/**
 * Progress update callback function
 */
export type ProgressUpdateCallback = (
  snapshot: ProgressSnapshot
) => void | Promise<void>;

/**
 * Progress display configuration
 *
 * Configuration for how progress should be displayed to users.
 */
export interface ProgressDisplayConfig {
  /** Display mode */
  readonly mode: 'silent' | 'basic' | 'detailed' | 'dashboard';

  /** Update frequency in milliseconds */
  readonly updateFrequencyMs: number;

  /** Whether to show stage details */
  readonly showStageDetails: boolean;

  /** Whether to show metrics */
  readonly showMetrics: boolean;

  /** Whether to show warnings */
  readonly showWarnings: boolean;

  /** Whether to show ETA */
  readonly showETA: boolean;

  /** Color scheme */
  readonly colorScheme?: 'auto' | 'always' | 'never';

  /** ASCII art and fancy displays */
  readonly fancyDisplay?: boolean;

  /** Maximum number of concurrent progress bars */
  readonly maxProgressBars?: number;
}
