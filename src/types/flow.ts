/**
 * Execution Flow Types
 *
 * Type definitions for pipeline execution flow control, including sequential,
 * parallel, conditional, and DAG (Directed Acyclic Graph) execution patterns.
 */

import type { PipelineExecutionContext, StageResult } from './multi-stage.js';

/**
 * Flow controller interface
 *
 * Core interface for managing different pipeline execution flows
 * and coordinating stage execution order and dependencies.
 */
export interface FlowController {
  /** Initialize the flow controller with pipeline context */
  initialize(context: PipelineExecutionContext): Promise<void>;

  /** Execute the pipeline according to the flow configuration */
  execute(): Promise<FlowExecutionResult>;

  /** Get the next stages ready for execution */
  getNextStages(): Promise<ReadonlyArray<string>>;

  /** Mark a stage as completed and update flow state */
  markStageCompleted(stageId: string, result: StageResult): Promise<void>;

  /** Mark a stage as failed and handle flow implications */
  markStageFailed(stageId: string, error: unknown): Promise<void>;

  /** Check if pipeline execution is complete */
  isComplete(): Promise<boolean>;

  /** Check if pipeline execution can continue */
  canContinue(): Promise<boolean>;

  /** Get current flow state */
  getFlowState(): Promise<FlowState>;

  /** Cleanup and finalize flow execution */
  finalize(): Promise<void>;
}

/**
 * Flow execution result
 *
 * Result of executing a complete pipeline flow with all stage results
 * and execution metadata.
 */
export interface FlowExecutionResult {
  /** Whether the flow execution was successful */
  readonly success: boolean;

  /** Results from all executed stages */
  readonly stageResults: Record<string, StageResult>;

  /** Stages that were skipped */
  readonly skippedStages: ReadonlyArray<string>;

  /** Flow execution metadata */
  readonly metadata: FlowExecutionMetadata;

  /** Final output from the pipeline */
  readonly finalOutput?: unknown;

  /** Any errors encountered during flow execution */
  readonly errors?: ReadonlyArray<FlowError>;
}

/**
 * Flow execution metadata
 *
 * Metadata about the flow execution process including timing,
 * parallelization efficiency, and execution patterns.
 */
export interface FlowExecutionMetadata {
  /** Flow execution start time */
  readonly startTime: Date;

  /** Flow execution end time */
  readonly endTime: Date;

  /** Total execution time in milliseconds */
  readonly executionTimeMs: number;

  /** Execution mode used */
  readonly executionMode: FlowExecutionMode;

  /** Maximum concurrency achieved */
  readonly maxConcurrency: number;

  /** Average concurrency during execution */
  readonly avgConcurrency: number;

  /** Parallelization efficiency (0-1) */
  readonly parallelizationEfficiency?: number;

  /** Dependency resolution time */
  readonly dependencyResolutionTimeMs: number;

  /** Stage execution order */
  readonly executionOrder: ReadonlyArray<StageExecutionOrder>;

  /** Critical path analysis */
  readonly criticalPath?: CriticalPathAnalysis;
}

/**
 * Flow execution mode enumeration
 */
export type FlowExecutionMode =
  | 'sequential' // Stages executed one after another
  | 'parallel' // Stages executed simultaneously where possible
  | 'conditional' // Execution based on runtime conditions
  | 'dag' // Dependency-driven execution
  | 'mixed'; // Combination of multiple modes

/**
 * Stage execution order record
 */
export interface StageExecutionOrder {
  /** Stage identifier */
  readonly stageId: string;

  /** Stage name */
  readonly stageName: string;

  /** Execution start time */
  readonly startTime: Date;

  /** Execution end time */
  readonly endTime?: Date;

  /** Parallel group this stage was part of (if any) */
  readonly parallelGroup?: number;

  /** Dependencies that were resolved before this stage */
  readonly resolvedDependencies: ReadonlyArray<string>;
}

/**
 * Critical path analysis
 *
 * Analysis of the critical path through the pipeline execution
 * for optimization and performance understanding.
 */
export interface CriticalPathAnalysis {
  /** Stages on the critical path */
  readonly criticalPathStages: ReadonlyArray<string>;

  /** Total critical path time in milliseconds */
  readonly criticalPathTimeMs: number;

  /** Potential time savings from optimization */
  readonly potentialTimeSavingsMs: number;

  /** Bottleneck stages that extend the critical path */
  readonly bottleneckStages: ReadonlyArray<BottleneckStage>;

  /** Parallelization opportunities */
  readonly parallelizationOpportunities: ReadonlyArray<ParallelizationOpportunity>;
}

/**
 * Bottleneck stage analysis
 */
export interface BottleneckStage {
  /** Stage identifier */
  readonly stageId: string;

  /** Time this stage adds to critical path */
  readonly criticalPathImpactMs: number;

  /** Reason this stage is a bottleneck */
  readonly bottleneckReason: BottleneckReason;

  /** Potential optimizations */
  readonly optimizationSuggestions: ReadonlyArray<string>;
}

/**
 * Bottleneck reason enumeration
 */
export type BottleneckReason =
  | 'long_execution' // Stage takes unusually long to execute
  | 'many_dependencies' // Stage has many dependencies
  | 'blocking_others' // Stage blocks many other stages
  | 'high_failure_rate' // Stage frequently fails and retries
  | 'resource_contention' // Stage competes for limited resources
  | 'external_dependency'; // Stage depends on external systems

/**
 * Parallelization opportunity
 */
export interface ParallelizationOpportunity {
  /** Stages that could be parallelized */
  readonly stageIds: ReadonlyArray<string>;

  /** Potential time savings in milliseconds */
  readonly potentialTimeSavingsMs: number;

  /** Current execution mode for these stages */
  readonly currentMode: 'sequential' | 'partially_parallel';

  /** Suggested execution mode */
  readonly suggestedMode: 'parallel' | 'batch_parallel';

  /** Prerequisites for parallelization */
  readonly prerequisites: ReadonlyArray<string>;
}

/**
 * Flow state
 *
 * Current state of flow execution including stage statuses,
 * dependencies, and execution progress.
 */
export interface FlowState {
  /** Current flow phase */
  readonly phase: FlowPhase;

  /** Stages that are ready to execute */
  readonly readyStages: ReadonlyArray<string>;

  /** Stages currently executing */
  readonly executingStages: ReadonlyArray<string>;

  /** Completed stages */
  readonly completedStages: ReadonlyArray<string>;

  /** Failed stages */
  readonly failedStages: ReadonlyArray<string>;

  /** Skipped stages */
  readonly skippedStages: ReadonlyArray<string>;

  /** Stages waiting for dependencies */
  readonly waitingStages: ReadonlyArray<string>;

  /** Current dependency graph state */
  readonly dependencyState: DependencyState;

  /** Active parallel groups */
  readonly activeParallelGroups: ReadonlyArray<ParallelGroupState>;

  /** Current execution statistics */
  readonly executionStats: FlowExecutionStats;
}

/**
 * Flow execution phase
 */
export type FlowPhase =
  | 'initializing' // Flow controller initializing
  | 'dependency_analysis' // Analyzing and building dependency graph
  | 'executing' // Actively executing stages
  | 'waiting' // Waiting for stages to complete
  | 'error_handling' // Handling stage failures
  | 'finalizing' // Cleaning up and finalizing
  | 'completed' // Flow execution completed
  | 'failed'; // Flow execution failed

/**
 * Dependency state
 *
 * Current state of the dependency graph and resolution process.
 */
export interface DependencyState {
  /** Total number of dependency relationships */
  readonly totalDependencies: number;

  /** Number of resolved dependencies */
  readonly resolvedDependencies: number;

  /** Number of unresolved dependencies */
  readonly unresolvedDependencies: number;

  /** Stages with unmet dependencies */
  readonly blockedStages: Record<string, ReadonlyArray<string>>;

  /** Circular dependency detection results */
  readonly circularDependencies?: ReadonlyArray<CircularDependency>;

  /** Dependency resolution order */
  readonly resolutionOrder: ReadonlyArray<string>;

  /** Orphaned stages (no dependencies, no dependents) */
  readonly orphanedStages: ReadonlyArray<string>;
}

/**
 * Circular dependency information
 */
export interface CircularDependency {
  /** Stages involved in the circular dependency */
  readonly involvedStages: ReadonlyArray<string>;

  /** Dependency chain that forms the cycle */
  readonly dependencyChain: ReadonlyArray<DependencyLink>;

  /** Suggested resolution strategies */
  readonly resolutionStrategies: ReadonlyArray<string>;
}

/**
 * Dependency link
 */
export interface DependencyLink {
  /** Source stage */
  readonly from: string;

  /** Target stage */
  readonly to: string;

  /** Dependency type */
  readonly type: DependencyType;

  /** Whether this dependency is optional */
  readonly optional?: boolean;
}

/**
 * Dependency type enumeration
 */
export type DependencyType =
  | 'data_dependency' // Stage needs output from another stage
  | 'order_dependency' // Stage must execute after another stage
  | 'resource_dependency' // Stage needs resources used by another stage
  | 'condition_dependency' // Stage execution depends on another stage's result
  | 'session_dependency' // Stage needs session context from another stage
  | 'custom_dependency'; // Custom dependency logic

/**
 * Parallel group state
 */
export interface ParallelGroupState {
  /** Parallel group identifier */
  readonly groupId: number;

  /** Stages in this parallel group */
  readonly stages: ReadonlyArray<string>;

  /** Group execution status */
  readonly status: ParallelGroupStatus;

  /** Number of completed stages in group */
  readonly completedCount: number;

  /** Number of failed stages in group */
  readonly failedCount: number;

  /** Group start time */
  readonly startTime?: Date;

  /** Group end time */
  readonly endTime?: Date;

  /** Maximum concurrency for this group */
  readonly maxConcurrency: number;

  /** Current concurrency */
  readonly currentConcurrency: number;
}

/**
 * Parallel group status enumeration
 */
export type ParallelGroupStatus =
  | 'pending' // Group not yet started
  | 'executing' // Group currently executing
  | 'completed' // All stages in group completed successfully
  | 'failed' // One or more stages in group failed
  | 'partial'; // Some stages completed, others failed

/**
 * Flow execution statistics
 */
export interface FlowExecutionStats {
  /** Total stages in flow */
  readonly totalStages: number;

  /** Currently executing stages */
  readonly currentlyExecuting: number;

  /** Completed stages */
  readonly completedStages: number;

  /** Failed stages */
  readonly failedStages: number;

  /** Skipped stages */
  readonly skippedStages: number;

  /** Average stage execution time */
  readonly avgStageExecutionTimeMs?: number;

  /** Current flow efficiency (0-1) */
  readonly efficiency: number;

  /** Estimated completion time */
  readonly estimatedCompletionTime?: Date;

  /** Flow execution health score (0-1) */
  readonly healthScore: number;
}

/**
 * Flow error
 *
 * Errors that occur during flow execution, distinct from stage execution errors.
 */
export interface FlowError {
  /** Error type */
  readonly type: FlowErrorType;

  /** Error code */
  readonly code: string;

  /** Error message */
  readonly message: string;

  /** Error timestamp */
  readonly timestamp: Date;

  /** Stages affected by this error */
  readonly affectedStages?: ReadonlyArray<string>;

  /** Whether the error is recoverable */
  readonly recoverable: boolean;

  /** Error context */
  readonly context?: Record<string, unknown>;

  /** Original error if this wraps another error */
  readonly originalError?: unknown;
}

/**
 * Flow error type enumeration
 */
export type FlowErrorType =
  | 'dependency_error' // Error in dependency resolution
  | 'concurrency_error' // Error in parallel execution management
  | 'condition_error' // Error in conditional branch evaluation
  | 'resource_error' // Resource management error
  | 'configuration_error' // Flow configuration error
  | 'timeout_error' // Flow execution timeout
  | 'coordination_error' // Error coordinating stage execution
  | 'state_error'; // Flow state management error

/**
 * Sequential flow controller
 *
 * Flow controller for sequential stage execution.
 */
export interface SequentialFlowController extends FlowController {
  /** Get the currently executing stage */
  getCurrentStage(): Promise<string | null>;

  /** Get remaining stages in execution order */
  getRemainingStages(): Promise<ReadonlyArray<string>>;

  /** Skip to specific stage (if conditions allow) */
  skipToStage(stageId: string): Promise<boolean>;
}

/**
 * Parallel flow controller
 *
 * Flow controller for parallel stage execution with concurrency management.
 */
export interface ParallelFlowController extends FlowController {
  /** Get current concurrency level */
  getCurrentConcurrency(): Promise<number>;

  /** Get maximum allowed concurrency */
  getMaxConcurrency(): Promise<number>;

  /** Update concurrency limit */
  setMaxConcurrency(limit: number): Promise<void>;

  /** Get parallel group status */
  getParallelGroupStatus(groupId: number): Promise<ParallelGroupState>;

  /** Force wait for specific parallel group completion */
  waitForParallelGroup(groupId: number): Promise<void>;
}

/**
 * Conditional flow controller
 *
 * Flow controller for condition-based execution with branch management.
 */
export interface ConditionalFlowController extends FlowController {
  /** Evaluate condition for a branch */
  evaluateCondition(
    condition: ConditionalBranch['condition'],
    context: PipelineExecutionContext
  ): Promise<boolean>;

  /** Get active branches */
  getActiveBranches(): Promise<ReadonlyArray<ActiveBranch>>;

  /** Get branch evaluation history */
  getBranchHistory(): Promise<ReadonlyArray<BranchEvaluation>>;

  /** Force branch selection (for testing/debugging) */
  forceBranch(branchName: string, direction: 'true' | 'false'): Promise<void>;
}

/**
 * Active branch information
 */
export interface ActiveBranch {
  /** Branch configuration */
  readonly branch: ConditionalBranch;

  /** Branch evaluation result */
  readonly evaluationResult: boolean;

  /** Stages selected for execution */
  readonly selectedStages: ReadonlyArray<string>;

  /** Branch evaluation timestamp */
  readonly evaluatedAt: Date;

  /** Branch execution status */
  readonly status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * Branch evaluation record
 */
export interface BranchEvaluation {
  /** Branch name */
  readonly branchName?: string;

  /** Evaluation result */
  readonly result: boolean;

  /** Evaluation timestamp */
  readonly timestamp: Date;

  /** Evaluation context */
  readonly context: Record<string, unknown>;

  /** Evaluation duration */
  readonly durationMs: number;
}

/**
 * DAG flow controller
 *
 * Flow controller for dependency-driven execution with graph analysis.
 */
export interface DAGFlowController extends FlowController {
  /** Get dependency graph visualization */
  getDependencyGraph(): Promise<DependencyGraph>;

  /** Get topological sort of stages */
  getTopologicalOrder(): Promise<ReadonlyArray<string>>;

  /** Find critical path through the DAG */
  findCriticalPath(): Promise<ReadonlyArray<string>>;

  /** Get stages with no dependencies (leaf nodes) */
  getLeafNodes(): Promise<ReadonlyArray<string>>;

  /** Get stages with no dependents (root nodes) */
  getRootNodes(): Promise<ReadonlyArray<string>>;

  /** Validate DAG for cycles and inconsistencies */
  validateDAG(): Promise<DAGValidationResult>;

  /** Get optimization suggestions for the DAG */
  getOptimizationSuggestions(): Promise<ReadonlyArray<DAGOptimization>>;
}

/**
 * Dependency graph representation
 */
export interface DependencyGraph {
  /** Graph nodes (stages) */
  readonly nodes: Record<string, DependencyGraphNode>;

  /** Graph edges (dependencies) */
  readonly edges: ReadonlyArray<DependencyGraphEdge>;

  /** Graph metadata */
  readonly metadata: DependencyGraphMetadata;
}

/**
 * Dependency graph node
 */
export interface DependencyGraphNode {
  /** Stage identifier */
  readonly stageId: string;

  /** Stage name */
  readonly stageName: string;

  /** Node dependencies (incoming edges) */
  readonly dependencies: ReadonlyArray<string>;

  /** Node dependents (outgoing edges) */
  readonly dependents: ReadonlyArray<string>;

  /** Node execution status */
  readonly status:
    | 'pending'
    | 'ready'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'skipped';

  /** Node metadata */
  readonly metadata: Record<string, unknown>;
}

/**
 * Dependency graph edge
 */
export interface DependencyGraphEdge {
  /** Source node */
  readonly from: string;

  /** Target node */
  readonly to: string;

  /** Dependency type */
  readonly type: DependencyType;

  /** Edge weight (for optimization) */
  readonly weight?: number;

  /** Whether this is a critical edge */
  readonly critical?: boolean;

  /** Edge metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Dependency graph metadata
 */
export interface DependencyGraphMetadata {
  /** Total number of nodes */
  readonly nodeCount: number;

  /** Total number of edges */
  readonly edgeCount: number;

  /** Graph complexity score */
  readonly complexity: number;

  /** Maximum dependency depth */
  readonly maxDepth: number;

  /** Graph diameter */
  readonly diameter?: number;

  /** Graph density (0-1) */
  readonly density: number;
}

/**
 * DAG validation result
 */
export interface DAGValidationResult {
  /** Whether the DAG is valid */
  readonly valid: boolean;

  /** Validation errors found */
  readonly errors: ReadonlyArray<DAGValidationError>;

  /** Validation warnings */
  readonly warnings: ReadonlyArray<DAGValidationWarning>;

  /** Suggested fixes */
  readonly suggestedFixes: ReadonlyArray<string>;
}

/**
 * DAG validation error
 */
export interface DAGValidationError {
  /** Error type */
  readonly type:
    | 'circular_dependency'
    | 'missing_stage'
    | 'invalid_dependency'
    | 'unreachable_stage';

  /** Error message */
  readonly message: string;

  /** Affected stages */
  readonly affectedStages: ReadonlyArray<string>;

  /** Severity */
  readonly severity: 'error' | 'warning';
}

/**
 * DAG validation warning
 */
export interface DAGValidationWarning {
  /** Warning type */
  readonly type:
    | 'orphaned_stage'
    | 'complex_dependency'
    | 'performance_concern'
    | 'redundant_dependency';

  /** Warning message */
  readonly message: string;

  /** Affected stages */
  readonly affectedStages: ReadonlyArray<string>;

  /** Suggested action */
  readonly suggestedAction?: string;
}

/**
 * DAG optimization suggestion
 */
export interface DAGOptimization {
  /** Optimization type */
  readonly type:
    | 'parallelization'
    | 'dependency_reduction'
    | 'critical_path_shortening'
    | 'resource_optimization';

  /** Potential improvement description */
  readonly description: string;

  /** Estimated benefit (0-1) */
  readonly benefit: number;

  /** Implementation complexity (0-1) */
  readonly complexity: number;

  /** Affected stages */
  readonly affectedStages: ReadonlyArray<string>;

  /** Implementation steps */
  readonly implementationSteps: ReadonlyArray<string>;
}

/**
 * Conditional branch (re-exported from multi-stage.ts for convenience)
 */
export interface ConditionalBranch {
  readonly condition: (
    input: unknown,
    context: PipelineExecutionContext
  ) => boolean | Promise<boolean>;
  readonly ifTrue: ReadonlyArray<string>;
  readonly ifFalse?: ReadonlyArray<string>;
  readonly name?: string;
  readonly description?: string;
}
