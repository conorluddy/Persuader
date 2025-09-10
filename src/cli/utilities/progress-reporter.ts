/**
 * Progress Reporting Utilities
 *
 * Handles progress tracking, user feedback, and visual indicators for CLI commands.
 * Provides consistent progress reporting with spinners, counters, and status messages.
 *
 * @module cli/utilities/progress-reporter
 */

import chalk from 'chalk';
import { consola } from 'consola';
import ora, { type Ora } from 'ora';

/**
 * Progress step configuration
 */
export interface ProgressStep {
  /** Step identifier */
  readonly id: string;
  /** Display name for the step */
  readonly name: string;
  /** Progress message while running */
  readonly runningMessage: string;
  /** Success message when completed */
  readonly successMessage: string;
  /** Estimated duration in milliseconds */
  readonly estimatedDuration?: number;
}

/**
 * Progress tracking state
 */
export interface ProgressState {
  /** Current step being executed */
  readonly currentStep: ProgressStep | null;
  /** Completed steps */
  readonly completedSteps: readonly ProgressStep[];
  /** Total steps in the process */
  readonly totalSteps: number;
  /** Start time of the process */
  readonly startTime: number;
  /** Current spinner instance */
  readonly spinner: Ora | null;
}

/**
 * Execution metrics for reporting
 */
export interface ExecutionMetrics {
  /** Total execution time */
  readonly totalTimeMs: number;
  /** LLM processing time */
  readonly llmTimeMs: number;
  /** Number of attempts made */
  readonly attempts: number;
  /** Provider used */
  readonly provider: string;
  /** Model used */
  readonly model?: string;
  /** Session ID if used */
  readonly sessionId?: string;
  /** Token usage statistics */
  readonly tokenUsage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly estimatedCost?: number;
  };
}

/**
 * Progress reporter for multi-step CLI operations
 *
 * Manages progress tracking through multiple steps of a CLI operation with
 * visual feedback, time estimates, and completion reporting.
 */
export class ProgressReporter {
  private state: ProgressState;

  constructor(steps: readonly ProgressStep[]) {
    this.state = {
      currentStep: null,
      completedSteps: [],
      totalSteps: steps.length,
      startTime: Date.now(),
      spinner: null,
    };
  }

  /**
   * Start a progress step with spinner
   *
   * @param stepId - Identifier of the step to start
   * @returns Promise that resolves when step is ready
   */
  async startStep(stepId: string): Promise<void> {
    // Stop any existing spinner first
    if (this.state.spinner?.isSpinning) {
      this.state.spinner.stop();
    }

    // Find the step by ID
    const steps = createDefaultProgressSteps();
    const step = steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Unknown progress step: ${stepId}`);
    }

    // Create and start new spinner
    const spinner = ora(step.runningMessage).start();

    // Update state
    this.state = {
      ...this.state,
      currentStep: step,
      spinner,
    };
  }

  /**
   * Complete current step with success
   *
   * @param customMessage - Optional custom success message
   */
  completeStep(customMessage?: string): void {
    if (!this.state.currentStep || !this.state.spinner) {
      return; // No active step to complete
    }

    const message = customMessage || this.state.currentStep.successMessage;
    this.state.spinner.succeed(chalk.green(message));

    // Update state
    this.state = {
      ...this.state,
      completedSteps: [...this.state.completedSteps, this.state.currentStep],
      currentStep: null,
      spinner: null,
    };
  }

  /**
   * Fail current step with error
   *
   * @param error - Error that caused the failure
   * @param customMessage - Optional custom error message
   */
  failStep(_error: Error, customMessage?: string): void {
    if (!this.state.spinner) {
      return; // No active step to fail
    }

    const message =
      customMessage || `${this.state.currentStep?.name || 'Operation'} failed`;
    this.state.spinner.fail(chalk.red(message));

    // Update state
    this.state = {
      ...this.state,
      currentStep: null,
      spinner: null,
    };
  }

  /**
   * Stop progress reporting and clean up
   */
  stop(): void {
    if (this.state.spinner?.isSpinning) {
      this.state.spinner.stop();
    }

    // Update state
    this.state = {
      ...this.state,
      currentStep: null,
      spinner: null,
    };
  }

  /**
   * Temporarily stop spinner for verbose output
   * Returns true if spinner was stopped, false if no spinner was active
   */
  pauseSpinner(): boolean {
    if (this.state.spinner?.isSpinning) {
      this.state.spinner.stop();
      return true;
    }
    return false;
  }

  /**
   * Get current progress state
   */
  getState(): ProgressState {
    return this.state;
  }
}

/**
 * Report execution metrics and summary
 *
 * Displays comprehensive execution summary including timing, token usage,
 * and performance metrics in a user-friendly format.
 *
 * @param metrics - Execution metrics to report
 * @param verbose - Whether to show detailed metrics
 */
export function reportExecutionMetrics(
  metrics: ExecutionMetrics,
  verbose: boolean = false
): void {
  // Always show success message
  consola.success(chalk.green('🎉 Persuader pipeline completed successfully!'));

  if (verbose) {
    // Show detailed execution summary
    consola.info(chalk.blue('📊 Execution Summary:'));
    consola.info(chalk.blue(`  • Total time: ${metrics.totalTimeMs}ms`));
    consola.info(chalk.blue(`  • LLM time: ${metrics.llmTimeMs}ms`));
    consola.info(chalk.blue(`  • Attempts: ${metrics.attempts}`));
    consola.info(chalk.blue(`  • Provider: ${metrics.provider}`));
    consola.info(chalk.blue(`  • Model: ${metrics.model || 'default'}`));
    consola.info(chalk.blue(`  • Session: ${metrics.sessionId || 'none'}`));

    // Show token usage if available
    if (metrics.tokenUsage) {
      const tokenLines = formatTokenUsage(metrics.tokenUsage);
      for (const line of tokenLines) {
        consola.info(chalk.blue(`  • ${line}`));
      }
    }
  } else {
    // Show concise summary
    consola.success(
      chalk.green(
        `✨ Completed in ${metrics.totalTimeMs}ms with ${metrics.attempts} attempt(s)`
      )
    );
  }
}

/**
 * Report dry-run configuration summary
 *
 * Displays what would be processed in dry-run mode without executing
 * the actual pipeline. Shows configuration, input files, and estimated metrics.
 *
 * @param config - Configuration that would be used
 * @param inputStats - Statistics about input files
 * @param outputPath - Where results would be saved
 */
export function reportDryRunSummary(
  config: {
    readonly schemaName: string;
    readonly schemaPath: string;
    readonly model?: string;
    readonly retries: number;
    readonly sessionId?: string;
  },
  inputStats: {
    readonly fileCount: number;
    readonly itemCount: number;
  },
  outputPath: string
): void {
  consola.success(chalk.green('✅ Dry run completed successfully'));
  consola.info(chalk.blue('Would process:'));
  consola.info(
    chalk.blue(`  • Schema: ${config.schemaPath} (${config.schemaName})`)
  );
  consola.info(chalk.blue(`  • Input files: ${inputStats.fileCount}`));
  consola.info(chalk.blue(`  • Input items: ${inputStats.itemCount}`));
  consola.info(chalk.blue(`  • Output: ${outputPath}`));
  consola.info(chalk.blue(`  • Model: ${config.model || 'default'}`));
  consola.info(chalk.blue(`  • Retries: ${config.retries}`));
  if (config.sessionId) {
    consola.info(chalk.blue(`  • Session: ${config.sessionId}`));
  }
}

/**
 * Create default progress steps for pipeline execution
 *
 * Defines the standard progress steps used by the run command including
 * schema loading, input processing, validation, and execution phases.
 *
 * @returns Array of default progress steps
 */
export function createDefaultProgressSteps(): readonly ProgressStep[] {
  return [
    {
      id: 'schema-loading',
      name: 'Schema Loading',
      runningMessage: 'Loading schema...',
      successMessage: 'Schema loaded successfully',
      estimatedDuration: 2000,
    },
    {
      id: 'input-processing',
      name: 'Input Processing',
      runningMessage: 'Processing input files...',
      successMessage: 'Input files processed',
      estimatedDuration: 3000,
    },
    {
      id: 'config-validation',
      name: 'Configuration Validation',
      runningMessage: 'Validating configuration...',
      successMessage: 'Configuration validated',
      estimatedDuration: 1000,
    },
    {
      id: 'provider-init',
      name: 'Provider Initialization',
      runningMessage: 'Initializing LLM provider...',
      successMessage: 'LLM provider ready',
      estimatedDuration: 2000,
    },
    {
      id: 'pipeline-execution',
      name: 'Pipeline Execution',
      runningMessage: 'Running LLM pipeline...',
      successMessage: 'Pipeline completed successfully',
      estimatedDuration: 10000,
    },
    {
      id: 'result-saving',
      name: 'Result Saving',
      runningMessage: 'Saving results...',
      successMessage: 'Results saved successfully',
      estimatedDuration: 1000,
    },
  ] as const;
}

/**
 * Format elapsed time for display
 *
 * Converts milliseconds to human-readable format with appropriate precision
 * based on the duration (ms for short times, seconds for longer).
 *
 * @param milliseconds - Time in milliseconds
 * @returns Formatted time string
 */
export function formatElapsedTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format token usage for display
 *
 * Creates user-friendly display of token usage statistics including
 * input/output tokens, totals, and estimated costs.
 *
 * @param tokenUsage - Token usage statistics
 * @returns Formatted token usage strings
 */
export function formatTokenUsage(tokenUsage: {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly estimatedCost?: number;
}): readonly string[] {
  const lines = [
    `Input tokens: ${tokenUsage.inputTokens}`,
    `Output tokens: ${tokenUsage.outputTokens}`,
    `Total tokens: ${tokenUsage.totalTokens}`,
  ];

  if (tokenUsage.estimatedCost) {
    lines.push(`Estimated cost: $${tokenUsage.estimatedCost.toFixed(4)}`);
  }

  return lines;
}
