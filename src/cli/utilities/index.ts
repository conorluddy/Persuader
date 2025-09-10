/**
 * CLI Utilities Module
 *
 * Centralized exports for all CLI utility modules providing reusable functionality
 * for command implementation, error handling, progress reporting, and workflow orchestration.
 *
 * @module cli/utilities
 */

import {
  loadAndValidateSchema,
  validatePipelineConfig,
} from './config-validator.js';
import { handleCLIError } from './error-handler.js';
import { processInputFiles, validateInputFile } from './file-processor.js';
// Internal imports for context function
import {
  createDefaultProgressSteps,
  ProgressReporter,
} from './progress-reporter.js';
import { WorkflowOrchestrator } from './workflow-orchestrator.js';

// Configuration Validation Utilities
export {
  type ConfigValidationResult,
  generateConfigSummary,
  loadAndValidateSchema,
  type OptionValidationError,
  type SchemaLoadResult,
  suggestConfigurationFixes,
  validateOptionValue,
  validatePipelineConfig,
} from './config-validator.js';
// Error Handling Utilities
export {
  analyzeErrorRecoverability,
  type CLIError,
  convertFileError,
  convertPipelineError,
  convertProviderError,
  convertValidationError,
  ERROR_TEMPLATES,
  type ErrorContext,
  type ErrorSeverity,
  EXIT_CODES,
  formatErrorForDisplay,
  generateRecoverySuggestions,
  handleCLIError,
} from './error-handler.js';
// File Processing Utilities
export {
  calculateFileProcessingStats,
  type FileProcessorOptions,
  type FileProcessorResult,
  type FileValidationResult,
  formatFileProcessingError,
  processInputFiles,
  validateInputFile,
} from './file-processor.js';
// Progress Reporting Utilities
export {
  createDefaultProgressSteps,
  type ExecutionMetrics,
  formatElapsedTime,
  formatTokenUsage,
  ProgressReporter,
  type ProgressState,
  type ProgressStep,
  reportDryRunSummary,
  reportExecutionMetrics,
} from './progress-reporter.js';

// Workflow Orchestration Utilities
export {
  createWorkflowContext,
  executeRunWorkflow,
  validateWorkflowPrerequisites,
  type WorkflowContext,
  type WorkflowExecutionResult,
  WorkflowOrchestrator,
  type WorkflowStepResult,
} from './workflow-orchestrator.js';

/**
 * Complete CLI utilities context
 */
export interface CLIUtilitiesContext {
  /** Progress reporter instance */
  readonly progressReporter: ProgressReporter;
  /** Error handling context */
  readonly errorHandler: {
    readonly verbose: boolean;
    readonly dryRun: boolean;
    readonly handle: typeof handleCLIError;
  };
  /** Workflow orchestrator factory */
  readonly createWorkflowOrchestrator: typeof WorkflowOrchestrator;
  /** File processing utilities */
  readonly fileProcessor: {
    readonly process: typeof processInputFiles;
    readonly validate: typeof validateInputFile;
  };
  /** Configuration validation utilities */
  readonly configValidator: {
    readonly validate: typeof validatePipelineConfig;
    readonly loadSchema: typeof loadAndValidateSchema;
  };
}

/**
 * Utility function to create a complete CLI utilities context
 *
 * Convenience function that initializes all necessary utilities for a command
 * including progress reporting, error handling, and workflow orchestration.
 *
 * @param options - Command options
 * @returns Initialized utilities context
 */
export async function createCLIUtilitiesContext(options: {
  readonly verbose?: boolean;
  readonly dryRun?: boolean;
}): Promise<CLIUtilitiesContext> {
  const steps = createDefaultProgressSteps();
  const progressReporter = new ProgressReporter(steps);

  return {
    progressReporter,
    errorHandler: {
      verbose: Boolean(options.verbose),
      dryRun: Boolean(options.dryRun),
      handle: handleCLIError,
    },
    createWorkflowOrchestrator: WorkflowOrchestrator,
    fileProcessor: {
      process: processInputFiles,
      validate: validateInputFile,
    },
    configValidator: {
      validate: validatePipelineConfig,
      loadSchema: loadAndValidateSchema,
    },
  };
}
