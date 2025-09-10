/**
 * Workflow Orchestration Utilities
 *
 * Coordinates command execution workflow, manages state transitions, and orchestrates
 * interactions between different CLI utilities for complex command operations.
 *
 * @module cli/utilities/workflow-orchestrator
 */

import type { Options, Result } from '../../types/pipeline.js';
import type { ProviderAdapter } from '../../types/provider.js';
import type {
  ConfigValidationResult,
  SchemaLoadResult,
} from './config-validator.js';
import type { FileProcessorResult } from './file-processor.js';
import type { ProgressReporter, ProgressStep } from './progress-reporter.js';

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /** Command-specific options */
  readonly options: Record<string, unknown>;
  /** Progress reporter for the workflow */
  readonly progressReporter: ProgressReporter;
  /** Whether verbose logging is enabled */
  readonly verbose: boolean;
  /** Start time of the workflow */
  readonly startTime: number;
}

/**
 * Workflow step result
 */
export interface WorkflowStepResult<T = unknown> {
  /** Whether step completed successfully */
  readonly success: boolean;
  /** Step result data */
  readonly data?: T;
  /** Error if step failed */
  readonly error?: Error;
  /** Step execution time in milliseconds */
  readonly executionTime: number;
  /** Any warnings generated during step */
  readonly warnings: readonly string[];
}

/**
 * Complete workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Whether entire workflow succeeded */
  readonly success: boolean;
  /** Pipeline execution result if successful */
  readonly pipelineResult?: Result<unknown>;
  /** Schema loading result */
  readonly schemaResult?: SchemaLoadResult;
  /** Input processing result */
  readonly inputResult?: FileProcessorResult;
  /** Configuration validation result */
  readonly configResult?: ConfigValidationResult;
  /** Final error if workflow failed */
  readonly error?: Error;
  /** Total workflow execution time */
  readonly totalExecutionTime: number;
  /** Individual step results */
  readonly stepResults: Record<string, WorkflowStepResult>;
}

/**
 * Workflow orchestrator for CLI commands
 *
 * Manages the complete execution workflow for CLI commands including state
 * transitions, error handling, progress reporting, and result aggregation.
 */
export class WorkflowOrchestrator {
  private _context: WorkflowContext;
  private _stepResults: Record<string, WorkflowStepResult> = {};

  constructor(_context: WorkflowContext) {
    this._context = _context;
  }

  /**
   * Execute schema loading workflow step
   *
   * Orchestrates schema file loading with progress reporting and error handling.
   * Validates schema format and exports before proceeding.
   *
   * @param schemaPath - Path to schema file
   * @returns Promise resolving to schema loading result
   */
  async executeSchemaLoading(
    schemaPath: string
  ): Promise<WorkflowStepResult<SchemaLoadResult>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('schema-loading');

      const { loadAndValidateSchema } = await import('./config-validator.js');
      const result = await loadAndValidateSchema(schemaPath, {
        verbose: this._context.verbose,
      });

      this._context.progressReporter.completeStep(
        `Schema loaded: ${result.schemaName}`
      );

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<SchemaLoadResult> = {
        success: true,
        data: result,
        executionTime,
        warnings,
      };

      this._stepResults['schema-loading'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<SchemaLoadResult> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['schema-loading'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute input processing workflow step
   *
   * Orchestrates input file processing with glob pattern resolution, file validation,
   * and data extraction with comprehensive progress reporting.
   *
   * @param inputPattern - Input file pattern or path
   * @returns Promise resolving to input processing result
   */
  async executeInputProcessing(
    inputPattern: string
  ): Promise<WorkflowStepResult<FileProcessorResult>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('input-processing');

      const { processInputFiles } = await import('./file-processor.js');
      const result = await processInputFiles(inputPattern, {
        verbose: this._context.verbose,
      });

      this._context.progressReporter.completeStep(
        `Found ${result.data.length} input items from ${result.fileCount} file(s)`
      );

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<FileProcessorResult> = {
        success: true,
        data: result,
        executionTime,
        warnings,
      };

      this._stepResults['input-processing'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<FileProcessorResult> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['input-processing'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute configuration validation workflow step
   *
   * Orchestrates CLI option validation and pipeline configuration assembly
   * with detailed validation reporting and suggestion generation.
   *
   * @param rawOptions - Raw CLI options to validate
   * @param schema - Loaded schema for validation context
   * @param inputData - Processed input data
   * @returns Promise resolving to configuration validation result
   */
  async executeConfigValidation(
    rawOptions: Record<string, unknown>,
    schema: SchemaLoadResult,
    _inputData: FileProcessorResult
  ): Promise<WorkflowStepResult<ConfigValidationResult>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('config-validation');

      const { validatePipelineConfig } = await import('./config-validator.js');
      const result = await validatePipelineConfig(rawOptions, schema.schema);

      if (!result.valid) {
        throw new Error(
          `Configuration validation failed: ${result.errors.join(', ')}`
        );
      }

      this._context.progressReporter.completeStep('Configuration validated');

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<ConfigValidationResult> = {
        success: true,
        data: result,
        executionTime,
        warnings: warnings.concat(result.warnings),
      };

      this._stepResults['config-validation'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<ConfigValidationResult> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['config-validation'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute provider initialization workflow step
   *
   * Orchestrates LLM provider initialization with health checks and
   * authentication validation.
   *
   * @param providerName - Name of provider to initialize
   * @returns Promise resolving to initialized provider
   */
  async executeProviderInitialization(
    _providerName: string
  ): Promise<WorkflowStepResult<ProviderAdapter>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('provider-init');

      // For now, default to Claude CLI adapter
      const { createClaudeCLIAdapter } = await import(
        '../../adapters/claude-cli.js'
      );
      const provider = createClaudeCLIAdapter();

      // Check provider health
      const health = await provider.getHealth?.();
      if (!health || !health.healthy) {
        throw new Error(
          `Provider health check failed: ${health?.error || 'Unknown error'}`
        );
      }

      this._context.progressReporter.completeStep('LLM provider ready');

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<ProviderAdapter> = {
        success: true,
        data: provider,
        executionTime,
        warnings,
      };

      this._stepResults['provider-init'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<ProviderAdapter> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['provider-init'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute pipeline workflow step
   *
   * Orchestrates the main pipeline execution with retry logic, progress updates,
   * and detailed result tracking.
   *
   * @param options - Validated pipeline options
   * @param provider - Initialized provider
   * @returns Promise resolving to pipeline execution result
   */
  async executePipeline(
    options: Options<unknown>,
    provider: ProviderAdapter
  ): Promise<WorkflowStepResult<Result<unknown>>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('pipeline-execution');

      if (this._context.verbose) {
        this._context.progressReporter.pauseSpinner();
        const { consola } = await import('consola');
        const chalk = await import('chalk');
        consola.info(chalk.default.blue('🔄 Processing data through LLM...'));
      }

      const { persuade } = await import('../../core/runner.js');
      const result = await persuade(options, provider);

      if (result.ok) {
        this._context.progressReporter.completeStep(
          'Pipeline completed successfully'
        );
      } else {
        this._context.progressReporter.failStep(
          new Error(result.error?.message || 'Pipeline execution failed')
        );
      }

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<Result<unknown>> = {
        success: result.ok,
        data: result,
        executionTime,
        warnings,
      };

      this._stepResults['pipeline-execution'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<Result<unknown>> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['pipeline-execution'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute result saving workflow step
   *
   * Orchestrates result serialization and file output with format validation
   * and directory creation as needed.
   *
   * @param result - Pipeline result to save
   * @param outputPath - Path to save results
   * @returns Promise resolving to save operation result
   */
  async executeResultSaving(
    result: Result<unknown>,
    outputPath: string
  ): Promise<WorkflowStepResult<void>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      await this._context.progressReporter.startStep('result-saving');

      // Prepare output data
      const outputData = {
        success: result.ok,
        data: result.value,
        metadata: {
          attempts: result.attempts,
          ...(result.sessionId && { sessionId: result.sessionId }),
          executionTimeMs: result.metadata.executionTimeMs,
          startedAt: result.metadata.startedAt,
          completedAt: result.metadata.completedAt,
          provider: result.metadata.provider,
          ...(result.metadata.model && { model: result.metadata.model }),
          ...(result.metadata.tokenUsage && {
            tokenUsage: result.metadata.tokenUsage,
          }),
        },
        ...(result.ok
          ? {}
          : {
              error: {
                type: result.error?.type,
                message: result.error?.message,
                code: (result.error as { code?: string })?.code,
                retryable: (result.error as { retryable?: boolean })?.retryable,
              },
            }),
      };

      const { writeOutput } = await import('../../utils/file-io.js');
      await writeOutput(outputData, outputPath, {
        pretty: true,
        createDir: true,
      });

      this._context.progressReporter.completeStep(
        `Results saved to: ${outputPath}`
      );

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<void> = {
        success: true,
        executionTime,
        warnings,
      };

      this._stepResults['result-saving'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));
      this._context.progressReporter.failStep(errorObj);

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<void> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['result-saving'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Execute dry-run workflow
   *
   * Orchestrates validation-only workflow without pipeline execution,
   * providing comprehensive reporting of what would be processed.
   *
   * @param options - CLI options for dry-run
   * @returns Promise resolving to dry-run result
   */
  async executeDryRun(
    options: Record<string, unknown>
  ): Promise<WorkflowStepResult<void>> {
    const stepStart = Date.now();
    const warnings: string[] = [];

    try {
      const { reportDryRunSummary } = await import('./progress-reporter.js');

      // Get schema and input results from previous steps
      const schemaResult = this._stepResults['schema-loading']?.data as
        | SchemaLoadResult
        | undefined;
      const inputResult = this._stepResults['input-processing']?.data as
        | FileProcessorResult
        | undefined;

      if (!schemaResult || !inputResult) {
        throw new Error(
          'Dry run requires completed schema loading and input processing steps'
        );
      }

      const dryRunConfig = {
        schemaName: schemaResult.schemaName,
        schemaPath: schemaResult.filePath,
        retries: parseInt(String(options.retries || '3'), 10),
      };

      if (options.model) {
        (dryRunConfig as { model?: string }).model = options.model as string;
      }
      if (options.sessionId) {
        (dryRunConfig as { sessionId?: string }).sessionId = options.sessionId as string;
      }

      reportDryRunSummary(
        dryRunConfig,
        {
          fileCount: inputResult.fileCount,
          itemCount: inputResult.data.length,
        },
        options.output as string
      );

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<void> = {
        success: true,
        executionTime,
        warnings,
      };

      this._stepResults['dry-run'] = stepResult;
      return stepResult;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      const executionTime = Date.now() - stepStart;
      const stepResult: WorkflowStepResult<void> = {
        success: false,
        error: errorObj,
        executionTime,
        warnings,
      };

      this._stepResults['dry-run'] = stepResult;
      return stepResult;
    }
  }

  /**
   * Get workflow execution summary
   *
   * Aggregates results from all executed workflow steps and generates
   * comprehensive execution summary with timing and performance metrics.
   *
   * @returns Complete workflow execution result
   */
  getExecutionSummary(): WorkflowExecutionResult {
    const totalExecutionTime = Date.now() - this._context.startTime;
    const hasFailures = Object.values(this._stepResults).some(
      result => !result.success
    );

    const pipelineResult = this._stepResults['pipeline-execution']?.data as
      | Result<unknown>
      | undefined;
    const schemaResult = this._stepResults['schema-loading']?.data as
      | SchemaLoadResult
      | undefined;
    const inputResult = this._stepResults['input-processing']?.data as
      | FileProcessorResult
      | undefined;
    const configResult = this._stepResults['config-validation']?.data as
      | ConfigValidationResult
      | undefined;
    const error = hasFailures
      ? Object.values(this._stepResults).find(result => result.error)?.error
      : undefined;

    const summary: WorkflowExecutionResult = {
      success: !hasFailures,
      totalExecutionTime,
      stepResults: this._stepResults,
      ...(pipelineResult && { pipelineResult }),
      ...(schemaResult && { schemaResult }),
      ...(inputResult && { inputResult }),
      ...(configResult && { configResult }),
      ...(error && { error }),
    };

    return summary;
  }
}

/**
 * Execute complete run command workflow
 *
 * High-level orchestration function that manages the complete execution workflow
 * for the run command including all phases from validation to result output.
 *
 * @param options - Run command options
 * @returns Promise resolving to workflow execution result
 */
export async function executeRunWorkflow(
  options: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const { createDefaultProgressSteps } = await import('./progress-reporter.js');
  const progressSteps = createDefaultProgressSteps();
  const context = await createWorkflowContext(options, progressSteps);
  const orchestrator = new WorkflowOrchestrator(context);

  try {
    // Execute schema loading
    const schemaResult = await orchestrator.executeSchemaLoading(
      options.schema as string
    );
    if (!schemaResult.success) {
      return orchestrator.getExecutionSummary();
    }

    // Execute input processing
    const inputResult = await orchestrator.executeInputProcessing(
      options.input as string
    );
    if (!inputResult.success) {
      return orchestrator.getExecutionSummary();
    }

    // Execute configuration validation
    if (!schemaResult.data || !inputResult.data) {
      throw new Error('Schema or input result is missing required data');
    }
    const configResult = await orchestrator.executeConfigValidation(
      options,
      schemaResult.data,
      inputResult.data
    );
    if (!configResult.success) {
      return orchestrator.getExecutionSummary();
    }

    // Handle dry-run mode
    if (options.dryRun) {
      await orchestrator.executeDryRun(options);
      return orchestrator.getExecutionSummary();
    }

    // Execute provider initialization
    const providerResult =
      await orchestrator.executeProviderInitialization('claude-cli');
    if (!providerResult.success) {
      return orchestrator.getExecutionSummary();
    }

    // Execute pipeline
    if (!configResult.data?.config || !providerResult.data) {
      throw new Error('Config or provider result is missing required data');
    }
    const pipelineResult = await orchestrator.executePipeline(
      configResult.data.config,
      providerResult.data
    );

    // Execute result saving (save both successful and failed results)
    if (pipelineResult.data) {
      await orchestrator.executeResultSaving(
        pipelineResult.data,
        options.output as string
      );
      // Continue execution even if save fails to ensure we return the summary
    }

    // Return workflow summary regardless of pipeline success/failure
    // The summary will indicate the overall workflow status

    return orchestrator.getExecutionSummary();
  } catch (error) {
    // Handle any unexpected errors
    const errorObj = error instanceof Error ? error : new Error(String(error));
    context.progressReporter.stop();

    return {
      success: false,
      error: errorObj,
      totalExecutionTime: Date.now() - context.startTime,
      stepResults: orchestrator.getExecutionSummary().stepResults,
    };
  }
}

/**
 * Create workflow context from CLI options
 *
 * Initializes workflow context including progress reporting, logging configuration,
 * and execution tracking for command orchestration.
 *
 * @param options - CLI options to use for context
 * @param steps - Progress steps for the workflow
 * @returns Initialized workflow context
 */
export async function createWorkflowContext(
  options: Record<string, unknown>,
  steps: readonly ProgressStep[]
): Promise<WorkflowContext> {
  // Import ProgressReporter dynamically
  const { ProgressReporter } = await import('./progress-reporter.js');

  return {
    options,
    progressReporter: new ProgressReporter(steps),
    verbose: Boolean(options.verbose),
    startTime: Date.now(),
  };
}

/**
 * Validate workflow prerequisites
 *
 * Checks that all required dependencies and conditions are met before
 * starting workflow execution including provider availability and file access.
 *
 * @param options - CLI options to validate
 * @returns Array of validation errors, empty if valid
 */
export function validateWorkflowPrerequisites(
  options: Record<string, unknown>
): readonly string[] {
  const errors: string[] = [];

  // Check required options
  if (!options.schema) {
    errors.push('Schema path is required (--schema)');
  }

  if (!options.input) {
    errors.push('Input path is required (--input)');
  }

  if (!options.output) {
    errors.push('Output path is required (--output)');
  }

  // Check retries is a valid number
  if (options.retries !== undefined) {
    const retries = parseInt(String(options.retries), 10);
    if (Number.isNaN(retries) || retries < 0) {
      errors.push('Retries must be a non-negative number');
    }
  }

  return errors;
}
