/**
 * Review System Types
 *
 * Type definitions for the pipeline review system, including review results,
 * confidence analysis, review interfaces, and automated review capabilities.
 */

import type {
  PipelineStage,
  StageResult,
  PipelineExecutionContext,
} from './multi-stage.js';

/**
 * Review system result
 *
 * Comprehensive result of a review process, including decision,
 * timing information, reviewer feedback, and quality assessments.
 */
export interface ReviewResult {
  /** Primary review decision */
  readonly decision: ReviewDecision;

  /** Review completion timestamp */
  readonly reviewedAt: Date;

  /** Total time spent on review in milliseconds */
  readonly reviewTimeMs: number;

  /** Reviewer-provided comments and feedback */
  readonly comments?: string;

  /** Confidence score provided by reviewer (0-1) */
  readonly confidence?: number;

  /** Specific modifications suggested by reviewer */
  readonly modifications?: ReadonlyArray<ReviewModification>;

  /** Auto-review metadata if review was automated */
  readonly autoReview?: AutoReviewMetadata;

  /** Review session identifier */
  readonly reviewId: string;

  /** Reviewer identifier (user ID, system, etc.) */
  readonly reviewedBy?: string;

  /** Review quality metrics */
  readonly reviewQuality?: ReviewQualityMetrics;
}

/**
 * Review decision enumeration
 *
 * All possible outcomes of a review process, supporting
 * various approval workflows and review outcomes.
 */
export type ReviewDecision =
  | 'approved' // Output approved, continue pipeline
  | 'rejected' // Output rejected, retry stage
  | 'requires_modification' // Output needs changes, provide feedback
  | 'conditional_approval' // Approved with conditions or notes
  | 'timeout' // Review timed out, auto-decision applied
  | 'deferred' // Review deferred to later time
  | 'escalated'; // Review escalated to higher authority

/**
 * Review modification suggestion
 *
 * Specific suggestions for improving stage output,
 * with targeted feedback and confidence scoring.
 */
export interface ReviewModification {
  /** JSON path to the field requiring modification */
  readonly path: string;

  /** Current value at the specified path */
  readonly currentValue: unknown;

  /** Suggested replacement value */
  readonly suggestedValue: unknown;

  /** Human-readable reason for the modification */
  readonly reason: string;

  /** Confidence in the suggested modification (0-1) */
  readonly confidence: number;

  /** Modification priority level */
  readonly priority: 'low' | 'medium' | 'high' | 'critical';

  /** Whether this modification is required or optional */
  readonly required: boolean;
}

/**
 * Auto-review metadata
 *
 * Metadata for automated review processes, including
 * algorithm information, confidence metrics, and decision explanations.
 */
export interface AutoReviewMetadata {
  /** Auto-review algorithm used for decision */
  readonly algorithm: AutoReviewAlgorithm;

  /** Algorithm's confidence in the decision (0-1) */
  readonly algorithmConfidence: number;

  /** Features and data used for the decision */
  readonly features?: Record<string, unknown>;

  /** Human-readable explanation of the decision */
  readonly explanation?: string;

  /** Decision processing time in milliseconds */
  readonly processingTimeMs: number;

  /** Algorithm version or model identifier */
  readonly algorithmVersion?: string;
}

/**
 * Auto-review algorithm enumeration
 *
 * Available automated review algorithms with different
 * approaches to quality assessment and decision making.
 */
export type AutoReviewAlgorithm =
  | 'confidence_threshold' // Simple confidence score comparison
  | 'pattern_matching' // Rule-based pattern matching
  | 'ml_classifier' // Machine learning classification
  | 'rule_based' // Complex rule engine
  | 'ensemble' // Combination of multiple algorithms
  | 'heuristic' // Heuristic-based decision making
  | 'statistical' // Statistical analysis based
  | 'custom'; // User-defined algorithm

/**
 * Review quality metrics
 *
 * Metrics for assessing the quality and effectiveness
 * of the review process itself.
 */
export interface ReviewQualityMetrics {
  /** Review thoroughness score (0-1) */
  readonly thoroughness: number;

  /** Review consistency with similar cases (0-1) */
  readonly consistency?: number;

  /** Review speed vs quality trade-off score (0-1) */
  readonly efficiency: number;

  /** Accuracy of review decision vs later outcomes (0-1) */
  readonly accuracy?: number;

  /** Review confidence calibration score (0-1) */
  readonly calibration?: number;
}

/**
 * Review manager interface
 *
 * Core interface for managing review processes, including
 * review requests, status tracking, and lifecycle management.
 */
export interface ReviewManager {
  /** Request review for a stage result */
  requestReview(
    stage: PipelineStage,
    result: StageResult,
    context: PipelineExecutionContext
  ): Promise<ReviewResult>;

  /** Check if review is required for a stage result */
  isReviewRequired(
    stage: PipelineStage,
    result: StageResult,
    context: PipelineExecutionContext
  ): Promise<boolean>;

  /** Get all pending reviews */
  getPendingReviews(): Promise<ReadonlyArray<PendingReview>>;

  /** Get specific review by ID */
  getReview(reviewId: string): Promise<PendingReview | null>;

  /** Cancel a pending review */
  cancelReview(reviewId: string): Promise<void>;

  /** Submit review decision for pending review */
  submitReview(
    reviewId: string,
    decision: ReviewSubmission
  ): Promise<ReviewResult>;

  /** Get review statistics and metrics */
  getReviewMetrics(): Promise<ReviewMetrics>;

  /** Configure review settings */
  configureReview(config: ReviewConfiguration): Promise<void>;
}

/**
 * Pending review information
 *
 * Complete information about a review that is waiting
 * for completion, including context and status tracking.
 */
export interface PendingReview {
  /** Unique review identifier */
  readonly id: string;

  /** Stage being reviewed */
  readonly stage: PipelineStage;

  /** Stage result being reviewed */
  readonly result: StageResult;

  /** Pipeline execution context */
  readonly context: PipelineExecutionContext;

  /** Review creation timestamp */
  readonly createdAt: Date;

  /** Review expiration time (if applicable) */
  readonly expiresAt?: Date;

  /** Current review status */
  readonly status: ReviewStatus;

  /** Review priority level */
  readonly priority: ReviewPriority;

  /** Assigned reviewer (if applicable) */
  readonly assignedTo?: string;

  /** Review complexity estimate */
  readonly complexity?: ReviewComplexity;

  /** Related reviews (for batch processing) */
  readonly relatedReviews?: ReadonlyArray<string>;
}

/**
 * Review status enumeration
 *
 * Possible states of a review throughout its lifecycle.
 */
export type ReviewStatus =
  | 'pending' // Review created, waiting for assignment
  | 'assigned' // Review assigned to reviewer
  | 'in_progress' // Review actively being conducted
  | 'completed' // Review completed with decision
  | 'expired' // Review timed out without decision
  | 'cancelled' // Review cancelled before completion
  | 'deferred' // Review postponed to later time
  | 'escalated'; // Review escalated to different reviewer

/**
 * Review priority enumeration
 *
 * Priority levels for review scheduling and resource allocation.
 */
export type ReviewPriority =
  | 'low' // Non-urgent review, can be batched
  | 'normal' // Standard priority review
  | 'high' // High priority, expedited review needed
  | 'urgent' // Urgent review, immediate attention required
  | 'critical'; // Critical review, blocking pipeline execution

/**
 * Review complexity enumeration
 *
 * Estimated complexity levels for review resource planning.
 */
export type ReviewComplexity =
  | 'simple' // Quick review, minimal analysis needed
  | 'moderate' // Standard review complexity
  | 'complex' // Complex review requiring detailed analysis
  | 'expert'; // Requires specialized expertise

/**
 * Review submission
 *
 * Data structure for submitting a review decision,
 * including all necessary feedback and modifications.
 */
export interface ReviewSubmission {
  /** Primary review decision */
  readonly decision: ReviewDecision;

  /** Optional comments from reviewer */
  readonly comments?: string;

  /** Reviewer confidence in decision (0-1) */
  readonly confidence?: number;

  /** Specific modifications suggested */
  readonly modifications?: ReadonlyArray<ReviewModification>;

  /** Time spent on review in milliseconds */
  readonly reviewTimeMs?: number;

  /** Additional metadata from reviewer */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Review metrics and statistics
 *
 * Comprehensive metrics for monitoring and optimizing
 * the review system performance and effectiveness.
 */
export interface ReviewMetrics {
  /** Total number of reviews processed */
  readonly totalReviews: number;

  /** Number of currently pending reviews */
  readonly pendingReviews: number;

  /** Average review time in milliseconds */
  readonly averageReviewTimeMs: number;

  /** Review decision distribution */
  readonly decisionDistribution: Record<ReviewDecision, number>;

  /** Review accuracy rate (when measurable) */
  readonly accuracyRate?: number;

  /** Review throughput (reviews per hour) */
  readonly throughputPerHour: number;

  /** Auto-review vs manual review ratio */
  readonly autoReviewRatio: number;

  /** Review quality metrics aggregated */
  readonly qualityMetrics: AggregatedQualityMetrics;

  /** Time period for these metrics */
  readonly timeWindow: {
    readonly from: Date;
    readonly to: Date;
  };
}

/**
 * Aggregated quality metrics
 *
 * Quality metrics aggregated across multiple reviews
 * for system-wide quality assessment.
 */
export interface AggregatedQualityMetrics {
  /** Average thoroughness score */
  readonly averageThoroughness: number;

  /** Average consistency score */
  readonly averageConsistency?: number;

  /** Average efficiency score */
  readonly averageEfficiency: number;

  /** Overall review system health score (0-1) */
  readonly systemHealthScore: number;

  /** Quality trends over time */
  readonly trends?: QualityTrends;
}

/**
 * Quality trends
 *
 * Trend information for tracking review quality over time.
 */
export interface QualityTrends {
  /** Thoroughness trend (improving/declining/stable) */
  readonly thoroughnessTrend: TrendDirection;

  /** Efficiency trend */
  readonly efficiencyTrend: TrendDirection;

  /** Overall quality trend */
  readonly overallTrend: TrendDirection;

  /** Trend calculation period */
  readonly trendPeriodDays: number;
}

/**
 * Trend direction enumeration
 */
export type TrendDirection = 'improving' | 'declining' | 'stable' | 'volatile';

/**
 * Review configuration
 *
 * Configuration settings for customizing review system behavior
 * and policies across different pipeline contexts.
 */
export interface ReviewConfiguration {
  /** Global review settings */
  readonly global?: GlobalReviewSettings;

  /** Stage-specific review overrides */
  readonly stageOverrides?: Record<string, StageReviewOverrides>;

  /** Auto-review configuration */
  readonly autoReview?: AutoReviewConfiguration;

  /** Review interface settings */
  readonly interface?: ReviewInterfaceSettings;

  /** Performance and scaling settings */
  readonly performance?: ReviewPerformanceSettings;
}

/**
 * Global review settings
 *
 * System-wide review configuration affecting all reviews.
 */
export interface GlobalReviewSettings {
  /** Default review timeout in milliseconds */
  readonly defaultTimeoutMs?: number;

  /** Default confidence threshold for auto-approval */
  readonly defaultConfidenceThreshold?: number;

  /** Default review priority */
  readonly defaultPriority?: ReviewPriority;

  /** Whether to enable batch review processing */
  readonly enableBatchReview?: boolean;

  /** Maximum batch size for review processing */
  readonly maxBatchSize?: number;

  /** Review retention period in days */
  readonly retentionPeriodDays?: number;
}

/**
 * Stage-specific review overrides
 *
 * Overrides for specific stages that need different review policies.
 */
export interface StageReviewOverrides {
  /** Override confidence threshold */
  readonly confidenceThreshold?: number;

  /** Override review timeout */
  readonly timeoutMs?: number;

  /** Override priority */
  readonly priority?: ReviewPriority;

  /** Override complexity estimate */
  readonly complexity?: ReviewComplexity;

  /** Custom review criteria */
  readonly customCriteria?: ReadonlyArray<ReviewCriterion>;
}

/**
 * Review criterion
 *
 * Custom criteria for evaluating review requirements and quality.
 */
export interface ReviewCriterion {
  /** Criterion identifier */
  readonly id: string;

  /** Human-readable criterion name */
  readonly name: string;

  /** Criterion evaluation function */
  readonly evaluate: (
    stage: PipelineStage,
    result: StageResult,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;

  /** Criterion weight in overall assessment (0-1) */
  readonly weight?: number;

  /** Whether failing this criterion blocks approval */
  readonly blocking?: boolean;
}

/**
 * Auto-review configuration
 *
 * Configuration for automated review algorithms and policies.
 */
export interface AutoReviewConfiguration {
  /** Whether auto-review is enabled */
  readonly enabled?: boolean;

  /** Preferred auto-review algorithm */
  readonly algorithm?: AutoReviewAlgorithm;

  /** Auto-review confidence threshold */
  readonly confidenceThreshold?: number;

  /** Fallback to manual review if auto-review confidence is low */
  readonly fallbackToManual?: boolean;

  /** Learning and adaptation settings */
  readonly learning?: AutoReviewLearningSettings;
}

/**
 * Auto-review learning settings
 *
 * Configuration for adaptive and learning auto-review systems.
 */
export interface AutoReviewLearningSettings {
  /** Whether to enable learning from manual review feedback */
  readonly enableLearning?: boolean;

  /** Learning rate for adaptive algorithms (0-1) */
  readonly learningRate?: number;

  /** Minimum samples required before enabling auto-review */
  readonly minimumSamples?: number;

  /** Retraining frequency in days */
  readonly retrainingFrequencyDays?: number;
}

/**
 * Review interface settings
 *
 * Configuration for review user interfaces and interaction patterns.
 */
export interface ReviewInterfaceSettings {
  /** CLI interface configuration */
  readonly cli?: CLIReviewSettings;

  /** Web interface configuration */
  readonly web?: WebReviewSettings;

  /** API interface configuration */
  readonly api?: APIReviewSettings;
}

/**
 * CLI review interface settings
 */
export interface CLIReviewSettings {
  /** Use colored output */
  readonly colorized?: boolean;

  /** Show detailed information by default */
  readonly showDetails?: boolean;

  /** Auto-expand sections */
  readonly autoExpand?: ReadonlyArray<
    'input' | 'output' | 'metadata' | 'errors' | 'history' | 'related'
  >;

  /** Enable interactive mode */
  readonly interactive?: boolean;

  /** Keyboard shortcuts */
  readonly shortcuts?: Record<string, string>;

  /** Maximum lines to display for large outputs */
  readonly maxDisplayLines?: number;

  /** Enable pagination for long content */
  readonly enablePagination?: boolean;
}

/**
 * Web review interface settings
 */
export interface WebReviewSettings {
  /** Web interface port */
  readonly port?: number;

  /** Enable real-time updates */
  readonly realTimeUpdates?: boolean;

  /** Theme configuration */
  readonly theme?: 'light' | 'dark' | 'auto';

  /** Enable collaborative review */
  readonly collaborative?: boolean;
}

/**
 * API review interface settings
 */
export interface APIReviewSettings {
  /** API authentication requirements */
  readonly requireAuth?: boolean;

  /** Rate limiting settings */
  readonly rateLimit?: {
    readonly requestsPerMinute?: number;
    readonly burstLimit?: number;
  };

  /** Webhook configuration for notifications */
  readonly webhooks?: ReadonlyArray<WebhookConfiguration>;
}

/**
 * Webhook configuration
 */
export interface WebhookConfiguration {
  /** Webhook URL */
  readonly url: string;

  /** Events to trigger webhook */
  readonly events: ReadonlyArray<
    | 'review_requested'
    | 'review_completed'
    | 'review_expired'
    | 'review_escalated'
  >;

  /** Authentication headers */
  readonly headers?: Record<string, string>;

  /** Retry configuration */
  readonly retries?: number;
}

/**
 * Review performance settings
 *
 * Settings for optimizing review system performance and scalability.
 */
export interface ReviewPerformanceSettings {
  /** Maximum concurrent reviews */
  readonly maxConcurrentReviews?: number;

  /** Review processing queue size */
  readonly queueSize?: number;

  /** Cache settings for review data */
  readonly caching?: ReviewCacheSettings;

  /** Performance monitoring settings */
  readonly monitoring?: ReviewMonitoringSettings;
}

/**
 * Review cache settings
 */
export interface ReviewCacheSettings {
  /** Enable caching of review data */
  readonly enabled?: boolean;

  /** Cache TTL in milliseconds */
  readonly ttlMs?: number;

  /** Maximum cache size in MB */
  readonly maxSizeMB?: number;

  /** Cache eviction policy */
  readonly evictionPolicy?: 'lru' | 'lfu' | 'ttl';
}

/**
 * Review monitoring settings
 */
export interface ReviewMonitoringSettings {
  /** Enable performance monitoring */
  readonly enabled?: boolean;

  /** Metrics collection interval in milliseconds */
  readonly metricsIntervalMs?: number;

  /** Performance alert thresholds */
  readonly alertThresholds?: {
    readonly averageReviewTimeMs?: number;
    readonly queueDepth?: number;
    readonly errorRate?: number;
  };
}
