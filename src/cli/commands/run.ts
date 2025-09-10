/**
 * Run Command Implementation
 *
 * Implements the `persuader run` command using modular utilities for clean
 * orchestration. This file serves as the main entry point that coordinates
 * workflow execution through extracted utility modules.
 */

import chalk from 'chalk';
import { consola } from 'consola';
import {
  type ErrorContext,
  handleCLIError,
} from '../utilities/error-handler.js';
import {
  type ExecutionMetrics,
  reportExecutionMetrics,
} from '../utilities/progress-reporter.js';
import { executeRunWorkflow } from '../utilities/workflow-orchestrator.js';

/**
 * CLI run command options interface
 */
export interface RunOptions {
  schema: string;
  input: string;
  output: string;
  sessionId?: string;
  context?: string;
  lens?: string;
  retries: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Main run command handler
 *
 * Orchestrates the complete pipeline execution using modular utilities.
 * Maintains backward compatibility while providing clean separation of concerns.
 */
export async function runCommand(options: RunOptions): Promise<void> {
  const startTime = Date.now();

  try {
    // Configure logging based on verbose flag
    configureLogging(options.verbose);

    consola.info(chalk.green('Starting Persuader pipeline...'));

    // Execute the complete workflow using orchestrator
    const result = await executeRunWorkflow(
      options as unknown as Record<string, unknown>
    );

    if (!result.success && result.error) {
      handleWorkflowFailure(result.error, options, startTime);
      return;
    }

    // Report success metrics
    if (result.pipelineResult && !options.dryRun) {
      reportSuccess(result.pipelineResult, startTime, options);
    } else if (options.dryRun) {
      const elapsed = Date.now() - startTime;
      consola.success(chalk.green(`🎉 Dry run completed in ${elapsed}ms`));
    }
  } catch (error) {
    const context: ErrorContext = {
      operation: 'run-command',
      verbose: options.verbose || false,
    };

    // Handle error without progress reporter
    handleCLIError(error, undefined, context);
  }
}

/**
 * Configure logging level based on verbose flag
 */
function configureLogging(verbose = false): void {
  if (verbose) {
    consola.level = 4; // Debug level
    consola.info(chalk.blue('🔧 Verbose mode enabled'));
  } else {
    consola.level = 3; // Info level
  }
}

/**
 * Handle workflow execution failure
 */
function handleWorkflowFailure(
  error: Error,
  options: RunOptions,
  startTime: number
): void {
  consola.error(chalk.red(`❌ Workflow failed: ${error.message}`));

  if (options.verbose) {
    consola.debug('Workflow error details:', error);
  }

  const elapsed = Date.now() - startTime;
  consola.info(chalk.blue(`Total time: ${elapsed}ms`));

  process.exit(1);
}

/**
 * Report successful pipeline execution with metrics
 */
function reportSuccess(
  result: {
    ok: boolean;
    attempts: number;
    sessionId?: string;
    metadata: {
      executionTimeMs: number;
      provider: string;
      model?: string;
      tokenUsage?: unknown;
    };
  },
  startTime: number,
  options: RunOptions
): void {
  const elapsed = Date.now() - startTime;
  const metrics: ExecutionMetrics = {
    totalTimeMs: elapsed,
    llmTimeMs: result.metadata.executionTimeMs,
    attempts: result.attempts,
    provider: result.metadata.provider,
  };

  if (result.metadata.model) {
    (metrics as { model?: string }).model = result.metadata.model;
  }
  if (result.sessionId) {
    (metrics as { sessionId?: string }).sessionId = result.sessionId;
  }
  if (result.metadata.tokenUsage) {
    (metrics as { tokenUsage?: ExecutionMetrics['tokenUsage'] }).tokenUsage = result.metadata.tokenUsage as ExecutionMetrics['tokenUsage'];
  }

  reportExecutionMetrics(metrics, options.verbose);
}
